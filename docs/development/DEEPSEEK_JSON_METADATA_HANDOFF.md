# MineOpsWeb — DeepSeek Handoff: Static JSON Catalog Metadata Scaffolding

## Purpose

Scaffold the versioned, static JSON metadata layer for MineOpsWeb. The immediate goal is to define and validate the artifact contract that a future APK/Unity parser will emit and that MineOpsWeb will consume locally.

This task is a data-contract and scaffolding task. It is **not** permission to invent game data, reverse-engineer unverified APK fields, activate a catalog, migrate player progress, or redesign the frontend.

The finished scaffold must make it possible to add real parsed data later without changing the contract.

## Read first

Before editing anything, read these repository files in order:

1. `docs/development/journal.md`
2. `PRD.md`
3. `AGENTS.md`
4. `docs/architecture/data-model.md`
5. `docs/architecture/sync-model.md`
6. `docs/architecture/system-overview.md`
7. `docs/validation/catalog-validation.md`
8. `shared/schemas/release.schema.json`
9. `shared/schemas/unity_catalog.schema.json`
10. `docs/emulator-ingestion/capture-workflow.md`

The journal is the current implementation history. In particular, PocketBase is the approved backend, `ubuntumac` is an outbound capture/extraction engine, and the current ingest route stores raw payloads plus release metadata. Do not follow stale architecture wording that still describes FastAPI/PostgreSQL as the active implementation.

## Current repository facts

The current capture envelope is validated by `shared/schemas/release.schema.json` and includes:

- `releaseId`
- `versionName`
- `versionCode`
- `capturedAt`
- `engineVersion`
- `schemaVersion`
- `apkHashes`
- `status` (`acquired`, `processed`, `published`, or `failed`)
- optional raw extraction fields such as `objects` and `manifest`

The PocketBase route is `POST /api/capture/ingest` in `pocketbase/pb_hooks/capture-ingest.pb.js`. It currently stores the original payload in `raw_imports` and a small release row in `catalog_versions`. It does **not** yet store or activate a normalized catalog artifact.

The current frontend fallback files are:

- `frontend/public/catalog/sm_complete_database.json`
- `frontend/public/catalog/sm_directory.json`

Those files are legacy/static compatibility data. They are useful examples of existing manager fields, but they are not proof that an APK object has any particular field. The new schema must preserve unknown source data instead of guessing.

## Explicit non-goals

Do not do any of the following in this handoff task:

- Do not claim that a real APK has been parsed unless a fixture proves it.
- Do not fabricate manager IDs, names, sprites, abilities, mines, equipment, or localization values.
- Do not use display names as canonical identity.
- Do not silently match records by name.
- Do not replace `sm_complete_database.json` or `sm_directory.json` as the active frontend source.
- Do not add catalog activation logic.
- Do not add player-progress migration or ID remapping code.
- Do not modify PocketBase migrations unless a schema change is strictly required for the metadata manifest, and if one is required, document it separately and keep it additive.
- Do not upload artifacts to a server.
- Do not add secrets, `.env` files, generated credentials, or large binary assets.
- Do not broaden the task into a parser for every Unity object type.

## Desired output

Create a versioned artifact contract and initial empty/fixture-safe scaffolding under:

```text
shared/schemas/catalog_manifest.schema.json
shared/schemas/normalized_catalog.schema.json
shared/schemas/catalog_diff.schema.json
shared/schemas/catalog_validation.schema.json
catalogs/
  README.md
  example/
    catalog-manifest.json
    catalog.json
    diff.json
    validation-report.json
```

If the repository already has a more appropriate schema or export directory, preserve the existing convention and explain the deviation in the handoff notes. Do not create a second competing contract.

The example artifact must contain empty arrays/maps where no verified source data exists. It must validate successfully against the new schemas.

## Artifact model

Use one immutable catalog bundle per release. Start with one `catalog.json` file; do not split into domain files yet. The manifest can support future file splitting without requiring a contract rewrite.

```text
catalogs/<catalog-version>/
  catalog-manifest.json
  catalog.json
  diff.json
  validation-report.json
```

The `<catalog-version>` directory name must be deterministic and filesystem-safe. Recommended form:

```text
<game-version>-<version-code>-<release-suffix>
```

Do not derive identity from a timestamp alone. `releaseId` from the capture envelope remains the source release identity.

## Manifest contract

`catalog-manifest.json` describes the immutable bundle and is the small file the app will eventually fetch first.

Required top-level fields:

```json
{
  "manifestSchemaVersion": "1.0.0",
  "catalogVersion": "4.90.0-123456-example",
  "releaseId": "fixture-release-id",
  "gameVersion": "4.90.0",
  "gameVersionCode": 123456,
  "generatedAt": "2026-07-16T12:00:00.000Z",
  "generator": {
    "name": "MineOpsDataEngine",
    "version": "0.1.0"
  },
  "catalogSchemaVersion": "1.0.0",
  "status": "candidate",
  "artifact": {
    "path": "catalog.json",
    "sha256": "",
    "bytes": 0
  },
  "counts": {
    "managers": 0,
    "mines": 0,
    "equipment": 0,
    "research": 0,
    "collectibles": 0,
    "artifacts": 0,
    "relationships": 0,
    "unresolvedObjects": 0
  },
  "previousCatalogVersion": null,
  "diffPath": "diff.json",
  "validationReportPath": "validation-report.json"
}
```

Allowed manifest statuses for this scaffold are:

```text
candidate | review_required | ready | active | superseded | rejected
```

The example may use `candidate`. Do not mark an invented or empty fixture `active`.

Hash rules:

- `artifact.sha256` is the lowercase SHA-256 of the exact UTF-8 bytes of `catalog.json`.
- Hashing must happen after deterministic JSON serialization.
- Do not put a fake hash such as `abc123` in a valid example. Use an empty string only if the schema explicitly permits an unbuilt example, or generate the real hash for the checked-in example.
- Never hash parsed object order that can change between runs.

## Normalized catalog contract

`catalog.json` must have this envelope:

```json
{
  "catalogSchemaVersion": "1.0.0",
  "catalogVersion": "4.90.0-123456-example",
  "releaseId": "fixture-release-id",
  "generatedAt": "2026-07-16T12:00:00.000Z",
  "source": {
    "kind": "apk_capture",
    "versionName": "4.90.0",
    "versionCode": 123456,
    "apkHashes": {},
    "parserVersion": "0.1.0"
  },
  "managers": [],
  "mines": [],
  "equipment": [],
  "research": [],
  "collectibles": [],
  "artifacts": [],
  "localization": {},
  "idMappings": [],
  "aliases": [],
  "relationships": [],
  "unresolvedObjects": []
}
```

Use arrays for entities and mappings so ordering can be explicitly sorted. Use objects/maps only for key-value localization or similarly unambiguous lookup tables.

### Canonical manager record

The manager schema must support the existing frontend data without making unverified fields mandatory:

```json
{
  "canonicalId": "verified-mineops-id",
  "gameNumericId": null,
  "internalObjectId": null,
  "assetGuid": null,
  "localizationKey": null,
  "name": "Verified name only",
  "nameSource": "fixture|localization|source_field|manual|unknown",
  "rarity": null,
  "area": null,
  "elements": [],
  "spriteAssetId": null,
  "activeAbility": null,
  "passiveAbilities": [],
  "availability": null,
  "source": {
    "objectPath": null,
    "objectType": null,
    "sourceHash": null
  },
  "firstSeenCatalogVersion": "4.90.0-123456-example",
  "lastSeenCatalogVersion": "4.90.0-123456-example",
  "extensions": {}
}
```

Rules for manager identity:

1. `canonicalId` is the stable MineOps identifier and is required for a normalized manager.
2. `gameNumericId`, `internalObjectId`, and `assetGuid` are optional source identifiers.
3. A missing source identifier is represented as `null`, not an invented value.
4. `name` is required only for a fully normalized manager; unresolved candidates belong in `unresolvedObjects`.
5. `extensions` preserves source fields that are not yet modeled. It must be JSON data, not a stringified JSON blob.
6. Never silently assign a canonical ID from a display name.

### Ability and passive records

Use a conservative shape:

```json
{
  "type": "verified_type_or_unknown",
  "name": null,
  "description": null,
  "multiplier": null,
  "durationSeconds": null,
  "cooldownSeconds": null,
  "unlockLevel": null,
  "progression": [],
  "source": "source_field|localization|manual|unknown",
  "extensions": {}
}
```

Do not convert strings such as `"2m30s"` into seconds unless the parser has a tested conversion rule. Preserve the original value in `extensions` when conversion is uncertain.

### Identity mappings and aliases

Represent mappings explicitly:

```json
{
  "kind": "game_numeric_id|internal_object_id|asset_guid|legacy_id|localization_key",
  "sourceValue": "raw-source-value",
  "canonicalId": "verified-mineops-id",
  "matchType": "exact|explicit_alias|manual_review",
  "confidence": "verified|review_required",
  "source": "fixture|manual|parser",
  "notes": null
}
```

An alias is not proof of a match. `matchType: manual_review` must remain review-required and must not auto-activate a catalog.

### Unresolved objects

Every source object that looks relevant but cannot be safely normalized must be retained:

```json
{
  "sourceObjectId": "raw-id-or-path",
  "objectType": "raw-type-or-unknown",
  "objectPath": "raw/path",
  "reason": "missing_identity|ambiguous_identity|unsupported_type|missing_required_field|possible_duplicate",
  "candidateCanonicalIds": [],
  "raw": {},
  "severity": "info|warning|error",
  "reviewStatus": "open|resolved|ignored"
}
```

Never drop an unresolved object merely because it cannot be used by the frontend yet.

