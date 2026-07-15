# MineOpsWeb architecture

MineOpsWeb is a React/TypeScript PWA with PocketBase as the cross-device authority. The browser opens from IndexedDB, renders the cached active player snapshot immediately, then restores auth and synchronizes. Immutable raw imports and versioned normalized snapshots keep external game data distinct from MineOps workspace edits.

```text
apps/web ──packages/domain, game-import, calculations──> IndexedDB (Dexie)
    │ HTTPS / PocketBase SDK
    ▼
PocketBase: profiles, devices, catalog_versions, raw_imports, player_snapshots,
player_state, workspace_records, saved_strategies, sync_events, capture_clients
    ▲ outbound authenticated upload
apps/capture-bridge (ubuntumac ADB)
```

OCR is not part of the web implementation. The real iOS catalog and deterministic calculations are the behavioral reference. PocketBase migrations and ownership rules are committed under `pocketbase/`.
