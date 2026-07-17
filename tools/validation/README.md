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

## Tests

```bash
npm run test:catalog    # 42 catalog package contract tests
npm run test:review     # 24 review contract tests
```

## Requirements

- Node.js 18+
- Run `npm install` from the workspace root to install `ajv`.
