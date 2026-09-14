# Android package deep dive — Idle Miner Tycoon 5.63.0

**Audit date:** 2026-09-14  
**APK:** 5.63.0 (version code 97356)  
**Release:** `5.63.0_97356_20260914T134142Z`  
**Source:** UbuntuMac capture for `com.fluffyfairygames.idleminertycoon`  
**Purpose:** Identify every useful, parseable game-data surface and turn it into safe inputs for guides, lineup advice, and future simulation.

## Executive answer

The fresh package is materially useful. It gives MineOps exact, release-scoped data for 119 Super Managers, every captured active level row, promotion/passive unlock rows, rank effects, elemental mappings, manager effect-factor metadata, 36 equipment identities, 15 equipment materials, 33 research records, nine mine/continent groups, 31 Frontier-related records, 1,675 strategy-config records, and 1,731 unresolved evidence entries that can be pursued instead of guessed.

The most important new finding is semantic, not numerical: the APK's own `SuperManagerPassiveType` enum identifies these passive IDs as follows:

| APK ID | APK meaning | MineOps label | Practical role |
|---:|---|---|---|
| 7 | Shaft upgrade cost reduction | Mineshaft Upgrade Cost Reduction | Reduce shaft spending before a burst |
| 8 | Elevator upgrade cost reduction | Elevator Upgrade Cost Reduction | Reduce elevator spending before conversion |
| 9 | Warehouse upgrade cost reduction | Warehouse Upgrade Cost Reduction | Reduce warehouse spending before conversion |
| 1005 | Barrier unlock cost reduction | Barrier Unlock Cost Reduction | Reduce barrier FC cost, if the mode applies it |
| 1006 | Shaft unlock cost reduction | Mineshaft Unlock Cost Reduction | Reduce shaft-unlock cost, if the mode applies it |
| 1007 | Mine income boost | Mine Income Factor | Preserve the income floor |
| 1008 | Mineshaft beam | Mineshaft Beam | Shaft-side burst/support |
| 1009 | Elevator beam | Elevator Beam | Elevator-side burst/support |
| 1010 | Continent income boost | Cash Income Factor | Broad income floor |

The previous frontend mapping treated ID 9 as a generic building reducer and could treat row-position enrichment as authoritative. That is now corrected. This matters for Frontier recommendations because the difference between shaft, elevator, warehouse, barrier, and unlock reductions changes both the correct manager role and the order of a burst.

The package still cannot tell us the user's current Frontier Mine barrier, Sparks, Frontier Credits, event deadline, active cooldowns, owned equipment assignment, or current lineup without a player save/runtime import. Therefore a truly personal “best bang for my buck” answer must combine this package with the next fresh player sync.

## Evidence grades

Use these grades in every guide and calculation:

| Grade | Meaning | Safe to use for |
|---|---|---|
| APK-verified | Directly present in a release asset or IL2CPP enum, with source path and record identity | Labels, IDs, promotion milestones, exact level rows, rank rows, cooldown/duration fields |
| APK-derived | A deterministic join of verified APK records, such as manager → promotion → passive | Unlock availability, role classification, elemental/rank relationships |
| Reference-enriched | Imported from the existing `idleminers-sm-data.json` snapshot when the APK has identity but not readable localized text/value | Display names, human-readable descriptions, provisional passive values |
| Community reference | Useful external planning material whose values can change by patch or account assumptions | Frontier checkpoint examples and sequencing heuristics |
| Unresolved | Evidence is retained but effect meaning or relationship is not proven | Never apply as a numeric strategy modifier |

## Release comparison

| Domain | 5.59.0 | 5.63.0 | Change |
|---|---:|---:|---|
| Super Managers | 118 | 119 | New manager ID `10119`; older rows retained |
| Exact active rows | 11,800 | 11,900 | One 100-row manager table added |
| Promotion rows | 1,180 | 1,190 | One 10-row manager table added |
| Rank rows | 560 | 565 | One 5-row manager table added |
| Equipment | 36 | 36 | No count change |
| Equipment materials | 15 | 15 | No count change |
| Equipment balancing rows | 2 | 2 | Still only Santa's Hat numeric rows |
| Strategy configs | 1,698 | 1,675 | Mostly visual/event config churn |
| Research domain records | 33 | 33 | No count change |
| Mine/continent groups | 9 | 9 | No count change |
| Frontier domain records | — | 31 | Identity/partial config evidence |
| Unresolved evidence | 1,726 | 1,731 | Five more retained for follow-up |

The release manifest is marked `review_required`. It is an excellent analysis source, but it should not become the active production catalog until its validation gate passes.

## What the package can support today

### Super Manager encyclopedia

For each manager, the package can provide:

- stable ID, name key, rarity, operating area, category, gender, maximum level, and maximum promotions;
- cooldown and active duration;
- exact active strength at each captured level, rather than an assumed interpolated curve;
- promotion level and cost rows;
- which promotion unlocks which passive ID;
- rank-based active/passive increases;
- active effect type, description type, and incremental behavior;
- fragment linkage;
- elemental mappings and rank requirements;
- raw source bytes, source asset path, source bundle, and record hash.

This supports a source-backed manager encyclopedia, promotion planner, rank planner, cooldown reference, active-value comparison, and “which next level actually has an exact value” view.

### Passive and role library

The package gives passive IDs and unlock milestones directly. The corrected stable taxonomy supports these safe groupings:

- income floor: IDs `1007` and `1010`;
- shaft upgrade reducer: ID `7`;
- elevator upgrade reducer: ID `8`;
- warehouse upgrade reducer: ID `9`;
- barrier unlock reducer: ID `1005`;
- shaft unlock reducer: ID `1006`;
- movement/mining/loading support: IDs `1`–`6`;
- beam effects: IDs `1008` and `1009`.

The package does not, by itself, prove that every passive has the same effect in every special mine. Mode compatibility must be confirmed from runtime behavior or a complete mode-specific effect mapping.

### Mine and research guides

The strategy-config and semantic-lift artifacts can support:

- continent and mine identity references;
- research node and category indexes;
- upgrade-cost, income, capacity, loading, walking, duration, and cooldown effect candidates;
- barrier, prestige, region, mainland, and event configuration references;
- exact source provenance for every candidate.

Numeric modifiers are not yet safe to apply generically. The raw configs often contain the key and serialized bytes, but the relationship between an effect key and its runtime target is not fully decoded. A future guide can still explain what each node is for, while the planner must keep unresolved values visibly inactive.

### Equipment and crafting guide

The package can identify 36 equipment entries and 15 crafting materials. It preserves equipment IDs, name keys, effect-type candidates, localization keys, and the two numeric balancing rows that currently resolve:

| Equipment ID | Reference name | Level | Value | Confidence |
|---:|---|---:|---:|---|
| 14091 | Santa's Hat | 5 | 0.05 | APK balancing row; name is reference-enriched |
| 14092 | Santa's Hat | 10 | 0.05 | APK balancing row; name is reference-enriched |

Frontier Claw (`14063`) and Frontier Helmet (`14021`–`14023`) are identifiable by the existing display-name mapping, but their effect text and numeric Spark reduction are not joined to a verified APK balancing row in this capture. They must remain “candidate equipment,” not hard-coded proof.

The useful next equipment guide is therefore a two-layer guide:

1. a verified inventory/crafting layer, showing what exists and what materials are needed;
2. an assignment optimizer that activates only after owned IDs, assigned manager IDs, effect type, tier, and mode scope are present in the player import.

### Frontier Mine guide

The static package contributes manager identity, passive unlocks, active values, cooldowns, durations, and equipment identities. It does not contain the live Frontier state. The existing Frontier guide is updated with the release-scoped role tables and the exact “best bang-for-buck” decision rules.

## Frontier “best bang-for-buck” rules

These rules are the strongest safe recommendations before the user's current roster and equipment assignments are imported.

### Rule 1 — Buy the first useful passive milestone, not the highest rarity

For an account with limited promotion resources, the first useful breakpoint is usually the manager's passive unlock. APK promotion rows show many low-rarity reducers at P1/L10, while income passives commonly appear at P3/L30 or P5/L50.

Use this order when the goal is a practical Frontier run:

1. keep at least one verified income-floor manager available in each useful role;
2. unlock a cheap shaft/elevator/warehouse cost reducer at its recorded breakpoint;
3. add the strongest compatible shaft burst;
4. add the transport-side burst that can convert the resulting stockpile;
5. invest in higher promotion only when the passive value or active window materially changes the next checkpoint.

This is a resource-efficiency rule, not a claim that a P1 common beats a P5 legendary in raw active strength.

### Rule 2 — Use the reducer that matches the spend

The corrected APK IDs give a precise order:

| Spend about to happen | Preferred passive ID | Use it |
|---|---:|---|
| Shaft level purchase | 7 | Before the purchase, then burst the shaft |
| Elevator level purchase | 8 | Before the purchase, then convert stockpile |
| Warehouse level purchase | 9 | Before the purchase, especially at a warehouse bottleneck |
| Barrier unlock | 1005 | Only if Frontier runtime confirms the passive applies |
| Shaft unlock | 1006 | Only if Frontier runtime confirms the passive applies |

Do not substitute an elevator or warehouse reducer merely because its percentage is larger. The reducer must match the actual spend.

### Rule 3 — Preserve the income floor while rotating actives

The APK identifies the core income-passive candidates:

- Mine Income Factor: Mr. Turner, Ranger Sue, Robot/1DL3, Zi Galvani, Damian Jones, and later P5 income managers;
- Continent Income Factor: Dr. Steiner, Dr. Lilly, Sir Lorenzo, Wolfgang Clawson, Ut'ux, Beiro, Dark Beiroth, Sam Fisher, Ezio, and many later P5 managers.

