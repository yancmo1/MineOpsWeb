# Data model

Implemented tables: `users`, `player_managers`, `mutation_log`, and `catalog_snapshots`. Revisioned records use UUIDs with `created_at`, `updated_at`, `deleted_at`, `revision`, and `device_id`. Future migrations add the remaining PRD domains (`player_mines`, research, collectibles, plans, devices, sessions, audit records, validation issues) without changing existing IDs.

`player_managers` preserves the iOS active fields: manager key, unlock state, level, rank, promotion, and fragments. Master catalog attributes remain snapshot data rather than user data.
