# Data migration map

## Boundaries

| Boundary | Contents | Web storage |
|---|---|---|
| Game catalog | Verified bundled manager definitions, IDs, names, rarity, area, abilities and passive data | Versioned static JSON in `public/catalog`; PocketBase `catalog_versions` metadata |
| Player state | Ownership, level, rank, promotion, fragments, mines/resources when supplied | IndexedDB active snapshot + PocketBase `player_state` / `player_snapshots` |
| MineOps workspace | Favorites, notes, saved strategies, targets, preferences | IndexedDB record queue + PocketBase `workspace_records` / `saved_strategies` |
| Raw imported payloads | Exact bytes/JSON, hash, source, timestamps, unknown fields, warnings | PocketBase `raw_imports` with immutable payload |
| Operational sync metadata | Freshness, attempt/success, revisions, device and errors | IndexedDB boot metadata + PocketBase `sync_events`, `devices` |

## Source mappings

- `SMMasterEntry` → `CatalogManager`: `id`, `gameId`, `name`, `rarity`, `area`, `sprite`, `elements`, `passives`, active scaling and descriptions.
- `SMProgress` → `PlayerManagerState`: catalog `managerId`, `unlocked`, `level`, `rank`, `promoted`, `fragments`.
- `ManagerData.id` in Kolibri is matched to `SMMasterEntry.gameId`; unmatched records remain in `unknownFields` and validation warnings.
- `KolibriDebugIDParser` accepts a pasted diagnostic string and stores only the normalized UUID; credentials remain local to the browser.
- `SyncMetadata` maps to `SyncMetadata` in IndexedDB and a server `sync_events` record; token/IDs are masked in diagnostics.
- `ImportSnapshot` maps to immutable `raw_imports` plus normalized `player_snapshots`; `active` is a separate activation decision.

## Versioning

Every raw import records parser version, catalog version, schema version, source timestamp and content hash. Unknown JSON keys are retained under `unknownFields`; migrations must be additive and never rewrite the original payload. IndexedDB versions migrate through Dexie upgrade callbacks. PocketBase schema changes are committed as JavaScript migrations under `pocketbase/pb_migrations`.
