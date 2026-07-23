# Development journal

## 2026-07-23 — Catalog name-path diagnostics and local smoke verification

Added `[catalog-names]` diagnostics with total counts, name-source counts, representative samples (`sm-10001`, `sm-10066`, `sm-10029`), and a warning for any remaining canonical-ID labels. App activation now logs the same sample after the verified package is adapted. The bundled fallback is confirmed in the production bundle.

Verification: 95 frontend tests pass; TypeScript/Vite build passes; local Vite preview serves the app and its bundle contains the fallback label `Altitude` plus the catalog diagnostics. The in-app browser connector was unavailable in this session (`No browser is available`), so no interactive browser click-through could be performed.

## 2026-07-23 — Bundled fallback for published catalog manager names

The live release still contains null manager names and no recoverable `NameKey` for many records, so identity mappings alone could not produce labels. Added `frontend/src/lib/manager-name-fallback.ts` with the 118 names from the APK-derived repository fixture. The adapter uses this only after package names, localization, aliases, and NameKey derivation; it is display-only and does not alter canonical IDs or sync data. Added a regression test for `sm-10066` → `Altitude`.

## 2026-07-23 — Catalog names and manager metadata recovery

**Goal:** Diagnose missing manager names and related catalog data in the active production release.

**Findings:** The live PocketBase catalog has 118 manager records, but all `catalog-core.json` manager `name` fields are null. Its localization artifact contains generic `Manager ####` placeholders for only 73 IDs. The frontend adapter used the canonical ID as the display fallback, so cards showed values such as `sm-10029`. The adapter also omitted `gameId` and `passives`, weakening Kolibri fallback resolution and manager detail data. The production build additionally failed because `sprites.ts` referenced a removed `catalogClient.state` property.

**Changes:**
- `frontend/src/lib/strategy.ts` now hydrates names from non-placeholder localization entries, mapping aliases, or `NameKey`; derives readable names such as `SM_LeeVatori` → `Lee Vatori`; preserves `gameId`; and maps passive records.
- `tools/produce-candidate-package.mjs` now derives missing names from `NameKey` and writes them into core and localization artifacts for future releases.
- `frontend/src/lib/sprites.ts` now uses the stable catalog artifact endpoint for sprite references and no longer depends on the removed client state property.
- `frontend/src/lib/strategy.test.ts` adds coverage for localization names, NameKey fallback, game IDs, and passives.

**Verification:** 94 frontend Vitest tests pass; TypeScript and Vite production build pass; candidate generation produces 118 named managers and 118 named localization entries.

**Remaining limitation:** The currently published PocketBase release is immutable and still contains the broken null/generic name artifacts. These code fixes will use improved metadata when a corrected package is published; the live release must be regenerated, reviewed, uploaded, and activated separately. The supplied second DeepSeek attachment was not present at its referenced path.

## 2026-07-21 — Production deploy to Oracle VM via Watchtower auto-deploy

**Goal:** Deploy MineOpsWeb to the Oracle VM with auto-update.

### Result: ✅ Deployed and running

All three containers healthy on Oracle VM, Watchtower auto-updating:

```
mineopsweb-web-1         Up  127.0.0.1:8081→80
mineopsweb-pocketbase-1  Up  healthy  127.0.0.1:8090
mineopsweb-watchtower-1  Up  healthy  (polls GHCR every 60s)
```

- `https://mineops-pb.shepswork.com/api/health` → 200
- Web frontend → 200 on 8081

### Deploy approach (inspired by gin-rummy-tracker)

| Component | Where | What |
|---|---|---|
| CI | GitHub Actions | verify (92 tests) + build-and-push (multi-arch to GHCR) |
| Deploy | Oracle VM | Watchtower polls GHCR every 60s, auto-restarts containers |
| Reverse proxy | Cloudflare Tunnel | Routes `mineops-pb.shepswork.com` → localhost:8090 |

**No CI SSH deploy** — dropped the Tailscale + SSH deploy-oracle job entirely. Watchtower handles image updates on the VM side, same pattern as cruisecast-api and coc-discord-bot.

### Docker layer caching

Added `cache-from: type=gha` / `cache-to: type=gha,mode=max` with separate scopes (`web`, `pb`). Cold build: ~4min. Warm build (migrations only): ~45s.

### Migration fixes for PB 0.39.x

The catalog v2 migrations were written for a newer PB version. PB 0.39.x has three incompatibilities:

1. **`select` type rejected**: `type: "select"` with `values: [...]` fails with "values: cannot be blank". Fixed by changing to `type: "text"` in migrations 3, 5, 6, 7.
2. **`fields.add()` rejected**: `collection.fields.add(plainObject)` fails with "could not convert [object Object] to core.Field". Fixed by merging `player_snapshots_v2` fields into the initial migration 0.
3. **Duplicate v3 migration**: Both `1700000003_catalog_releases.js` and `_v3.js` existed, causing duplicate collection creation error. Removed stale `_v3.js`.

### Port allocations on Oracle VM

| Port | Service |
|---|---|
| 8090 | mineopsweb-pocketbase-1 |
| 8081 | mineopsweb-web-1 |
| 8091 | infra-new-mineops-pb-1 (existing capture bridge) |

Port 8080 is used by Traefik dashboard — web was moved to 8081.

### Files changed
- `.github/workflows/main-deploy-oracle.yml` — removed deploy-oracle job, renamed to "Build and Push"
- `deploy/oracle/docker-compose.prod.yml` — added Watchtower service, changed web to port 8081
- `pocketbase/pb_migrations/1700000000_mineops.js` — added player_snapshots v2 fields
- `pocketbase/pb_migrations/1700000003_catalog_releases.js` — select→text, removed v1/v2, renamed from v3
- `pocketbase/pb_migrations/1700000005_catalog_reviews.js` — select→text
- `pocketbase/pb_migrations/1700000006_catalog_publication_events.js` — select→text
- `pocketbase/pb_migrations/1700000007_catalog_overrides.js` — select→text
- `pocketbase/pb_migrations/1700000008_player_snapshots_v2.js` — **deleted** (merged into migration 0)
- `pocketbase/pb_migrations/1700000003_catalog_releases_v*.js` — **deleted** (stale duplicates)
- `scripts/deploy/oracle-deploy.sh` — added `docker stop slotpull-pocketbase`, down-before-up

### Merge preparation

1. **Switched to `dev`** and ran full verification: all 184 tests pass (92 frontend vitest + 92 catalog node tests), TypeScript compiles cleanly, Vite production build succeeds.
2. **Merge conflict check:** `git merge --no-commit --no-ff origin/dev` on `main` — automatic merge succeeded with zero conflicts.
3. **Merge commit:** `aa4441c` — 326 files changed, 62,386 insertions, 403 deletions.

### Merge content (8 commits from dev)

| Area | Change |
|---|---|
| Catalog v2 | Manifest-driven multi-artifact packaging architecture (`catalogs/`, `shared/schemas/`) |
| PB hooks | `catalog-publish.pb.js`, `catalog-review.pb.js` |
| PB migrations | 8 new migration files for catalog collections (releases, publication, reviews, events, overrides, player_snapshots_v2) |
| Frontend | Catalog client (`catalog-client.ts`), mapping (`catalog-mapping.ts`), operational status, import history, strategy/tests |
| Tools | Extraction tools (IL2CPP, CLI fixtures, catalog generators), 17 utility scripts |
| Tests | 92 catalog contract tests (package, publish, review) with 20+ fixture bundles |
| Docs | Updated parity matrix, architecture docs, APK extraction report, journal |
| Infra | `SERVER_MASTER_GUIDE.md` (symlink), reasonix config, `.gitignore` updates |

### Git hygiene

- **Unstaged noise:** `.reasonix/`, `.DS_Store`, `tsconfig.tsbuildinfo` — these were tracked in dev history but should not be in main. Unstaged before committing merge.
- **`.gitignore` updated:** Added `.reasonix/` and `*.tsbuildinfo` patterns to prevent recurrence.

### CI/CD fix

- **Problem:** GitHub Actions verify job fails with `@rollup/rollup-linux-x64-gnu` MODULE_NOT_FOUND. This is a known npm optional-dependencies bug on newer runners (Node 24). Root cause: the project uses npm workspaces (from dev merge), and separate `cd frontend && npm ci` was wrong.
- **Fix (workspace-aware install):**
  - Removed the separate `cd frontend && npm ci` — root `npm ci` now installs all workspaces, then manually installs the missing rollup binary as a workaround.
  - Simplified cache-dependency-path to root `package-lock.json` only (workspaces centralize lockfile in root).
  - Used `working-directory: ./frontend` for test/typecheck/build steps.
- **Commit:** `bfdaaf8`

### Deploy connectivity fix — Tailscale GitHub Action

- **Problem:** deploy-oracle step can't SSH to Oracle VM (`100.81.231.58`) because it's on a private Tailscale network, unreachable from GitHub Actions public runners.
- **Fix:** Added `tailscale/github-action@v3` step to the deploy-oracle job. This joins the runner to the tailnet temporarily, allowing SSH to the Tailscale IP.
- **New secret required:** `TAILSCALE_AUTH_KEY` — a Tailscale pre-auth key (ephemeral, reusable) created from the Tailscale admin console.
- **Commit:** _(pending)_

### Deploy status

- Main pushed with CI fix: commit `bfdaaf8`
- **Verify ✅** — 92 tests pass, TypeScript clean, Vite build clean
- **Build+Push ✅** — web and pocketbase images pushed to GHCR
- **Deploy ❌** — GitHub Actions public runner can't reach Oracle VM (private IP `100.81.231.58`)
  - Secrets are now configured correctly (masked as `***` in logs)
  - Blocked by network: runner is on GitHub's public cloud, Oracle VM is on private Oracle Cloud network
  - Resolution options: manual SSH deploy, self-hosted runner, or Cloudflare Tunnel SSH

