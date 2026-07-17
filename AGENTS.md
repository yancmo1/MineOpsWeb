# MineOpsWeb Agent Guide

## 📖 Required reading before any changes

Read these files in order:
1. `docs/development/journal.md` — **session history, known issues, and all recent decisions.** This is the single source of truth for what has been done and what is known to be broken.
2. `PRD.md` — the V3 product requirements document (authoritative).
3. `AGENTS.md` — this file.
4. `docs/architecture/*.md` — architecture decisions and data/sync models.
5. `docs/server-guide` — if it exists; production deployment details.
6. `SERVER_MASTER_GUIDE.md` — the canonical server reference for UbuntuMac (symlinked in repo root). Consult before any server-side operations.
7. `docs/ORACLE_VM_SETUP_REFERENCE.md`, `docs/ORACLE-VM-DEPLOY-SETUP.md`, `docs/ORACLE-VM-GUIDE.md` — Oracle VM infrastructure reference. Consult before any Oracle VM operations.

The iOS project at `../mineops-companion` is the behavioral reference until the parity matrix (`docs/PARITY_MATRIX.md`) says the web has achieved parity.

## ⚠️ Known issues (check journal.md for full details)

- **Kolibri fragment field name unconfirmed** — the parser reads `Fragments` but the exact field name in the Kolibri save response hasn't been verified via a real sync. Check browser console for `[kolibri] First manager raw keys:` debug output.
- **PocketBase `player_snapshots` collection** — the remote PB instance on `mineops-pb.shepswork.com` returns 400 for snapshot queries. The collection may not exist or the migration hasn't been applied on that instance.
- **Strategy page is a placeholder** — only shows "strongest per area". Needs real lineup evaluation and recommendations (V3 PRD Step 8).
- **Oracle PB: `sort=-created` returns 400 on `catalog_versions`** — frontend falls back to unsorted reads gracefully.
- **Oracle compose is a shared `infra-new` project** — any MineOps service changes must use `-p infra-new` to avoid container name conflicts.

### Recently resolved (2026-07-16)

- ✅ **Issue #1 — Contract-test the capture envelope** — shared validation module (`shared/schemas/validate-release.mjs`) with stable error codes, 12 contract fixtures, 31 passing tests covering CLI and PB hook parity. See `apps/capture-bridge/tests/contract.test.mjs`.
- ✅ **Capture ingest route** — live on Oracle PB at `https://mineops-pb.shepswork.com/api/capture/ingest`. Hook file mounted at `/opt/infra-new/apps/mineopsweb/pb_hooks/capture-ingest.pb.js`.
- ✅ **UbuntuMac→Oracle data pipeline** — wired end-to-end with token auth, payload enrichment, and import history display.
- ✅ **SSH alias `oracle-vm`** — configured in `~/.ssh/config` with RSA key. Agents should use this alias for all server operations.
- ✅ **More page import history** — shows release lineage, latest-vs-previous diff, raw import preview, and asset type breakdown.
- ✅ **VS Code tasks** — `UbuntuMac: Capture status`, `UbuntuMac: Check APK + upload latest release`, `Oracle: Verify capture ingest`.

## 🐳 Docker rules

## 🖥️ Oracle server access convention

- Use SSH host alias `oracle-vm` for server operations.
- Expected alias shape in `~/.ssh/config`:
	- `Host oracle-vm`
	- `HostName <oracle-vm-ip-or-dns>`
	- `User <oracle-user>`
	- `IdentityFile ~/.ssh/<oracle-key>`
	- `IdentitiesOnly yes`
- If alias auth fails, verify the key path and permissions (`chmod 600 ~/.ssh/<oracle-key>`) before changing deploy scripts.

