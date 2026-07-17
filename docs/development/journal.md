# Development journal

## 2026-07-17 — Implement JSON evidence review, quarantine, and catalog review (Issue #5)

**Goal:** Review immutable JSON evidence and release summaries before a package can become active. Operates on the v2 package: manifest metadata, artifact verification, validation-report.json, changelog.json, mapping conflicts, unresolved IDs, object counts, and schema compatibility.

### Review evidence module (`shared/schemas/review-package.mjs`)

Created a shared review module that loads a v2 package and produces a structured review summary. Generated evidence remains in the immutable JSON package; PocketBase stores only the human decision and audit trail.

Review checks performed:
- **Artifact integrity:** All 7 artifacts verified (SHA-256 hash, byte size, file existence, schema compatibility). Missing required artifacts or hash mismatches are fatal.
- **Validation findings:** Parses `validation-report.json`, classifies each check as fatal or warning based on check code. Fatal codes: `SCHEMA_VALID`, `MANIFEST_CATALOG_CONSISTENCY`, `ARTIFACT_HASH_CONSISTENCY`, `MANIFEST_ARTIFACTS`, `DETERMINISTIC_SERIALIZATION`. Warning codes: `DUPLICATE_CANONICAL_ID`, `DUPLICATE_SOURCE_IDENTIFIER`, `MISSING_REQUIRED_FIELDS`, `UNRESOLVED_OBJECTS`, `INVALID_REFERENCES`, `SUSPICIOUS_CHANGE_DETECTION`.
- **Changelog review:** Flags suspiciously large manager changes (>50), unresolved objects, breaking entity removals.
- **Mapping conflicts:** Detects duplicate source identifiers, orphaned mappings (references to non-existent entities), and orphaned aliases.
- **Schema compatibility:** Checks manifest major version and every required artifact's schema version.
- **Object counts:** Summarizes entity counts from the manifest.

Recommendations: `approved` (no issues), `review_required` (warnings present), `quarantined` (fatal issues — cannot publish).

### PocketBase migration: `catalog_reviews` (1700000005)

New collection for human review decisions:
- `releaseId` — FK to `catalog_releases`
- `decision` — `approved` | `rejected` | `quarantined`
- `reviewedBy`, `reviewedAt`, `notes`
- `annotations` — JSON: specific annotations on findings
- `manualOverrides` — JSON: manual mapping overrides with reason
- `findingsSummary` — JSON: compact fatal/warning count summary
- `schemaCompat` — JSON: schema compatibility assessment
- `isLatest` — boolean for tracking most recent review per release

### PocketBase review hook (`pocketbase/pb_hooks/catalog-review.pb.js`)

Three routes for authenticated users:
- `POST /api/catalog/review/approve` — status: candidate|review_required → ready
- `POST /api/catalog/review/reject` — status: candidate|review_required → rejected
- `POST /api/catalog/review/quarantine` — status: candidate|review_required|ready → review_required

Each route:
1. Validates the release exists
2. Checks status transition validity
3. For approval, blocks if validation summary has fatal findings
4. Marks previous reviews as not latest
5. Creates a `catalog_reviews` record
6. Updates `catalog_releases.status` and appends to `auditLog`

### CLI review tool (`tools/validation/review-package.mjs`)

Command-line tool for reviewing a v2 package:
```bash
npm run review:catalog catalogs/example
npm run review:catalog catalogs/example -- --json
```

Produces a formatted review summary with artifact integrity, validation findings, changelog review, mapping conflicts, schema compatibility, object counts, and decision guidance. Exit code: 0=approved, 1=quarantined, 2=not reviewable.

### Contract tests (`tests/catalog-review.test.mjs`)

24 tests in 9 suites, all passing:
- **Valid package review (2):** Clean package → approved; example bundle → approved
- **Missing required artifacts (4):** No manifest, no validation-report, no catalog-core → not reviewable; missing optional → still reviewable
- **Hash failures (2):** Required artifact hash mismatch → quarantined; optional artifact hash mismatch → still passes integrity
- **Fatal validation findings (2):** Fatal checks + blocking issues → quarantined; warnings only → review_required
- **Unresolved mappings (4):** Duplicate source IDs, orphaned mappings, orphaned aliases, clean mappings
- **Schema compatibility (3):** Unsupported manifest major → not reviewable; unsupported artifact schema → incompatible; non-v2 manifest → not reviewable
- **Changelog review (3):** Suspicious changes flagged, first release exempt from suspicious threshold, unresolved objects flagged
- **Review decision guidance (3):** Clean → approved; fatal + hash → quarantined; warnings → review_required
- **Generated evidence immutability (1):** Review does not modify source artifact files

### Documentation

- Added `npm run review:catalog` and `npm run test:review` scripts
- Updated `tools/validation/README.md` with review tool documentation

### Verification

- ✅ All 24 review contract tests pass
- ✅ Review CLI produces correct output for example bundle (approved)
- ✅ Review CLI produces correct JSON output
- ✅ All 42 catalog package tests still pass
- ✅ All 11 frontend tests still pass
- ✅ All 39 capture-bridge contract tests still pass
- ✅ Review evidence is read-only — source artifacts are never modified

### Deferred
- PocketBase migrations not yet applied to Oracle instance
- Frontend review UI is deferred (separate issue)
- Review hook not yet tested end-to-end against live PocketBase

## 2026-07-17 — Post-review hardening for Issue #4 (7 architecture checks)

Addressed 7 final architecture checks from the Issue #4 review:

### Check 1 — Manifest does not hash itself ✅
Confirmed: the manifest describes 7 content artifacts and never lists itself. The manifest's SHA-256 is stored in the `catalog_publication` singleton (`manifestSha256` field), breaking the recursive dependency. Model:
```
catalog_publication → manifestSha256
manifest.json → artifacts[].sha256 (content artifacts only)
```

### Check 2 — Path traversal sanitization ✅
Hardened `isSafeRelativePath()` in the validator to reject:
- Absolute paths (`/etc/passwd`)
- Windows drive letters (`C:\...`)
- URL schemes (`http://...`, `file://...`)
- Backslashes (`\`)
- URL-encoded traversal sequences (`%2f`, `%2e%2e`, `%5c`)
- Double-encoded sequences (`%252f`, `%252e`)
- Encoded dot segments
- Paths > 255 characters

Also added `pattern` constraints on `path` and `filename` in the manifest JSON schema to enforce safe values at the schema level.

### Check 3 — Release identity and manifest hash immutability ✅
Documented immutable vs mutable fields in the `catalog_releases` migration and `catalogs/README.md`:
- **Immutable:** `releaseId`, `manifestSha256`, artifact hashes/paths, `catalogVersion`, game version info, `previousCatalogVersion`, `storageBaseUrl`
- **Mutable:** `status`, `reviewNotes`, `auditLog`, `reviewedBy`, `publishedAt`

### Check 4 — Separate active-pointer singleton ✅
Created `catalog_publication` collection (migration `1700000004`) with:
- `activeReleaseId` — points to the currently active release
- `previousReleaseId` — for rollback
- `manifestSha256` — manifest integrity verification
- `activatedAt`, `activatedBy`, `notes`

Removed `isActive` boolean from `catalog_releases`. The singleton model makes atomic publish/rollback simpler and prevents two releases from accidentally becoming active.

### Check 5 — Artifact schema compatibility policy ✅
Documented two-level compatibility check:
1. Manifest major version must be supported by the client
2. Every `required: true` artifact's schema major version must be supported
3. Optional artifacts with unsupported schemas → load with warning

### Check 6 — Required vs optional artifacts ✅
Added `required` boolean to every `artifactEntry` in the manifest schema and example:
- **Required:** `catalog-core.json`, `validation-report.json`
- **Optional:** `relationships.json`, `mappings.json`, `localization.json`, `assets.json`, `changelog.json`

Missing required artifact → reject package. Missing optional artifact → load with warning.

### Check 7 — Empty-file vs missing-file semantics ✅
Defined in documentation and schema:
- `recordCount: 0` → valid state meaning "no records of this type"
- Missing artifact file → "artifact not produced" (distinct from empty)
- These two states must not be silently treated as equivalent

### Verification
- ✅ All 42 contract tests pass (was 40; added `required` field check + path sanitization check)
- ✅ All 18 validation checks pass
- ✅ All 11 frontend tests pass
- ✅ All 31 capture-bridge contract tests pass
- ✅ Example manifest has no self-referencing hash entry
- ✅ `catalog_publication` migration holds `manifestSha256` (manifest hash: `3045d6e7...`)

## 2026-07-17 — Define versioned JSON catalog packages and PocketBase release-control records (Issue #4)

**Goal:** Adopt a JSON-first catalog data plane with PocketBase as the release control plane. Evolve from monolithic `catalog.json` to 8 separate, content-addressed package artifacts.

### Multi-artifact package contract (v2 manifest)

The catalog package now consists of 8 immutable, content-addressed artifacts:

| Artifact | Schema | Description |
|---|---|---|
| `manifest.json` | `catalog_manifest.schema.json` (v2) | Release descriptor with artifacts array, counts, storage pointer |
| `catalog-core.json` | `catalog_core.schema.json` | Core entities (managers, mines, equipment, research, collectibles, artifacts) |
| `relationships.json` | `relationships.schema.json` | Directed entity relationships |
| `mappings.json` | `mappings.schema.json` | Identity mappings + aliases |
| `localization.json` | `localization.schema.json` | Key-value localization table |
| `assets.json` | `assets.schema.json` | Asset reference index |
| `validation-report.json` | `catalog_validation.schema.json` | Deterministic validation checks (same schema as v1) |
| `changelog.json` | `changelog.schema.json` | Domain-level diff (replaces `diff.json`) |

### Manifest evolution

- `manifestSchemaVersion` bumped to `"2.0.0"` with a new `artifacts` array replacing the single `artifact` object.
- Each artifact entry includes: `filename`, `contentType`, `sha256`, `bytes`, `schemaVersion`, `recordCount`, `path`.
- Added `storage` section with `baseUrl` and optional `cdnUrl`.
- Removed `catalogSchemaVersion`, `diffPath`, `validationReportPath` (now covered by `artifacts` entries).

### New schemas created

- `shared/schemas/catalog_core.schema.json` — split from `normalized_catalog.schema.json` (entities only; relationships, mappings, localization moved to separate artifacts)
- `shared/schemas/relationships.schema.json` — directed relationships with `sourceId`/`targetId`/`kind`
- `shared/schemas/mappings.schema.json` — `idMappings` (source→canonical) + `aliases`
- `shared/schemas/localization.schema.json` — locale + key-value entries
- `shared/schemas/assets.schema.json` — asset reference index with type, path, dimensions
- `shared/schemas/changelog.schema.json` — structured changelog (replaces `catalog_diff.schema.json`)

All schemas use JSON Schema draft 2020-12 with `additionalProperties: false`.

### Example bundle updated

`catalogs/example/` now contains all 8 v2 artifacts plus the legacy v1 files for backward compatibility. All artifacts are in canonical JSON form (sorted keys, trailing newline). Status is `candidate`, zero game records, source kind `fixture`.

Legacy v1 files (`catalog-manifest.json`, `catalog.json`, `diff.json`) retained so both formats are testable.

### Validation tooling upgrade

`tools/validation/validate-catalog.mjs` rewritten to support dual-format detection:
- **v2:** Detects `manifest.json` with `manifestSchemaVersion: "2.0.0"` → validates all 8 artifacts against their schemas, checks all 7 artifact hashes, verifies deterministic serialization on every artifact.
- **v1:** Falls back to `catalog-manifest.json` with legacy checks (single artifact hash, single deterministic serialization check).

18 checks run on v2 bundles (8 schema + 8 integrity); all pass on the example bundle.

### PocketBase migration: `catalog_releases` collection

New migration `1700000003_catalog_releases.js` creates the `catalog_releases` collection for release-control-plane records:

- Fields: `releaseId` (unique), `catalogVersion`, `gameVersion`, `gameVersionCode`, `status` (select), `manifestRef`, `artifactCount`, `counts` (JSON), `validationSummary` (JSON), `previousCatalogVersion`, `storageBaseUrl`, `isActive`, `publishedAt`, `reviewedBy`, `reviewNotes` (JSON), `auditLog` (JSON)
- Indexes on `status`, `isActive`, `gameVersionCode`, and unique on `releaseId`
- Public read, auth-required write
- Stores only metadata needed to identify, govern, review, and publish; full catalog remains in JSON artifacts

### Contract tests

`tests/catalog-package.test.mjs` — 40 tests in 7 suites, all passing:

- **Deterministic serialization (6):** Stable key sorting, array preservation, round-trip stability, hash stability, key order invariance, trailing newline.
- **SHA-256 content addressing (4):** Format validation, idempotency, collision resistance, byte sensitivity.
- **Manifest artifact integrity (9):** Schema version, artifact count, required fields, disk existence, SHA-256 match, byte size match, status, storage section, previous version.
- **Example bundle fixture safety (8):** Zero game records in all artifacts, fixture source kind, no fabricated data.
- **Schema conformance (8):** All 8 artifacts validate against their schemas.
- **Manifest consistency (3):** catalogVersion, releaseId, and counts match catalog-core.
- **Canonical JSON round-trip stability (2):** All example artifacts are canonical, stability with nested arrays.

### Documentation

- `catalogs/README.md` — full rewrite covering v2 package contract, artifact table, manifest entry spec, PocketBase records, rules, compatibility/storage/rollback boundaries, and validation commands.
- Added `npm run test:catalog` script to root `package.json`.

### Verification

- ✅ All 18 validation checks pass on the v2 example bundle
- ✅ All 40 contract tests pass (`npm run test:catalog`)
- ✅ All 7 artifact hashes verified against actual file content
- ✅ Deterministic serialization confirmed for all artifacts
- ✅ Example bundle is fixture-safe (zero game records, no fabricated data)
- ✅ Backward compatibility: v1 legacy bundle still validates with the same tool
- ✅ No secrets, APK binaries, or raw extracted assets in fixtures

### Remaining / deferred

- PocketBase migration not yet applied to Oracle instance (requires `docker compose build pocketbase && docker compose up -d pocketbase` on oracle-vm)
- `catalog_releases` record creation not yet wired into the capture ingest hook
- Frontend catalog consumption from v2 packages is deferred (Issue #7)
- Active-pointer publication and rollback is deferred (Issue #6)
- Real APK data population is deferred (requires parser work)

## 2026-07-17 — Revised GitHub backlog for JSON-first catalog architecture

- Updated GitHub milestones 1–5 and issues #4–#12 to reflect the versioned JSON catalog data plane.
- PocketBase is now documented as the release control plane for provenance, validation summaries, review decisions, publication pointers, and audit history; it must not duplicate the full static catalog.
- Issue #4 now defines the immutable package contract and artifact manifest; #5 covers JSON evidence review; #6 covers active-pointer publication and rollback; #7 covers verified JSON retrieval and IndexedDB caching; #8 covers JSON mappings with audited PocketBase overrides.
- Issues #9–#12 were retained and clarified to record catalog interpretation metadata, consume the verified JSON client, and expose package verification state in More.
- No code or deployment state changed in this backlog/documentation update. The existing JSON schemas and validation scaffolding remain the implementation baseline.

## 2026-07-16 — Contract-test the capture envelope (Issue #1)

**Goal:** Make the capture-bridge CLI, PocketBase ingest hook, and release schema a single versioned contract with stable machine-readable error codes and fixture-based contract tests.

### Shared validation module (`shared/schemas/validate-release.mjs`)

- Created single source of truth for capture envelope validation used by both CLI and PB hook.
- Exports: `validateReleasePayload()`, `ERROR_CODES`, `exitCodeForError()`, `REQUIRED_FIELDS`, `VALID_STATUSES`, `SUPPORTED_SCHEMA_VERSION`.
- Stable error codes follow `CATEGORY / REASON` format (e.g., `VALIDATION_ERROR / MISSING_REQUIRED_FIELD`).
- Schema version check: rejects major versions > current (1.x), accepts legacy (0.x) for backward compatibility.
- Added null/undefined/array guard on input.
- New validations not previously enforced: SHA-256 format check on individual apkHash values, schema version unsupported check.

### CLI updates (`apps/capture-bridge/src/cli.mjs`)

- Replaced inline `validatePayload()` with `validateReleasePayload()` from shared module.
- Removed duplicate `REQUIRED_FIELDS` constant.
- Exit codes now driven by `exitCodeForError()` mapping: DUPLICATE_RELEASE→14, UNAUTHORIZED→2, all VALIDATION_ERROR→1.
- Error code printed to stderr alongside human-readable message.

### PocketBase hook updates (`pocketbase/pb_hooks/capture-ingest.pb.js`)

- All error responses now include `"code"` field matching shared ERROR_CODES.
- Added SHA-256 format validation on individual apkHash values.
- Added schema version check (rejects future major versions).
- Documented stable error codes in header comment.

### Contract test fixtures (`shared/fixtures/`)

Created 12 fixtures covering all validation scenarios:
- `valid-release.json` — minimal valid payload
- `valid-release-with-extras.json` — with objects + manifest
- `missing-releaseId.json` — required field absent
- `empty-releaseId.json` — empty string releaseId
- `invalid-versionCode-zero.json` / `invalid-versionCode-negative.json`
- `empty-apkHashes.json` / `invalid-apkHash-bad-format.json`
- `invalid-status.json` — unknown status value
- `future-schema.json` — schemaVersion 99.0.0
- `legacy-schema.json` — schemaVersion 0.9.0 (accepted)
- `invalid-schemaVersion-format.json` — non-numeric version

### Contract test suite (`apps/capture-bridge/tests/contract.test.mjs`)

- 31 tests in 5 suites, all passing.
- **Shared validator tests (14):** Unit tests for every fixture + null/undefined input.
- **CLI contract tests (6):** Runs CLI as child process, verifies exit codes match expected error codes.
- **Exit code mapping tests (4):** DUPLICATE_RELEASE→14, UNAUTHORIZED→2, validation→1, unknown→1.
- **Constants consistency (3):** Required fields count, status enum, semver format.
- **Server hook mirror (4):** Required fields array match, fixture outcome agreement, error code format validation.

### Verification

- All 31 contract tests pass: `node --test tests/contract.test.mjs`
- Existing `test-release.json` fixture still validates and dry-runs correctly.
- CLI correctly rejects malformed/missing payloads with exit code 1 and prints error code to stderr.
- CLI accepts legacy schema (0.9.0) for backward compatibility.
- No secrets, APK binaries, or raw extracted assets in fixtures.

### Acceptance criteria status

- ✅ Shared fixture suite passes for client and server validation.
- ✅ A payload cannot be accepted by one side and rejected by the other without an explicit schema-version error.
- ✅ Tests cover release ID, integer version code, APK hashes, status, object count, and provenance metadata.
- ✅ No secrets, APK binaries, or raw extracted assets in this repository.

## 2026-07-16 — Documentation requirements strengthened

- Updated `AGENTS.md` so documentation is mandatory for every implementation, configuration, schema, test, deployment, bug-fix, or workflow task—not only material architecture/data/auth/Docker decisions.
- Agents must add a dated journal entry, review pertinent docs, and explicitly state when no document beyond the journal applies before handoff.

## 2026-07-16 — Oracle deploy: capture ingest route + full UbuntuMac→Oracle data wiring

**Goal:** Get capture-ingest route live on Oracle PocketBase, complete end-to-end UbuntuMac→Oracle data pipeline, and make the data visible and meaningful in the app.

### SSH alias setup

- Added `oracle-vm` alias convention to `AGENTS.md`:
  - `Host oracle-vm` → `HostName 100.81.231.58`, `User ubuntu`, `IdentityFile ~/.ssh/id_rsa`
- Investigation showed the Oracle VM accepts `id_rsa` (not `id_ed25519`). Debug traces confirmed the server rejects the ED25519 key but accepts the RSA key authenticated via agent. Switched alias to `id_rsa` — alias now works reliably.

### Oracle server-side deployment

- **Live PB service:** `infra-new-mineops-pb-1` (image: `ghcr.io/shepswork/mineops-pocketbase:0.39.6`) on `127.0.0.1:8091→8090`, exposed publicly via Traefik at `mineops-pb.shepswork.com`.
- **Hook deploy:** Copied `capture-ingest.pb.js` to `/opt/infra-new/apps/mineopsweb/pb_hooks/` and added bind mount to compose (`/opt/infra-new/apps/mineopsweb/pb_hooks:/pb/pb_hooks:ro`). Restarted under correct project name (`infra-new`).
- **Verification:** ingest route went from `404` → `401` (auth error) after hook mount + restart, confirming route is live.
- **capture_clients collection:** Created directly via PocketBase admin API (schema: `name`, `tokenHash`, `active`, `lastUsedAt`). Seeded `ubuntumac` client record with token hash.
- **Found PB API quirk:** Initial collection creation payload used wrong property key — empty fields. Patched in-place with PATCH to add `name`/`tokenHash`/`active`/`lastUsedAt` fields. Created `scripts/oracle/setup-capture-client.sh` and `scripts/oracle/fix-capture-clients-collection.sh` for repeatability.

### Token rotation

- Generated new capture token on UbuntuMac, stored at `~/mineops-data/.capture.token`.
- Old token backed up (`*.bak.*` timestamped), `.capture.env` updated.
- Reseeded Oracle `capture_clients.tokenHash` with new SHA256 via setup script.
- Verified upload still works with rotated token (409 duplicate = auth accepted).

### VS Code tasks

Added to `.vscode/tasks.json`:
- `UbuntuMac: Capture status` — SSHes UbuntuMac, runs `check-and-upload.sh --status`
- `UbuntuMac: Check APK + upload latest release` — SSHes UbuntuMac, runs full check+upload
- `Oracle: Verify capture ingest` — SSHes `oracle-vm`, checks health + ingest route + catalog versions

### Remote script deployment

- `scripts/ubuntumac/run-remote-check.sh` — local launcher used by VS Code tasks
- `scripts/ubuntumac/check-and-upload.remote.sh` — source-of-truth remote runner, deployed to `~/mineops-data/bin/check-and-upload.sh` on UbuntuMac
- Edits deployed via `scp` + `chmod +x`

### Payload enrichment

- UbuntuMac extraction produces `exports/catalog.json` with 4,035 assets but `release.json` had `objects: []`.
- Added `enrich_payload()` to remote runner: reads `exports/catalog.json`, computes asset type counts, writes lightweight objects + `objectSummary` into `release.json` before upload.
- Lightweight approach avoids PB's 5000-char payload limit. Payload now carries type-count objects + total asset count.
- Verified: enriched payload upload returns `200`, Oracle `catalog_versions` shows `recordCount: "7"`.

### Frontend import history upgrade

- **Import history table:** now shows up to 5 releases with per-row release ID, object count, and date. Latest release highlighted with cyan dot.
- **Latest vs previous comparison:** side-by-side release ID, object count, ingest timestamp with delta.
- **Raw import preview:** shows game version, total assets extracted, asset type list, APK file count.
- Added `totalAssets` and `objectTypes` fields to `CaptureRawImportPreview`.
- Cleaned up test records from Oracle after validation.

### Documentation

- Created `docs/deployment/oracle-server-manifest.md` — authoritative live state record with:
  - Active service/container details
  - PB hooks mount location and compose line
  - `capture_clients` collection schema
  - Re-apply steps after redeploy
  - Verification commands (local + workstation)
  - Rollback procedures (hook mount restore, token restore, collection re-seed)
- Updated `docs/deployment/oracle-cicd.md` with server-side state cross-reference
- Updated `docs/DEPLOYMENT.md` with server manifest link
- Updated `docs/emulator-ingestion/capture-workflow.md` with VS Code task references and remote script deployment notes

### Commits

Two commits on `dev`:
1. `087575a` — capture wiring, import history, VS Code tasks (13 files, +829/-21)
2. `f864198` — payload enrichment, richer import history, rollback runbook (7 files, +298/-39)

### Verification

- TypeScript compiles cleanly, all 11 frontend tests pass
- End-to-end: UbuntuMac task → Oracle PB ingest → `catalog_versions` record created → app More page shows import history
- VS Code task `Oracle: Verify capture ingest` confirmed working
- Payload enrichment confirmed: 4,035 total assets, 7 object types

### Key architectural decisions

- UbuntuMac is **not** a PocketBase host — it is an outbound data engine only (V3-consistent).
- Capture payloads stay lightweight (type counts, not full asset lists) to respect PB field-size limits.
- Oracle server state that isn't in CI/CD (hook mount, capture_clients, etc.) is documented in `oracle-server-manifest.md` with re-apply instructions.
- SSH alias convention (`oracle-vm`) is codified in `AGENTS.md` for future agent consistency.

## 2026-07-16 — Catalog metadata validation hardening

- Tightened catalog schemas: SHA-256 format is enforced, normalized managers require verified names/provenance/version bounds, progression entries require level/value, and generic entity records route unknown data through `extensions`.
- Hardened `tools/validation/validate-catalog.mjs` with manifest/catalog identity and count checks, safe artifact-path checks, byte-count verification, and canonical JSON serialization checks.
- Aligned the catalog README and example manifest hash with the validator’s exact-byte hashing policy.

## 2026-07-16 — JSON metadata scaffolding handoff

- Added `docs/development/DEEPSEEK_JSON_METADATA_HANDOFF.md` as the implementation handoff for scaffolding immutable, versioned static catalog JSON metadata.
- The handoff defines manifest, normalized catalog, diff, and validation-report contracts; deterministic serialization/hash rules; unresolved-object preservation; and strict non-goals preventing fabricated APK data or premature activation.
- No frontend catalog source, PocketBase activation flow, or player-progress migration is changed by this documentation decision.

## 2026-07-16 — Static JSON catalog metadata scaffolding implemented

Implemented the versioned, static JSON metadata layer per `DEEPSEEK_JSON_METADATA_HANDOFF.md`.

### Schemas (shared/schemas/)

- **`catalog_manifest.schema.json`** — immutable bundle descriptor with lifecycle status, artifact pointer (path/sha256/bytes), entity counts, and generator metadata.
- **`normalized_catalog.schema.json`** — full catalog contract with managers, mines, equipment, research, collectibles, artifacts, localization, idMappings, aliases, relationships, and unresolvedObjects. Manager identity rules require `canonicalId`; all source identifiers are nullable. `extensions` preserves unmodeled source fields as JSON data.
- **`catalog_diff.schema.json`** — domain-level diff (added/removed/changed/unresolved) with per-field before/after and severity.
- **`catalog_validation.schema.json`** — validation report contract with checks, blocking issues, warnings, and counts. Defines 9 standard check codes.

All schemas use JSON Schema draft 2020-12 with `additionalProperties: false`, matching the existing convention in `shared/schemas/`.

### Example bundle (catalogs/example/)

- `catalog-manifest.json` — status `candidate` (not `active`), real SHA-256 hash of catalog.json.
- `catalog.json` — empty arrays/maps; no fabricated game records. Source kind: `fixture`.
- `diff.json` — null previous version, zero changes.
- `validation-report.json` — all 9 checks pass.

### Validation tooling (tools/validation/)

- `validate-catalog.mjs` — runs all 9 checks: schema conformance (×4), duplicate canonical IDs, duplicate source identifiers, missing required fields, unresolved objects, relationship reference integrity, artifact hash consistency, deterministic serialization, and suspicious change detection.
- Added `ajv` (^8.17.1) as root dev dependency.
- Added `npm run validate:catalog` script.
- All 12 checks pass on the example bundle. Existing 11 frontend tests pass.

### Documentation

- `catalogs/README.md` — bundle layout, lifecycle, identity rules, deterministic hashing spec, and future generation workflow.
- `tools/validation/README.md` — validation usage and check descriptions.

### Limitations & deferred work

- No real APK data has been parsed; the example is fixture-safe with zero game records.
- Manager nameSource `unknown` is the default for unverified data — real parser must set the actual source.
- PocketBase manifest storage and activation flow are deferred.
- Frontend catalog consumption is deferred (legacy files remain untouched).
- Diff generation between real catalog versions is deferred.
- `SUSPICIOUS_CHANGE_DETECTION` threshold (50) is provisional.

## 2026-07-16 — UbuntuMac outbound wiring clarification + capture diagnostics hardening

- Confirmed V3 architecture guardrail: UbuntuMac should **not** host PocketBase. It remains the outbound capture/extraction engine, uploading to MineOps PocketBase over HTTPS.
- Added `capture-bridge` wiring diagnostics command:
   - `apps/capture-bridge/src/cli.mjs` now supports `--status`
   - Checks PocketBase health (`/api/health`), ingest auth behavior (401 vs non-401), and recent `catalog_versions` readability.
   - Added npm script: `apps/capture-bridge/package.json` → `npm run status`
- Updated capture workflow docs with explicit UbuntuMac→PocketBase runbook:
   - `docs/emulator-ingestion/capture-workflow.md`
   - Includes setup expectations, verification steps, upload commands, and troubleshooting notes.
- Hardened frontend capture status fetch against dev PocketBase query quirks:
   - Some dev setups reject `sort=-created` on `catalog_versions` with HTTP 400.
   - `frontend/src/lib/capture.ts` now falls back to unsorted reads and keeps status online with a diagnostic note instead of reporting unavailable.
- Clarified operator confusion around “zero” values: record/object counts can be `0` when payload `objects` is empty (fixture behavior), even though ingest and connectivity are healthy.

## 2026-07-16 — Capture bridge: ubuntumac → PocketBase ingest pipeline

**Dual-ended implementation:** Both the server-side ingest endpoint (PocketBase) and the client-side upload CLI (capture-bridge) were built and wired together.

### Server side (MineOpsWeb PocketBase)

1. **New migration:** `1700000001_capture_clients.js` — adds `capture_clients` collection with `name`, `tokenHash` (stored SHA256 token hash), `active`, `lastUsedAt` fields. No public access rules; only superusers manage via Admin UI.

2. **New PB hook:** `pocketbase/pb_hooks/capture-ingest.pb.js` — custom route `POST /api/capture/ingest` that:
   - Authenticates via Bearer token using PB 0.39-compatible `$security.sha256()` + `$security.equal()` against `capture_clients.tokenHash`
   - Validates payload against `release.schema.json` requirements (releaseId, versionCode, apkHashes, status, etc.)
   - Returns HTTP 409 on duplicate releaseId (exit code 14 on CLI)
   - Creates `raw_imports` record with capture client name as owner
   - Creates `catalog_versions` record with object count
   - Updates `capture_clients.lastUsedAt` on each request

3. **Dockerfile:** Added `COPY pb_hooks /pb/pb_hooks` so hooks are baked into the PB image.

4. **Frontend:** Added "Capture Status" card to the More page showing:
   - Online/Unavailable status indicator
   - Catalog version count from PocketBase
   - Latest release ID and ingest timestamp
   - Refresh button (calls PB `catalog_versions` endpoint)
   - New module: `frontend/src/lib/capture.ts`

### Client side (capture-bridge CLI)

5. **Rewrote `apps/capture-bridge/src/cli.mjs`** — from a 12-line prototype to a robust CLI with:
   - `node src/cli.mjs <payload.json>` — single file upload
   - `--dry-run` — validate without sending (prints release summary)
   - `--inbox <dir>` — batch process all JSON files in a directory
   - `--help` — full usage docs
   - Payload validation against `release.schema.json` requirements
   - Duplicate detection (exit code 14 on HTTP 409)
   - Structured JSON output for scripting
   - Env var checks: `MINEOPS_CAPTURE_URL`, `MINEOPS_CAPTURE_TOKEN`

6. **Test fixture:** `apps/capture-bridge/fixtures/test-release.json` for dry-run testing.

7. **Env docs:** `apps/capture-bridge/.env.example` and updated root `.env.example` with `MINEOPS_CAPTURE_URL`/`MINEOPS_CAPTURE_TOKEN` instead of the old placeholder.

### Verification

- Frontend: TypeScript compiles cleanly, Vite build passes, all 11 tests pass.
- Docker: `docker compose build pocketbase` succeeds (pb_hooks copied into image).
- CLI: `node src/cli.mjs fixtures/test-release.json --dry-run` works and produces structured output.
- The ingest hook and CLI validate the same required fields on both ends (defense in depth).

### End-to-end test results (2026-07-16)

All verified against a running dev stack (`docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d`):

| Test | Result |
|---|---|
| `POST /api/capture/ingest` with valid auth + payload | ✅ 200 — rawImportId + catalogVersionId returned |
| Duplicate releaseId | ✅ 409 — "Release already ingested" |
| Missing auth header | ✅ 401 — "Missing or malformed Authorization header" |
| Invalid token | ✅ 401 — "Invalid or inactive capture token" |
| Missing required fields | ✅ 400 — specific field name in error |
| `node src/cli.mjs <payload.json>` | ✅ Uploads, returns structured JSON with IDs |
| `node src/cli.mjs <payload.json> --dry-run` | ✅ Validates, prints release summary (no upload) |
| Duplicate via CLI | ✅ Detects 409, exits with code 14 |
| `--inbox <dir>` mode | ✅ Processes all JSON files in dir |
| Public `catalog_versions` read | ✅ Returns records without auth |
| `raw_imports` created | ✅ 4 records stored |
| `catalog_versions` created | ✅ 4 records stored |

### PB 0.39.x hooks API notes

Key findings from debugging the custom route:

| Concept | PB 0.36-0.38 API | PB 0.39.x API |
|---|---|---|
| Route registration | `routerAdd(method, path, handler)` | Same |
| Request body | `c.body()` or `JSON.parse(c.body())` | `c.requestInfo().body` (parsed JSON object) |
| Request headers | `c.request().header.get("name")` | `c.requestInfo().headers.name` (lowercase, underscored) |
| DAO access | `$app.dao().method()` | `$app.method()` directly (no `.dao()`) |
| Record save | `$app.dao().saveRecord(rec)` | `$app.save(rec)` |
| Record ID | `record.getId()` | `record.id` |
| Field access | `record.getString("name")` | `record.get("name")` |
| Bcrypt | `$security.compareWithBcrypt()` | Not available — use `$security.sha256()` + `$security.equal()` |
| Public rule | `null` = public | `""` (empty string) = public; `null` = deny all |

### To use end-to-end

1. Start dev stack: `make dev-up`
2. Create superuser: `docker exec mineopsweb-pocketbase-1 /pb/pocketbase superuser upsert admin@example.com "password" --dir=/pb/pb_data`
3. Create capture client via Admin UI or API (store SHA256 of your chosen token)
4. Run: `MINEOPS_CAPTURE_URL=http://localhost:8090/api/capture/ingest MINEOPS_CAPTURE_TOKEN=my-token node apps/capture-bridge/src/cli.mjs apps/capture-bridge/fixtures/test-release.json`
5. View capture status in frontend More → Capture Status → Refresh

## 2026-07-16 — Docker production fix: nginx proxy, stage targeting, and port merging

### Summary
The production Docker setup had three distinct bugs that prevented the app from serving correctly after rebuild. Fixed all three and documented root causes for future prevention.

## 2026-07-14 — Initial replacement foundation

- Added a Dockerized React PWA, FastAPI API, PostgreSQL service, and local emulator ingestion CLI.
- Used revisioned player-manager records, a client IndexedDB queue, idempotency keys, and HTTP 409 conflicts as the first end-to-end parity domain.
- Risk: authentication, Alembic migrations, richer iOS data migration, catalog validation, and the remaining product workflows still need implementation before production use.

## 2026-07-14 — Docker hot-reload development stack

- Added explicit development targets to the frontend and backend Dockerfiles plus `docker-compose.dev.yml` bind mounts.
- `make dev-up` starts Vite HMR on port 8080, Uvicorn API reload on port 8000, and PostgreSQL; source changes refresh without rebuilding images.
- Production Compose continues to use production targets. CI/CD is deliberately deferred until the application has authentication, migrations, and a production-readiness review.

## 2026-07-14 — Development branch policy and manager workflow refactor

- Confirmed existing `dev` branch as the development-only branch; `main` remains production-only and has no deployment workflow yet.
- Replaced the manager proof-of-concept with an editable local-first manager workflow, mobile navigation, status metrics, and a desktop/mobile-safe editor.

## 2026-07-14 — Revised PRD parity correction

- Audited the read-only iOS reference at `/Users/yancyshepherd/Projects/mineops-companion` and created the required migration inventory, parity matrix, data migration map, calculation inventory, and visual reference set.
- Replaced the generic free-text manager CRUD shell with the verified 111-manager catalog, catalog-backed progress, iOS-derived score/readiness rules, Today/Managers/Strategy/More routes, responsive shell, and cached Dexie state.
- Replaced the PostgreSQL/FastAPI Compose direction with PocketBase services, migrations, persistent volume, health check, and deployment/security/operations documentation.
- Remaining parity work is explicit in `docs/PARITY_MATRIX.md`: authenticated SDK sync, full Kolibri import review/rollback UI, capture bridge route, and end-to-end evidence.

## 2026-07-14 — Local Kolibri sync path

- Added local-only Kolibri fields (ID/debug string, auth token, save-game key) under More → Kolibri sync, with `.env.example` support.
- Added Vite proxies and browser decoding for the iOS-compatible Capsule request and `U58U`/base64/gzip response format.
- Valid synced manager rows now replace cached player progress automatically in local development; diagnostics report payload format and unmatched catalog IDs.

## 2026-07-15 — V3 PRD reconciliation: FastAPI removal, navigation consolidation

- Tagged current prototype state `prototype-before-parity-reset`
- Created `docs/V3_CURRENT_STATE_RECONCILIATION.md` — assesses current state against V3 PRD
- Removed `backend/` (FastAPI/PostgreSQL) — PocketBase is the approved backend
- Removed `frontend/src/api/` (FastAPI client), `MinesPage.tsx`, `ResourcesPage.tsx` (placeholder pages)
- Consolidated navigation from 6 tabs → 4 tabs as per iOS parity: **Today**, **Managers**, **Strategy**, **More**
- Renamed `OverviewPage` → `TodayPage` with `TodayPage` component
- Updated Docker Compose (already PB-only, no changes needed)
- Updated `Makefile` — removed `backend` test/lint targets
- Updated `NavigationIcon.tsx` — removed mines/resources icon cases
- Updated `App.tsx` — removed dead imports/routes, unified header title via `getTabLabel()`
- All navigation items now visible on mobile (Strategy was previously hidden on mobile)

## 2026-07-15 — Multi-device sync: manager calculations ported, PB cross-device sync wired

- **Calculation parity:** Ported `effectiveActiveValue()` (linear interpolation between L1/L100) and `raritySortWeight()` from the iOS Swift codebase. Updated `strengthScore()` to use the new active value. Added `isRankUpReady()` as the canonical function.
- **UI changes:** ManagerCard now shows "Ready to Rank Up" badge using the shared function. ManagerDetailModal shows computed effective active value and rank-up readiness.
- **PocketBase auth:** Confirmed the app uses `pb.collection("users").authWithPassword()` — regular **user** accounts, not admin accounts. User created manually via Admin UI.
- **Cross-device sync:** On app launch, if authenticated, pulls the latest PB snapshot and applies it (LWW by `capturedAt`). On sign-in, immediately pulls from PB and pushes local state. On tab close, fire-and-forget pushes to PB.
- All tests pass (11/11) and TypeScript compiles cleanly.

## 2026-07-15 — Fragment parsing fix and progress bar UI

- **Bug fix:** Kolibri parser was hard-coding `fragments: 0` for every manager — the `Fragments` field from the save response was never read. Added `row.Fragments ?? row.fragments ?? 0` to the parser.
- **UI improvement:** ManagerCard now shows a fragment progress bar with X/Y count (e.g., "⬥ 15/50") towards the next rank threshold, using `rankThreshold()`. Thresholds: R0=15, R1=30, R2=50, R3=80 fragments.
- **CSS:** Added `.fragment-progress`, `.fragment-progress-bar`, `.fragment-progress-fill`, `.fragment-progress-label` styles with orange accent color and smooth width transition.
- All 11 tests pass, TypeScript compiles cleanly.

## 2026-07-16 — Docker production fix: nginx proxy, stage targeting, and port merging

### Summary
The production Docker setup had three distinct bugs that prevented the app from serving correctly after rebuild. Fixed all three and documented root causes for future prevention.

### Changes

**1. Dockerfile: production stage was unnamed**
- The final nginx stage had no `AS production` label, so `docker-compose.yml`'s `target: build` was building the intermediate build stage (Node.js) instead of the nginx stage.
- **Fix:** Named the final stage `AS production` and updated compose to `target: production`.
- **Files:** `frontend/Dockerfile`, `docker-compose.yml`

**2. nginx.conf: missing Kolibri API proxy**
- In dev mode, Vite proxies `/kolibri` → `capsule.kolibrigames.com` and `/master` → `idle-miners.com`. The production nginx config only served static files, so Kolibri syncs silently failed after deployment.
- **Fix:** Added `location /kolibri/` and `location /master/` proxy_pass blocks that forward headers (including Authorization) and support SSL server name.
- **File:** `frontend/nginx.conf`

**3. Docker compose port merging with dev.yml**
- When using `docker-compose.yml` + `docker-compose.dev.yml` together, Compose *merges* port arrays instead of replacing them. Since base compose has `8080:80` and dev compose has `8080:5173`, both get published, causing "port already allocated" on restart.
- **Fix:** Dev compose already uses `!override` on `web.ports` — this was correct. The issue was running the *production* compose (no dev.yml) which bundles code at build time, so source edits on the host don't take effect without a rebuild.
- **Lesson:** Always verify merged config with `docker compose -f docker-compose.yml -f docker-compose.dev.yml config` and check `web.ports` contains only one entry.

**4. Kolibri fragment field name unconfirmed**
- Added `row.Fragments ?? row.fragments ?? row.FragmentCount ?? 0` fallback chain plus debug logging that prints the actual Kolibri response keys to console. The exact field name still needs to be confirmed from a real sync — check browser console for `[kolibri] First manager raw keys:` output.

### Issues Found & Prevention

| Issue | Root Cause | Prevention |
|---|---|---|
| Stale code in production containers | Production compose bundles source at build time; source edits don't propagate | Use `docker compose up --build -d` after code changes, or use dev compose with volume mounts |
| nginx doesn't proxy like Vite dev | `nginx.conf` had no proxy rules for `/kolibri` or `/master` | Keep nginx proxy rules in sync with `vite.config.ts` proxy config |
| Docker builds wrong stage | Intermediate stage (build) selected by `target` instead of final nginx stage | Always name final stage in Dockerfile (e.g., `AS production`) |
| Port conflict with dev+base compose | Compose merges port arrays from multiple compose files | Use `!override` on ports in dev.yml; validate with `docker compose config` |
| PB query 400 on launch | Remote PB returns 400 for `player_snapshots` query — collection may not exist on production PB | Handle PB 400s gracefully; the `player_snapshots` collection needs migration on the remote PB instance |

### TL;DR for next agent

Read this file before making changes. The production Docker setup is now correct:
- `docker compose up --build -d` rebuilds and serves on port 8080 via nginx with Kolibri proxying
- `docker compose -f docker-compose.dev.yml up --build -d` for Vite hot-reload development
- Fragment parsing from Kolibri is wired but the exact response field name is unconfirmed — check `[kolibri]` console debug logs after a real sync
