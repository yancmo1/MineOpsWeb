# MineOps Catalog Bundles

Versioned, immutable static JSON metadata artifacts for MineOpsWeb. Each bundle is a directory containing a manifest, normalized catalog, diff, and validation report for one game release.

## Directory layout

```text
catalogs/
  README.md              ← this file
  example/               ← empty/fixture-safe scaffold (validates, zero game records)
    catalog-manifest.json
    catalog.json
    diff.json
    validation-report.json
  <catalog-version>/     ← per-release bundles (future)
    catalog-manifest.json
    catalog.json
    diff.json
    validation-report.json
```

## Bundle identity

The `<catalog-version>` directory name is deterministic and filesystem-safe:

```text
<game-version>-<version-code>-<release-suffix>
```

Examples: `4.90.0-123456-example`, `5.0.0-200000-kolibri-parser-v1`

Identity is derived from the source release, not a timestamp. `releaseId` from the capture envelope remains the authoritative release identity.

## Bundle lifecycle

| Status | Meaning |
|---|---|
| `candidate` | Newly generated, not yet reviewed. |
| `review_required` | Validation found warnings; human review needed. |
| `ready` | Approved and ready for activation. |
| `active` | Currently consumed by the frontend. Only one per environment. |
| `superseded` | Replaced by a newer active catalog. Retained for history/diffs. |
| `rejected` | Failed review and will not be activated. |

## Files

### catalog-manifest.json

Small descriptor fetched first by the app. Contains:
- Bundle identity (`catalogVersion`, `releaseId`, game version info)
- Lifecycle `status`
- Artifact pointer (`path`, `sha256`, `bytes`)
- Entity counts
- Links to diff and validation report

Schema: `shared/schemas/catalog_manifest.schema.json`

### catalog.json

The normalized game-data catalog. Contains:
- Source metadata
- Entity arrays: `managers`, `mines`, `equipment`, `research`, `collectibles`, `artifacts`
- `localization` key-value table
- `idMappings` and `aliases` for identity resolution
- `relationships` between entities
- `unresolvedObjects` for source data that could not be safely normalized

Schema: `shared/schemas/normalized_catalog.schema.json`

### diff.json

Domain-level comparison against the previous catalog version. Reports added, removed, and changed entities with severity levels.

Schema: `shared/schemas/catalog_diff.schema.json`

### validation-report.json

Deterministic validation checks run against the catalog. Records schema validity, identity conflicts, reference integrity, hash consistency, and suspicious changes. Does not activate anything.

Schema: `shared/schemas/catalog_validation.schema.json`

## Deterministic hashing

- `artifact.sha256` is the lowercase SHA-256 of the exact UTF-8 bytes of `catalog.json`.
- JSON must use two-space indentation, a trailing newline, recursively sorted object keys, and deterministic array ordering by domain-specific keys.
- All fields in `catalog.json` are included in the artifact hash, including source metadata and the catalog envelope.
- Same source input + same parser version MUST produce the same generated timestamp policy, ordering, bytes, and hash.
- The validator rejects a catalog whose bytes are not in canonical serialization form.

## How catalogs are generated (future)

1. APK is extracted by the UbuntuMac capture engine
2. Raw payload is uploaded to MineOps PocketBase via `POST /api/capture/ingest`
3. `MineOpsDataEngine` parser normalizes the raw extraction into `catalog.json`
4. Manifest, diff, and validation report are generated
5. Bundle is committed to this directory
6. Frontend consumption requires explicit activation (status → `active`)

## Validation

```bash
# Install dependencies (first time)
npm install

# Validate the example bundle
npm run validate:catalog catalogs/example
```

See `tools/validation/README.md` for full validation documentation.
