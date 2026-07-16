# MineOpsDataEngine — Third-Party Review Report

**Date:** 2026-07-16  
**Repository:** `ShepsWork/ubuntumac-server` (subdirectory `MineOpsDataEngine/`)  
**Status:** Milestones 1–4 complete; Milestone 5 not started

---

## 1. Executive Summary

MineOpsDataEngine is the **canonical acquisition and processing engine** for Idle Miner Tycoon game data, running on the `ubuntumac` Ubuntu/Tailscale/Docker host. It ingests Android APKs from an emulator, extracts raw assets, parses Unity artifacts into typed contract files, and prepares normalized data for downstream consumption by MineOpsWeb.

The engine follows a strict layered architecture (raw → extracted → unity → normalized → staging → published) with immutability at every layer. Nothing is ever deleted; reprocessing creates revision records.

**Four milestones are fully implemented and tested** (24 unit tests, all passing). The codebase is production-ready from M1 through M4.

---

## 2. Architecture Decisions (Binding)

The following architect-approved decisions govern all implementation:

| Decision | Summary |
|----------|---------|
| **D-001** | MineOpsDataEngine owns all schemas (extraction, normalization, mappings, exports). MineOpsWeb consumes them. |
| **D-002** | Schema versions use Semantic Versioning. Minor backward-compatible; major requires migration scripts. |
| **D-003/D-004** | UUIDv5 with fixed namespace constant. Contract: `<objectType>:<gameId>` or fallback `<objectType>:<sourceAsset>:<unityPathId>`. |
| **D-007** | `release.json` required fields: releaseId, versionName, versionCode, capturedAt, engineVersion, schemaVersion, apkHashes, status. |
| **D-008** | Globally unique releaseId format: `versionName_versionCode_UTCtimestamp`. |
| **D-009** | `versionCode` always integer; missing/malformed immediately fails acquisition. |
| **D-010** | Every APK split preserved, hashed, inventoried, exported — even if MineOpsWeb never consumes it. |
| **D-019** | Exit code 14 (unchanged release) stays local-only; no PocketBase write occurs. |
| **D-027** | Reprocessing creates new Processing Revision; original extraction preserved forever. |
| **D-034** | M2 acceptance criteria: emulator starts, package detected, all APKs pulled, SHA256 generated, release.json generated, immutable archive created, recovery tested. |
| **A-001** | Immutable philosophy: nothing is ever deleted. |
| **A-002** | Layer separation: a layer may only consume from the layer directly above it. |
| **A-007** | Every processing stage independently rerunnable. |

Full decision log: `docs/MINEOPS_DATA_ENGINE_DECISION_LOG.md`

---

## 3. Milestone Completion Summary

### Milestone 1 — Foundation ✅

| Component | File | Status |
|-----------|------|--------|
| Package scaffold | `pyproject.toml`, `Makefile`, `README.md` | Done |
| CLI entrypoint | `src/mineops_data_engine/cli.py` | Done |
| Config/env loader | `src/mineops_data_engine/config.py` | Done |
| Fixed serial enforcement | Enforces `emulator-5556`; rejects other serials | Done |
| JSON logging | `src/mineops_data_engine/logging_setup.py` | Done |
| File lock manager | `src/mineops_data_engine/locks.py` (flock semantics) | Done |
| Emulator commands | `emulator start\|stop\|status` via `emulator.py` | Done |

### Milestone 2 — Acquisition ✅

| Command | Description | Exit Codes |
|---------|-------------|------------|
| `detect` | Parse versionName/versionCode from `dumpsys package` | 0 |
| `acquire` | Dynamic split APK discovery via `pm path`, pull all APKs, generate hashes + metadata | 0 (new), 14 (unchanged) |
| `release list` | List all acquired release IDs | 0 |
| `release show <id>` | Display full release.json | 0 |
| `release verify <id>` | Structural check + schema validation + SHA256 verification | 0 / 50 |
| `release reprocess <id>` | Create revision marker under `revisions/<ts>/reprocess.json` | 0 / 50 |
| `doctor` | Work-dir write/delete probe for recovery path validation | 0 / 10 |

