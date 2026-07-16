# Development journal

## 2026-07-16 — Capture bridge: ubuntumac → PocketBase ingest pipeline

**Dual-ended implementation:** Both the server-side ingest endpoint (PocketBase) and the client-side upload CLI (capture-bridge) were built and wired together.

### Server side (MineOpsWeb PocketBase)

1. **New migration:** `1700000001_capture_clients.js` — adds `capture_clients` collection with `name`, `tokenHash` (bcrypt), `active`, `lastUsedAt` fields. No public access rules; only superusers manage via Admin UI. The ingest hook reads records via DAO for auth.

2. **New PB hook:** `pocketbase/pb_hooks/capture-ingest.pb.js` — custom route `POST /api/capture/ingest` that:
   - Authenticates via Bearer token against `capture_clients` bcrypt hashes
   - Validates payload against `release.schema.json` requirements (releaseId, versionCode, apkHashes, status, etc.)
   - Returns HTTP 409 on duplicate releaseId (exit code 14 on CLI)
   - Creates `raw_imports` record with capture client name as owner
   - Creates/updates `catalog_versions` record with object count
   - Updates `capture_clients.lastUsedAt` on each request

3. **Dockerfile:** Added `COPY pb_hooks /pb/pb_hooks` so hooks are baked into the PB image.

4. **Frontend:** Added "Capture Status" card to the More page showing:
   - Online/Unavailable status indicator
   - Catalog version count from PocketBase
   - Latest release ID and ingest timestamp
   - Refresh button (calls PB `catalog_versions` endpoint)
   - New module: `frontend/src/lib/capture.ts`

### Client side (capture-bridge CLI)

5. **Rewrote `apps/capture-bridge/src/cli.mjs`** — from a 12-line prototype to a robust CLI with:
   - `node src/cli.mjs <payload.json>` — single file upload
   - `--dry-run` — validate without sending (prints release summary)
   - `--inbox <dir>` — batch process all JSON files in a directory
   - `--help` — full usage docs
   - Payload validation against `release.schema.json` requirements
   - Duplicate detection (exit code 14 on HTTP 409)
   - Structured JSON output for scripting
   - Env var checks: `MINEOPS_CAPTURE_URL`, `MINEOPS_CAPTURE_TOKEN`

6. **Test fixture:** `apps/capture-bridge/fixtures/test-release.json` for dry-run testing.

7. **Env docs:** `apps/capture-bridge/.env.example` and updated root `.env.example` with `MINEOPS_CAPTURE_URL`/`MINEOPS_CAPTURE_TOKEN` instead of the old placeholder.

### Verification

- Frontend: TypeScript compiles cleanly, Vite build passes, all 11 tests pass.
- Docker: `docker compose build pocketbase` succeeds (pb_hooks copied into image).
- CLI: `node src/cli.mjs fixtures/test-release.json --dry-run` works and produces structured output.
- The ingest hook and CLI validate the same required fields on both ends (defense in depth).

### End-to-end test results (2026-07-16)

All verified against a running dev stack (`docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d`):

| Test | Result |
|---|---|
| `POST /api/capture/ingest` with valid auth + payload | ✅ 200 — rawImportId + catalogVersionId returned |
| Duplicate releaseId | ✅ 409 — "Release already ingested" |
| Missing auth header | ✅ 401 — "Missing or malformed Authorization header" |
| Invalid token | ✅ 401 — "Invalid or inactive capture token" |
| Missing required fields | ✅ 400 — specific field name in error |
| `node src/cli.mjs <payload.json>` | ✅ Uploads, returns structured JSON with IDs |
| `node src/cli.mjs <payload.json> --dry-run` | ✅ Validates, prints release summary (no upload) |
| Duplicate via CLI | ✅ Detects 409, exits with code 14 |
| `--inbox <dir>` mode | ✅ Processes all JSON files in dir |
| Public `catalog_versions` read | ✅ Returns records without auth |
| `raw_imports` created | ✅ 4 records stored |
| `catalog_versions` created | ✅ 4 records stored |

### PB 0.39.x hooks API notes

Key findings from debugging the custom route:

| Concept | PB 0.36-0.38 API | PB 0.39.x API |
|---|---|---|
| Route registration | `routerAdd(method, path, handler)` | Same |
| Request body | `c.body()` or `JSON.parse(c.body())` | `c.requestInfo().body` (parsed JSON object) |
| Request headers | `c.request().header.get("name")` | `c.requestInfo().headers.name` (lowercase, underscored) |
| DAO access | `$app.dao().method()` | `$app.method()` directly (no `.dao()`) |
| Record save | `$app.dao().saveRecord(rec)` | `$app.save(rec)` |
| Record ID | `record.getId()` | `record.id` |
| Field access | `record.getString("name")` | `record.get("name")` |
| Bcrypt | `$security.compareWithBcrypt()` | Not available — use `$security.sha256()` + `$security.equal()` |
| Public rule | `null` = public | `""` (empty string) = public; `null` = deny all |

