# Strategy-configs characterization (lossless release `5.59.0_96449_20260716T143539Z.lossless-v1`)

**Date:** 2026-08-04
**Source:** published `strategy-configs.json` artifact (`https://mineops-pb.shepswork.com/api/catalog/artifacts?file=strategy-configs.json`, 11,858,185 bytes)
**Tool:** `tools/characterize_strategy_configs.py`

## Purpose

Determine what the 1,698 provenanced strategy-config records actually contain and which of them can be normalized into semantic strategy artifacts at extraction time. This directly answers the Phase-1 question of whether the published evidence can power the planner or whether extraction-time normalization is required.

## Headline findings

1. **Every record is `semanticStatus: partial`.** The published artifact preserves provenance, raw serialized bytes, and a limited set of parsed Unity fields. None of the 1,698 records is marked fully semantic. A frontend-only consumer therefore cannot derive strategy values from this artifact today — normalization must happen at extraction time (confirmed by the APK strategy-data audit).
2. **Roughly a quarter of the records are not strategy data at all.** ~404–419 records are `MigrateToVersion_*` save-migration scripts and sprite/atlas/visual assets (e.g. `SuperManager047_Atlas.asset`, `0_flavor`), which should be excluded from any normalization pass.
3. **~900 records are Super-Manager-related but mostly visual:** `SuperManagerElementalConfig_1*` (91), `SuperManagerSpine_*`, `SuperManager*_Atlas`, skeleton/mix assets. Only the elemental configs carry gameplay data; the rest are presentation.
4. **The strategy-relevant core is concentrated and decodable.** The raw Unity serialized bytes for research nodes, continent configs, frontier/event configs, artifact configs, and power-score settings are intact and decode to readable semantics (e.g. a research node decodes to *"x{0} production in all Mainland Mines"*). Extraction-time normalization of this core is feasible.

## Classification (keyword-based, two precedences)

| Domain | Count (mine-first) | Count (supermanager-first) | Notes |
|---|---|---|---|
| mine-economy (continent/shaft/elevator/warehouse/prestige/region) | 396 | 289 | `SuperMineContinent*` (16), region/continent configs; highest strategy value |
| supermanager-related | 378 | 913 | mostly visual/elemental; ~91 `SuperManagerElementalConfig_1*` carry data |
| equipment / crafting | 179 | 179 | prefabs + equipment-domain overlap |
| chapter / tutorial | 182 | 16 | `ImpossibleMineResourceEntity*`, chapter configs |
| elemental | 124 | 22 | `SuperManagerElementalConfig_1*`, competitive elemental mines |
| frontier / event / battle-pass | 59 | 47 | `EventSeasonBundle*Config`, `MazeEventKeyConfig` (fully parsed entries), eventhub, barrier_event |
| research / skill nodes | 11–14 | 2 | `*SkillNodeConfig.asset` with `DescriptionKey`, `region` — decodable |
| artifact | 6 | 5 | `ArtifactsConfig` evidence |
| power-score | 1 | 1 | `supermanagerpowerscore` domain record |
| non-strategy (migration/visual) | 362–404 | 404 | `MigrateToVersion_*`, atlas/sprite assets — exclude |

Exact counts depend on pattern precedence; the buckets are stable. Source-domain split of all records: `configfiles` 1104, `generalassets` 566, `supermanager_elemental` 9, `competitiveelementalmines` 6, `configfiles_jsonfallback` 3, `mainlandcontent` 3, `eventhub` 2, `barrier_event` 2, `chapters` 1, `supermanagerpowerscore` 1, `genericbattlepass` 1.

## Evidence quality

- Parsed-field coverage is thin: only `m_Name`, `m_Enabled`, `m_PathName`, `m_Script` are common; `DescriptionKey` (183), `ContinentType` (91), `Effect` (32), `region` (9), `MineType` (3) are the meaningful gameplay fields present.
- A few records are already fully parsed by the extractor: `MazeEventKeyConfig.asset` contains a complete `entries[]` array (`ConsumableId`, `KeyId`, `KeyLocaKey`).
- The rest of the semantics live in `raw.serialized.rawBytes` (base64) + `rawSha256`, which the extractor currently preserves rather than decodes.

## Implication for the roadmap

Normalize at extraction time, in priority order:

1. **power-score settings** (1 record + `SuperManagerPowerScoreSettings` in the APK) — enables game-parity ranking.
2. **research / skill nodes** (~14 `*SkillNodeConfig`) — enables research-ROI planning.
3. **mine-economy continents** (`SuperMineContinent*`, region/continent configs) — enables bottleneck/prestige/upgrade modeling.
4. **frontier / event / battle-pass static configs** (~47–59) — replaces patch-sensitive hardcoded `FRONTIER_BARRIERS` reference tables with release-scoped data.
5. **equipment effects and artifacts** — joins with `equipment-domain.json` for equipment-aware scoring.

Each new domain becomes its own immutable artifact with source IDs and unresolved values preserved, per the existing control-plane rules. Records classified `non-strategy` are excluded.
