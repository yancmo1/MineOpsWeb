# APK strategy-data audit

**Audit date:** 2026-08-02  
**Audited host:** UbuntuMac (`ssh ubuntumac`)  
**Audited game release:** `5.59.0_96449_20260716T143539Z`  
**Purpose:** Identify APK-derived inputs that can improve deterministic, explainable MineOps strategy.

## Executive finding

The Android APK contains far more strategy data than the published MineOps catalog currently preserves. The current package identifies 118 Super Managers plus 36 equipment records and 15 materials, but it flattens most manager tables and leaves mines, research, collectibles, and artifacts empty. The raw Addressables bundles still contain exact manager level curves, promotion unlocks, official power-score inputs, artifacts, research effects, event/frontier settings, and manager-specific mechanics.

The immediate passive defect had the same root cause. The v3 catalog retained APK passive identity (`passiveId`) but emitted placeholder rows (`passive_1`, `passive_2`) with no value or unlock requirement. The frontend treated those rows as complete and suppressed its richer fallback. The web adapter now merges both sources, retains the APK ID, displays the passive milestone, and only uses unlocked passives in strategy.

### 2026-08-02 implementation and publication update

The lossless pipeline is implemented and its immutable release revision is stored on UbuntuMac at `~/mineops-data/releases/5.59.0_96449_20260716T143539Z.lossless-v1`. The published candidate is `exports/strategy-candidates/5.59.0_96449_20260716T143539Z.lossless-v1.unique.candidate` under that revision. The 11-artifact package contains 118 manager definitions, 11,800 exact active-level rows, 1,180 promotion rows, 560 rank rows, 36 equipment definitions, 15 materials, and 1,698 provenanced strategy-config records. All 26 independent validation checks pass; 1,726 partial/unresolved meanings are explicitly retained instead of guessed, including blocked evidence for the sprite-only Frontier and collectible bundles.

The package is active on Oracle as release `5.59.0_96449_20260716T143539Z.lossless-v1` (manifest SHA-256 `2ea925ea0c66b7f047d20b4e1be0784fe4a5d7a869769f2eb4dcde76f25fe1ee`). The app adapter can use exact manager-domain active rows for imported player levels and reads passive unlock level/promotion from strict core extensions. Research, mine, artifact, equipment-effect, power-score, chapter, barrier/event, and elemental records are now available in the verified active package for later normalization; they are not yet applied as anonymous modifiers.

## What exists on UbuntuMac

Only one complete production capture is currently available:

| Item | Observed state |
|---|---|
| Complete release | `~/mineops-data/releases/5.59.0_96449_20260716T143539Z` |
| Game | 5.59.0, version code 96449 |
| APK set | Base APK plus arm64 split |
| General normalized objects | 4,035 |
| General relationships | 1,169 |
| Flattened source-evidence rows | 5,014 |
| Extracted Super Managers | 118 |
| Equipment / materials | 36 / 15 |
| v3 mines / research / collectibles / artifacts | 0 / 0 / 0 / 0 |

`test_enriched_20260716-153648` is an incomplete test release, not a valid capture. Weekly runs on July 26 and August 2 matched that directory as “unchanged” and then rejected it as incomplete. The emulator currently has 5.59.0 installed and was offline during this read-only audit. Until duplicate-release selection is corrected and the refreshed bridge runner is installed, scheduled capture is not proving that newer game releases are being processed.

## Pre-repair pipeline evolution and loss points

1. The July 16 capture preserved the raw APKs, extracted Unity assets, IL2CPP scaffolding, normalized objects, and v2/v3 exports.
2. The July 17 targeted manager extractor proved that a manager is represented by linked core, level, promotion, rank, fragment, element, and effect assets.
3. `ops/il2cpp_extractor.py` generalized manager discovery, but it reads only `params[0]` into the canonical manager row. That discards the remaining active-level, promotion, and rank rows.
4. The remote v2 catalog code can follow `SuperManagerDataConfig` pointers and reconstruct the full tables, but emits an empty passive array because it does not join core `Passive1`/`Passive2`/`Passive3` identities to promotion unlocks and localization.
5. `tools/build-v3-catalog.py` consumes the flattened row and creates identity-only passive placeholders. It cannot recover tables already removed upstream.
6. `ops/generate_catalog.py` contains more complete progression and passive-label logic, demonstrating that a lossless join is feasible, but that representation is not what the published v3 path currently packages.

