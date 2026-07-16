# Development journal

## 2026-07-16 — Documentation requirements strengthened

- Updated `AGENTS.md` so documentation is mandatory for every implementation, configuration, schema, test, deployment, bug-fix, or workflow task—not only material architecture/data/auth/Docker decisions.
- Agents must add a dated journal entry, review pertinent docs, and explicitly state when no document beyond the journal applies before handoff.

## 2026-07-16 — Oracle deploy: capture ingest route + full UbuntuMac→Oracle data wiring

**Goal:** Get capture-ingest route live on Oracle PocketBase, complete end-to-end UbuntuMac→Oracle data pipeline, and make the data visible and meaningful in the app.

### SSH alias setup

- Added `oracle-vm` alias convention to `AGENTS.md`:
  - `Host oracle-vm` → `HostName 100.81.231.58`, `User ubuntu`, `IdentityFile ~/.ssh/id_rsa`
- Investigation showed the Oracle VM accepts `id_rsa` (not `id_ed25519`). Debug traces confirmed the server rejects the ED25519 key but accepts the RSA key authenticated via agent. Switched alias to `id_rsa` — alias now works reliably.

### Oracle server-side deployment

- **Live PB service:** `infra-new-mineops-pb-1` (image: `ghcr.io/shepswork/mineops-pocketbase:0.39.6`) on `127.0.0.1:8091→8090`, exposed publicly via Traefik at `mineops-pb.shepswork.com`.
- **Hook deploy:** Copied `capture-ingest.pb.js` to `/opt/infra-new/apps/mineopsweb/pb_hooks/` and added bind mount to compose (`/opt/infra-new/apps/mineopsweb/pb_hooks:/pb/pb_hooks:ro`). Restarted under correct project name (`infra-new`).
- **Verification:** ingest route went from `404` → `401` (auth error) after hook mount + restart, confirming route is live.
- **capture_clients collection:** Created directly via PocketBase admin API (schema: `name`, `tokenHash`, `active`, `lastUsedAt`). Seeded `ubuntumac` client record with token hash.
- **Found PB API quirk:** Initial collection creation payload used wrong property key — empty fields. Patched in-place with PATCH to add `name`/`tokenHash`/`active`/`lastUsedAt` fields. Created `scripts/oracle/setup-capture-client.sh` and `scripts/oracle/fix-capture-clients-collection.sh` for repeatability.

### Token rotation

- Generated new capture token on UbuntuMac, stored at `~/mineops-data/.capture.token`.
- Old token backed up (`*.bak.*` timestamped), `.capture.env` updated.
- Reseeded Oracle `capture_clients.tokenHash` with new SHA256 via setup script.
- Verified upload still works with rotated token (409 duplicate = auth accepted).

### VS Code tasks

Added to `.vscode/tasks.json`:
- `UbuntuMac: Capture status` — SSHes UbuntuMac, runs `check-and-upload.sh --status`
- `UbuntuMac: Check APK + upload latest release` — SSHes UbuntuMac, runs full check+upload
- `Oracle: Verify capture ingest` — SSHes `oracle-vm`, checks health + ingest route + catalog versions

### Remote script deployment

- `scripts/ubuntumac/run-remote-check.sh` — local launcher used by VS Code tasks
- `scripts/ubuntumac/check-and-upload.remote.sh` — source-of-truth remote runner, deployed to `~/mineops-data/bin/check-and-upload.sh` on UbuntuMac
- Edits deployed via `scp` + `chmod +x`

### Payload enrichment

- UbuntuMac extraction produces `exports/catalog.json` with 4,035 assets but `release.json` had `objects: []`.
- Added `enrich_payload()` to remote runner: reads `exports/catalog.json`, computes asset type counts, writes lightweight objects + `objectSummary` into `release.json` before upload.
- Lightweight approach avoids PB's 5000-char payload limit. Payload now carries type-count objects + total asset count.
- Verified: enriched payload upload returns `200`, Oracle `catalog_versions` shows `recordCount: "7"`.

### Frontend import history upgrade