The first four P3/L30 Mine Income Factor entries are especially relevant for a budget-minded account because they unlock earlier than the P5 income group. Their exact values should be taken from the release-scoped passive/value join when it is verified; the existing upstream value table is reference-enriched, not APK-localized proof.

### Rule 4 — Match equipment to the scarce resource, but do not fake its effect

If the player import proves that Frontier Claw or Frontier Helmet reduces Spark cost, assign the strongest applicable Frontier item to the manager whose active will be used most often in the planned rotation. If the item instead reduces a different cost or applies to a specific area, the optimizer must follow that exact effect.

Until the effect join is verified, MineOps should show the candidate item and ask for confirmation rather than ranking a manager based on an assumed Spark percentage.

## Current 5.63 candidate roster tables

These tables are generated from APK passive IDs plus reference-enriched names. The passive ID and promotion milestone are APK-derived; the display name is not guaranteed to be localized from this capture.

### Early income breakpoints

| Manager | ID | Area | Passive | Unlock |
|---|---:|---|---|---|
| Mr. Turner | 10006 | Mine Shaft | Mine income | P3/L30 |
| Ranger Sue | 10010 | Mine Shaft | Mine income | P3/L30 |
| Damian Jones | 10029 | Elevator | Mine income | P3/L30 |
| Zi Galvani | 10035 | Mine Shaft | Mine income | P3/L30 |

### Cheap first cost-reduction breakpoints

| Area/action | Example managers | Earliest recorded unlock |
|---|---|---|
| Shaft upgrade | Chester, Blingsley, Floating Agatha, Samantha Reiss | P1/L10 |
| Elevator upgrade | Damian Jones, Sojo | P1/L10 |
| Warehouse upgrade | Dr. Nova, Jade Kim, Octavia De Vere | P1/L10 |
| Barrier unlock | Mr. Goodman, Mrs. Goodman, Goodman Jr., Ranger Sue | P1/L10 |
| Shaft unlock | Gordon | P1/L10 |

### Higher-value income/cost combinations

Managers whose APK promotion table contains both income and a cost/unlock role are particularly interesting for a limited roster because they can support more than one phase of a run. Examples include Ranger Sue, Dr. Steiner, Sir Lorenzo, Wolfgang Clawson, Ut'ux, Beiro, Sam Fisher, Ezio, and several later managers. The correct pick still depends on the player's current promotion, area bottleneck, cooldown, and equipment assignment.

## What cannot be safely inferred from the APK

Static package analysis cannot recover:

- current Frontier Mine tier, shaft, barrier, live cost, or remaining timer;
- current Sparks, Frontier Credits, multipliers, event deadline, or shop state;
- current manager cooldown state;
- owned versus locked managers unless the player save is imported;
- which equipment is owned, equipped, assigned, or available for crafting;
- whether a passive or equipment effect is active in a particular special mine when the mode-specific runtime rule is not encoded in a readable config;
- live cash, shaft stockpile, elevator backlog, warehouse backlog, or the next profitable spend;
- a guaranteed current reward table from the static `frontiermines` visual bundle.

## Highest-value follow-up work

1. Import the current player save and expose owned manager level, rank, promotion, fragments, equipment IDs, and assignments.
2. Capture one Frontier screen state: tier, shaft, barrier cost, timer, FC, Sparks, active multiplier, and event time remaining.
3. Decode the equipment localization join, then validate Frontier Claw/Helmet effects with a controlled before/after observation.
4. Normalize manager-specific effect configs so shaft, elevator, warehouse, beam, and stockpile actions become typed roles instead of text guesses.
5. Decode the remaining Frontier/economy serialized values and validate one release against live UI values before applying them to planning.
6. Replace generic strength scoring with an event-specific score: passive opportunity cost + exact active output + Spark cost + equipment effect + target spend.

## Source trail

- Fresh candidate artifacts: UbuntuMac release `5.63.0_97356_20260914T134142Z`, under `exports/strategy-candidates/5.63.0_97356_20260914T134142Z.deep-dive/`.
- Existing extractor and package builder: `ops/strategy_package.py`, `ops/strategy_semantics.py`, `ops/equipment_extractor.py`, and `ops/passive_extractor.py`.
- Existing historical inventory: [APK_DATA_INVENTORY.md](APK_DATA_INVENTORY.md).
- Existing strategy audit: [APK_STRATEGY_DATA_AUDIT.md](APK_STRATEGY_DATA_AUDIT.md).
- Frontier planning guide: [frontier-mine-guide.md](frontier-mine-guide.md).
- IL2CPP enum evidence: UbuntuMac `~/mineops-data/il2cpp_output/dump.cs`, `SuperManagerPassiveType`.
