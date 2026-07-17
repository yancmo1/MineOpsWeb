# Catalog Validation & Review Tools

Validates and reviews catalog artifacts against MineOps JSON Schemas.

## Validation (`validate-catalog.mjs`)

Runs deterministic integrity checks on a bundle directory. Auto-detects v1 or v2 format.

```bash
npm run validate:catalog catalogs/example
node tools/validation/validate-catalog.mjs catalogs/example
```

## Review (`review-package.mjs`)

Loads a v2 catalog package and produces a structured review summary. Reviews manifest metadata, artifact verification, validation-report.json, changelog.json, mapping conflicts, unresolved IDs, object counts, and schema compatibility.

```bash
# Formatted output
npm run review:catalog catalogs/example
node tools/validation/review-package.mjs catalogs/example

# JSON output
node tools/validation/review-package.mjs catalogs/example --json
```

### Review recommendations

| Recommendation | Meaning |
|---|---|
| `approved` | No blocking issues. Package is ready for approval. |
| `review_required` | Warnings present. Human review required before approval. |
| `quarantined` | Fatal issues found. Package cannot be published until resolved. |

### Fatal checks (block publication)

- Missing required artifact (`catalog-core.json`, `validation-report.json`)
- SHA-256 hash mismatch on required artifact
- Schema validation failure
- Manifest/catalog consistency failure
- Non-deterministic serialization
- Unsupported manifest major version
- Unsupported required artifact schema version

### Warning checks (require review, don't block)

- Duplicate canonical IDs
- Duplicate source identifiers
- Missing required fields on entities
- Unresolved objects
- Broken relationship references
- Suspiciously large changelog changes (>50 managers)
- Orphaned mappings/aliases

## Publication (`publish-release.mjs`)

Manages the active-release pointer: publish a reviewed release or roll back to a previous one. The active release is tracked by a single `catalog_publication` record — publishing changes only this pointer.

```bash
# Publish a reviewed release
npm run publish:catalog publish <releaseId> <manifestHash>

# Roll back to previous (or specified) release
npm run publish:catalog rollback [targetReleaseId]

# View current publication state
npm run publish:catalog status

# Options
npm run publish:catalog -- --url http://pb:8090 --token <auth-token> --json
```

### Requirements
- Release must be in `ready` status (reviewed and approved)
- Manifest hash must match the stored release record
- Capture-client Bearer tokens are rejected (PB auth cookie required)

## Tests

```bash
npm run test:catalog    # 42 catalog package contract tests
npm run test:review     # 26 review contract tests
npm run test:publish    # 21 publication contract tests
```

## Requirements

- Node.js 18+
- Run `npm install` from the workspace root to install `ajv`.