- **Production compose** (`docker-compose.yml`): `docker compose up --build -d` after every source change. Code is bundled at build time — source edits on the host are **not** reflected until rebuild.
- **Dev compose** (`docker-compose.dev.yml`): `docker compose -f docker-compose.dev.yml up --build -d` for Vite hot-reload with volume mounts.
- **`!override` on ports** in `docker-compose.dev.yml` is intentional — Compose merges port arrays from multiple files. Without `!override`, both `8080:80` (production) and `8080:5173` (dev) get published, causing port conflicts.
- **Validate merged config:** `docker compose -f docker-compose.yml -f docker-compose.dev.yml config | grep ports` — should show a single port mapping.
- **nginx proxy rules** in `frontend/nginx.conf` must stay in sync with `frontend/vite.config.ts` proxy config. The production build uses nginx, not Vite.
- **Production stage** is named `AS production` in `frontend/Dockerfile`. The intermediate `build` stage is Node.js for compilation only.

## ✅ Required pre-handoff checks

### Documentation is part of every change

For every implementation, configuration, schema, test, deployment, bug-fix, or workflow task, the agent must update documentation before handoff. This is mandatory even when the code change appears small or obvious.

- Add a dated entry to `docs/development/journal.md` describing what changed, why, verification performed, and any remaining limitations.
- Review and update every pertinent document affected by the work. Examples include `docs/PARITY_MATRIX.md` for parity changes, architecture documents for data/sync changes, validation docs for schema/check changes, capture/deployment/operations docs for infrastructure or workflow changes, and the relevant PRD/reconciliation document when implementation status changes.
- If no pertinent document beyond the journal applies, state that explicitly in the handoff. Do not silently skip the documentation review.
- A handoff is incomplete until the journal and pertinent documentation updates are included in the same change set as the implementation.
- Do not rewrite historical journal entries. Add a new dated entry with links or file paths to the changed artifacts.

- Never create or commit `.env` files or secrets; update `.env.example` and documentation only.
- Keep migrations additive and document a backup/rollback path for destructive changes.
- Preserve stable client UUIDs, IndexedDB-first behavior, queued mutations, idempotency, and explicit conflict resolution.
- Maintain mobile-first, keyboard-accessible UI and PWA update safety.
- Keep Docker development and production paths working; follow the server guide for deployment details.
- Run relevant lint, type, unit, and integration checks before handing off.
- Update documentation and `docs/development/journal.md` for every work item; architecture, data, auth, Docker, and workflow decisions require especially explicit entries.
- Update `docs/PARITY_MATRIX.md` when parity changes.
- Do not declare completion based on infrastructure — a running Docker container or successful sync is not product completion (V3 PRD guardrail).

## 🖥️ Server access conventions

### UbuntuMac (100.105.31.42)
- **SSH alias**: `ubuntumac`, fallbacks `ubuntumac-ip` (Tailscale IP) and `ubuntumac-lan` (LAN IP)
- **Python venv**: `~/mineops-env` — use `~/mineops-env/bin/mineops-data-engine` for all engine commands
- **ADB**: `~/Android/Sdk/platform-tools/adb` — not in default PATH, must add per session
- **Engine code**: `~/mineops-engine`
- **Data root**: `~/mineops-data/releases/`
- Emulator serial: `emulator-5556`
- Full server reference: `SERVER_MASTER_GUIDE.md` (symlinked in repo root)

### Oracle VM (100.81.231.58)
- **SSH alias**: `oracle-vm`
- **Compose project**: `/opt/infra-new/compose` — all MineOps service changes must use `-p infra-new`
- **PocketBase**: container in infra-new stack, port mapping `127.0.0.1:8091→8090`
- **Public endpoint**: `https://mineops-pb.shepswork.com`
- **Server reference**: `docs/ORACLE_VM_SETUP_REFERENCE.md`
- **Deploy guide**: `docs/ORACLE-VM-DEPLOY-SETUP.md`
- **Production guide**: `docs/ORACLE-VM-GUIDE.md`
- **Important**: This is ARM64 (aarch64). Any deployed image must support `linux/arm64`.
- **Traefik/Caddy**: Not used — routing via Cloudflare Tunnel.
