# V3 Current State Reconciliation

**Created:** 2026-07-15  
**Author:** Cline (AI agent)  
**Purpose:** Assess current MineOpsWeb state against V3 PRD (`PRD/MineOpsWeb_Codex_PRD_V3.md`)

---

## 1. Overview

The MineOpsWeb project has undergone a substantial iOS-style redesign in the latest commit (`2403e97` — "Complete iOS-style redesign of MineOpsWeb frontend"). The current state is approximately **Phase/Step 4–6** in V3 terms: real catalog ports and most of the app shell are in place, but PocketBase integration, FastAPI removal, and deeper data pipelines are incomplete.

---

## 2. Completed (reusable as-is)

| Area | Details | V3 PRD Reference |
|---|---|---|
| **React/Vite/TypeScript stack** | Working build toolchain, strict mode, PWA manifest, service worker | §7.5 |
| **Real manager catalog** | 111-manager `sm_complete_database.json` with correct IDs, names, rarity, area, abilities | §8.1, §3 |
| **Catalog-backed progress** | Dexie/IndexedDB: managers loaded from catalog, progress synced to `PlayerManager` records | §7.5, §8.2 |
| **iOS-derived calculations** | `strengthScore()`, `rankThreshold()` ported to `db.ts`, 2 passing tests | §18, CALCULATION_INVENTORY.md |
| **Kolibri sync client** | `kolibri.ts` — Capsule fetch, base64/gzip inflate, progress merge, diagnostics | §13 |
| **PocketBase client** | `pocketbase.ts` — auth restore, sign-in/out, auth state listener | §9, §10 |
| **PocketBase migration** | `1700000000_mineops.js` — 8 collections defined with ownership rules | §9 |
| **Responsive UI shell** | Bottom nav, side nav for desktop, safe-area handling, dark/light theme tokens in CSS | §12.1 |
| **Today/Overview page** | Best Next Move, Empire Snapshot, Roster Leaders, Mine Intelligence cards | §12.2 |
| **Manager grid** | Search, department filter chips, ownership segmented control, grid layout | §12.3 |
| **Manager detail modal** | Real catalog data display (abilities, passives, fragments, level/rank/promotion) | §12.4 |
| **Strategy page** | Implemented with deterministic calculations (not disabled) | §12.5, §16A.6 |
| **More page** | Kolibri credentials, sync button, diagnostics, PB auth, settings | §12.6 |
| **Docker Compose** | `docker-compose.yml` and `docker-compose.dev.yml` with web + pocketbase services | §20 |
| **PocketBase Dockerfile** | `pocketbase/Dockerfile` + `entrypoint.sh` | §20.1 |
| **Visual references** | `docs/VISUAL_REFERENCE/` — 18 iOS screenshots captured | §6.4 |
| **Audit documents** | MIGRATION_INVENTORY.md, PARITY_MATRIX.md, DATA_MIGRATION_MAP.md, CALCULATION_INVENTORY.md all exist with real content | §6.1–6.5 |
| **Documentation** | ARCHITECTURE.md, DEPLOYMENT.md, SECURITY.md, TEST_PLAN.md, USER_GUIDE.md, OPERATIONS.md all present | §23 |
| **Frontend tests** | 2 passing tests for calculation logic | §19.1 |
| **NavigationIcon component** | SVG icons for each tab | frontend |
| **textNormalization utility** | Normalizes game text strings | frontend |
| **Sprites utility** | Manager sprite image loader | frontend |

---

## 3. Partially Completed (needs work)

| Area | Current State | What's Missing | V3 PRD Reference |
|---|---|---|---|
| **PocketBase integration** | Client exists with auth; no real Oracle backend connection | No dedicated MineOps PB on Oracle; no DEV/STAGING vs PRODUCTION separation; no sync/push of player state or workspace to PB | §7.2, §7.6, §9.3 |
| **Navigation** | 6 tabs (Overview, Mines, Managers, Strategy, Resources, More) | V3 specifies 4 tabs: **Today**, **Managers**, **Strategy**, **More**. Mines and Resources don't exist in iOS. Need renaming/reparenting | §12.1 |
| **Overview page** | Shows real data with recommendations | Should be renamed to "Today" per iOS; sync status display is technical — needs more game-actionable content | §12.2 |
| **Kolibri credentials** | Stored via env vars + text fields | Needs browser-appropriate secure storage; no server-side storage; no refresh-on-launch auto-sync | §13 |
| **Tests** | Only 2 calculation unit tests | Need: import validation, normalization, snapshot comparison, conflict logic, component tests, E2E tests | §19 |

