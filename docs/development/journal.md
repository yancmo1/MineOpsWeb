# Development journal

## 2026-07-14 — Initial replacement foundation

- Added a Dockerized React PWA, FastAPI API, PostgreSQL service, and local emulator ingestion CLI.
- Used revisioned player-manager records, a client IndexedDB queue, idempotency keys, and HTTP 409 conflicts as the first end-to-end parity domain.
- Risk: authentication, Alembic migrations, richer iOS data migration, catalog validation, and the remaining product workflows still need implementation before production use.

## 2026-07-14 — Docker hot-reload development stack

- Added explicit development targets to the frontend and backend Dockerfiles plus `docker-compose.dev.yml` bind mounts.
- `make dev-up` starts Vite HMR on port 8080, Uvicorn API reload on port 8000, and PostgreSQL; source changes refresh without rebuilding images.
- Production Compose continues to use production targets. CI/CD is deliberately deferred until the application has authentication, migrations, and a production-readiness review.

## 2026-07-14 — Development branch policy and manager workflow refactor

- Confirmed existing `dev` branch as the development-only branch; `main` remains production-only and has no deployment workflow yet.
- Replaced the manager proof-of-concept with an editable local-first manager workflow, mobile navigation, status metrics, and a desktop/mobile-safe editor.
## 2026-07-14 — Revised PRD parity correction

- Audited the read-only iOS reference at `/Users/yancyshepherd/Projects/mineops-companion` and created the required migration inventory, parity matrix, data migration map, calculation inventory, and visual reference set.
- Replaced the generic free-text manager CRUD shell with the verified 111-manager catalog, catalog-backed progress, iOS-derived score/readiness rules, Today/Managers/Strategy/More routes, responsive shell, and cached Dexie state.
- Replaced the PostgreSQL/FastAPI Compose direction with PocketBase services, migrations, persistent volume, health check, and deployment/security/operations documentation.
- Remaining parity work is explicit in `docs/PARITY_MATRIX.md`: authenticated SDK sync, full Kolibri import review/rollback UI, capture bridge route, and end-to-end evidence.

## 2026-07-14 — Local Kolibri sync path

- Added local-only Kolibri fields (ID/debug string, auth token, save-game key) under More → Kolibri sync, with `.env.example` support.
- Added Vite proxies and browser decoding for the iOS-compatible Capsule request and `U58U`/base64/gzip response format.
- Valid synced manager rows now replace cached player progress automatically in local development; diagnostics report payload format and unmatched catalog IDs.

## 2026-07-15 — V3 PRD reconciliation: FastAPI removal, navigation consolidation

- Tagged current prototype state `prototype-before-parity-reset`
- Created `docs/V3_CURRENT_STATE_RECONCILIATION.md` — assesses current state against V3 PRD
- Removed `backend/` (FastAPI/PostgreSQL) — PocketBase is the approved backend
- Removed `frontend/src/api/` (FastAPI client), `MinesPage.tsx`, `ResourcesPage.tsx` (placeholder pages)
- Consolidated navigation from 6 tabs → 4 tabs as per iOS parity: **Today**, **Managers**, **Strategy**, **More**
- Renamed `OverviewPage` → `TodayPage` with `TodayPage` component
- Updated Docker Compose (already PB-only, no changes needed)
- Updated `Makefile` — removed `backend` test/lint targets
- Updated `NavigationIcon.tsx` — removed mines/resources icon cases
- Updated `App.tsx` — removed dead imports/routes, unified header title via `getTabLabel()`
- All navigation items now visible on mobile (Strategy was previously hidden on mobile)

## 2026-07-15 — Multi-device sync: manager calculations ported, PB cross-device sync wired

- **Calculation parity:** Ported `effectiveActiveValue()` (linear interpolation between L1/L100) and `raritySortWeight()` from the iOS Swift codebase. Updated `strengthScore()` to use the new active value. Added `isRankUpReady()` as the canonical function.
- **UI changes:** ManagerCard now shows "Ready to Rank Up" badge using the shared function. ManagerDetailModal shows computed effective active value and rank-up readiness.
- **PocketBase auth:** Confirmed the app uses `pb.collection("users").authWithPassword()` — regular **user** accounts, not admin accounts. User created manually via Admin UI.
- **Cross-device sync:** On app launch, if authenticated, pulls the latest PB snapshot and applies it (LWW by `capturedAt`). On sign-in, immediately pulls from PB and pushes local state. On tab close, fire-and-forget pushes to PB.
- All tests pass (11/11) and TypeScript compiles cleanly.

## 2026-07-15 — Fragment parsing fix and progress bar UI

- **Bug fix:** Kolibri parser was hard-coding `fragments: 0` for every manager — the `Fragments` field from the save response was never read. Added `row.Fragments ?? row.fragments ?? 0` to the parser.
- **UI improvement:** ManagerCard now shows a fragment progress bar with X/Y count (e.g., "⬥ 15/50") towards the next rank threshold, using `rankThreshold()`. Thresholds: R0=15, R1=30, R2=50, R3=80 fragments.
- **CSS:** Added `.fragment-progress`, `.fragment-progress-bar`, `.fragment-progress-fill`, `.fragment-progress-label` styles with orange accent color and smooth width transition.
- All 11 tests pass, TypeScript compiles cleanly.
