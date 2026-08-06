# Handoff: Tool-Call Conventions & Current State (for the next agent)

**Date:** 2026-08-05
**Read this first, then `AGENTS.md` and `docs/development/journal.md`.** This document exists so a fresh agent can operate this repo without re-learning the environment and without burning turns on tool-call failures that are already understood.

---

## 1. The tool-call environment (what works, what doesn't)

- Host is **macOS (darwin/arm64)**, shell **bash**. Node v26.5.0, npm 11, python3 3.13, docker, git, make available. **No `rg`, no `go`, no `cargo`** — use `grep -rn`, `python3`, `node`.
- **Writes are confined to the workspace** `/Users/yancyshepherd/Projects/MineOpsWeb`. `/tmp` writes are **blocked** by the sandbox. For scratch scripts that must run server-side, put them in `ops/` in the repo (remember to delete them later) or in `tools/` (permanent). `tools/data/` is **gitignored** — regenerated artifacts go there, never committed.
- Economy mode: keep work direct; use `connect_tool_source` only when you genuinely need a capability the core file/shell tools lack (e.g. `workflow` for `todo_write`/`complete_step`, `ask` for user decisions).
- The `ask` tool exists for genuine user-owned forks (approach, scope, deploy target). **YOLO mode does not answer `ask` questions** — you still call it when a real fork appears; otherwise pick the sensible reversible default and state the assumption.

## 2. The workflow tools (`todo_write` / `complete_step`) — read this carefully

The host drives a **serial task list**. Failing to follow these rules cost multiple turns before they were internalized:

1. **`todo_write`** establishes the list. Use one level-0 item per phase plus level-1 sub-steps.
2. **Exactly ONE `in_progress` item at a time.** The list is serial; a second `in_progress` is rejected outright.
3. **`complete_step` signs off the CURRENT in_progress item only.** You cannot batch completions and you cannot sign an earlier todo out of order — the host advances the list for you after each sign-off. Pass the todo's `content` as `step`, its 1-based index as `step_index`, and always include `result` + `evidence`.
4. **Level-0 (phase) items must be signed off too**, after their sub-steps.
5. **Evidence rules (the expensive ones):**
   - `kind: "verification"` commands are matched against the **session command history, verbatim**. Any deviation fails: wrong quote escaping (`\"` vs `"`), different trailing pipe count (`tail -3` vs `tail -4`), a `&&`-joined command that actually ran as two calls, whitespace. If in doubt, re-run the exact command now, or use `kind: "manual"` for the claim instead.
   - `kind: "files"` paths must have a successful **read/write receipt in the current turn**. Files created in an earlier turn fail the check — cite what you touched this turn, or re-run a check now.
   - `kind: "manual"` needs no matching receipt but counts as unverified evidence; use it for things that aren't re-runnable (probes from earlier turns, interpretation).
   - A failed `complete_step` does NOT lose the todo; repair the evidence (pick the exact command from the error's "commands that ran" list) and retry. **Repeated identical retries are bounded** — fix the citation, don't hammer.
6. **The single biggest failure pattern:** running a probe as `ssh host 'multi-line python -c "…nested quotes…"'` then trying to cite it. The history stores the exact string including `\"` escapes; reconstructing it by hand almost never matches. **Fix: write the probe to `ops/_probe_xyz.py`, pipe it via stdin, and cite a quote-free command:**
   ```
   ssh -o BatchMode=yes ubuntumac /home/yancmo/mineops-env/bin/python - < ops/_probe_xyz.py
   ```
   (Note: use the **absolute** remote python path — `~`/`$HOME` can be expanded by the local shell and silently break.)

## 3. Server conventions (both hosts, from AGENTS.md + experience)

- **UbuntuMac** = `ssh -o BatchMode=yes ubuntumac` (user `yancmo`, `~/.ssh/id_rsa`). Engine at `/home/yancmo/mineops-engine/src/mineops_data_engine/`, venv python `/home/yancmo/mineops-env/bin/python`, data root `/home/yancmo/mineops-data/releases/`. Repo copies under `ops/` must be **deployed** to the engine dir to take effect (repo ≠ engine; `diff` them to confirm).
- **Oracle VM** = `ssh -o BatchMode=yes oracle-vm`. Compose project `infra-new` (`/opt/infra-new/compose`, always `-p infra-new`), PocketBase `127.0.0.1:8091`, public `https://mineops-pb.shepswork.com`, live web `https://mineops.shepswork.com`. ARM64 — any image must support `linux/arm64`. No direct UbuntuMac→Oracle scp (publickey denied) — relay via the local Mac. Artifact mount `/opt/infra-new/catalog-artifacts/releases/` is root-owned; stage with sudo.
- **Production catalog discipline (never skip):** cold backup (`/opt/infra-new/backups/mineops-catalog/`, verify `sha256sum -c` + sqlite `PRAGMA integrity_check`) → register → **hash-bound review** → transactional publish. The PB data volume is `infra-new_mineops_pb_data` (a wrong volume name yields an empty tar — check tar contents before trusting the backup). Credentials only from `.env` on the server, never in scripts.
- **Deploy path:** CI ("Build and Push (main → GHCR)") builds only on push to **main**; watchtower on Oracle recreates the container. Work on `dev`, verify, fast-forward merge `main`, push. Live smoke: `node tools/cdp-smoke.mjs "https://mineops.shepswork.com/"`.

## 4. House rules that must never be broken

- **No fabricated game data.** Values must come from the verified APK catalog or be explicitly labeled manual inputs. Never invent Unity field names/semantics (the codebase forbids fabrication; the power-score field names remain unverified on purpose).
- **Exact rows only** — no interpolation on manager progression (`effectiveActiveValue` uses exact level rows or the level-1 base; `limitedData` flags missing rows).
- Every work item requires a **dated `docs/development/journal.md` entry** plus updates to any pertinent docs (`PARITY_MATRIX.md`, architecture, validation, reference, deployment).
- Never commit `.env` or secrets; keep migrations additive with documented rollback.

## 5. Current state (as of this handoff)

**Branch:** `main` == `dev` at `de4749c`. All four recent commits are live: `926e449` (repair of the Strategy/More crash + beacons), `d864b45` (user's), `7485a95` (phases 2–4: verified planner on lossless-v2), `de4749c` (feature push: progress tracker, Stella's elevator, crystal planner).

**Live:** mineops.shepswork.com serves `de4749c` (assets `index-ltj0Wq4l.js`), catalog pointer `lossless-v2` (15 artifacts, manifest `3d9ec0037ed30890…`), beacon POST `/api/vitals` and `/api/errors` → 204. CI run for `de4749c` = `30962919464` (success). CDP smoke: FIRST LOAD / STRATEGY / MORE render OK, zero page errors.

**Test/build:** 225 tests / 24 files (`cd frontend && npm test`), `npx tsc -b` clean, `npm run build` clean. Main bundle 201.6 kB (flat); all planner code lives in the lazy `StrategyPage` chunk (62.25 kB). Bundle guardrail: keep new UI in lazy chunks, no new deps.

**Strategy page plan cards now:** Frontier playbook · Lineup · Upgrades · Tier list & compare · **Progress tracker** · **Stella's Elevator** · **Crystal planner** (all in `frontend/src/lib/*` + `StrategyPage.tsx`).

**Known honest gaps (do not fake; extraction passes can close them):**
- Power-score field **names** unverified (no game class definition) — see `docs/power-score-parity.md`.
- Frontier barrier **cost tables** still reference-provenance (`FRONTIER_BARRIERS` + banner); `verifiedBarrierTableFromDomain` in `barrier-tables.ts` is schema-ready for an APK-decode swap.
- Crystal shop costs (13 raw configs in strategy-configs, all `partial`) — crystal planner takes manual costs.
- Mine-economy magnitudes (continent/shaft numbers) not yet decoded.
- Chrono schedule + essence planner not ported (data not owned).
- **Out-of-scope known issues** (pre-existing): Kolibri fragment field name unconfirmed (console `[kolibri] First manager raw keys:`), Oracle `player_snapshots` 400, Oracle `sort=-created` 400 on `catalog_versions` (frontend falls back).

**Infrastructure note:** UbuntuMac's next weekly run (Aug 9) exercises the fixed release selection on the current 5.59.0/96449 APK. The superseded capture `5.59.0_96449_20260802T070052Z` was discarded and never ingested — fine to leave.

## 6. Typical session skeleton (proven to work)

1. `connect_tool_source source=workflow` (if not already enabled), then `todo_write` with the plan (one level-0 per phase, level-1 sub-steps, single in_progress).
2. Execute a sub-step; verify with a **simple, quote-free command** (or a `ops/` script piped via ssh stdin).
3. `complete_step` with `step` (exact todo content), `step_index` (1-based list index), `result`, and `evidence` citing only this-turn receipts.
4. Repeat; sign off level-0 phases after their sub-steps.
5. Before shipping: full suite, tsc, build, `git diff --check`, journal entry + pertinent docs, commit on `dev`, ff-merge `main`, push, wait for CI (`gh run list --branch main --limit 1`), confirm watchtower recreate, run `cdp-smoke.mjs`.
