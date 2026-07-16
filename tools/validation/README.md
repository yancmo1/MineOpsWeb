# Catalog Validation Tool

Validates catalog artifacts against MineOps JSON Schemas and runs deterministic checks.

## Usage

```bash
# Validate the example bundle
node tools/validation/validate-catalog.mjs catalogs/example

# Validate a specific catalog version
node tools/validation/validate-catalog.mjs catalogs/4.90.0-123456-example
```

## Checks performed

1. **SCHEMA_VALID** — All four artifacts conform to their respective JSON Schemas.
2. **DUPLICATE_CANONICAL_ID** — No duplicate `canonicalId` across all entity arrays.
3. **DUPLICATE_SOURCE_IDENTIFIER** — No duplicate source identifiers in mappings.
4. **MISSING_REQUIRED_FIELDS** — All entities have required fields populated.
5. **UNRESOLVED_OBJECTS** — Unresolved objects are properly recorded (warning only).
6. **INVALID_REFERENCES** — All relationship references resolve to existing entities.
7. **ARTIFACT_HASH_CONSISTENCY** — Manifest SHA-256 matches actual catalog.json content.
8. **DETERMINISTIC_SERIALIZATION** — Same input produces the same hash.
9. **SUSPICIOUS_CHANGE_DETECTION** — Large additions/removals flagged for review.

## Requirements

- Node.js 18+
- Run `npm install` from the workspace root to install `ajv`.