The repair must therefore happen at extraction/normalization time. A frontend-only catalog builder cannot reconstruct dropped table rows.

## Manager strategy data already present in the APK

Across the Addressables bundles, the audited APK exposes:

- 118 manager identities, rarity, operating area, category, duration, cooldown, max level, max promotions, passive IDs, fragment IDs, sprite references, and element affinities.
- Exact active strength for levels 1–100. The web currently uses only level 1/100 plus linear interpolation.
- Promotion rows including level, promotion number, currency cost, whether a passive unlocks, and the unlocked passive ID.
- Five rank-effect rows with active and passive increases.
- Active effect type, description type, and incremental behavior.
- `SuperManagerEffectConfig` values for manager-specific mechanics such as neighboring-shaft factors, per-manager bonuses, caps, intervals, and cash-burst behavior.
- `SuperManagerLocalizationConfig` mappings for all 16 observed passive IDs to localization/effect-description keys.
- `SuperManagerPowerScoreSettings`, including level, rank, promotion, rarity, and locked-preview inputs used by the game’s own power score.

### Verified level-30 MIF example

| Manager | Core passive IDs | P1 milestone | P3 milestone |
|---|---|---|---|
| Mr. Turner (`10006`) | `5`, `1007` | Level 10: passive `5` (Walking & Mining Speed Boost) | Level 30: passive `1007` (Mine Income Factor) |
| Ranger Sue (`10010`) | `1005`, `1007` | Level 10: passive `1005` | Level 30: passive `1007` (Mine Income Factor) |

The corresponding enrichment value for both level-30 MIF entries is 1.44×. Player availability follows the imported promotion value: a P3 manager has the MIF; a P2 manager does not.

### Duplicate/legacy manager identities

The published 118-row catalog includes six same-name pairs under distinct Super Manager IDs: Blingsley (`10005`/`10021`), Dr. Steiner (`10003`/`10023`), Ezio Auditore (`10019`/`10022`), Professor Impossible (`10017`/`10020`), Queen Aurora (`10026`/`10027`), and Rabbid Blingsley (`10025`/`10028`). Several pairs also share the same passive definitions. These may be legacy, rental, collaboration, or replacement records rather than true simultaneous roster choices. The extraction pipeline should preserve both identities but publish an explicit active/legacy/variant relationship before strategy treats every row as an independent candidate.

## Other high-value strategy sources

The APK’s 57 Addressables bundles include `configfiles`, `generalassets`, `frontiermines`, `chapters`, `collectibles`, `supermanagerequipment`, `supermanagerpowerscore`, `barrierrewards-*`, `mainlandcontent-*`, and related event/tier bundles.

### Research and mine economy

The main `configfiles` bundle exposes hundreds of relevant configs, including:

- mine, continent, shaft, elevator, and warehouse balancing;
- 44 single-mine research nodes and 38 continent nodes;
- mine/continent income, upgrade-cost, capacity, loading, walking, cooldown, and effect-duration modifiers;
- barrier-time/cost efficiency, prestige cost, region unlock cost, mainland difficulty, gem rewards, and area boosts;
- Super Manager hiring, leveling, and promotion costs.

These inputs can power bottleneck detection, cheapest-next-upgrade advice, research ROI, prestige timing, barrier wait-versus-spend choices, and continent-specific lineup scoring.

### Artifacts and collectibles