## Diff contract

`diff.json` compares this candidate against `previousCatalogVersion`. It must be domain-level, not only object-count deltas.

Required sections:

```json
{
  "diffSchemaVersion": "1.0.0",
  "catalogVersion": "4.90.0-123456-example",
  "previousCatalogVersion": null,
  "generatedAt": "2026-07-16T12:00:00.000Z",
  "summary": {
    "managersAdded": 0,
    "managersRemoved": 0,
    "managersChanged": 0,
    "identifiersChanged": 0,
    "spritesChanged": 0,
    "abilitiesChanged": 0,
    "unresolvedObjects": 0,
    "warnings": 0
  },
  "changes": {
    "added": [],
    "removed": [],
    "changed": [],
    "unresolved": []
  }
}
```

Each changed record should identify `canonicalId`, `field`, `before`, `after`, and `severity`. Do not report a change caused only by nondeterministic ordering.

## Validation report contract

`validation-report.json` records deterministic checks and does not activate anything:

```json
{
  "validationSchemaVersion": "1.0.0",
  "catalogVersion": "4.90.0-123456-example",
  "validatedAt": "2026-07-16T12:00:00.000Z",
  "status": "passed|review_required|failed",
  "checks": [
    {
      "code": "SCHEMA_VALID",
      "severity": "info|warning|error",
      "passed": true,
      "message": "Catalog conforms to normalized catalog schema.",
      "path": null
    }
  ],
  "blockingIssues": [],
  "warnings": [],
  "counts": {
    "errors": 0,
    "warnings": 0,
    "unresolved": 0
  }
}
```

The scaffold must define checks for at least:

- schema validity
- duplicate `canonicalId`
- duplicate source identifiers
- missing required manager fields
- unresolved objects
- invalid references in relationships
- artifact hash consistency
- deterministic serialization/hash
- suspiciously large additions/removals

The implementation may initially return “not yet evaluated” for checks that require real parsed data, but it must not claim they passed without evidence.

## Deterministic serialization rules

Implement or document one deterministic serialization strategy:

- UTF-8 JSON
- two-space indentation for checked-in human-readable artifacts
- stable object-key ordering
- stable array ordering by domain-specific keys (`canonicalId`, then source ID where applicable)
- no timestamps generated during normalization except explicit `generatedAt` metadata
- no random UUIDs in static catalog entities
- no environment-specific absolute paths
- no `undefined`; use `null`, empty arrays, or empty objects according to schema

The same input and parser version must produce the same normalized content hash, apart from intentionally separate build metadata such as `generatedAt` if the hash excludes it. Document exactly which fields are included in the hash.

## Recommended implementation order

1. Add the four JSON Schemas with strict top-level `additionalProperties: false`.
2. Add reusable `$defs` for manager, ability, passive, mapping, unresolved object, diff change, and validation check.
3. Add the example bundle with no fabricated game records.
4. Add a small validation script or test that validates every example artifact.
5. Add deterministic sorting and hash helpers only if an existing project utility location is clear.
6. Add `catalogs/README.md` explaining bundle layout, lifecycle, and how future exports are generated.
7. Update `docs/development/journal.md` with the schema/scaffolding decision.

Do not wire the frontend or PocketBase activation in this pass.

## Testing requirements

Run the narrowest relevant checks and report exact results:

- JSON Schema validation for all checked-in examples
- TypeScript/lint checks if code was added
- existing frontend tests/build if shared code was touched
- a deterministic serialization test: same fixture twice produces the same hash
- a negative test proving duplicate canonical IDs fail validation
- a negative test proving unresolved/manual-review records do not become `active`

If the repository lacks a schema-validation dependency, add the smallest compatible dev dependency only after checking existing package conventions. Do not write a custom incomplete JSON Schema validator as a substitute.

## Acceptance criteria

The task is complete only when:

- the four schema files exist and are internally consistent;
- the example bundle validates;
- the manifest points to the catalog, diff, and validation report paths;
- the example manifest is not falsely marked `active`;
- no invented manager/game data is present;
- unknown source fields have a defined preservation path;
- identity rules prohibit name-only matching;
- diff and validation structures cover additions, removals, changes, unresolved objects, and blocking issues;
- hashing and ordering rules are documented and tested where implemented;
- the frontend’s existing legacy catalog files remain untouched;
- the journal records the decision and any limitations;
- the final response lists changed files, tests run, and anything intentionally deferred.

## Final response format for DeepSeek

When handing work back, report:

1. Files created or modified.
2. The exact schema/version decisions made.
3. Tests/validation commands and results.
4. Any assumptions, clearly labeled.
5. Deferred work: parser extraction, real APK fixtures, PocketBase manifest storage, activation, frontend consumption, and progress migration.

If a requested field cannot be verified from repository fixtures, state that it is unverified and leave it nullable/unknown. Do not fill the gap with a plausible-looking value.