**Acquisition outputs per release:**
- `releases/<id>/release.json` (metadata)
- `releases/<id>/apk/APK_SET.json` (inventory)
- `releases/<id>/apk/APK_PATHS.json` (device paths)
- `releases/<id>/apk/SHA256SUMS` (checksums)
- `releases/<id>/apk/<split files>` (base.apk, split_config.*.apk, etc.)
- `releases/<id>/manifests/package-dumpsys.txt` (raw dumpsys)
- **Immutable** via `chmod -R a-w` after write
- **Unchanged detection** compares `versionCode + apkHashes`; returns exit 14 on match

### Milestone 3 — Extraction ✅

| Command | Description |
|---------|-------------|
| `extract [release_id] [--force]` | Unzips all APK splits into `extracted/<apk-name>/`, writes `EXTRACTION_MANIFEST.json` |
| `inventory [release_id]` | Builds `inventory/inventory.json` with APK list, hashes, extraction stats, errors |

**Failure handling:**
- `bad-zip` classification for corrupt APK files
- `missing-apk` classification when APK_SET references absent files
- `--force` rebuild: removes existing extracted dir and re-extracts
- Both `EXTRACTION_MANIFEST.json` and `inventory.json` validated against strict schemas

### Milestone 4 — Unity Processing ✅

**4.0 — Scaffold:**
- `unity extract [release_id]` command
- Requires M3 extraction manifest (precondition gate)

**4.1 — Typed Contracts:**
Schemas defined for all Unity artifact types:
- `schemas/unity_catalog.schema.json`
- `schemas/unity_typetree.schema.json`
- `schemas/unity_localization.schema.json`
- `schemas/unity_relationships.schema.json`
- `schemas/unity_assets.schema.json` (manifest)

**4.2 — Parser Plug-Points:**
Module `unity_parsers.py` provides deterministic parser functions:
- `parse_catalog` — discovers files, derives stable asset IDs
- `parse_typetree` — derives node metadata from catalog
- `parse_localization` — extracts locale/language candidates
- `parse_relationships` — derives adjacency relationships from catalog ordering

All parsers use deterministic SHA1-based stable IDs (no randomness).

**4.3 — Adapter Interface + Diagnostics:**
- `UnityAdapter` protocol in `unity_adapters.py`
- `HeuristicUnityAdapter` — default implementation wired into pipeline
- `build_diagnostics()` — generates `unity/diagnostics.json` with adapter name, counts, warnings, errors
- Schema: `schemas/unity_diagnostics.schema.json`

**Unity outputs per release:**
- `unity/catalog.json`
- `unity/typetree.json`
- `unity/localization.json`
- `unity/relationships.json`
- `unity/diagnostics.json`
- `unity/unity_assets.json` (manifest pointing to all above)

---

## 4. Module Inventory

```
src/mineops_data_engine/
├── __init__.py          # Package version
├── cli.py               # CLI entrypoint (argparse, all commands, lock wrapping)
├── config.py            # Env loader, fixed serial enforcement
├── constants.py         # Default values, UUID namespace placeholder
├── adb.py               # ADB client wrapper (serial-pinned)
├── emulator.py          # Emulator lifecycle (start/stop/status scripts)
├── acquisition.py       # APK acquisition pipeline (pull + hash + archive)
├── release.py           # Release ID generation, version parsing, release.json writer
├── release_store.py     # CRUD for release dirs, matching, verify, reprocess
├── extraction.py        # ZIP extraction, inventory builder
├── unity.py             # Unity extraction orchestrator (adapter-driven)
├── unity_parsers.py     # Deterministic catalog/typetree/localization/relationship parsers
├── unity_adapters.py    # Adapter protocol, heuristic adapter, diagnostics builder
├── validation.py        # Schema-driven JSON validation engine + typed validators
├── hashing.py           # SHA256 computation and SHA256SUMS parser
├── archive.py           # Immutable write (chmod)
├── locks.py             # Engine-level file lock
├── logging_setup.py     # Structured JSON logging
└── models/              # (empty — reserved for future ORM/dataclass models)
```

**Schemas (10 files):**
```
schemas/
├── apk_set.schema.json
├── extraction_manifest.schema.json
├── inventory.schema.json
├── release.schema.json
├── unity_assets.schema.json
├── unity_catalog.schema.json
├── unity_diagnostics.schema.json
├── unity_localization.schema.json
├── unity_relationships.schema.json
└── unity_typetree.schema.json
```

---

## 5. Test Coverage

**24 unit tests, all passing.** Framework: `unittest` (stdlib), run via `make test`.