### To use end-to-end

1. Start dev stack: `make dev-up`
2. Create superuser: `docker exec mineopsweb-pocketbase-1 /pb/pocketbase superuser upsert admin@example.com "password" --dir=/pb/pb_data`
3. Create capture client via Admin UI or API (store SHA256 of your chosen token)
4. Run: `MINEOPS_CAPTURE_URL=http://localhost:8090/api/capture/ingest MINEOPS_CAPTURE_TOKEN=my-token node apps/capture-bridge/src/cli.mjs apps/capture-bridge/fixtures/test-release.json`
5. View capture status in frontend More → Capture Status → Refresh

## 2026-07-16 — Docker production fix: nginx proxy, stage targeting, and port merging

### Summary
The production Docker setup had three distinct bugs that prevented the app from serving correctly after rebuild. Fixed all three and documented root causes for future prevention.

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

## 2026-07-16 — Docker production fix: nginx proxy, stage targeting, and port merging

### Summary
The production Docker setup had three distinct bugs that prevented the app from serving correctly after rebuild. Fixed all three and documented root causes for future prevention.

### Changes

**1. Dockerfile: production stage was unnamed**
- The final nginx stage had no `AS production` label, so `docker-compose.yml`'s `target: build` was building the intermediate build stage (Node.js) instead of the nginx stage.
- **Fix:** Named the final stage `AS production` and updated compose to `target: production`.
- **Files:** `frontend/Dockerfile`, `docker-compose.yml`

**2. nginx.conf: missing Kolibri API proxy**
- In dev mode, Vite proxies `/kolibri` → `capsule.kolibrigames.com` and `/master` → `idle-miners.com`. The production nginx config only served static files, so Kolibri syncs silently failed after deployment.
- **Fix:** Added `location /kolibri/` and `location /master/` proxy_pass blocks that forward headers (including Authorization) and support SSL server name.
- **File:** `frontend/nginx.conf`

**3. Docker compose port merging with dev.yml**
- When using `docker-compose.yml` + `docker-compose.dev.yml` together, Compose *merges* port arrays instead of replacing them. Since base compose has `8080:80` and dev compose has `8080:5173`, both get published, causing "port already allocated" on restart.
- **Fix:** Dev compose already uses `!override` on `web.ports` — this was correct. The issue was running the *production* compose (no dev.yml) which bundles code at build time, so source edits on the host don't take effect without a rebuild.
- **Lesson:** Always verify merged config with `docker compose -f docker-compose.yml -f docker-compose.dev.yml config` and check `web.ports` contains only one entry.

**4. Kolibri fragment field name unconfirmed**
- Added `row.Fragments ?? row.fragments ?? row.FragmentCount ?? 0` fallback chain plus debug logging that prints the actual Kolibri response keys to console. The exact field name still needs to be confirmed from a real sync — check browser console for `[kolibri] First manager raw keys:` output.

### Issues Found & Prevention

| Issue | Root Cause | Prevention |
|---|---|---|
| Stale code in production containers | Production compose bundles source at build time; source edits don't propagate | Use `docker compose up --build -d` after code changes, or use dev compose with volume mounts |
| nginx doesn't proxy like Vite dev | `nginx.conf` had no proxy rules for `/kolibri` or `/master` | Keep nginx proxy rules in sync with `vite.config.ts` proxy config |
| Docker builds wrong stage | Intermediate stage (build) selected by `target` instead of final nginx stage | Always name final stage in Dockerfile (e.g., `AS production`) |
| Port conflict with dev+base compose | Compose merges port arrays from multiple compose files | Use `!override` on ports in dev.yml; validate with `docker compose config` |
| PB query 400 on launch | Remote PB returns 400 for `player_snapshots` query — collection may not exist on production PB | Handle PB 400s gracefully; the `player_snapshots` collection needs migration on the remote PB instance |

### TL;DR for next agent

Read this file before making changes. The production Docker setup is now correct:
- `docker compose up --build -d` rebuilds and serves on port 8080 via nginx with Kolibri proxying
- `docker compose -f docker-compose.dev.yml up --build -d` for Vite hot-reload development
- Fragment parsing from Kolibri is wired but the exact response field name is unconfirmed — check `[kolibri]` console debug logs after a real sync