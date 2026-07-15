# MineOpsWeb migration inventory

Audit date: 2026-07-14. The iOS repository at `/Users/yancyshepherd/Projects/mineops-companion` is the read-only behavioral reference.

| Source area | Purpose / major types | Data and behavior | Classification | MineOpsWeb destination | Tests / questions |
|---|---|---|---|---|---|
| `MineOpsCompanionPackage/Sources/.../V2/Models/SMModels.swift` | `SMMasterEntry`, `SMProgress`, departments, passive tables | Catalog identity, rarity, area, abilities and progress-derived values | Reuse data + port logic | `packages/domain/src/catalog.ts`, `packages/calculations` | Fixture decode and score parity |
| `.../Resources/sm_complete_database.json` | Verified bundled master catalog (31 records; source metadata reports 51) | Names, IDs, abilities and rarity | Reuse asset/data | `apps/web/public/catalog/sm_complete_database.json` | Catalog count/schema gate |
| `.../Resources/sm_directory.json` | OCR/tracker directory aliases | Stable IDs, aliases, display names | Reuse mapping; OCR itself retired | `packages/domain/src/managerDirectory.ts` | Alias collision tests |
| `.../V2/Services/SMProgressService.swift` | Sync merge, persistence, score, recommendations | Authoritative manager progress and deterministic Today recommendations | Port business logic | `packages/calculations`, Dexie snapshot store | Characterization fixtures |
| `.../V2/Services/ManagerListQuery.swift` | Ownership/filter/sort query | Unlocked default, department, rarity, readiness, deterministic ties | Port business logic | `packages/calculations/managerQuery.ts` | Filter/sort component tests |
| `.../Strategy/StrategyEngine.swift` | Rules-first lineup plan | Owned-manager constraints and burst steps | Port business logic | `packages/calculations/strategy.ts` | Strategy parity fixtures |
| `.../Data/KolibriAPIClient.swift` | Capsule request/decode | Authenticated save request, U58U/base64/gzip decoding, diagnostics | Port integration | `packages/game-import/src/kolibri.ts` | Sanitized payload fixtures |
| `.../Data/KolibriDebugIDParser.swift` | Full debug ID parsing | Extracts final UUID from pasted diagnostic text | Port business logic | `packages/game-import/src/debugId.ts` | UUID parser tests |
| `.../Models/KolibriModels.swift` | Save payload models | Managers, mines, resources and unknown Codable values | Port schema with unknown preservation | `packages/game-import/src/schema.ts` | Zod fixture validation |
| `.../Data/SyncMetadataStore.swift`, `SyncFrequency.swift` | Freshness and diagnostics | Last success/attempt, payload format, selected interval | Recreate web-native | `packages/domain/src/sync.ts` + PocketBase `sync_events` | Freshness tests |
| `.../Data/SnapshotManager.swift`, `ImportSnapshot.swift` | Import history | Preserve previous state and rollback | Recreate web-native | PocketBase `raw_imports` / `player_snapshots` | Activation/rollback tests |
| `.../V2/Views/V2DashboardView.swift` | Today UI | Sync header, strongest by area, upgrade opportunities, coverage | Recreate UI | `apps/web/src/routes/Today.tsx` | Responsive component tests |
| `.../V2/Views/V2ManagersView.swift` | Managers list/detail UI | Catalog-backed cards, filters, detail sheet | Recreate UI | `apps/web/src/routes/Managers.tsx` | RTL + Playwright |
| `.../V2/Views/V2StrategyView.swift` | Strategy UI | Provider/config and generated strategy | Recreate UI; rules-first | `apps/web/src/routes/Strategy.tsx` | Empty/loading/error tests |
| `.../V2/Views/V2MoreView.swift` | Settings/diagnostics UI | Sync, credentials, diagnostics, reset/export | Recreate UI | `apps/web/src/routes/More.tsx` | Form and protected-route tests |
| `.../Resources/Icons`, app assets | Manager/status imagery | Sprite/icon presentation | Reuse assets where licensable | `apps/web/public/assets` | Visual reference review |
| OCR feature files | Screenshot recognition | OCR import and image fingerprinting | Retire (explicit PRD prohibition) | None | Ensure no OCR route ships |

Current web prototype files under `frontend/` and `backend/` are scaffolding. React/Vite, TypeScript, PWA manifest/service worker, Dexie dependency and test configuration are reusable. The FastAPI/PostgreSQL API, free-text manager CRUD, generic queue, placeholder dashboard and disabled Strategy route conflict with the authoritative PRD and are being replaced by PocketBase plus catalog-backed player state.