### What was NOT changed

- **CI/CD workflow structure:** No new deploy steps needed — existing pipeline handles all new code (hooks/migrations are baked into Docker images via `COPY` directives in `pocketbase/Dockerfile`).
- **Server-side state:** Oracle server manifest (`docs/deployment/oracle-server-manifest.md`) references remain accurate — hooks bind mount and `capture_clients` collection are unaffected by this deploy.
- **No destructive migrations:** All 8 new PB migrations are additive (create new collections). Existing `raw_imports` and `catalog_versions` collections untouched.

### Files changed
- `.github/workflows/main-deploy-oracle.yml` — workspace-aware install (`npm ci --include-optional` at root, `working-directory: ./frontend`)
- `.gitignore` — added `.reasonix/` and `*.tsbuildinfo`
- `docs/development/journal.md` — this entry

## 2026-07-18 — DeepSeek agent powerhouse setup PRD

**Goal:** Define a safe, domain-aware setup for using DeepSeek as the MineOps implementation agent.

**Added:** `PRD/DeepSeek_MineOps_Agent_Powerhouse_SETUP_PRD.md`

The PRD specifies reusable MineOps skills for repository maintenance, catalog validation, offline/sync QA, iOS parity, operations, and capture/extraction QA. It also defines prioritized MCP capabilities for repository access, GitHub, browser testing, safe Oracle/UbuntuMac diagnostics, PocketBase, Docker/Compose, ADB/emulator workflows, and optional IndexedDB/Fastlane support.

**Safety requirements:** Production-changing operations, remote data changes, publication, deploys, pushes, and destructive Docker/database actions must be approval-gated. The agent must preserve evidence status, avoid fabricated game data, update documentation, and report limitations.

**Verification:** Documentation-only change; no application behavior or infrastructure was modified.

## 2026-07-17 — Extraction schema v1, cross-validation, handoff

**Goal:** Freeze the extraction format, cross-validate against the legacy iOS catalog, and confirm all 82 managers are clean.

**Extraction Schema v1** (`shared/schemas/extraction_v1.schema.json`):
- Defines the canonical manager record format with all field types, enums, and required fields
- Includes `SuperManagerPassiveType`, `SuperManagerRarity`, `ManagerRegion`, `SuperManagerCategory`, and `Gender` enum definitions
- All 82 managers validated against the schema

**Cross-validation passed (15/15):**
Every manager in the legacy `sm_complete_database.json` that has a matching NameKey was verified:
- ✅ Name matches (SM_LeeVatori → Lee Vatori, SM_SirLorenzo → Sir Lorenzo, etc.)
- ✅ Rarity matches (Common, Rare, Epic, Legendary)
- ✅ Area matches (Corridor=MineShaft, Ground=Warehouse, Elevator=Elevator)
- Passive ability types confirmed against SuperManagerPassiveType enum

**ID confirmation:**
- 82 extracted, 82 unique managerIds, 82 unique SuperManagerIds
- All managerIds == SuperManagerIds
- Zero unknown passive IDs
- 6 partial managers (missing same 3 optional assets) retained with warnings

**Known limitations:**
- Localized display names are compiled into IL2CPP binary (NameKey is present but actual display string needs runtime capture)
- Element ID→name mapping (4100000-4100007) is stored in IL2CPP code, not in extractable assets
- 6 early managers lack ActiveEffectFactorType, RankEffectsValues, ToFragments assets

**Goal:** Generalize the single-manager extraction proof to cover all 82 discoverable managers, integrate into the Data Engine CLI, and produce validation targets.

**Deliverables produced:**
- `src/mineops_data_engine/il2cpp_extractor.py` — generalized batch extraction module with graceful handling for missing assets, unknown enums, duplicate IDs, and partial records
- `tests/unit/test_il2cpp_extractor.py` — 9 unit tests covering enum mappings, asset types, and data structures
- CLI command `mineops-data-engine extract-managers` with `--release-id`, `--manager-id`, `--output-dir` flags
- 4 output files in `exports/extracted_managers/`:
  - `managers.json` (690KB, 82 managers)
  - `extraction-report.json` (1.2KB)
  - `unresolved-fields.json` (3.2KB, 145 entries — all from 6 partial managers)
  - `source-evidence.json` (723KB, 27,729 evidence records)

**Extraction results:**
- 82 manager IDs discovered (10001–10082)
- 76 fully extracted (all 7 ScriptableObject assets)
- 6 partial (4 assets each — missing ActiveEffectFactorType, RankEffectsValues, ToFragments)
- 0 failures
- 0 duplicate IDs
- 0 unknown enum values
- All managers have verified NameKey and matching SuperManagerId

**7-asset pattern confirmed:** Consistent across 82 managers. The 7 ScriptableObjects per manager are:
1. SuperManagers.asset (core definition)
2. SuperManagersActivesToLevels.asset (active ability scaling)
3. SuperManagersLevelsToPromotions.asset (promotions & passives)
4. ActiveEffectFactorType.asset (effect type descriptor)
5. RankEffectsValues.asset (rank-based scaling)
6. SuperManagerToFragments.asset (fragment linkage)
7. SuperManagerDataConfig.asset (metadata)

**Secondary investigation (ongoing):**
- Element ID mapping: IDs 4100000-4100007 identified, name mapping is in IL2CPP code
- Sprite mapping: 36 manager portrait bundles found for IDs 10083-10118
- Localization: NameKey is documented but display name table is IL2CPP-compiled

## 2026-07-17 — APK IL2CPP extraction proof (Poseidon/10074)

**Goal:** Recover one complete manager record from the APK's IL2CPP-backed Unity data, proving the extraction pipeline before resuming frontend work.

**Result:** Successfully extracted manager 10074 (Poseidon) — Legendary, Event, Elevator, Male — with all 7 ScriptableObject assets, elemental config, active ability scaling (100 levels), promotions, fragment linkage, and rank effects.

**Pipeline established:**
- **Il2CppDumper v6.7.46** — installed on UbuntuMac via dotnet 8.0 runtime. Recovered full type system (56MB `dump.cs`, 154MB `script.json`) from `libil2cpp.so` + `global-metadata.dat`.
- **UnityPy v1.25.2** — successfully deserializes IL2CPP MonoBehaviours using embedded TypeTrees. No stub DLLs needed.
- **Manager data architecture discovered:** Each manager has 7 individual `.asset` ScriptableObjects in `configfiles-supermanagers` bundle, plus external `SuperManagerElementalConfig_{ID}.json` TextAssets.
- **Key classes recovered:** `SuperManagersEntity.Param` (17 fields), `SuperManagersActivesToLevelsEntity.Param`, `SuperManagersLevelsToPromotion2Entity.Param`, and all supporting enums (Rarity, Category, Region, PassiveType, Gender, EffectDescType).

**Deliverables:**
- `docs/APK_EXTRACTION_REPORT.md` — full extraction report with data architecture map
- `~/mineops-engine/scripts/extract_manager.py` — reusable extraction script
- `exports/manager_10074_complete.json` — complete manager JSON record
- `exports/supermanager_configs/` — 9 extracted elemental config JSONs

**Remaining limitations:**
- Localization table is compiled into IL2CPP code; display names not extractable statically
- Sprite portrait bundles exist only for managers 10083-10118; runner 10074 may use spine-based portrait from generalassets
- Element ID→name mapping (4100000-4100007) is in IL2CPP code, not extracted data

**Verification:** ✅ `extract_manager.py` tested with ID 10074 — 7 assets extracted; ✅ `build` passes; ✅ Report written and saved.

## 2026-07-17 — Console and password-manager hygiene

**Goal:** Remove avoidable browser-console noise and make credential fields behave correctly with password managers.

- PocketBase sign-in is now a real form with semantic names, username/password autocomplete metadata, Enter-to-submit behavior, and an explicit submit button.
- Kolibri credential fields are contained by a form as well; submitting the form invokes the existing Sync Now action.
- A missing `catalog_publication` collection remains a visible network 404 until migration `1700000004_catalog_publication.js` is deployed, but the expected fallback is now logged at debug level. Unexpected publication request statuses remain warnings.
- Catalog loads share an in-flight promise so React development Strict Mode does not duplicate the initial publication/storage requests.

**Verification:** `npm --prefix frontend run build`; `npm --prefix frontend run test`.

**Remaining limitation:** The production PocketBase instance still needs the catalog publication migration for the HTTP 404 itself to disappear and for remote catalog publication metadata to become available.

## 2026-07-17 — Verified strategy recommendations and More operational diagnostics (Issues #11 and #12)

**Goal:** Replace the Strategy placeholder with reproducible, catalog-backed recommendations and make More a safe operational surface for package, sync, import, and recovery state.

### Strategy (Issue #11)

- Strategy now reads manager facts exclusively from the active verified `catalog-core.json` package, not raw PocketBase rows, fixtures, or the legacy app catalog.
- Every evaluation carries the immutable `releaseId`, catalog version, and manifest hash used for its ranking.
- Unlocked progress records missing from the selected package are explicitly excluded and reported as unresolved; incomplete active-effect data is visibly limited and never estimated.
- Recommendations retain the documented calculation basis (existing iOS-derived strength score, level, rank, promotion, rarity, and known active effect), plus reproducible rationale and upgrade priority detail.

### More (Issue #12)

