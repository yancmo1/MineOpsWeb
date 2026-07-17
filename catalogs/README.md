# MineOps Catalog Bundles

Versioned, immutable static JSON metadata artifacts for MineOpsWeb. Each bundle is a directory containing a manifest and 7 content-addressed artifacts for one game release.

## Directory layout

```text
catalogs/
  README.md              ← this file
  example/               ← empty/fixture-safe scaffold (validates, zero game records)
    manifest.json         ← v2 release manifest (lists all artifacts + integrity metadata)
    catalog-core.json     ← managers, mines, equipment, research, collectibles, artifacts
    relationships.json    ← directed entity relationships
    mappings.json         ← identity mappings + aliases
    localization.json     ← key-value localization table
    assets.json           ← asset reference index (sprites, textures, etc.)
    validation-report.json ← deterministic validation checks
    changelog.json        ← domain-level diff against previous version
  <catalog-version>/     ← per-release bundles (future)
```

### Legacy v1 format (still supported)

The example directory also retains the v1 monolithic format for backward compatibility:
- `catalog-manifest.json` — v1 manifest (single artifact pointer)
- `catalog.json` — monolithic catalog (all entities in one file)
- `diff.json` — v1 diff
- `validation-report.json` — same as v2

Both formats are validated by `tools/validation/validate-catalog.mjs`.

## Package contract (v2)

Each release package is an immutable, content-addressed bundle of 8 artifacts:

| Artifact | Schema | Description |
|---|---|---|
| `manifest.json` | `catalog_manifest.schema.json` (v2) | Release descriptor with artifact array, counts, storage pointer |
| `catalog-core.json` | `catalog_core.schema.json` | Core entities: managers, mines, equipment, research, collectibles, artifacts |
| `relationships.json` | `relationships.schema.json` | Directed relationships between entities |
| `mappings.json` | `mappings.schema.json` | Identity mappings (`idMappings`) and aliases |
| `localization.json` | `localization.schema.json` | Key-value localization table |
| `assets.json` | `assets.schema.json` | Asset reference index (sprite sheets, textures, etc.) |
| `validation-report.json` | `catalog_validation.schema.json` | Deterministic validation checks and results |
| `changelog.json` | `changelog.schema.json` | Domain-level diff between this and previous catalog version |

### Manifest artifact entries

Every artifact entry in the manifest includes:

- `filename` — artifact filename (e.g. `catalog-core.json`)
- `contentType` — always `application/json`
- `sha256` — lowercase SHA-256 of the exact UTF-8 bytes (immutable once the release is accepted)
- `bytes` — file size in bytes
- `schemaVersion` — version of the JSON schema this artifact conforms to
- `recordCount` — number of top-level records. Zero means "no records" (valid, empty artifact). A missing file means "artifact not produced" — these are distinct states.
- `required` — (`true`/`false`) whether the client MUST have this artifact to use the package. See below.
- `path` — safe relative path resolved only within the immutable release directory

### Required vs optional artifacts

| Artifact | Required | Rationale |
|---|---|---|
| `catalog-core.json` | ✅ Yes | Core entities; the app cannot function without them. |
| `validation-report.json` | ✅ Yes | Required to verify package integrity before activation. |
| `relationships.json` | No | App can operate without relationship data (degraded mode). |
| `mappings.json` | No | App can operate without source→canonical identity mappings. |
| `localization.json` | No | App can fall back to internal display names. |
| `assets.json` | No | App can operate without asset index. |
| `changelog.json` | No | Informational only; not needed at runtime. |

Client behavior:
- **Missing required artifact** → reject the package entirely.
- **Missing optional artifact** → load the package with a warning, continue in degraded mode for that artifact's domain.
- **Artifact with `recordCount: 0`** → valid state; means "no records of this type." Distinct from a missing file.

The manifest also includes a `storage` section with `baseUrl` (where artifacts can be fetched) and optional `cdnUrl`.

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

## Deterministic hashing

- Every artifact's `sha256` is computed from the exact UTF-8 bytes on disk.
- JSON must use two-space indentation, a trailing newline, recursively sorted object keys, and deterministic array ordering by domain-specific keys.
- All fields are included in the artifact hash.
- Same source input + same parser version MUST produce the same bytes and hash.
- The validator (`deterministicSerialization` check) rejects artifacts not in canonical form.