`ArtifactsConfig` contains 49 artifacts with IDs, name/description keys, requirements, category tabs, and nine upgrade mappings. The generalassets bundle also contains 73 elemental Super Manager configs and multiple elemental/mine fallback JSON files. The collectibles bundle contains 161 collectible sprites; its balancing/data relationship still needs to be located and normalized.

### Equipment

The current package captures 36 equipment records and 15 materials. Additional APK settings describe area-boost caps/factors and active-effect boost behavior. Joining those values to owned assignments would allow lineup comparison with and without equipment, crafting priority, and burst-window optimization.

### Frontier, events, and live modes

Frontier and event bundles/configs expose barrier reward tiers, mine balancing/config, event start data, battle-pass settings, fragment draws/shops, and Rush/Frontier-related settings. These should eventually replace patch-sensitive checked-in community tables when a complete, validated APK mapping is available. Player-specific Sparks, current barrier, live event time, and current cost still require save/runtime data rather than static APK data.

## Recommended extraction roadmap

| Priority | Work | Strategy value | Verification gate |
|---|---|---|---|
| P0 | Fix scheduled duplicate/release selection and install the refreshed bridge runner | Ensures every later model uses a current APK | A new or clean unchanged run never selects an incomplete test release |
| P0 | Emit a lossless manager domain artifact | Exact level scaling, passive unlocks, rank effects, costs | 118 managers; Turner and Sue passive/promotion contract fixtures |
| P0 | Join passive ID → localization/effect type → promotion row | Correct labels, values, and availability | All observed passive IDs resolve or remain explicitly unresolved |
| P1 | Classify duplicate/legacy manager identities | Prevents duplicate cards and double-counted strategy candidates | Six known same-name pairs have explicit active/variant relationships |
| P1 | Normalize official power-score settings and compare against current score | Better roster ranking and game parity | Characterization fixtures across rarity/level/rank/promotion |
| P1 | Normalize manager-specific effect configs | Correct active pairings and burst sequencing | Per-effect schema plus representative manager fixtures |
| P1 | Normalize research and mine-balance configs | Upgrade, research, prestige, barrier, and bottleneck plans | Cross-reference IDs; no anonymous fabricated modifiers |
| P1 | Normalize artifacts, equipment effects, and assignment data | Equipment/artifact-aware lineups and crafting priorities | Owned-state join plus before/after calculation fixtures |
| P2 | Normalize Frontier/event static configs | Patch-matched FC/barrier and event plans | Release-scoped tables with visible game-version provenance |
| P2 | Locate collectible balancing data | Collectible-aware global/continent boosts | Sprite/config/owned-state identity mapping |

Every new domain should be its own immutable artifact with source identifiers and unresolved values preserved. Do not fold these objects into generic anonymous rows, and do not activate a release unless relationship and semantic validation pass.

## Remaining limitations

- This was a read-only audit of the one complete 5.59.0 capture; it does not establish that these values are unchanged in a newer APK.
- Localization values and some effect semantics still require a verified join or runtime observation.
- Static APK data alone cannot provide live mine levels, cash, barrier timer, Sparks, event progress, owned equipment assignments, or current offers.
- The active production package supplies APK-native passive identity, unlock milestones, and exact manager level tables. Value/effect localization joins and generic config semantics remain review work before they should influence strategy scoring.

## Update 2026-08-04 — semantic-lift implemented and published

The 1,698 strategy-config records were characterized (`docs/strategy-configs-characterization.md`): 100% are `semanticStatus: partial`; ~404 are non-strategy (migration scripts + visual assets); the strategy-relevant core (mine-economy continents, research skill nodes, frontier/event configs, artifacts, power-score) is decodable at extraction time. New conservative semantic-lift artifacts (`research-domain.json`, `mine-economy-domain.json`, `frontier-domain.json`, `power-score-domain.json`) were added via `ops/strategy_semantics.py` and published as `lossless-v2` (control-plane gated, backup `20260804T150514Z`). Effect magnitudes inside raw serialized bytes remain unresolved by design; the web planner consumes only the verified identity-level data and never fabricates values.