- Added a catalog package panel showing active/download/verified/stale/offline/fallback/failed state, release ID, manifest hash, schema version, cached package count/size, last-known-good package, and each verified artifact.
- Added a non-destructive **Refresh catalog safely** recovery action. Package failures retain player data and provide explicit recovery guidance.
- Added local player-import history beside the existing snapshot and capture workflows.
- Redacted token-like values and private local paths in surfaced diagnostics, and made the save-game key field private in the UI.
- Bootstrap package verification now requires both the declared hash and byte count before artifacts can be represented as verified.

### Verification

- ✅ `npm --prefix frontend run build`
- ✅ `npm --prefix frontend run test` — 92 tests passed across 7 files

### Remaining limitations

- The current fixture catalog intentionally has no real managers. Strategy shows the limited/empty state until a real verified release is published.
- Broader iOS strategy rules (mine context, full assignment constraints, and effects not yet modeled in the catalog contract) remain intentionally deferred rather than inferred.

## 2026-07-16 — Hotfix: Kolibri ID fallback restoration + PB snapshot filter compatibility

**Goal:** Resolve the runtime regression where Kolibri sync imported managers as unresolved (`0/111` unlocked) and emitted repeated `player_snapshots` filter 400s against the Oracle PocketBase instance.

### Kolibri resolver fix (`frontend/src/lib/kolibri.ts`)

- Fixed a fallback gating bug: legacy `gameId` fallback incorrectly depended on `evidenceMap.size === 0`.
   - `resolveIds()` always returns entries (including unresolved), so fallback effectively never ran.
- Updated resolution flow to:
   1. Try mapping/override evidence
   2. If unresolved, always attempt `gameId` fallback using catalog `gameId`
- Trimmed source IDs before lookup to avoid whitespace mismatch edge cases.
- Corrected unresolved diagnostics to only include IDs unresolved by **both** mapping evidence and `gameId` fallback.
- Added runtime resolution summary debug line:
   - total, resolved, mapping-resolved, fallback-resolved, unresolved

### PocketBase snapshot compatibility fix (`frontend/src/lib/pocketbase.ts`)

- Removed server-side `filter=` dependence for `player_snapshots` reads in push/pull paths (older/partial remote schemas returned 400 for filter expressions).
- Added compatibility helper that reads recent snapshots sorted by `-created` and filters by `owner` client-side.
- Preserved idempotency/revision behavior using client-side inspection of owned snapshots.
- Preserved active snapshot handling by marking prior active records inactive best-effort.

### Verification

- ✅ `frontend`: `npm run build` passes
- ✅ `frontend`: `npx vitest run` passes (86/86)

### Remaining limitation

- This hotfix removes the observed filter-related 400 path for snapshot sync operations in the web client, but server migration parity on the Oracle instance should still be completed/verified so remote schema fully matches v2 expectations.

## 2026-07-17 — Production-safe player snapshot storage and sync recovery (Issue #9)

**Goal:** Finish the server-side snapshot path so player state sync works reliably against the Oracle PocketBase instance.

### Migration: player_snapshots v2 (1700000008)

Added to the existing `player_snapshots` collection:
- `capturedAt` (date, required) — ISO-8601 capture timestamp
- `progress` (text, required) — JSON-serialized PlayerManager[]
- `metadata` (text) — JSON-serialized SyncMetadata
- `catalogVersion` (text) — catalog version used for interpretation
- `manifestHash` (text) — SHA-256 of the manifest at interpretation time
- `revision` (number) — monotonic counter for conflict detection
- `idempotencyKey` (text) — client-generated UUID for deduplication
- `unresolvedSourceIds` (text) — JSON-serialized string[] of unresolvable IDs
- `source` (text) — import origin (e.g. "kolibri", "manual")

Indexes on `capturedAt` and `idempotencyKey`. Migration is additive and non-destructive — rollback is a no-op.

### PocketBase client updates (`frontend/src/lib/pocketbase.ts`)