## PocketBase release-control records

The `catalog_releases` collection (migration `1700000003`) stores release-control-plane metadata:

- Release identity (`releaseId`, `catalogVersion`, game version info)
- Lifecycle `status` and `isActive` pointer
- `manifestRef` — storage URL/path to the manifest artifact
- `counts` — JSON entity count summary
- `validationSummary` — JSON validation status and results
- `reviewNotes` and `auditLog` — JSON arrays for governance
- `storageBaseUrl` — artifact storage location

PocketBase stores only metadata needed to identify, govern, review, and publish a package. The full canonical catalog remains in JSON artifacts. Small searchable summaries (counts, validation status) are stored for quick lookup.

## Rules

- Package releases are immutable and content-addressed.
- Unknown objects remain in JSON (`extensions` fields).
- No PocketBase-per-object mirror is required.
- The package must be independently downloadable and verifiable using only the manifest.
- Schema versions are independent from game versions.

## How catalogs are generated (future)

1. APK is extracted by the UbuntuMac capture engine
2. Raw payload is uploaded to MineOps PocketBase via `POST /api/capture/ingest`
3. `MineOpsDataEngine` parser normalizes the raw extraction into split artifacts
4. Manifest, changelog, and validation report are generated
5. Bundle is committed (locally or to object storage)
6. A `catalog_releases` record is created in PocketBase
7. Frontend consumption requires explicit activation (status → `active`, `isActive` → true)

## Compatibility and storage boundaries

### Client compatibility policy

MineOpsWeb determines compatibility using **both** the manifest version and every required artifact's schema version:

1. **Manifest major version check:** If the manifest's `manifestSchemaVersion` major is higher than the client supports, reject the package.
2. **Required artifact schema check:** For every `required: true` artifact, if the artifact's `schemaVersion` major is higher than the client supports, reject the package. The client must refuse activation when it encounters an unsupported required artifact schema, even when the manifest schema itself is supported.
3. **Optional artifact schema check:** For `required: false` artifacts, if the schema version is unsupported, the client may load the package with a warning and skip that artifact.

### Immutability rules

Once a release record is accepted in PocketBase, these fields must never change:

- `releaseId`
- `manifestSha256`
- All artifact `sha256` values
- All artifact `path` values
- `catalogVersion`
- `gameVersion` / `gameVersionCode`
- `previousCatalogVersion`
- `storageBaseUrl`

These fields may evolve during the review/activation lifecycle:

- `status` (candidate → review_required → ready → active → superseded)
- `reviewNotes`
- `auditLog`
- `reviewedBy`
- `publishedAt`

### Content addressing model

```
catalog_publication (singleton)
└── activeReleaseId
└── manifestSha256         ← manifest integrity, held by PocketBase

manifest.json              ← describes all content artifacts, does NOT hash itself
└── artifacts[].sha256     ← content-addressed hashes of all content artifacts
```

The manifest does not contain its own hash. The manifest hash is stored in the `catalog_publication` singleton record. This avoids the recursive dependency of a self-hashing manifest.

### Active-release pointer

The active release is tracked by a **separate singleton** (`catalog_publication`), not by an `isActive` boolean on each release row. This makes atomic publish and rollback simpler:

**Publish:** Set `catalog_publication.activeReleaseId` to the new release. Update the old release's status to `superseded` and the new one to `active`.

**Rollback:** Set `catalog_publication.activeReleaseId` back to `previousReleaseId`. The previous catalog's JSON artifacts remain intact.

Schema versions are independent from game versions. Adding new optional fields to a schema is backward-compatible; removing or renaming required fields requires a schema version bump. The `extensions` field on all entity types preserves unmodeled source data across parser upgrades.

## Validation

```bash
# Install dependencies (first time)
npm install

# Validate the example bundle (auto-detects v1 or v2 format)
npm run validate:catalog catalogs/example

# Run contract tests (40 tests covering serialization, hashing, manifest, schema, fixtures)
node --test tests/catalog-package.test.mjs
```

See `tools/validation/README.md` for full validation documentation.