---

## 4. Conflicting with V3 PRD

| Item | Current State | V3 Requirement | Action Needed |
|---|---|---|---|
| **FastAPI/PostgreSQL backend** | Present in `backend/` directory, referenced in Docker Compose services | **Remove or isolate.** PocketBase is the approved backend. FastAPI/PostgreSQL must be removed | **Remove** backend directory, Docker services, API routes, proxy config |
| **API client** | `api/client.ts` talks to the FastAPI backend | Should talk to PocketBase SDK instead | Rewrite or remove |
| **Resources page** (tab) | Placeholder page listing future features | Not an iOS tab; resource data belongs in Today/More/Manager detail | Remove or fold into More section |
| **Mines page** (tab) | Placeholder for mine-state analysis | Not a top-level iOS tab (mine analysis is a Today card section) | Remove or fold into Today |
| **Navigation tab set** | 6 tabs (Overview, Mines, Managers, Strategy, Resources, More) | 4 tabs (Today, Managers, Strategy, More) | Rename Overview→Today, remove Mines/Resources tabs |
| **Overview page name** | "Command Center" and "Overview" | Should be "Today" for iOS parity | Rename |
| **Strategy not on mobile nav** | Strategy tab hidden on mobile (`mobile: false` in navigation.ts) | iOS has Strategy as a bottom tab — should be accessible on mobile | Fix mobile navigation |

---

## 5. Missing (not yet started)

| Feature | V3 PRD Reference | Notes |
|---|---|---|
| **Oracle VM setup** (dedicated MineOps PB) | §7.2, §7.6, §2 | Need to inspect existing server guide, create DEV/STAGING PB on Oracle |
| **DEV/STAGING vs PRODUCTION PB separation** | §7.2 | Two separate PB instances on Oracle |
| **Local-first → PB sync** | §9.3, §16.1 | Push workspace changes, pull newer revisions, conflict resolution |
| **Snapshot/rollback UI** | §9.2, §12.6, §15 | Import review, validation report, comparison view, rollback |
| **Import history** | §12.6, §8.4 | Raw import preservation, versioning |
| **Data validation engine** | §15 | Validation rules, classification (info/warning/blocking) |
| **Full manager detail** (abilities, elements, passives) | §12.4 | Current modal shows basics; needs full iOS-parity detail |
| **Player state beyond managers** | §8.2 | Equipment, research, artifacts, collectibles, crystals, mines |
| **Calculation parity tests** | §19.4, §18 | Characterization fixtures from iOS behavior |
| **End-to-end Playwright tests** | §19.3 | Sign-in, launch, sync, browse, strategy, offline, rollback |
| **Component tests** | §19.2 | Today cards, manager filtering, sync states, etc. |
| **ubuntumac APK extraction POC** | §14 | Existing `ubuntumac-setup/` docs exist; needs test against real APK |
| **iOS calculations full port** | §18 | Only strengthScore + rankThreshold ported; need effectiveActiveValue, recommendations, strategy ranking |
| **Docker production hardening** | §20.2, §21 | Health checks, restart policies, backup scripts, reverse proxy |
| **Backup/restore procedures** | §22 | Nightly PB backup, restore testing |
| **Deployment documentation** | §21, §23 | DEPLOYMENT.md with copy/paste commands |

---

## 6. Reusable After Refactor

