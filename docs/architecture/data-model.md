# Data model

Implemented tables: `users`, `player_managers`, `mutation_log`, `catalog_snapshots`, `catalog_raw_imports`, and `catalog_validation_runs`. Revisioned records use UUIDs with `created_at`, `updated_at`, `deleted_at`, `revision`, and `device_id`. Future migrations add the remaining PRD domains (`player_mines`, research, collectibles, plans, devices, sessions, audit records, validation issues) without changing existing IDs.

`player_managers` preserves the iOS active fields: manager key, unlock state, level, rank, promotion, and fragments. Master catalog attributes remain snapshot data rather than user data.

Catalog ingestion now keeps immutable raw-import provenance and immutable validation outcomes alongside the staged `catalog_snapshots` rows. `catalog_snapshots.release_id`, `raw_import_id`, and `validation_run_id` are additive linkage fields so duplicate release uploads remain idempotent and every accepted snapshot can be traced back to its original UbuntuMac capture metadata without mutating the raw evidence rows.