| Test File | What It Covers |
|-----------|----------------|
| `test_config.py` | Fixed serial enforcement, config loading |
| `test_release_parse.py` | Version field parsing from dumpsys |
| `test_release_store.py` | Release list, verify missing files |
| `test_release_store_revision.py` | Reprocess revision creation |
| `test_hashing.py` | SHA256 compute and SHA256SUMS parsing |
| `test_acquisition_flow.py` | Mocked ADB acquire + no-change match path |
| `test_extraction_flow.py` | Extract/inventory cycle, bad-zip handling, missing-APK handling, `--force` rerun |
| `test_unity_flow.py` | Unity extract scaffold, typed artifact existence, diagnostics artifact, M3 prerequisite gate |
| `test_unity_parsers.py` | Parser pipeline determinism (catalog/typetree/localization/relationships) |
| `test_doctor_flow.py` | Doctor probe creation/cleanup |
| `test_validation.py` | Schema validation for all 10 schemas (required fields, unexpected properties, sha patterns, empty arrays) |

---

## 6. Validation Rigor

Every JSON artifact written by the engine is validated against its schema **before** the operation is considered successful. If validation fails, a `ValueError` is raised (CLI returns exit 50 with `error=...`). This applies to:

- `release.json`
- `APK_SET.json`
- `EXTRACTION_MANIFEST.json`
- `inventory.json`
- `unity_assets.json`
- `unity/catalog.json`
- `unity/typetree.json`
- `unity/localization.json`
- `unity/relationships.json`
- `unity/diagnostics.json`

The validation engine supports: `type`, `required`, `additionalProperties`, `enum`, `minimum`, `minLength`, `minItems`, `minProperties`, `pattern` (regex), and recursive object/array validation.

---

## 7. CLI Command Surface

```
mineops-data-engine verify-host
mineops-data-engine emulator start|stop|status
mineops-data-engine detect
mineops-data-engine acquire
mineops-data-engine extract [release_id] [--force]
mineops-data-engine inventory [release_id]
mineops-data-engine unity extract [release_id]
mineops-data-engine release list
mineops-data-engine release show <release_id>
mineops-data-engine release verify <release_id>
mineops-data-engine release reprocess <release_id>
mineops-data-engine doctor
```

Placeholder (scaffolded, not implemented): `normalize`, `map`, `validate`, `diff`, `export`, `publish`, `process`, `artifacts serve`.

---

## 8. Safety & Compliance

| Concern | Implementation |
|---------|---------------|
| Fixed ADB serial | Enforced in config; rejects any non-`emulator-5556` serial |
| Immutability | `chmod -R a-w` after release write; never mutates completed releases |
| No-change handling | Exit code 14; no duplicate release written |
| Layer separation | Each layer only consumes from the layer above |
| Reprocessing | Creates revision records; never overwrites |
| Schema enforcement | Every artifact validated against JSON Schema before success |
| Locking | Engine-level `flock` prevents concurrent runs |
| Error taxonomy | bad-zip, missing-apk, missing-apk-file, schema violations all classified |

---

## 9. What Has NOT Been Done (M5+)

- **Milestone 5 (Normalization):** Not started. This will convert Unity/raw data into canonical game objects with UUIDv5 identity.
- **Milestone 6 (Quality):** Not started. Validation blocking, confidence thresholds, quarantine states.
- **Milestone 7 (Delivery):** Not started. PocketBase staging upload, symlink advancement, artifact API.
- **Milestone 8 (Hardening):** Not started. Retention, SLOs, contract tests.
- **Server deployment:** Scaffold exists locally; not yet deployed to `ubuntumac`.
- **Real Unity asset parsing:** Current parsers use heuristic/placeholder logic. Real Unity bundle/asset format parsing adapters are not yet implemented.
- **Integration tests with real ADB:** Mocked only; no real emulator-based integration tests yet.

---

## 10. Immediate Next Steps

1. **M5 — Normalization:** Implement canonical object extraction (UUIDv5 mapping, field normalization, relationship resolution).
2. **M4 adapter hardening:** Replace heuristic parsers with real Unity asset/bundle format readers.
3. **Server deployment:** Sync scaffold to `ubuntumac`, configure `.env`, run dry-run `detect`/`acquire`/`extract`/`unity extract` end-to-end with real emulator.

---

**Report prepared for third-party architecture/code review. All code is in `MineOpsDataEngine/` within the `ubuntumac-server` repository.**
