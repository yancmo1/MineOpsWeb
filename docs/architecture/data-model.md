# Data model

Player data remains revisioned and user-scoped: `users`, `player_managers`, `mutation_log`, and snapshot/history records use stable UUIDs with `created_at`, `updated_at`, `deleted_at`, `revision`, and `device_id`. `player_managers` preserves the iOS active fields: manager key, unlock state, level, rank, promotion, and fragments.

Static game data is not modeled as one PocketBase record per object. It lives in immutable, versioned JSON release packages with a manifest and separate artifacts for catalog core, relationships, mappings/evidence, localization, assets, validation, and changelog data. Canonical IDs and source identifiers remain in JSON, including unresolved objects.

PocketBase stores only control-plane records: release metadata, raw-import provenance, artifact manifests/references, validation summaries, lifecycle/review state, audited manual mapping overrides, publication pointers, and audit history. A player snapshot records the catalog release ID and manifest hash used to interpret it so newer catalogs can be applied as a new interpretation without destructive player-data migration.
