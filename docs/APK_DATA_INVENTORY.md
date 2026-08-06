# APK Data Inventory — MineOps Reverse-Engineering Reference

**Date:** 2026-08-02  
**APK Version:** 5.59.0 (96449)  
**Release ID:** `5.59.0_96449_20260716T143539Z`  
**Host:** ubuntumac (100.105.31.42)  
**Source:** Android emulator (`emulator-5556`), `com.fluffyfairygames.idleminertycoon`

> **Purpose:** This document catalogs every data source inside the APK, what MineOps already extracts, what is extractable but not yet tapped, and what is permanently out of reach via static analysis. It is the single reference for any simulator-building or reverse-engineering effort.

---

## Table of Contents

1. [APK Structure Overview](#1-apk-structure-overview)
2. [What We Extract Today (In Use)](#2-what-we-extract-today-in-use)
3. [Complete Bundle Inventory](#3-complete-bundle-inventory)
4. [Entity Type Catalog (from Il2CppDumper)](#4-entity-type-catalog-from-il2cppdumper)
5. [What Could Be Extracted But Isn't](#5-what-could-be-extracted-but-isnt)
6. [Hard Limitations (Not Extractable Statically)](#6-hard-limitations-not-extractable-statically)
7. [Extraction Approach Per Category](#7-extraction-approach-per-category)
8. [Recommended Simulator Data Priority](#8-recommended-simulator-data-priority)

---

## 1. APK Structure Overview

The APK is a split APK (base.apk + split_config.arm64_v8a.apk) for ARM64 Android. It's built with Unity using IL2CPP (Metadata v31).

### Extraction Pipeline

```
APK → unzip → assets/Addressables/Android/*.bundle (57 files, ~82 MB)
           → lib/arm64-v8a/libil2cpp.so (120 MB)
           → assets/bin/Data/Managed/Metadata/global-metadata.dat (24 MB)
           
Il2CppDumper v6.7.46:
  libil2cpp.so + global-metadata.dat → dump.cs (56 MB), il2cpp.h (146 MB), script.json (154 MB)

UnityPy v1.25.2:
  Per-bundle deserialization of MonoBehaviours, TextAssets, Sprites, etc.
```

### Key Artifacts on UbuntuMac

| Path | Size | Description |
|------|------|-------------|
| `~/mineops-data/il2cpp_output/dump.cs` | 56 MB | C# class definitions with field offsets |
| `~/mineops-data/releases/{release_id}/extracted/base.apk/assets/Addressables/Android/` | ~82 MB | 57 Unity AssetBundles |
| `~/mineops-data/releases/{release_id}/exports/extracted_managers/managers.json` | ~760 KB | 118 manager records |
| `~/mineops-data/releases/{release_id}/exports/extracted_equipment/equipment.json` | ~5 KB | 36 equipment + 15 materials |
| `~/mineops-data/releases/{release_id}/exports/v3/catalog-core.json` | ~700 KB | Full catalog package |

---

## 2. What We Extract Today (In Use)

### 2.1 Managers — 118 records (112 fully extracted, 6 partial)

**Source bundle:** `configfiles-supermanagers_assets_all_*.bundle` (0.2 MB, 556 MonoBehaviours)

**7 ScriptableObject assets per manager (ID range 10001–10118):**

| Asset | Data |
|-------|------|
| `{ID}_SuperManagers.asset` | nameKey, rarity, area, category, gender, cooldown, duration, maxLevel, maxPromotions, passives 1-3, flags |
| `{ID}_SuperManagersActivesToLevels.asset` | Active strength per level (1–100/50) in `Params[]` |
| `{ID}_SuperManagersLevelsToPromotions.asset` | Promotion cost, level req, unlocked passive per rank |
| `{ID}_ActiveEffectFactorType.asset` | EffectType, EffectDescType, Incremental |
| `{ID}_RankEffectsValues.asset` | ActiveIncrease, PassiveIncrease per rank |
| `{ID}_SuperManagerToFragments.asset` | FragmentId (900001–900118) |
| `{ID}_SuperManagerDataConfig.asset` | Metadata (some managers missing this) |

**Plus:** `SuperManagerElementalConfig_{ID}.json` (TextAsset) for elemental mappings.

**Output:** `exports/extracted_managers/managers.json` — 118 records with `managerId`, `canonical` (flattened), `fields` (per-asset-field provenance), `assetsFound`, `assetsMissing`, `warnings`.

**Used in:** `frontend/src/lib/strategy.ts` → catalog-core.json → Manager cards, detail modals, Strategy page.

### 2.2 Equipment — 36 items + 15 materials

**Source bundle:** `supermanagerequipment_assets_all_*.bundle` (0.2 MB) + `configfiles_assets_all_*.bundle` (1.2 MB)

**6 MonoBehaviour configs parsed via binary layout reverse-engineering:**

| Config | Data |
|--------|------|
| SuperManagerEquipmentConfig | equipment name keys + IDs |
| SuperManagerEquipmentBalancingConfig | id→level→value tuning |
| SuperManagerEquipmentEffectLocaConfig | effect description localization keys |
| SuperManagerEquipmentMaterialConfig | 15 crafting materials |
| SuperManagerEquipmentMaterialShopConfig | shop pricing (identified, not yet parsed) |
| SuperManagerEquipmentInfoPanelConfig | UI panel colors (skipped) |

**Output:** `exports/extracted_equipment/equipment.json` and the candidate package `equipment-domain.json`. Equipment rows now preserve long/short localization keys alongside numeric balancing rows.

**Limitations per journal:**
- Equipment display names are localization keys (SMEquipmentName01–19)
- Equipment-to-SuperManager assignment is player-save data and is now captured separately from Kolibri when an owned-equipment section is present
- The APK capture still has no decoded localized effect text for equipment 11031; its `SMEquipmentEffectLocaConfig` key is preserved and remains unresolved until the localization bundle is decoded
- MaterialShopConfig shop price data not parsed

### 2.3 Game Objects Inventory — 4,035 entries (heuristic/placeholder)

**Source:** Entire APK file listing

**Output:** `exports/game-objects.jsonl` — file-level heuristic catalog with `objectType: "Unknown"` and `confidence: 0.85`. **Not real game entities** — these are APK file entries (META-INF, AndroidManifest, libraries).

### 2.4 Localization — placeholder only

**Output:** `exports/localization.jsonl` — ~4,035 entries, all with `text: "placeholder::..."` and `status: "scaffolded"`. **No real game strings extracted.**

### 2.5 Relationships — file-level only

**Output:** `exports/relationships.jsonl` — file-to-file relationships. Not game entity relationships.

---

## 3. Complete Bundle Inventory

All bundles from `assets/Addressables/Android/`. Bundles marked **★** contain game data configs; others are visual/support assets.

### Game Data Bundles ★

| Bundle | Size | Objects | Content |
|--------|------|---------|---------|
| **generalassets** | 60.7 MB | 123,307 | **All visual assets** (sprites, spine animations, textures, UI prefabs). 38,627 MonoBehaviours, 336 TextAssets (mostly empty via IL2CPP). Contains SuperManager spine skeletons, mine resource entities, district resource configs. |
| **configfiles** ★ | 1.2 MB | 6,083 | **Skill/Config wrapper objects.** 2,981 MonoBehaviours, 1603 named. Contains skill effect configs (CorridorUpgradeCostReduction, ElevatorCapacity, GroundWorkerCapacity, etc.), mine type configs, UI configs, region configs. Each has `DescriptionKey` + `Effect` or `ContinentType` attributes. |
| **configfiles-supermanagers** ★ | 0.2 MB | 565 | **All 118 manager configs.** 556 MonoBehaviours + 9 TextAssets. Already fully extracted. |
| **configfiles-jsonfallback** | 0.01 MB | tiny | JSON fallback configs |
| **configfiles-migrationsteps** | 0.01 MB | tiny | Migration step configs |
| **supermanagerpowerscore** | 0.3 MB | 995 | **Manager power scoring UI.** 359 MonoBehaviours. |
| **supermanagerequipment** | 0.2 MB | 33 | **Equipment materials/sprites.** Already partially extracted. |
| **frontiermines** | 1.1 MB | 86 | Frontier Mine sprites/textures only (no data configs found) |
| **competitiveelementalmines** | 1.5 MB | 147 | Elemental mine sprites + 6 MonoBehaviours (likely UI configs) |
| **collectibles** | 2.7 MB | 323 | Collectible sprites/textures only |
| **chapters** | 0.9 MB | 761 | Chapter/mine progression UI. 238 MonoBehaviours. |
| **barrierrewards-continent-regular** | 0.1 MB | 7 | Barrier reward sprites + 1 MonoBehaviour |
| **barrierrewards-tier-default** | 0.2 MB | 9 | Tier reward sprites + 1 MonoBehaviour |
| **chainoffer** | 0.01 MB | tiny | Chain offer UI |
| **eventhub** | 0.1 MB | ~100 | Event hub UI |
| **genericbattlepass** | 0.05 MB | ~50 | Battle pass UI |
| **mainlandcontent-coast** | 0.3 MB | ~300 | Mainland coast content |
| **tesseract** | 1.4 MB | ~400 | Tesseract (spine animation framework?) |
| **localscenes** | 0.7 MB | ~50 | Local scenes |
| **textmeshproassets** | 7.0 MB | ~100 | TextMeshPro font assets |

### Visual Asset Bundles

| Bundle Group | Count | Total Size | Content |
|---|---|---|---|
| supermanager-{10083..10118} | 36 | ~11 MB | Per-manager portrait/sprite bundles (IDs 10083–10118 have bundles; IDs 10001–10082 are in generalassets) |
| _unitybuiltinshaders | 1 | 0.1 MB | Unity built-in shaders |

### Key Finding

The `generalassets` bundle (60.7 MB) is overwhelmingly visual assets — spine skeleton data, animations, textures, and UI prefabs. The game economy data tables (upgrade costs, mine income per level, etc.) are **not stored as standalone TextAsset JSONs** in the bundles. Instead, they live in two places:

1. **configfiles bundle** — Skill/config wrapper objects with `DescriptionKey` (localization reference) and `Effect` (numeric multiplier). These reference the economy tables but don't contain the raw per-level data.
2. **IL2CPP code** — The actual Entity.Param tables (with per-level costs, income values) may be hardcoded in the C# IL2CPP binary and only resolved at runtime. The Il2CppDumper output confirms 151 entity types with `.Param` nested classes.

---

## 4. Entity Type Catalog (from Il2CppDumper)

The `dump.cs` (56 MB) defines **302 Entity types**, of which **151 are ScriptableObject Entity types** with nested `.Param` classes. Here are the categories most relevant to a simulator:

### 4.1 Mine Economy Entities

| Entity | Description | Simulator Use |
|--------|-------------|---------------|
| `CorridorEntity.Param` | Mine shaft upgrade costs & income per level | Core mine shaft simulation |
| `GroundEntity.Param` | Ground (transport) upgrade costs | Transport simulation |
| `ElevatorEntity.Param` | Elevator upgrade costs | Elevator simulation |
| `WarehouseEntity.Param` | Warehouse upgrade costs & capacity | Warehouse simulation |
| `CorridorLevelCapsEntity.Param` | Max shaft level caps | Progression limits |
| `ElevatorLevelCapsEntity.Param` | Max elevator level caps | Progression limits |
| `GroundLevelCapsEntity.Param` | Max ground level caps | Progression limits |
| `MineRegionEntity.Param` | Mine region multipliers & unlock costs | Region progression |
| `MineFactorsEntity.Param` | Income/production multipliers per mine | Economy tuning |
| `MineIdentifierEntity.Param` | Mine type identification | Mine type mapping |
| `NormalMineDifficultyEntity.Param` | Difficulty scaling for normal mines | Difficulty scaling |
| `MineResourceEntity` | Cash/resource icon configs | UI/display |

### 4.2 Manager Economy Entities

| Entity | Description | Simulator Use |
|--------|-------------|---------------|
| `ManagerCostEntity.Param` | Hire cost per manager slot | Manager hiring simulation |
| `ManagerCostEMMMEntity.Param` | Event mine manager costs | Event simulation |
| `SuperManagerUnlockCostsEntity.Param` | Super manager unlock costs | SM progression |
| `SuperManagerUpgradeCostsEntity.Param` | SM level upgrade costs | SM leveling |
| `ManagerEntity.Param` | Regular manager stats | Manager simulation |
| `ManagerRarityEntity.Param` | Rarity probabilities | Gacha simulation |
| `ManagerCooldownResetCostEntity.Param` | Cooldown reset costs | Active ability simulation |
| `SuperManagerCooldownResetCostsEntity.Param` | SM cooldown reset costs | SM active simulation |
| `HireRollEntity.Param` | Manager hire roll costs | Hiring gacha |

### 4.3 Research / Skill Tree Entities

| Entity | Description | Simulator Use |
|--------|-------------|---------------|
| `SkillLevelsEntity.Param` | Skill tree level data | Research tree simulation |
| `SkillNodeEntity.Param` | Individual skill node configs | Skill effects |
| `SkillPointCostsEntity.Param` | Skill point costs per level | Research costs |
| `PremiumSkillPointCostsEntity.Param` | Premium (super cash) skill costs | Premium research |
| `SkillResetEntity.Param` | Skill reset costs | Respec simulation |
| `PromotionDataEntity.Param` | Promotion benefit data | Manager promotion |

### 4.4 Artifact & Collectible Entities

| Entity | Description | Simulator Use |
|--------|-------------|---------------|
| `ArtifactsEntity.Param` | Artifact definitions | Artifact simulation |
| `ArtifactEffectsEntity.Param` | Artifact effect values | Artifact benefits |
| `UpgradableArtifactsEntity.Param` | Artifact upgrade costs | Artifact upgrades |
| `CollectiblesEntity.Param` | Collectible definitions | Collectible simulation |
| `CollectibleLevelsEntity.Param` | Collectible level data | Collectible progression |
| `CollectibleProductionFactorsEntity.Param` | Production multipliers | Income multipliers |
| `CollectiblePartsChestsEntity.Param` | Parts chest configs | Collectible gacha |
| `CollectiblePartsLootTablesEntity.Param` | Loot table data | Drop rates |
| `BlueprintEntity.Param` | Blueprint (equipment crafting) data | Equipment crafting |

### 4.5 Event Mine Entities

| Entity | Description | Simulator Use |
|--------|-------------|---------------|
| `EventConfigurationEntity.Param` | Event configuration data | Event simulation |
| `EventCorridorEntity.Param` | Event mine shaft data | Event mines |
| `EventElevatorEntity.Param` | Event elevator data | Event mines |
| `EventGroundEntity.Param` | Event ground data | Event mines |
| `EventMineRegionEntity.Param` | Event mine region data | Event regions |
| `EventLimitationsEntity.Param` | Event limitations/rules | Event rules |
| `ImpossibleMineCorridorEntity.Param` | Impossible mine shaft data | IM simulation |
| `ImpossibleMineElevatorEntity.Param` | IM elevator data | IM simulation |
| `ImpossibleMineGroundEntity.Param` | IM ground data | IM simulation |
| `ImpossibleMineRegionEntity.Param` | IM region data | IM regions |
| `ImpossibleMineDifficultyEntity.Param` | IM difficulty scaling | IM difficulty |
| `ImpossibleMineRewardsEntity.Param` | IM reward tables | IM rewards |
| `SuperMineCorridorEntity.Param` | Super mine shaft data | Mainland/FM simulation |
| `SuperMineElevatorEntity.Param` | Super mine elevator data | Mainland/FM |
| `SuperMineGroundEntity.Param` | Super mine ground data | Mainland/FM |
| `SuperMineRegionsEntity.Param` | Super mine region data | Mainland/FM regions |
| `SuperMineDifficultiesEntity.Param` | Super mine difficulty | Mainland/FM difficulty |
| `SuperMineRewardsEntity.Param` | Super mine reward tables | Mainland/FM rewards |
| `SuperMineBlockConfigEntity.Param` | Block/barrier config | Barrier simulation |
| `SuperMineUnlockCostsEntity.Param` | Unlock costs | Progression |
| `RushMineCorridorEntity.Param` | Rush mine shaft data | Rush events |
| `RushMineElevatorEntity.Param` | Rush mine elevator data | Rush events |
| `RushMineWarehouseEntity.Param` | Rush mine warehouse data | Rush events |
| `RushMineRegionEntity.Param` | Rush mine region data | Rush regions |
| `ElementalMineCorridorEntity.Param` | Elemental mine shaft data | Elemental mines |
| `ElementalMineElevatorEntity.Param` | Elemental elevator data | Elemental mines |
| `ElementalMineWarehouseEntity.Param` | Elemental warehouse data | Elemental mines |
| `ElementalMineRegionEntity.Param` | Elemental region data | Elemental regions |
| `ElementalMineElevatorLevelCapsEntity.Param` | Level caps | Progression limits |
| `ElementalMineWarehouseLevelCapsEntity.Param` | Level caps | Progression limits |

### 4.6 Boost / Economy Entities

| Entity | Description | Simulator Use |
|--------|-------------|---------------|
| `BoostSinkItemXPEntity.Param` | Boost sink XP values | Boost simulation |
| `BoostSinkRewardsEntity.Param` | Boost sink rewards | Boost rewards |
| `BoostTimeReductionEntity.Param` | Time reduction values | Boost simulation |
| `ItemXPEntity.Param` | Item XP values | Item progression |
| `ActionXpEntity.Param` | Action XP values | XP simulation |
| `RewardExpEntity.Param` | Reward XP values | XP rewards |
| `RewardsEntity.Param` | Reward definitions | Reward tables |
| `RewardTiersEntity.Param` | Tier-based rewards | Tier rewards |
| `GateRewardEntity.Param` | Gate/barrier rewards | Barrier rewards |
| `GateUnlockEntity.Param` | Gate unlock costs | Barrier costs |
| `AdChestEntity.Param` | Ad chest configs | Ad economy |
| `IdleChestsEntity.Param` | Idle chest configs | Idle economy |
| `ChestLootTablesEntity.Param` | Loot table data | Drop rates |
| `MineKeyCostEntity.Param` | Mine key costs | Key economy |
| `KeyDurationEntity.Param` | Key duration values | Key timing |
| `AdBoostFactorConfig` | Ad boost multiplier | Ad boost |

### 4.7 Other Entities

| Entity | Description |
|--------|-------------|
| `FragmentRankCostEntity.Param` | Fragment rank-up costs |
| `SpareFragmentExchangeRatesEntity.Param` | Fragment exchange rates |
| `PassiveEffectFactorTypeEntity.Param` | Passive effect type definitions |
| `SMEquipmentEffectMappingEntity.Param` | Equipment-to-effect mapping |
| `SuperManagerEquipmentEntity.Param` | Equipment definitions |
| `EquipmentMaterialEntity.Param` | Equipment material data |
| `DiscountMappingEntity.Param` | Discount mappings |
| `LuckyElevator*Entity.Param` (5 types) | Lucky elevator event |
| `LuckyWheel*Entity.Param` (4 types) | Lucky wheel event |
| `LuckyDraw*Entity.Param` (2 types) | Lucky draw event |
| `MedalTimesEntity.Param` | Medal time thresholds |
| `MysteryReward*Entity.Param` (2 types) | Mystery reward configs |
| `SeededRollsEntity.Param` | Seeded random rolls |
| `TieredSpender*Entity.Param` (4 types) | Tiered spender event |
| `VideoChestChanceEntity.Param` | Video chest probabilities |
| `GemSuperCashLimitEntity.Param` | Gem/super cash limits |
| `IapEntity.Param` | In-app purchase configs |
| `IapToItemsEntity.Param` | IAP item mappings |
| `DailyDealsLootTableEntity.Param` | Daily deals |
| `BattlePassTierToRewardEntity.Param` | Battle pass rewards |
| `AchievementsEntity.Param` | Achievement configs |
| `DecorationsEntity.Param` | Decoration configs |
| `UnlockCostEntity.Param` | Generic unlock costs |
| `UpgradesEntity.Param` | Generic upgrade data |
| `TotalLevelExpEntity.Param` | Total level XP |
| `MiscEntity.Param` | Miscellaneous configs |
| `BuyMissingGemsEntity.Param` | Gem purchase configs |

---

## 5. What Could Be Extracted But Isn't

### 5.1 Config Bundle Skill/Effect Data (MEDIUM effort)

The `configfiles` bundle contains 1,603 named MonoBehaviours with economy-related skill effect data. Each has a `DescriptionKey` (localization reference) and `Effect` (numeric multiplier), some also have `ContinentType`, `region`, or `MineType`.

**Probe result:** Successfully accessed `CorridorUpgradeCostReduction` (Effect=10) and `CorridorWorkerGain` via UnityPy — same approach as the manager extractor. These objects ARE extractable.

**What we could get:**
- Per-skill effect magnitudes (e.g., "Corridor Upgrade Cost -10%", "Elevator Capacity +5")
- Continent-specific skill node configs
- Region-specific skill configs
- Mine type-specific skill configs

**Effort:** ~1 day to write a generalized configfiles extractor.

### 5.2 Economy Entity Tables (HIGH effort, unknown feasibility)

The Entity.Param tables (CorridorEntity, ElevatorEntity, etc.) are defined in the Il2CppDumper output with field offsets, but their **instances** may exist in the `generalassets` bundle as nested MonoBehaviours. The UnityPy IL2CPP path currently shows these as visual objects (sprites, animations), not data tables.

**Approach options:**
1. **UnityPy object_reader path:** The `object_reader` attribute on MonoBehaviours may contain the raw type tree data. Currently returns `None` for configfiles bundle objects; may work better on generalassets.
2. **TextAsset extraction:** The 336 TextAssets in generalassets all have 0-length content via UnityPy's IL2CPP path. They may contain data at the binary level that needs raw offset-based extraction.
3. **Runtime capture (see §6):** Use the Android emulator to capture entity data at runtime via save file analysis or memory inspection.

**Effort:** 1–2 weeks of binary reverse-engineering, OR runtime capture approach.

### 5.3 Equipment-to-Manager Mapping (LOW effort)

The `SMEquipmentEffectMappingEntity.Param` and `SuperManagerEquipmentEntity.Param` entities define which equipment goes on which manager. These may be in the `configfiles` bundle.

**Effort:** ~few hours to locate and parse (if in configfiles), ~1 day (if in generalassets binary).

### 5.4 Equipment Material Shop Prices (LOW effort)

The `SuperManagerEquipmentMaterialShopConfig` MonoBehaviour was identified in the equipment_extractor but shop price data was not yet parsed.

**Effort:** ~few hours.

### 5.5 Manager Power Scoring (LOW effort)

The `supermanagerpowerscore` bundle (0.3 MB, 359 MonoBehaviours) contains power score calculation UI data. This could reveal how the game computes manager strength.

**Effort:** ~half day.

### 5.6 Frontier Mine Config Data (UNCERTAIN)

The `frontiermines` bundle contains only sprites (51) and textures (34) — no MonoBehaviours. Frontier Mine economy data likely lives in the `generalassets` MonoBehaviours or IL2CPP code.

**Effort:** Unknown. May require runtime capture.

### 5.7 Chapter/Mine Progression Configs (MEDIUM effort)

The `chapters` bundle (0.9 MB, 238 MonoBehaviours) contains chapter/mine progression UI data with MonoBehaviour configs.

**Effort:** ~1 day.

### 5.8 Barrier/Event Mine Reward Configs (MEDIUM effort)

The `barrierrewards-continent-regular` and `barrierrewards-tier-default` bundles each contain 1 MonoBehaviour. Combined with `GateRewardEntity.Param` and `GateUnlockEntity.Param`, this could yield barrier milestone data.

**Effort:** ~half day.

---

## 6. Hard Limitations (Not Extractable Statically)

### 6.1 Localization Strings

Display names and descriptions are resolved at runtime from IL2CPP-compiled code. The localization table is not in extractable asset files. Current workaround: the frontend uses a hardcoded fallback (`manager-name-fallback.ts`) with 118 names + upstream API enrichment (`idle-miners.com/api/sm-data`).

**Impact:** Equipment display names remain as localization keys (SMEquipmentName01–19), skill descriptions, element names.

### 6.2 Element ID → Name Mapping

Element IDs 4100000–4100007 are defined in IL2CPP code, not in extractable data.

### 6.3 Per-Level Economy Tables

The actual numeric cost/income tables for mine shafts, elevator, warehouse (e.g., "Shaft 1 Level 100 costs X") may be:
- In IL2CPP code as compiled constants
- In generalassets as Entity.Param ScriptableObjects (not yet found)
- Generated algorithmically at runtime from formulas

### 6.4 Frontier Mine Dynamic Data

FM barrier costs, spark counts, and event timing are server-driven or procedurally generated.

---

## 7. Extraction Approach Per Category

### For configfiles Skill/Effect Data (Proven Approach)

Same pattern as the working manager extractor:

```python
import UnityPy
env = UnityPy.load("configfiles_assets_all_*.bundle")
for obj in env.objects:
    if obj.type.name == "MonoBehaviour":
        data = obj.read()
        name = getattr(data, "m_Name", "")
        desc = getattr(data, "DescriptionKey", None)
        effect = getattr(data, "Effect", None)
        continent = getattr(data, "ContinentType", None)
        # ... extract
```

### For generalassets Entity Tables (Experimental)

1. Try `object_reader` attribute to access raw type tree
2. Try binary offset reads using Il2CppDumper field offsets
3. Fallback: runtime capture from emulator save file

### Runtime Capture Alternative

The emulator (`emulator-5556`) can run the game. Options:
- **Save file analysis:** Extract the game save from `/data/data/com.fluffyfairygames.idleminertycoon/` — may contain serialized entity data
- **Memory inspection:** Use Frida or similar to hook into the EntityProvider system at runtime
- **Kolibri API:** The game's cloud save contains player state, but not static game config data

---

## 8. Recommended Simulator Data Priority

### Tier 1 — Essential for Core Simulation (extract first)

| Data | Source | Effort |
|------|--------|--------|
| Manager passive identity & unlock milestones | `configfiles-supermanagers` | ✅ Lossless candidate |
| Manager active abilities & scaling | `configfiles-supermanagers` | ✅ 11,800 exact level rows |
| Skill effect configs (Corridor/Ground/Elevator/Warehouse) | `configfiles` | ✅ Raw/provenanced; normalization pending |
| Mine region multipliers | `configfiles` / Entity tables | Medium-High |
| Manager hire/upgrade costs | `configfiles` / Entity tables | Medium-High |

### Tier 2 — Major Simulator Value

| Data | Source | Effort |
|------|--------|--------|
| Research/skill tree full data | Entity tables | High |
| Artifact definitions & effects | Entity tables | High |
| Collectible progression tables | Entity tables | High |
| Equipment-to-manager mapping | `configfiles` / Entity tables | Low |
| Equipment crafting costs | `configfiles` | Low |
| Fragment costs & exchange rates | Entity tables | Medium |
| Manager cooldown reset costs | Entity tables | Medium |
| Continent progression (region unlock costs) | Entity tables | Medium-High |

### Tier 3 — Advanced Features

| Data | Source | Effort |
|------|--------|--------|
| Event mine full configs (all types) | Entity tables | High |
| Barrier/milestone reward tables | Entity tables | Medium |
| Boost/sink economy | Entity tables | High |
| Battle pass rewards | Entity tables | Low |
| Lucky wheel/elevator configs | Entity tables | Low |
| IAP configs | Entity tables | Low |
| Daily deal configs | Entity tables | Low |

### Lossless candidate status (2026-08-02)

UbuntuMac now has a complete immutable candidate with 11 artifacts and a manifest written last. It stages 1,698 data-shaped records from `configfiles`, JSON fallback, generalassets, power score, chapters, barrier/event, battle pass, mainland, competitive elemental mines, and previously extracted elemental JSON. Bundles with no selected data-shaped records—notably the sprite-only Frontier and collectible bundles—remain represented by the audit inventory, not fabricated empty domain objects. The raw records are review inputs; their gameplay semantics are not considered normalized merely because extraction succeeded.

---

## Appendix A: Quick Reference Commands

```bash
# SSH to UbuntuMac
ssh ubuntumac

# List releases
ls ~/mineops-data/releases/

# Show bundle inventory
ls ~/mineops-data/releases/5.59.0_96449_20260716T143539Z/extracted/base.apk/assets/Addressables/Android/

# Inspect a bundle with UnityPy
~/mineops-env/bin/python3 -c "
import UnityPy
env = UnityPy.load('path/to/bundle')
for obj in env.objects:
    print(obj.type.name, getattr(obj.read(), 'm_Name', '?'))
"

# Search dump.cs for entity types
grep 'public class.*Entity' ~/mineops-data/il2cpp_output/dump.cs | head -50

# View manager extraction
cat ~/mineops-data/releases/5.59.0_96449_20260716T143539Z/exports/extracted_managers/extraction-report.json

# View equipment data
~/mineops-env/bin/python3 -c "
import json
with open('~/mineops-data/releases/5.59.0_96449_20260716T143539Z/exports/extracted_equipment/equipment.json') as f:
    print(json.dumps(json.load(f), indent=2))
"
```

## Appendix B: Bundle Object Type Counts (Quick Reference)

```
generalassets:           123,307 total (38,627 MonoBehaviour, 26,788 GameObject, 24,404 RectTransform)
configfiles:               6,083 total (2,981 MonoBehaviour, 846 GameObject)
chapters:                    761 total (238 MonoBehaviour, 145 GameObject)
supermanagerpowerscore:      995 total (359 MonoBehaviour, 198 GameObject)
collectibles:                323 total (161 Sprite, 161 Texture2D)
configfiles-supermanagers:   565 total (556 MonoBehaviour, 9 TextAsset)
competitiveelementalmines:   147 total (92 Sprite, 42 Texture2D, 6 MonoBehaviour)
frontiermines:                86 total (51 Sprite, 34 Texture2D)
supermanagerequipment:        33 total (16 Sprite, 16 Texture2D)
```