- **Import history table:** now shows up to 5 releases with per-row release ID, object count, and date. Latest release highlighted with cyan dot.
- **Latest vs previous comparison:** side-by-side release ID, object count, ingest timestamp with delta.
- **Raw import preview:** shows game version, total assets extracted, asset type list, APK file count.
- Added `totalAssets` and `objectTypes` fields to `CaptureRawImportPreview`.
- Cleaned up test records from Oracle after validation.

### Documentation

- Created `docs/deployment/oracle-server-manifest.md` — authoritative live state record with:
  - Active service/container details
  - PB hooks mount location and compose line
  - `capture_clients` collection schema
  - Re-apply steps after redeploy
  - Verification commands (local + workstation)
  - Rollback procedures (hook mount restore, token restore, collection re-seed)
- Updated `docs/deployment/oracle-cicd.md` with server-side state cross-reference
- Updated `docs/DEPLOYMENT.md` with server manifest link
- Updated `docs/emulator-ingestion/capture-workflow.md` with VS Code task references and remote script deployment notes

### Commits

Two commits on `dev`:
1. `087575a` — capture wiring, import history, VS Code tasks (13 files, +829/-21)
2. `f864198` — payload enrichment, richer import history, rollback runbook (7 files, +298/-39)

### Verification

- TypeScript compiles cleanly, all 11 frontend tests pass
- End-to-end: UbuntuMac task → Oracle PB ingest → `catalog_versions` record created → app More page shows import history
- VS Code task `Oracle: Verify capture ingest` confirmed working
- Payload enrichment confirmed: 4,035 total assets, 7 object types

### Key architectural decisions

- UbuntuMac is **not** a PocketBase host — it is an outbound data engine only (V3-consistent).
- Capture payloads stay lightweight (type counts, not full asset lists) to respect PB field-size limits.
- Oracle server state that isn't in CI/CD (hook mount, capture_clients, etc.) is documented in `oracle-server-manifest.md` with re-apply instructions.
- SSH alias convention (`oracle-vm`) is codified in `AGENTS.md` for future agent consistency.

## 2026-07-16 — Catalog metadata validation hardening

- Tightened catalog schemas: SHA-256 format is enforced, normalized managers require verified names/provenance/version bounds, progression entries require level/value, and generic entity records route unknown data through `extensions`.
- Hardened `tools/validation/validate-catalog.mjs` with manifest/catalog identity and count checks, safe artifact-path checks, byte-count verification, and canonical JSON serialization checks.
- Aligned the catalog README and example manifest hash with the validator’s exact-byte hashing policy.

## 2026-07-16 — JSON metadata scaffolding handoff

- Added `docs/development/DEEPSEEK_JSON_METADATA_HANDOFF.md` as the implementation handoff for scaffolding immutable, versioned static catalog JSON metadata.
- The handoff defines manifest, normalized catalog, diff, and validation-report contracts; deterministic serialization/hash rules; unresolved-object preservation; and strict non-goals preventing fabricated APK data or premature activation.
- No frontend catalog source, PocketBase activation flow, or player-progress migration is changed by this documentation decision.

## 2026-07-16 — Static JSON catalog metadata scaffolding implemented

Implemented the versioned, static JSON metadata layer per `DEEPSEEK_JSON_METADATA_HANDOFF.md`.

### Schemas (shared/schemas/)

- **`catalog_manifest.schema.json`** — immutable bundle descriptor with lifecycle status, artifact pointer (path/sha256/bytes), entity counts, and generator metadata.
- **`normalized_catalog.schema.json`** — full catalog contract with managers, mines, equipment, research, collectibles, artifacts, localization, idMappings, aliases, relationships, and unresolvedObjects. Manager identity rules require `canonicalId`; all source identifiers are nullable. `extensions` preserves unmodeled source fields as JSON data.
- **`catalog_diff.schema.json`** — domain-level diff (added/removed/changed/unresolved) with per-field before/after and severity.
- **`catalog_validation.schema.json`** — validation report contract with checks, blocking issues, warnings, and counts. Defines 9 standard check codes.