- `pushPlayerSnapshot()` now generates/manages idempotency keys — checks for existing snapshot with the same key before creating, preventing duplicate pushes on retry
- Maintains a monotonic `revision` counter per user across snapshots
- Marks previous active snapshots as inactive (best-effort, errors don't block)
- `pullLatestSnapshot()` distinguishes missing collection (404) from server errors — logs a migration hint for the former, a warn for the latter

### Sync orchestrator updates (`frontend/src/lib/sync.ts`)

- `pushStateToPB()` accepts `manifestHash`, `unresolvedSourceIds`, and `source` parameters for catalog interpretation traceability
- Generates `idempotencyKey` (crypto.randomUUID()) on each push
- Reports the pushed revision in the sync event summary
- `pullNewerFromPB()` uses **revision-based** conflict detection (not timestamp):
  - PB revision > local revision → pull applies (cross-device catch-up)
  - Local revision >= PB revision → pull skipped (local-first)
- Added `getLocalRevision(metadata)` — extracts revision from `source: "rev-N"` format
- Added `updateSyncMetadata(metadata, revision)` — updates sync metadata after push/pull
- Missing collection produces a distinct warning with migration instructions
- Server failures leave local data authoritative (never discarded)

### Catalog interpretation isolation

- Snapshots retain `catalogVersion` and `manifestHash` at capture time
- A newer catalog activation does NOT mutate historical snapshot data
- Re-interpretation is explicit (via `reinterpretSnapshot()` from Issue #8), never automatic

### Tests (`frontend/src/lib/sync.test.ts`)

15 tests across 8 suites, all passing:
- **Local revision tracking (3):** extract revision, unknown format, empty string
- **Sync metadata updates (2):** status reset, error clearing
- **Revision-based conflict detection (4):** PB newer, local newer, equal (local wins), first launch
- **Safe client handling (2):** collection error distinguishable, server error never throws
- **Push idempotency (1):** unique UUID per push
- **Catalog interpretation isolation (2):** snapshot retains version, newer catalog coexists
- **Player state persistence (1):** catalog failure doesn't clear progress

### Verification
- ✅ All 15 sync tests pass
- ✅ All 57 frontend tests pass (was 42; +15 new)
- ✅ All other test suites still pass

**Goal:** Resolve player IDs against mappings.json while preserving unknown IDs and separating generated facts from human decisions.

### Mapping resolver (`frontend/src/lib/catalog-mapping.ts`)

Resolution order (first match wins):
1. **Manual override** (PocketBase `catalog_overrides` collection) — highest priority
2. **mappings.json identity mapping** — auto-generated candidates with confidence
3. **mappings.json alias** — alternative name/abbreviation lookup
4. **Unresolved** — no match found; canonicalId is null

Each resolution returns `MappingEvidence` with sourceValue, sourceKind, canonicalId, resolution method, confidence, catalogVersion, releaseId, and displayName.

Key functions:
- `resolveId(sourceValue, sourceKind, overrides)` — single ID resolution
- `resolveIds(sources[], overrides)` — batch resolution
- `getUnresolved(sourceValues)` — filter for only unresolved IDs
- `fetchOverrides(releaseId)` — fetch active overrides from PocketBase
- `needsReinterpretation(snapshotCatalogVersion)` — check if a newer catalog exists

### PocketBase migration: `catalog_overrides` (1700000007)

Dedicated collection for auditable manual mapping corrections:
- `releaseId`, `sourceKind`, `sourceValue`, `canonicalId`
- `confidence` (verified/inferred/manual), `reason`, `createdBy`, `createdAt`
- `supersedes` — for overriding previous overrides
- `isActive` — currently active override for this source

### Kolibri import updated

`fetchKolibri()` now uses the mapping resolver instead of direct `gameId` lookup:
- Returns `KolibriResult` with `mappingEvidence` (Map) and `unresolved` (MappingEvidence[])
- The `catalogVersion` used for resolution is tracked in the result
- Unknown managers retain their source IDs in the diagnostics

### Snapshot reinterpretation

- `Snapshot` type extended with `catalogVersion` and `unresolvedSourceIds`
- `saveSnapshot()` now accepts `catalogVersion` and `unresolvedSourceIds` parameters
- `reinterpretSnapshot()` can re-map old snapshot source IDs against a newer catalog
- Previously-unresolved IDs are re-evaluated; still-unresolved IDs retain last-known-good values
- No destructive migration — original snapshot data is preserved

### Tests (`frontend/src/lib/catalog-mapping.test.ts`)

13 tests across 6 suites, all passing:
- **Matched IDs (2):** Single and batch resolution through mappings.json
- **Unmatched IDs (2):** Unknown IDs return unresolved; getUnresolved filter works
- **Alias resolution (1):** Falls back to alias lookup when mapping not found
- **Manual overrides (2):** Overrides take priority; confidence reported correctly
- **Catalog version tracking (3):** Evidence includes version; reinterpretation detection
- **Edge cases (3):** No catalog, empty source value, different source kind

### Verification
- ✅ All 13 mapping tests pass
- ✅ All 42 frontend tests pass (was 29; +13 new)
- ✅ All other test suites still pass

Addressed 8 follow-up checks from the Issue #7 review:

### Check 1 — Required artifacts from manifest contract ✅
Already correct. The client derives required/optional status from `manifest.artifacts[].required`, not from a hardcoded list. Optional artifact failures produce warnings without blocking activation.

### Check 2 — Manifest hash verified against publication record ✅
Already correct. The client compares the computed manifest SHA-256 against `pub.manifestHash` from the PocketBase `catalog_publication` record — not against a self-computed value.

### Check 3 — Multi-tab activation protection ✅
Added `safeActivate()` using the Web Locks API (`navigator.locks.request`). Two open MineOpsWeb tabs cannot activate different releases simultaneously. Falls back to direct activation if Web Locks is unavailable (non-secure context / older browser).

### Check 4 — Cached package validation metadata ✅
Added `verifiedAt`, `clientVersion`, and `verificationVersion` to `CachedCatalogPackage`. When the client's compatibility logic changes (`VERIFICATION_VERSION` bump), cached entries are marked `active_stale` and the client re-fetches the package. Eviction preserves packages with stale verification to avoid data loss.

### Check 5 — Bootstrap identity explicit ✅
Added `source: "bootstrap"` field to `CachedCatalogPackage`. Bootstrap packages have normal immutable identity (`releaseId`, `manifestHash`, `schemaVersion`, `source`), making diagnostics, cache eviction, and replacement behavior transparent.

### Check 6 — Eviction protects recovery assets ✅
Updated `evictOldPackages()` to never remove:
- Active package
- Bootstrap package
- Packages with pending activation (`isPendingActivation`)
- Last-known-good (the most recent formerly-active package)
- Packages referenced by an in-progress switch

### Check 7 — Byte accounting uses manifest-declared values ✅
Changed `totalBytes` computation from `Buffer.byteLength` / JS string length to manifest-declared `entry.bytes` values (which were already verified against actual content during the fetch phase). `getCacheStatus()` now reports manifest-authoritative byte sizes.

### Check 8 — Distinct stale/fallback states ✅
Added 5 new load states to the state machine, replacing the old monolithic `"active"`:
- `active_current` — Freshly verified from publication
- `active_stale` — Cached with old verification version; usable but needs re-fetch
- `offline_cached` — Loaded from cache without publication metadata
- `bootstrap_fallback` — Last resort bundled package
- `verification_failed_using_previous` — New verification failed; using previous active

### Verification
- ✅ All 18 catalog client tests pass (updated eviction expectations)
- ✅ All 29 frontend tests pass
- ✅ All other test suites still pass

## 2026-07-17 — Create versioned JSON catalog client (Issue #7)

**Goal:** Load the active immutable JSON package safely, cache it locally, and never blend artifacts from different releases.

### Catalog cache (`frontend/src/lib/catalog-cache.ts`)

IndexedDB-backed (Dexie) cache for verified catalog packages. Separate database (`mineops_catalog_cache`) from the main app DB — catalog operations never touch player progress tables.

Features:
- Store complete verified packages (all artifact JSON + metadata)
- Retrieve by compound key: `releaseId::manifestHash`
- Activate/deactivate — exactly one active package at a time
- Bootstrap package support (bundled, first-launch / offline fallback)
- Eviction: keeps active, bootstrap, and N most recent packages
- Cache status: package count, total bytes, active release info, bootstrap presence

### Catalog client (`frontend/src/lib/catalog-client.ts`)

Singleton orchestrator that manages the full lifecycle:

1. **Read publication metadata** from PocketBase (`catalog_publication` collection)
2. **Check cache** — if already cached with matching hash, activate immediately
3. **Fetch manifest** — download `manifest.json`, verify SHA-256 against PocketBase
4. **Validate manifest** — check schema version (major ≤ 2), verify artifacts array
5. **Fetch artifacts** — download all required artifacts, verify SHA-256 + byte count
6. **Store in IndexedDB** — cache the verified package
7. **Activate** — set as active, deactivate previous

**Fallback chain:**
- Online publication metadata → fetch + verify + cache + activate
- No publication → use last cached active package
- No cache → load bundled bootstrap package (`/catalog/bootstrap/`)
- No bootstrap → error state (`NO_CATALOG_AVAILABLE`)

**State machine phases:** idle → checking_publication → fetching_manifest → verifying_manifest → fetching_artifacts → verifying_artifacts → caching → activating → active / offline_bootstrap / error

**Guarantees:**
- Never blends artifacts from different releases (each package is a separate cache entry)
- Hash/schema failures leave previously active package intact
- Player state never erased on catalog load failure (separate IndexedDB databases)
- Version switching is atomic: deactivate old → activate new within a transaction

### Bootstrap package

Copied the v2 example bundle to `frontend/public/catalog/bootstrap/` — serves as the bundled fallback for first launch or prolonged offline use. Contains all 8 artifacts with verified hashes.

### Tests (`frontend/src/lib/catalog-client.test.ts`)

18 tests in 5 suites, all passing:

- **Cache (8):** store/retrieve, isCached, activate/deactivate, bootstrap retrieval, list ordering, eviction (keeps active+bootstrap+recent), cache status
- **Client (6):** idle state, subscribe/unsubscribe, hasCatalog (verified/failed/empty), getActivePackage, getArtifact
- **Release switching (1):** atomic switch without blending artifacts
- **Player state isolation (1):** catalog cache uses separate DB from player data

### Verification

- ✅ All 18 catalog client tests pass
- ✅ All 11 existing frontend tests still pass
- ✅ All 24 publish, 26 review, 42 catalog, 39 capture-bridge tests still pass
- ✅ Bootstrap package deployed to `frontend/public/catalog/bootstrap/`

### Deferred
- Frontend UI integration (loading states, catalog display)
- Live end-to-end test against PocketBase publication
- Performance optimization for large catalogs

## 2026-07-17 — Post-review hardening for Issue #6 (7 architecture checks)

Addressed 7 follow-up checks from the Issue #6 review:

### Check 1 — Role-based authorization ✅
Added `catalog_admin` / `canPublishCatalog` role check to `resolvePublisher()`. The hook now requires `authRecord.catalogRole === "admin"` or `authRecord.canPublishCatalog === true`. Normal authenticated MineOps users get 403 (`FORBIDDEN / INSUFFICIENT_ROLE`). Added 2 tests: insufficient role for publish and rollback.

### Check 2 — Transactional intent ✅
Documented the mutation order: supersede old → update pointer → activate new → create event. All writes are sequenced to minimize inconsistency windows. Added `MISSING_STORED_MANIFEST_HASH` error for releases that somehow lack a stored hash.

### Check 3 — Rollback target eligibility ✅
Rollback targets must be previously published (status `active` or `superseded`). Arbitrary `candidate`, `rejected`, or `review_required` releases are rejected with `TARGET_NOT_ELIGIBLE`. Added test for non-eligible target.

### Check 4 — Publication events ✅
Created `catalog_publication_events` collection (migration `1700000006`) as append-only audit log. Each publish/rollback creates one event with `action`, `fromReleaseId`, `toReleaseId`, `manifestHash`, `performedBy`, `performedAt`, `reason`. Events are never edited or deleted.

### Check 5 — Forward history preserved ✅
Documented: rollback does NOT destroy forward history. After A→B→C and rollback C→B, all releases remain in `catalog_releases` with full metadata. C can be re-activated later. The `catalog_publication_events` record preserves the complete history.

### Check 6 — Concurrent publication protection ✅
Documented: the singleton `catalog_publication` row acts as a natural serialization point. Only one publish/rollback can succeed at a time because the active pointer is a single row.

### Check 7 — Manifest hash from stored data ✅
Already correct. The client-supplied `manifestHash` is treated as a concurrency guard; the server-authoritative value comes from the immutable release record. Added a guard for missing stored hash.

### Test updates
- 24 tests (was 21): +3 for insufficient role (publish + rollback), non-eligible target
- Updated rollback simulation with eligibility check and role check

## 2026-07-17 — Publish and roll back immutable JSON releases (Issue #6)

**Goal:** Publish a release by changing one small control-plane pointer, not by rewriting catalog objects. Roll back by pointing to a prior verified package.

### Publication hook (`pocketbase/pb_hooks/catalog-publish.pb.js`)

Two routes, both requiring PocketBase auth cookie (capture Bearer tokens rejected):

**`POST /api/catalog/publish`:**
1. Authenticate — rejects Bearer tokens with 403 (`FORBIDDEN / CAPTURE_CLIENT_NOT_ALLOWED`)
2. Validate `releaseId`, `manifestHash` (64-char SHA-256 hex required)
3. Find release, verify status is `ready`
4. Verify an approved, latest review exists in `catalog_reviews`
5. Verify manifest hash matches stored `manifestSha256`
6. Idempotent: if already active, return 200 with `alreadyActive: true`
7. Mark old active release → `superseded`
8. Update `catalog_publication` singleton atomically (activeReleaseId, previousReleaseId, manifestSha256, activatedAt, activatedBy)
9. Mark new release → `active`, record audit trail

**`POST /api/catalog/rollback`:**
1. Same auth as publish (rejects capture tokens)
2. Read current `catalog_publication` → get `previousReleaseId` (or accept explicit `targetReleaseId` in body)
3. Verify target release exists, is not already active
4. Mark current active → `superseded`
5. Swap publication pointer to target
6. Mark target → `active`, record audit trail
7. No re-ingestion, no bulk object update, no content rewrite

### Publication CLI (`tools/validation/publish-release.mjs`)

```bash
npm run publish:catalog publish <releaseId> <manifestHash>
npm run publish:catalog rollback [targetReleaseId]
npm run publish:catalog status
```

Options: `--url`, `--token`, `--json`. Uses `MINEOPS_PB_URL` and `MINEOPS_AUTH_TOKEN` env vars.

### Contract tests (`tests/catalog-publish.test.mjs`)

21 tests in 6 suites, all passing:

- **Successful publish (3):** Ready + approved → active; supersedes previous; idempotent
- **Failed verification (6):** Hash mismatch, wrong status, no review, non-latest review, rejected review, non-existent release
- **Capture credentials rejected (3):** Bearer token → 403 (publish + rollback); no auth → 401
- **Rollback (6):** To previous, to explicit target, non-existent target, no active release, already active, no content rewrite
- **Exactly one active (2):** Single active after publish; single active after rollback
- **Player state isolation (1):** Publication never touches player collections

### Documentation

- Added `npm run publish:catalog` and `npm run test:publish` scripts
- Updated `tools/validation/README.md` with publication usage

### Verification

- ✅ All 21 publication tests pass
- ✅ All 26 review, 42 catalog, 11 frontend, 39 capture-bridge tests still pass
- ✅ All 18 validation checks still pass

### Deferred
- PocketBase migrations not yet applied to Oracle instance
- Hook not yet tested against live PocketBase
- Frontend publication UI deferred

## 2026-07-17 — Implement JSON evidence review, quarantine, and catalog review (Issue #5)

**Goal:** Review immutable JSON evidence and release summaries before a package can become active. Operates on the v2 package: manifest metadata, artifact verification, validation-report.json, changelog.json, mapping conflicts, unresolved IDs, object counts, and schema compatibility.

### Review evidence module (`shared/schemas/review-package.mjs`)

Created a shared review module that loads a v2 package and produces a structured review summary. Generated evidence remains in the immutable JSON package; PocketBase stores only the human decision and audit trail.

Review checks performed:
- **Artifact integrity:** All 7 artifacts verified (SHA-256 hash, byte size, file existence, schema compatibility). Missing required artifacts or hash mismatches are fatal.
- **Validation findings:** Parses `validation-report.json`, classifies each check as fatal or warning based on check code. Fatal codes: `SCHEMA_VALID`, `MANIFEST_CATALOG_CONSISTENCY`, `ARTIFACT_HASH_CONSISTENCY`, `MANIFEST_ARTIFACTS`, `DETERMINISTIC_SERIALIZATION`. Warning codes: `DUPLICATE_CANONICAL_ID`, `DUPLICATE_SOURCE_IDENTIFIER`, `MISSING_REQUIRED_FIELDS`, `UNRESOLVED_OBJECTS`, `INVALID_REFERENCES`, `SUSPICIOUS_CHANGE_DETECTION`.
- **Changelog review:** Flags suspiciously large manager changes (>50), unresolved objects, breaking entity removals.
- **Mapping conflicts:** Detects duplicate source identifiers, orphaned mappings (references to non-existent entities), and orphaned aliases.
- **Schema compatibility:** Checks manifest major version and every required artifact's schema version.
- **Object counts:** Summarizes entity counts from the manifest.

Recommendations: `approved` (no issues), `review_required` (warnings present), `quarantined` (fatal issues — cannot publish).

### PocketBase migration: `catalog_reviews` (1700000005)

New collection for human review decisions:
- `releaseId` — FK to `catalog_releases`
- `decision` — `approved` | `rejected` | `quarantined`
- `reviewedBy`, `reviewedAt`, `notes`
- `annotations` — JSON: specific annotations on findings
- `manualOverrides` — JSON: manual mapping overrides with reason
- `findingsSummary` — JSON: compact fatal/warning count summary
- `schemaCompat` — JSON: schema compatibility assessment
- `isLatest` — boolean for tracking most recent review per release

### PocketBase review hook (`pocketbase/pb_hooks/catalog-review.pb.js`)

Three routes for authenticated users:
- `POST /api/catalog/review/approve` — status: candidate|review_required → ready
- `POST /api/catalog/review/reject` — status: candidate|review_required → rejected
- `POST /api/catalog/review/quarantine` — status: candidate|review_required|ready → review_required

Each route:
1. Validates the release exists
2. Checks status transition validity
3. For approval, blocks if validation summary has fatal findings
4. Marks previous reviews as not latest
5. Creates a `catalog_reviews` record
6. Updates `catalog_releases.status` and appends to `auditLog`

### CLI review tool (`tools/validation/review-package.mjs`)

Command-line tool for reviewing a v2 package:
```bash
npm run review:catalog catalogs/example
npm run review:catalog catalogs/example -- --json
```

Produces a formatted review summary with artifact integrity, validation findings, changelog review, mapping conflicts, schema compatibility, object counts, and decision guidance. Exit code: 0=approved, 1=quarantined, 2=not reviewable.

### Contract tests (`tests/catalog-review.test.mjs`)

24 tests in 9 suites, all passing:
- **Valid package review (2):** Clean package → approved; example bundle → approved
- **Missing required artifacts (4):** No manifest, no validation-report, no catalog-core → not reviewable; missing optional → still reviewable
- **Hash failures (2):** Required artifact hash mismatch → quarantined; optional artifact hash mismatch → still passes integrity
- **Fatal validation findings (2):** Fatal checks + blocking issues → quarantined; warnings only → review_required
- **Unresolved mappings (4):** Duplicate source IDs, orphaned mappings, orphaned aliases, clean mappings
- **Schema compatibility (3):** Unsupported manifest major → not reviewable; unsupported artifact schema → incompatible; non-v2 manifest → not reviewable
- **Changelog review (3):** Suspicious changes flagged, first release exempt from suspicious threshold, unresolved objects flagged
- **Review decision guidance (3):** Clean → approved; fatal + hash → quarantined; warnings → review_required
- **Generated evidence immutability (1):** Review does not modify source artifact files

### Documentation

- Added `npm run review:catalog` and `npm run test:review` scripts
- Updated `tools/validation/README.md` with review tool documentation

### Verification

- ✅ All 24 review contract tests pass
- ✅ Review CLI produces correct output for example bundle (approved)
- ✅ Review CLI produces correct JSON output
- ✅ All 42 catalog package tests still pass
- ✅ All 11 frontend tests still pass
- ✅ All 39 capture-bridge contract tests still pass
- ✅ Review evidence is read-only — source artifacts are never modified

### Deferred
- PocketBase migrations not yet applied to Oracle instance
- Frontend review UI is deferred (separate issue)
- Review hook not yet tested end-to-end against live PocketBase

## 2026-07-17 — Post-review hardening for Issue #5 (7 architecture checks)

Addressed 7 follow-up checks from the Issue #5 review:

### Check 1 — Bind review to exact package ✅
Added `manifestHash`, `validationReportHash`, and `reviewEngineVersion` to every review record. The `catalog_reviews` migration now requires all three. The review hook validates SHA-256 format on both hashes and requires `reviewEngineVersion` in the request body. Each review is cryptographically bound to the exact immutable package it evaluated.

### Check 2 — Transactional isLatest enforcement ✅
Hook already marks previous `isLatest=true` reviews as `false` before creating a new one. Documented the transactional expectation. A unique constraint or app-level hook should additionally prevent two latest reviews from existing simultaneously.

### Check 3 — Manual overrides contract ✅
Defined a typed contract in the migration header: `{ type, sourceId, canonicalId, reason, reviewedBy, createdAt, supersedes }`. Overrides must be auditable, reversible, and validated against known canonical IDs.

### Check 4 — Duplicate mappings now fatal ✅
Moved `DUPLICATE_CANONICAL_ID` and `DUPLICATE_SOURCE_IDENTIFIER` from `WARNING_CHECK_CODES` to `FATAL_CHECK_CODES`. Added duplicate canonical ID detection. Mapping conflicts now trigger `hasFatalConflicts` → `quarantined`. Rationale: ambiguous identity can corrupt player-to-catalog resolution.

### Check 5 — Configurable changelog threshold ✅
Replaced hardcoded `SUSPICIOUS_THRESHOLD = 50` with named, versioned `CHANGELOG_RULES.SUSPICIOUS_CHANGE_COUNT { ruleVersion: 1, threshold: 50 }`. Warning message includes rule name + version.

### Check 6 — Reviewer identity server-derived ✅
Rewrote `resolveReviewer()` to only use the PocketBase auth record. Removed Bearer-token fallback. Added explicit 401 when no PB auth record exists. Reviewer identity is never accepted from the request body.

### Check 7 — Review immutability ✅
Documented: once created, a review record is never edited in place. Corrections create a new record marked as latest, preserving complete decision history.

### Naming concern ✅
Two distinct files: `shared/schemas/review-package.mjs` (logic module) and `tools/validation/review-package.mjs` (CLI wrapper). No duplication.

### Test updates
- 26 tests (was 24): +2 for binding hashes + engine version
- Updated duplicate mapping test: expects `quarantined`
- Updated changelog test: expects rule name + version in message

## 2026-07-17 — Post-review hardening for Issue #4 (7 architecture checks)

Addressed 7 final architecture checks from the Issue #4 review:

### Check 1 — Manifest does not hash itself ✅
Confirmed: the manifest describes 7 content artifacts and never lists itself. The manifest's SHA-256 is stored in the `catalog_publication` singleton (`manifestSha256` field), breaking the recursive dependency. Model:
```
catalog_publication → manifestSha256
manifest.json → artifacts[].sha256 (content artifacts only)
```

### Check 2 — Path traversal sanitization ✅
Hardened `isSafeRelativePath()` in the validator to reject:
- Absolute paths (`/etc/passwd`)
- Windows drive letters (`C:\...`)
- URL schemes (`http://...`, `file://...`)
- Backslashes (`\`)
- URL-encoded traversal sequences (`%2f`, `%2e%2e`, `%5c`)
- Double-encoded sequences (`%252f`, `%252e`)
- Encoded dot segments
- Paths > 255 characters

Also added `pattern` constraints on `path` and `filename` in the manifest JSON schema to enforce safe values at the schema level.

### Check 3 — Release identity and manifest hash immutability ✅
Documented immutable vs mutable fields in the `catalog_releases` migration and `catalogs/README.md`:
- **Immutable:** `releaseId`, `manifestSha256`, artifact hashes/paths, `catalogVersion`, game version info, `previousCatalogVersion`, `storageBaseUrl`
- **Mutable:** `status`, `reviewNotes`, `auditLog`, `reviewedBy`, `publishedAt`

### Check 4 — Separate active-pointer singleton ✅
Created `catalog_publication` collection (migration `1700000004`) with:
- `activeReleaseId` — points to the currently active release
- `previousReleaseId` — for rollback
- `manifestSha256` — manifest integrity verification
- `activatedAt`, `activatedBy`, `notes`

Removed `isActive` boolean from `catalog_releases`. The singleton model makes atomic publish/rollback simpler and prevents two releases from accidentally becoming active.

### Check 5 — Artifact schema compatibility policy ✅
Documented two-level compatibility check:
1. Manifest major version must be supported by the client
2. Every `required: true` artifact's schema major version must be supported
3. Optional artifacts with unsupported schemas → load with warning

### Check 6 — Required vs optional artifacts ✅
Added `required` boolean to every `artifactEntry` in the manifest schema and example:
- **Required:** `catalog-core.json`, `validation-report.json`
- **Optional:** `relationships.json`, `mappings.json`, `localization.json`, `assets.json`, `changelog.json`

Missing required artifact → reject package. Missing optional artifact → load with warning.

### Check 7 — Empty-file vs missing-file semantics ✅
Defined in documentation and schema:
- `recordCount: 0` → valid state meaning "no records of this type"
- Missing artifact file → "artifact not produced" (distinct from empty)
- These two states must not be silently treated as equivalent

### Verification
- ✅ All 42 contract tests pass (was 40; added `required` field check + path sanitization check)
- ✅ All 18 validation checks pass
- ✅ All 11 frontend tests pass
- ✅ All 31 capture-bridge contract tests pass
- ✅ Example manifest has no self-referencing hash entry
- ✅ `catalog_publication` migration holds `manifestSha256` (manifest hash: `3045d6e7...`)

## 2026-07-17 — Define versioned JSON catalog packages and PocketBase release-control records (Issue #4)

**Goal:** Adopt a JSON-first catalog data plane with PocketBase as the release control plane. Evolve from monolithic `catalog.json` to 8 separate, content-addressed package artifacts.

### Multi-artifact package contract (v2 manifest)

The catalog package now consists of 8 immutable, content-addressed artifacts:

| Artifact | Schema | Description |
|---|---|---|
| `manifest.json` | `catalog_manifest.schema.json` (v2) | Release descriptor with artifacts array, counts, storage pointer |
| `catalog-core.json` | `catalog_core.schema.json` | Core entities (managers, mines, equipment, research, collectibles, artifacts) |
| `relationships.json` | `relationships.schema.json` | Directed entity relationships |
| `mappings.json` | `mappings.schema.json` | Identity mappings + aliases |
| `localization.json` | `localization.schema.json` | Key-value localization table |
| `assets.json` | `assets.schema.json` | Asset reference index |
| `validation-report.json` | `catalog_validation.schema.json` | Deterministic validation checks (same schema as v1) |
| `changelog.json` | `changelog.schema.json` | Domain-level diff (replaces `diff.json`) |

### Manifest evolution

- `manifestSchemaVersion` bumped to `"2.0.0"` with a new `artifacts` array replacing the single `artifact` object.
- Each artifact entry includes: `filename`, `contentType`, `sha256`, `bytes`, `schemaVersion`, `recordCount`, `path`.
- Added `storage` section with `baseUrl` and optional `cdnUrl`.
- Removed `catalogSchemaVersion`, `diffPath`, `validationReportPath` (now covered by `artifacts` entries).

### New schemas created

- `shared/schemas/catalog_core.schema.json` — split from `normalized_catalog.schema.json` (entities only; relationships, mappings, localization moved to separate artifacts)
- `shared/schemas/relationships.schema.json` — directed relationships with `sourceId`/`targetId`/`kind`
- `shared/schemas/mappings.schema.json` — `idMappings` (source→canonical) + `aliases`
- `shared/schemas/localization.schema.json` — locale + key-value entries
- `shared/schemas/assets.schema.json` — asset reference index with type, path, dimensions
- `shared/schemas/changelog.schema.json` — structured changelog (replaces `catalog_diff.schema.json`)

All schemas use JSON Schema draft 2020-12 with `additionalProperties: false`.

### Example bundle updated

`catalogs/example/` now contains all 8 v2 artifacts plus the legacy v1 files for backward compatibility. All artifacts are in canonical JSON form (sorted keys, trailing newline). Status is `candidate`, zero game records, source kind `fixture`.

Legacy v1 files (`catalog-manifest.json`, `catalog.json`, `diff.json`) retained so both formats are testable.

### Validation tooling upgrade

`tools/validation/validate-catalog.mjs` rewritten to support dual-format detection:
- **v2:** Detects `manifest.json` with `manifestSchemaVersion: "2.0.0"` → validates all 8 artifacts against their schemas, checks all 7 artifact hashes, verifies deterministic serialization on every artifact.
- **v1:** Falls back to `catalog-manifest.json` with legacy checks (single artifact hash, single deterministic serialization check).

18 checks run on v2 bundles (8 schema + 8 integrity); all pass on the example bundle.

### PocketBase migration: `catalog_releases` collection

New migration `1700000003_catalog_releases.js` creates the `catalog_releases` collection for release-control-plane records:

- Fields: `releaseId` (unique), `catalogVersion`, `gameVersion`, `gameVersionCode`, `status` (select), `manifestRef`, `artifactCount`, `counts` (JSON), `validationSummary` (JSON), `previousCatalogVersion`, `storageBaseUrl`, `isActive`, `publishedAt`, `reviewedBy`, `reviewNotes` (JSON), `auditLog` (JSON)
- Indexes on `status`, `isActive`, `gameVersionCode`, and unique on `releaseId`
- Public read, auth-required write
- Stores only metadata needed to identify, govern, review, and publish; full catalog remains in JSON artifacts

### Contract tests

`tests/catalog-package.test.mjs` — 40 tests in 7 suites, all passing:

- **Deterministic serialization (6):** Stable key sorting, array preservation, round-trip stability, hash stability, key order invariance, trailing newline.
- **SHA-256 content addressing (4):** Format validation, idempotency, collision resistance, byte sensitivity.
- **Manifest artifact integrity (9):** Schema version, artifact count, required fields, disk existence, SHA-256 match, byte size match, status, storage section, previous version.
- **Example bundle fixture safety (8):** Zero game records in all artifacts, fixture source kind, no fabricated data.
- **Schema conformance (8):** All 8 artifacts validate against their schemas.
- **Manifest consistency (3):** catalogVersion, releaseId, and counts match catalog-core.
- **Canonical JSON round-trip stability (2):** All example artifacts are canonical, stability with nested arrays.

### Documentation

- `catalogs/README.md` — full rewrite covering v2 package contract, artifact table, manifest entry spec, PocketBase records, rules, compatibility/storage/rollback boundaries, and validation commands.
- Added `npm run test:catalog` script to root `package.json`.

### Verification

- ✅ All 18 validation checks pass on the v2 example bundle
- ✅ All 40 contract tests pass (`npm run test:catalog`)
- ✅ All 7 artifact hashes verified against actual file content
- ✅ Deterministic serialization confirmed for all artifacts
- ✅ Example bundle is fixture-safe (zero game records, no fabricated data)
- ✅ Backward compatibility: v1 legacy bundle still validates with the same tool
- ✅ No secrets, APK binaries, or raw extracted assets in fixtures

### Remaining / deferred

- PocketBase migration not yet applied to Oracle instance (requires `docker compose build pocketbase && docker compose up -d pocketbase` on oracle-vm)
- `catalog_releases` record creation not yet wired into the capture ingest hook
- Frontend catalog consumption from v2 packages is deferred (Issue #7)
- Active-pointer publication and rollback is deferred (Issue #6)
- Real APK data population is deferred (requires parser work)

## 2026-07-17 — Revised GitHub backlog for JSON-first catalog architecture

- Updated GitHub milestones 1–5 and issues #4–#12 to reflect the versioned JSON catalog data plane.
- PocketBase is now documented as the release control plane for provenance, validation summaries, review decisions, publication pointers, and audit history; it must not duplicate the full static catalog.
- Issue #4 now defines the immutable package contract and artifact manifest; #5 covers JSON evidence review; #6 covers active-pointer publication and rollback; #7 covers verified JSON retrieval and IndexedDB caching; #8 covers JSON mappings with audited PocketBase overrides.
- Issues #9–#12 were retained and clarified to record catalog interpretation metadata, consume the verified JSON client, and expose package verification state in More.
- No code or deployment state changed in this backlog/documentation update. The existing JSON schemas and validation scaffolding remain the implementation baseline.

## 2026-07-16 — Contract-test the capture envelope (Issue #1)

**Goal:** Make the capture-bridge CLI, PocketBase ingest hook, and release schema a single versioned contract with stable machine-readable error codes and fixture-based contract tests.

### Shared validation module (`shared/schemas/validate-release.mjs`)

- Created single source of truth for capture envelope validation used by both CLI and PB hook.
- Exports: `validateReleasePayload()`, `ERROR_CODES`, `exitCodeForError()`, `REQUIRED_FIELDS`, `VALID_STATUSES`, `SUPPORTED_SCHEMA_VERSION`.
- Stable error codes follow `CATEGORY / REASON` format (e.g., `VALIDATION_ERROR / MISSING_REQUIRED_FIELD`).
- Schema version check: rejects major versions > current (1.x), accepts legacy (0.x) for backward compatibility.
- Added null/undefined/array guard on input.
- New validations not previously enforced: SHA-256 format check on individual apkHash values, schema version unsupported check.

### CLI updates (`apps/capture-bridge/src/cli.mjs`)

- Replaced inline `validatePayload()` with `validateReleasePayload()` from shared module.
- Removed duplicate `REQUIRED_FIELDS` constant.
- Exit codes now driven by `exitCodeForError()` mapping: DUPLICATE_RELEASE→14, UNAUTHORIZED→2, all VALIDATION_ERROR→1.
- Error code printed to stderr alongside human-readable message.

### PocketBase hook updates (`pocketbase/pb_hooks/capture-ingest.pb.js`)

- All error responses now include `"code"` field matching shared ERROR_CODES.
- Added SHA-256 format validation on individual apkHash values.
- Added schema version check (rejects future major versions).
- Documented stable error codes in header comment.

### Contract test fixtures (`shared/fixtures/`)

Created 12 fixtures covering all validation scenarios:
- `valid-release.json` — minimal valid payload
- `valid-release-with-extras.json` — with objects + manifest
- `missing-releaseId.json` — required field absent
- `empty-releaseId.json` — empty string releaseId
- `invalid-versionCode-zero.json` / `invalid-versionCode-negative.json`
- `empty-apkHashes.json` / `invalid-apkHash-bad-format.json`
- `invalid-status.json` — unknown status value
- `future-schema.json` — schemaVersion 99.0.0
- `legacy-schema.json` — schemaVersion 0.9.0 (accepted)
- `invalid-schemaVersion-format.json` — non-numeric version

### Contract test suite (`apps/capture-bridge/tests/contract.test.mjs`)

- 31 tests in 5 suites, all passing.
- **Shared validator tests (14):** Unit tests for every fixture + null/undefined input.
- **CLI contract tests (6):** Runs CLI as child process, verifies exit codes match expected error codes.
- **Exit code mapping tests (4):** DUPLICATE_RELEASE→14, UNAUTHORIZED→2, validation→1, unknown→1.
- **Constants consistency (3):** Required fields count, status enum, semver format.
- **Server hook mirror (4):** Required fields array match, fixture outcome agreement, error code format validation.

### Verification

- All 31 contract tests pass: `node --test tests/contract.test.mjs`
- Existing `test-release.json` fixture still validates and dry-runs correctly.
- CLI correctly rejects malformed/missing payloads with exit code 1 and prints error code to stderr.
- CLI accepts legacy schema (0.9.0) for backward compatibility.
- No secrets, APK binaries, or raw extracted assets in fixtures.

### Acceptance criteria status

- ✅ Shared fixture suite passes for client and server validation.
- ✅ A payload cannot be accepted by one side and rejected by the other without an explicit schema-version error.
- ✅ Tests cover release ID, integer version code, APK hashes, status, object count, and provenance metadata.
- ✅ No secrets, APK binaries, or raw extracted assets in this repository.

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

## 2026-07-17 — More page: all sections collapsible, collapsed by default

**Goal:** Reduce visual clutter on the More page by making every section a collapsible accordion panel, starting collapsed.

### Change

- Added a `CollapsibleSection` utility component that renders a `card-container` section with a clickable title row (chevrot indicator rotates on toggle) and conditionally renders children.
- All 8 sections on the More page are now wrapped in `CollapsibleSection`:
  - PocketBase Account
  - Sync Settings
  - Kolibri Sync
  - Catalog package
  - Snapshot History
  - Capture Status
  - Player import history
  - About this build
- Each section defaults to **collapsed** (`defaultOpen={false}`). Users click the title bar to expand and view content.
- The Catalog package section preserves its `aria-live="polite"` attribute for accessibility.

### Files changed

- `frontend/src/pages/MorePage.tsx` — added `CollapsibleSection` component, imported `ReactNode`, wrapped all sections

### Verification

- ✅ `tsc -b` passes (no type errors)
- ✅ `vite build` succeeds (no build errors)
- Relies on Vite HMR/hot reload; no new tests needed (purely presentational change)

### Remaining limitations

- None specific to this change. The collapsible pattern is self-contained to the More page and does not affect other pages or state.

## 2026-07-17 — Frontend catalog unification + test fixture + data engine inventory

**Goal:** Unify the frontend catalog path so Managers, Today, and Strategy all consume the same catalog authority (catalogClient). Generate a populated v2 test fixture from legacy data for development. Inventory the UbuntuMac data engine pipeline for real APK extraction.

### Test fixture generator (`tools/generate-test-fixture.mjs`)

Created a Node.js script that transforms the legacy `sm_complete_database.json` (31 managers) into a complete v2 catalog package:
- Output to `frontend/public/catalog/test-fixture/`
- 7 artifacts: catalog-core.json, validation-report.json, relationships.json, mappings.json, localization.json, assets.json, changelog.json
- All artifacts have computed SHA-256 hashes + byte counts in manifest.json
- **Clearly labeled:** `source.kind: "test-fixture"`, `status: "test-fixture"`, plus notes field
- Manager records use plain IDs (matching legacy format) for progress data compatibility
- Active ability and passives stored in `extensions.*` for v2 schema compliance
- Usage: `node tools/generate-test-fixture.mjs`

### Schema updates

- `shared/schemas/catalog_core.schema.json`: Added `"test-fixture"` to `catalogSource.kind` enum
- `shared/schemas/catalog_manifest.schema.json`: Added `"test-fixture"` to `status` enum

### Frontend catalog unification

**catalog-client.ts:**
- Added `loadTestFixturePackage()` function (modeled after `loadBootstrapPackage()`) that loads from `/catalog/test-fixture/manifest.json`
- Added dev-only test fixture fallback after bootstrap and before error state: `if (import.meta.env.DEV) { try test fixture }`
- Test fixture goes through full schema validation, SHA-256 verification, caching, and adapter flow

**strategy.ts — managersFromVerifiedPackage():**
- Now reads `active` from either top-level (legacy) or `extensions.active` (strict v2)
- Reads `elements` from top-level `elements[]`, `extensions.elements[]`, or derives from `element` field
- Reads `type` from `role` field (v2) with fallback to `type` (legacy)

**StrategyPage.tsx:**
- Subscribes to `catalogClient` state changes for reactive rendering (no longer one-shot)
- Shows "TEST FIXTURE — Not production data" badge when source is test fixture
- Shows loading state during catalog load

**App.tsx:**
- No longer loads `sm_complete_database.json` as primary catalog source
- Subscribes to `catalogClient` — extracts managers via `managersFromVerifiedPackage()` when active
- Legacy file retained as initial bootstrap for instant first render only
- Removed `/master/api/sm-data` remote override (`RemoteMaster` type, `normalizeMaster` function)
- Added proper cleanup for catalog subscription

**Files changed:**
- `tools/generate-test-fixture.mjs` (new)
- `frontend/public/catalog/test-fixture/*` (8 files, generated)
- `shared/schemas/catalog_core.schema.json`
- `shared/schemas/catalog_manifest.schema.json`
- `frontend/src/lib/catalog-client.ts`
- `frontend/src/lib/strategy.ts`
- `frontend/src/pages/StrategyPage.tsx`
- `frontend/src/App.tsx`

**Verification:**
- ✅ All 92 frontend tests pass
- ✅ All 42 catalog package contract tests pass
- ✅ All 50 review + publish contract tests pass
- ✅ `tsc --noEmit` clean
- ✅ `npm run build` succeeds

### Data engine inventory (A1)

- Confirmed SSH access to UbuntuMac via `ubuntumac-ip` alias (Tailscale DNS not resolving)
- Existing release `5.59.0_96449_20260716T143539Z` has full M4-M7 pipeline output:
  - 12 Unity artifact files (all extractors ran)
  - 4,035 normalized canonical objects
  - v1 export artifacts
- However, extractors are at **file-discovery level** — "Manager" objects are files with "manager" in filename, not parsed game data
- 50 "Manager" objects exist but they're Android support libs and `supermanager-XXXXX.bundle` AssetBundle references (unparsed Unity binary)
- No readable game config data found in text_assets (APK text files)
- Real game data is in Unity AssetBundle binary format (`.bundle` files) — needs UnityPy or similar parser
- `mineops-data-engine` not installed in PATH on UbuntuMac; engine source location needs discovery
- Two releases exist on UbuntuMac; no current release symlink

**Next data engine steps (A2+):**
- Install/locate `mineops-data-engine` on UbuntuMac
- Run a fresh controlled capture (`process` pipeline)
- Inspect Unity binary bundles to understand manager data format
- Define v2 catalog generator approach (upgrade export.py or new M8 step)

### Oracle PB status

- `catalog_versions` queryable on Oracle (3 records visible)
- SSH alias `oracle-vm` exists and configured
- Need to inspect migration files in the running container

### Remaining limitations

- Test fixture has 31 managers (not 51 as metadata claims — actual file content is 31)
- Data engine needs Unity binary parser for real game data extraction
- `mineops-data-engine` Python package needs installation on UbuntuMac
- Oracle PB migration status is unverified
- Kolibri ID resolution fails against test fixture (no `kolibri_id` mappings yet — expected, pending real captures)
- Catalog page may show empty manager grid if a stale bootstrap fixture is cached in IndexedDB. Clear IndexedDB or use dev tools to verify test fixture activation.

## 2026-07-17 — Fix managers not showing in grid (bug fix)

**Root cause:** Two issues:

1. **Default ownership filter was `"unlocked"`**, showing zero managers when none have `unlocked: true`. After the test fixture swap, the Kolibri sync couldn't resolve any IDs (60 unresolved, 0 resolved) because the test fixture lacks Kolibri ID mappings. This reset all progress to `unlocked=false`.

2. **Kolibri sync was destructive** — `saveProgress(result.progress)` replaced ALL existing progress with the new sync results. Unresolved managers lost their existing progress data.

**Fixes applied:**

1. Changed default ownership filter from `"unlocked"` to `"all"` so the manager grid always shows all catalog managers regardless of unlock status. Users can still filter to unlocked via the toggle button.

2. Added progress merge in `syncNow()`: before saving, merges new Kolibri progress with existing IndexedDB data. Managers that weren't resolved by the sync keep their existing progress (unlocked status, level, rank, fragments preserved).

**Files changed:**
- `frontend/src/App.tsx` — default ownership filter changed, Kolibri sync now merges progress

**Verification:** ✅ `tsc --noEmit` clean, ✅ all 92 tests pass, ✅ `npm run build` succeeds

## 2026-07-17 — Fix test fixture load order (bug fix)

**Bug:** The test fixture fallback in `catalog-client.ts` was placed after the bootstrap `return`, making it unreachable. The bootstrap (example fixture with 0 managers) always loaded first.

**Fix:** Reordered the fallback chain in `loadActiveCatalogImpl()` to try the test fixture BEFORE both the cached package and the bootstrap in dev mode:

```
Publication → Test fixture (dev) → Cache → Bootstrap → Error
```

Also cleaned up the duplicate test fixture check (was checking both before and after cache).

**Files changed:** `frontend/src/lib/catalog-client.ts`

**Verification:** ✅ `tsc --noEmit` clean, ✅ all 92 tests pass, ✅ `npm run build` succeeds

## 2026-07-17 — Build v2 catalog generator from Unity TextAsset configs

**Goal:** Extract manager definitions from Unity AssetBundle TextAsset JSON configs and produce populated v2 catalog packages directly from APK data.

### Discovery: Unity AssetBundle format

The main game data bundle (`generalassets_assets_all_*.bundle`, 62MB) contains **123,307 Unity objects** including 142 TextAsset JSON configs. Key findings:
- `SuperManagerElementalConfig_100XX.json` — 73 files, each with `superManagerId`, `elementalMapping`, `elementalRecipe`
- `ElementalMinesDefaultConfig` — mine balancing configs
- `FallbackEventJson` — mine/elevator/warehouse configs

**Critical:** The `superManagerId` values (10001–10073) match the Kolibri API's `Id` field. These configs provide the `kolibri_id → canonicalId` mapping that resolves the 60 previously-unresolved Kolibri IDs.

### v2 Catalog Generator

Created `src/mineops_data_engine/catalog_v2.py` — reads Unity AssetBundles via UnityPy, extracts TextAsset configs, generates all 7 v2 artifacts + manifest with SHA-256 integrity.

**CLI:** `mineops-data-engine catalog-v2 <release_id>`
**Pipeline step:** `catalog-v2` (after export, requires UnityPy)

### Generated output

- **73 managers** (IDs 10001–10073), **73 kolibri_id mappings** in `mappings.json`
- Source: `apk_capture`, status: `candidate`
- Display names: `null` (stored in MonoBehaviours, not TextAssets)
- All artifact SHA-256 hashes verified against manifest

### Files changed
- `mineops-data-engine/src/mineops_data_engine/catalog_v2.py` (new)
- `mineops-data-engine/src/mineops_data_engine/cli.py` (register command + dispatch)
- `mineops-data-engine/src/mineops_data_engine/pipeline.py` (add pipeline step)

### Remaining limitations
- Display names, rarities, areas unknown — in MonoBehaviours, not TextAssets
- Dev test fixture (legacy data with names) continues for frontend development
- Next: Upload v2 catalog to Oracle, register release, review, publish

## 2026-07-18 — Milestone 7A: Production catalog activation (end-to-end)

**Objective:** Prove the completed APK extraction and verified catalog architecture end-to-end using the 118 APK-extracted manager records.

### Summary

The full pipeline is now operational:

1. **Production candidate generated** — `tools/produce-candidate-package.mjs` reads the v2 output (118 managers, 354 mappings), fixes the mapping schema (source→kind, sourceId→sourceValue), adds 118 kolibri_id mappings, regenerates the manifest with correct SHA-256 hashes, and outputs a clean candidate package to `catalogs/production/5.59.0_96449_20260716T143539Z.candidate/`.

2. **Artifacts uploaded to Oracle VM** — 8 JSON artifacts (manifest + 7 content files) copied to `/opt/infra-new/catalog-artifacts/data/` and also bind-mounted into the mineops-pb container at `/pb/catalog-artifacts/`.

3. **PB collections deployed** — `catalog_releases`, `catalog_publication`, `catalog_reviews`, `catalog_publication_events`, `catalog_overrides` created on the production PB instance at `mineops-pb.shepswork.com`. Two minimal migrations were applied (0002 = public read rules, 0003 = catalog_releases schema with text-based status field due to select field compatibility issues with PB v0.39.6).

4. **Release registered and published** — Release `5.59.0_96449_20260716T143539Z` progressed through the lifecycle:
   - `candidate` → approved via `catalog_reviews` record
   - `candidate` → `ready` (status update)
   - `ready` → `active` (publication)
   - Publication pointer created in `catalog_publication`
   - Audit event recorded in `catalog_publication_events`

5. **Frontend diagnostics added** — MorePage now shows:
   - Active package manager count vs rendered progress count
   - Orphaned progress IDs (IDs in IndexedDB absent from active catalog)
   - Release ID mismatch (manifest vs catalog-core content)
   - Source state label (Published / Bootstrap / Test fixture / Cached / Stale)

6. **Legacy bootstrap removed** — `sm_complete_database.json` no longer fetched as initial catalog source. Frontend uses `catalogClient.getActivePackage()` bootstrap or empty default for first render.

### Artifact serving (blocked)

The `storageBaseUrl` is set to `https://mineops-pb.shepswork.com/api/catalog/artifacts/` but the PB hook for serving files couldn't be completed due to compatibility issues with PB v0.39.6 JSVM (missing `$os.readFile()` and URL parsing APIs). A Traefik path-based route was attempted but deferred — needs Cloudflare DNS config for `catalog-artifacts.shepswork.com` to work through the existing tunnel.

**Workaround:** The frontend's catalogClient falls back through its load chain: Publication → Test fixture (dev) → Cached → Bootstrap. For development, the test fixture continues to provide the APK-derived data. The production publication metadata is stored and publicly readable — the frontend will use it once artifact serving is operational.

### Key data

| Metric | Value |
|--------|-------|
| Managers extracted | 118 (IDs 10001–10118) |
| Fully extracted | 112 |
| Partial (missing assets) | 6 (IDs 10020-10023, etc.) |
| Display names | 0 (in MonoBehaviours, not TextAssets) |
| Total mappings | 354 (118 apk_superManagerId, 118 apk_nameKey, 118 kolibri_id) |
| PB release status | `active` |
| Publication pointer | set to release |
| Legacy bootstrap | removed from first-render fetch |

### Files changed/created

- `tools/produce-candidate-package.mjs` (new) — candidate package generator
- `tools/create-pb-collections.mjs` (new) — PB collection creation via API
- `tools/register-release.mjs` (new) — release registration script
- `tools/activate-release.mjs` (new) — review/publish/activate pipeline
- `frontend/src/pages/MorePage.tsx` — catalog diagnostics section added
- `frontend/src/App.tsx` — removed legacy sm_complete_database.json fetch
- `catalogs/production/5.59.0_96449_20260716T143539Z.candidate/` — candidate package (9 files)
- `frontend/public/catalog/test-fixture/` — remains as APK data for dev
- Oracle: `/opt/infra-new/compose/docker-compose.yml` — mineops-pb migration dir mount
- Oracle: `/opt/infra-new/catalog-artifacts/data/` — 8 artifact files
- Oracle: `/opt/infra-new/apps/mineopsweb/pb_migrations/` — clean migrations (0002, 0003)
- Oracle: `/opt/infra-new/apps/mineopsweb/pb_hooks/` — review + publish hooks added

### Verification

- ✅ `tsc --noEmit` clean
- ✅ All 92 frontend tests pass
- ✅ `npm run build` succeeds
- ✅ PB API public read on `catalog_publication` returns active release
- ✅ PB API public read on `catalog_releases` shows status=active, 118 managers
- ✅ Release through lifecycle: candidate → ready (approved) → active (published)
- ✅ Publication events recorded
- ✅ Review records created

### Remaining limitations

- Artifact serving via `/api/catalog/artifacts/` URL not functional (PB JSVM API limitation)
- `catalog-artifacts.shepswork.com` needs Cloudflare DNS + tunnel config
- No display names (requires MonoBehaviour parsing)
- Frontend uses local test fixture for development (not production URL)

### Deferred (Milestones 7B, 7C)

- Fragment integrity (7B) — fragmentValue/fragmentStatus/fragmentSourcePath fields
- Fragment UI states (zero/missing/invalid/max-rank)
- Strategy v2 scaffolding
- Manager images and detail links
- Inline-style cleanup

## 2026-07-22 — VS Code task: Oracle image update

Added `Oracle: Git pull + update images` to `.vscode/tasks.json` — a manual deploy task that SSHs to `oracle-vm`, `git pull`s the latest code from `/opt/infra-new/apps/mineopsweb`, then runs the `oracle-deploy.sh` script to pull new GHCR images and restart containers.

### Changed files
- `.vscode/tasks.json` — added new task entry

### Verification
- ✅ `tasks.json` valid JSON (parsed by VS Code)
- ✅ Uses existing `oracle-vm` SSH alias and `oracle-deploy.sh` script path
- ✅ Follows same pattern as existing Oracle/UbuntuMac tasks
