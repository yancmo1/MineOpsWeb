# MineOpsWeb parity matrix

| iOS feature | Source files | Existing behavior | Web destination | Required data | Current web status | Acceptance criteria | Reference captured | Remaining work |
|---|---|---|---|---|---|---|---|---|
| Application launch | `ContentView.swift`, `AppLaunchCoordinator.swift` | Loads catalog, then progress and four tabs | PWA boot + React Router shell | Catalog, cached snapshot, auth | Prototype has three tabs and generic sync | Cached state renders before network; four routes | `VISUAL_REFERENCE/` | Replace shell |
| Today/dashboard | `V2DashboardView.swift` | Freshness, strongest-by-area, upgrade opportunities, coverage | `/today` | Player snapshot + sync metadata | Generic unlocked count | Real actionable cards and first-run/offline states | `VISUAL_REFERENCE/today.png` | Implement |
| Managers list | `V2ManagersView.swift`, `ManagerListQuery.swift` | Catalog-backed cards, unlocked default, filters/sorts | `/managers` | Catalog + player state | Free-text CRUD | No free-text IDs; real names/images | `VISUAL_REFERENCE/managers.png` | Implement |
| Manager detail | `V2ManagersView.swift`, `SMModels.swift` | Abilities, passives, progress, rank/promotion | `/managers/:id` | Catalog + progress + workspace notes | None | Detail clearly separates imported facts/workspace | `VISUAL_REFERENCE/manager-detail.png` | Implement |
| Recommendation scoring | `SMProgressService.swift` | Strength score and fragment opportunities | `packages/calculations` | Active values, level/rank/promotion/rarity | None | Characterization tests match Swift | N/A | Port |
| Strategy | `StrategyEngine.swift`, `V2StrategyView.swift` | Deterministic lineup/boost plan; optional AI provider | `/strategy` | Owned roster, manager abilities | Verified-package ranking with release/hash evidence and unresolved-ID exclusion | Useful rules-first strategy with owned constraints | `VISUAL_REFERENCE/strategy.png` | Broader iOS lineup/boost rules remain to be ported when their catalog effects are modeled |
| More/settings | `V2MoreView.swift` | Sync, diagnostics, settings, exports, reset | `/more` | Sync metadata, auth, imports | Sync/import/snapshot/capture plus catalog verification, cache, and recovery diagnostics | Protected settings and actionable errors | `VISUAL_REFERENCE/more.png` | Export/reset parity remains |
| Kolibri sync | `KolibriAPIClient.swift`, `KolibriSyncService.swift` | Full debug ID, request, U58U decode, merge | import service + More | Credentials, raw payload, catalog | Generic API | Launch/manual sync, raw preservation, validation | N/A | Implement |
| Snapshots/rollback | `SnapshotManager.swift` | Historical import snapshots | More/imports | Raw and normalized snapshots | Catalog snapshot only | Bad imports cannot activate; rollback works | N/A | Implement |
| Export/import | `SMTrackerExporter.swift` | Strict tracker JSON | More | Player state/catalog IDs | None | Validated backup round-trip | N/A | Implement |
| Loading/error/offline | SwiftUI sync states | Loading, stale, error diagnostics | Global shell/routes | Sync metadata + network | Minimal message | Explicit actionable state on every route | N/A | Implement |
| Phone/tablet/desktop | Theme/layout constants and views | Mobile-first cards | Responsive CSS | Same domain model | Narrow phone layout | Bottom nav on phone; useful wide layout | N/A | Implement |

Status is intentionally incomplete until the implementation and verification gates pass.