| Item | Current Location | Refactor Needed |
|---|---|---|
| `db.ts` (Dexie schema, calculations) | `frontend/src/lib/db.ts` | Add PB sync layer; retain local-first schema |
| `kolibri.ts` | `frontend/src/lib/kolibri.ts` | Credential storage refactor; async retry logic |
| `pocketbase.ts` | `frontend/src/lib/pocketbase.ts` | Add push/pull sync methods; conflict resolution |
| `ManagerCard.tsx` | `frontend/src/components/` | Already good; minor polish |
| `ManagerDetailModal.tsx` | `frontend/src/components/` | Expand to full iOS-parity detail |
| `OverviewPage.tsx` | `frontend/src/pages/` | Rename to TodayPage; add more actionable content |
| `StrategyPage.tsx` | `frontend/src/pages/` | Already implemented; connect to strategy engine |
| `MorePage.tsx` | `frontend/src/pages/` | Add snapshot/rollback, import history sections |
| CSS styles | `frontend/src/styles.css` | Good foundation; refine tokens |
| PocketBase migration | `pocketbase/pb_migrations/` | Expand schema as needed |
| Docker Compose files | `docker-compose.yml`, `docker-compose.dev.yml` | Remove backend services; keep web + pb |
| `sprites.ts` | `frontend/src/lib/sprites.ts` | Already good for manager images |
| `textNormalization.ts` | `frontend/src/lib/textNormalization.ts` | Already good |

---

## 7. Needs Complete Rewrite or Removal

| Item | Reason | V3 Directive |
|---|---|---|
| **`backend/` directory** | FastAPI/PostgreSQL — contrary to PocketBase-only direction | Remove |
| **`api/client.ts`** | Talks to FastAPI backend | Remove or rewrite for PB SDK |
| **`infrastructure/nginx/`** | Custom nginx conf — may be replaced by Docker Compose reverse proxy approach | Review vs. server guide; potentially keep |
| **`frontend/src/pages/MinesPage.tsx`** | Placeholder — not an iOS tab | Remove |
| **`frontend/src/pages/ResourcesPage.tsx`** | Placeholder — not an iOS tab | Remove |
| **`ingestion-agent/`** | Python ingestion agent — concept may be superseded by ubuntumac approach | Review and possibly archive |

---

## 8. Blocked

| Item | Blocker | Mitigation |
|---|---|---|
| **Oracle PB setup** | Need to inspect existing server guide (`docs/server-guide` symlink or docs/) | Check `docs/ORACLE_VM_SETUP_REFERENCE.md`, `docs/ORACLE-VM-GUIDE.md`, `docs/server-guide` |
| **ubiuntumac APK extraction** | May need SSH access to ubuntumac or manual test | Works without it per V3 guardrail #2 |
| **Real Kolibri credentials** | User must provide a real debug ID for integration test | Works with fixtures for development |
| **Full iOS parity** | iOS app is reference only — cannot modify, but can inspect freely | All source is readable |

---

## 9. Recommended Next Implementation Order

Based on V3 PRD §24 and actual current state:

### Immediate (this session)
1. ✅ Tag current prototype state (`prototype-before-parity-reset`)
2. **Create this reconciliation document** (current task)
3. **Remove FastAPI/PostgreSQL** — delete `backend/` directory, remove from Docker Compose, remove API client references
4. **Update Docker Compose** — web + pocketbase only
5. **Consolidate navigation** — rename Overview→Today, remove Mines/Resources tabs per iOS parity, fix Strategy mobile visibility

### Next session
6. Establish dedicated MineOps PocketBase on Oracle (DEV/STAGING)
7. Implement local-first → PB sync (push/pull)
8. Snapshots and import validation UI
9. Expand tests (component tests, calculation parity)
10. Port remaining iOS calculations to shared TypeScript
11. Expand manager detail to full iOS parity

---

## 10. Assessment Summary

| Domain | Score (1-5) | Commentary |
|---|---|---|
| **Frontend UI** | 4/5 | Strong redesign with real catalog; needs tab consolidation |
| **Data model** | 3/5 | Good IndexedDB + catalog; no PB sync yet |
| **Calculations** | 3/5 | Core score/threshold ported; full suite missing |
| **Backend** | 2/5 | FastAPI/PostgreSQL needs removal; PB migration exists but unused |
| **Tests** | 1/5 | Only 2 unit tests; massive gap vs. §19 requirements |
| **Documentation** | 4/5 | Excellent docs present; reconciliation will improve them |
| **PWA** | 3/5 | Manifest + service worker present; offline and sync need work |
| **Oracle deployment** | 1/5 | Not connected yet; PB migration exists |
| **ubuntumac** | 1/5 | Setup docs exist; no working extraction pipeline |
| **Overall** | **2.5/5** | Good frontend foundation; critical architecture work (PB-only, Oracle, tab consolidation) needed before deeper product work |