All schemas use JSON Schema draft 2020-12 with `additionalProperties: false`, matching the existing convention in `shared/schemas/`.

### Example bundle (catalogs/example/)

- `catalog-manifest.json` — status `candidate` (not `active`), real SHA-256 hash of catalog.json.
- `catalog.json` — empty arrays/maps; no fabricated game records. Source kind: `fixture`.
- `diff.json` — null previous version, zero changes.
- `validation-report.json` — all 9 checks pass.

### Validation tooling (tools/validation/)

- `validate-catalog.mjs` — runs all 9 checks: schema conformance (×4), duplicate canonical IDs, duplicate source identifiers, missing required fields, unresolved objects, relationship reference integrity, artifact hash consistency, deterministic serialization, and suspicious change detection.
- Added `ajv` (^8.17.1) as root dev dependency.
- Added `npm run validate:catalog` script.
- All 12 checks pass on the example bundle. Existing 11 frontend tests pass.

### Documentation

- `catalogs/README.md` — bundle layout, lifecycle, identity rules, deterministic hashing spec, and future generation workflow.
- `tools/validation/README.md` — validation usage and check descriptions.

### Limitations & deferred work

- No real APK data has been parsed; the example is fixture-safe with zero game records.
- Manager nameSource `unknown` is the default for unverified data — real parser must set the actual source.
- PocketBase manifest storage and activation flow are deferred.
- Frontend catalog consumption is deferred (legacy files remain untouched).
- Diff generation between real catalog versions is deferred.
- `SUSPICIOUS_CHANGE_DETECTION` threshold (50) is provisional.

## 2026-07-16 — UbuntuMac outbound wiring clarification + capture diagnostics hardening

- Confirmed V3 architecture guardrail: UbuntuMac should **not** host PocketBase. It remains the outbound capture/extraction engine, uploading to MineOps PocketBase over HTTPS.
- Added `capture-bridge` wiring diagnostics command:
   - `apps/capture-bridge/src/cli.mjs` now supports `--status`
   - Checks PocketBase health (`/api/health`), ingest auth behavior (401 vs non-401), and recent `catalog_versions` readability.
   - Added npm script: `apps/capture-bridge/package.json` → `npm run status`
- Updated capture workflow docs with explicit UbuntuMac→PocketBase runbook:
   - `docs/emulator-ingestion/capture-workflow.md`
   - Includes setup expectations, verification steps, upload commands, and troubleshooting notes.
- Hardened frontend capture status fetch against dev PocketBase query quirks:
   - Some dev setups reject `sort=-created` on `catalog_versions` with HTTP 400.
   - `frontend/src/lib/capture.ts` now falls back to unsorted reads and keeps status online with a diagnostic note instead of reporting unavailable.
- Clarified operator confusion around “zero” values: record/object counts can be `0` when payload `objects` is empty (fixture behavior), even though ingest and connectivity are healthy.

## 2026-07-16 — Capture bridge: ubuntumac → PocketBase ingest pipeline

**Dual-ended implementation:** Both the server-side ingest endpoint (PocketBase) and the client-side upload CLI (capture-bridge) were built and wired together.

### Server side (MineOpsWeb PocketBase)

1. **New migration:** `1700000001_capture_clients.js` — adds `capture_clients` collection with `name`, `tokenHash` (stored SHA256 token hash), `active`, `lastUsedAt` fields. No public access rules; only superusers manage via Admin UI.

2. **New PB hook:** `pocketbase/pb_hooks/capture-ingest.pb.js` — custom route `POST /api/capture/ingest` that:
   - Authenticates via Bearer token using PB 0.39-compatible `$security.sha256()` + `$security.equal()` against `capture_clients.tokenHash`
   - Validates payload against `release.schema.json` requirements (releaseId, versionCode, apkHashes, status, etc.)
   - Returns HTTP 409 on duplicate releaseId (exit code 14 on CLI)
   - Creates `raw_imports` record with capture client name as owner
   - Creates `catalog_versions` record with object count
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
