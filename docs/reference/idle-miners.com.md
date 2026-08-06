# idle-miners.com reference documentation

**Date:** 2026-08-04
**Purpose:** Reverse-engineering record of idle-miners.com ("Idle Master's Hub") — its tools, API shapes, and calculator math — used as a **behavioral/UX reference and validation cross-check only**. Per the project's data policy, MineOps numbers come from the APK capture; idle-miners.com data is community-curated and is never a runtime dependency.

## Site overview

A Flask SPA (static assets under `/static/`) for Idle Miner Tycoon. Title: "Idle Master's Hub — Idle Miner Tycoon". Tools discovered from `/static/js/*` and `/static/css/*`:

| Tool | Assets | MineOps counterpart |
|---|---|---|
| FM calculator | `fm-calc-logic.js`, `fm-calc-setup.js`, `fm-calc-chart-init.js` | Frontier playbook + `FRONTIER_BARRIERS` (ported) |
| SM comparison | `sm-comparison-calc.js` | Balanced lineup / manager comparison (ported) |
| Tierlist | `tierlist.js`, `tierlist-standalone.css` | Power-score ranking (ported) |
| Progress tracker | `progress-tracker.js`, `progress-tracker-stages.js` | `frontend/src/lib/progress-tracker.ts` — rebuilt on verified data (ported) |
| Stella elevator | `stella-calc.js`, `stella-bomb.js`, `stella-decision.js` | `frontend/src/lib/stella-elevator.ts` — faithful port, mechanics are manual inputs (ported) |
| Crystal planner | `crystal-planner.js` | `frontend/src/lib/crystal-planner.ts` — structural gates ported, costs manual input (ported); Today upgrade focus now consumes verified manager progression/passive milestones |
| Essence planner | `frontend/src/lib/essence-planner.ts`, Strategy UI | Rebuilt using active-catalog `elementalRecipe` rows and the user’s synced Kolibri essence inventory. Pouch simulation remains unavailable until APK-backed yields are verified. |
| Chrono schedule | `chrono-*.js` | Not ported — community-maintained event-rotation schedule, not our data |

## API endpoints and data shapes

- **`GET /api/sm-data`** → 112 Super Managers. Fields: `id`, `gameId`, `name`, `rarity` (common/rare/epic/legendary), `area` (mineshaft/elevator/warehouse), `activeL1`, `activeL100`, `cooldown`, `duration`, `descriptionLong/Short`, `elements` (10 entries: `element` + `effectiveness` SE/PE/NVE + `rankReq`), `passives`, `placeholderIndices`, `sprite`. This is the same shape MineOps's `MANAGER_ENRICHMENT` was captured from.
- **`GET /api/sm-actives`** → per-manager exact active tables: `{ type, scaleType, values: [[per rank] × per promotion] }`.
- **`GET /static/data/sm_passive_tables.json`** → passive unlock tables (`maxPromoByRank`, `passiveUnlockByPromo`, per-rank passive values).
- **`GET /api/fm-data`** → the Frontier Mine barrier table: `{ Name: "FM I 5", "Time Before Skip", "Time After Skip", "FC Cost Before": 97, "FC Cost After": 29, "FC received after unlocking it (no pass)", "Premium Pass", "Elite Frontier Pass", "Range of MS which give the FC": "MS 6-10" }`.
- **`POST /api/calculate`** — FM calculator backend; the cost/income math runs server-side.

## FM calculator model (reverse-engineered)

The barrier table drives the Frontier playbook:

- Each checkpoint `FM {tier} {shaft}` has a **skip cost after** (e.g. FM I 5 = 29 FC) and a **before** cost (97 FC); MineOps's `FRONTIER_BARRIERS` stores the "after" values, matching this table (verified: FM I 5 → 29, FM I 10 → 40).
- Each checkpoint has a **wait time** before/after skipping (e.g. 34:33 → 7:33) and a **mine-shaft range** that produces its FC income (e.g. MS 6–10).
- Pass tiers (no pass / Premium / Elite) adjust FC rewards; MineOps's `reward: {free, premium, elite}` mirrors this.

## Relationship to MineOps and the validation-diff hook

- **Verified APK data wins.** The published `manager-domain.json` exact level tables and `research-domain.json`/`mine-economy-domain.json` identities come from the game files, not this site.
- **Cross-check only:** the Phase-4 validation diff compares APK-derived exact active/passive tables against `/api/sm-actives` + `sm_passive_tables.json` to catch extraction bugs; any mismatch is investigated, not adopted.
- The reference crystal planner exposes blue/red crystal budgets, crystal spend schedules, and Mainland income inputs. MineOps does not currently claim those values: the current normalized player/catalog package contains manager progress and progression/passive definitions, but no normalized crystal inventory, crystal price schedule, or blue/red income fields. The UI must label those values unavailable until the capture pipeline proves them.
- **When the APK frontier bundles are decoded** into a release-scoped barrier table, `verifiedBarrierTableFromDomain` (`frontend/src/lib/barrier-tables.ts`) swaps out the hardcoded reference table automatically. Until then the reference table is labeled patch-sensitive in the UI.
