# MineOpsWeb Agent Guide

## 📖 Required reading before any changes

Read these files in order:
1. `docs/development/journal.md` — **session history, known issues, and all recent decisions.** This is the single source of truth for what has been done and what is known to be broken.
2. `PRD.md` — the V3 product requirements document (authoritative).
3. `AGENTS.md` — this file.
4. `docs/architecture/*.md` — architecture decisions and data/sync models.
5. `docs/server-guide` — if it exists; production deployment details.

The iOS project at `../mineops-companion` is the behavioral reference until the parity matrix (`docs/PARITY_MATRIX.md`) says the web has achieved parity.

## ⚠️ Known issues (check journal.md for full details)

- **Kolibri fragment field name unconfirmed** — the parser reads `Fragments` but the exact field name in the Kolibri save response hasn't been verified via a real sync. Check browser console for `[kolibri] First manager raw keys:` debug output.
- **PocketBase `player_snapshots` collection** — the remote PB instance on `mineops-pb.shepswork.com` returns 400 for snapshot queries. The collection may not exist or the migration hasn't been applied on that instance.
- **Strategy page is a placeholder** — only shows "strongest per area". Needs real lineup evaluation and recommendations (V3 PRD Step 8).
- **More page** — needs import history, snapshot rollback, and full diagnostics (V3 PRD Step 9).

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

- Never create or commit `.env` files or secrets; update `.env.example` and documentation only.
- Keep migrations additive and document a backup/rollback path for destructive changes.
- Preserve stable client UUIDs, IndexedDB-first behavior, queued mutations, idempotency, and explicit conflict resolution.
- Maintain mobile-first, keyboard-accessible UI and PWA update safety.
- Keep Docker development and production paths working; follow the server guide for deployment details.
- Run relevant lint, type, unit, and integration checks before handing off.
- Update documentation and `docs/development/journal.md` for every material architecture, data, auth, Docker, or workflow decision.
- Update `docs/PARITY_MATRIX.md` when parity changes.
- Do not declare completion based on infrastructure — a running Docker container or successful sync is not product completion (V3 PRD guardrail).
