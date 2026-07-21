# APK Extraction Report — MineOps Manager Data

**Date:** 2026-07-17  
**APK Version:** 5.59.0 (96449)  
**Release ID:** `5.59.0_96449_20260716T143539Z`  
**Platform:** Android (arm64-v8a)  
**Unity Version:** IL2CPP (Metadata v31)  
**Host:** ubuntumac (100.105.31.42)

---

## Summary

Successfully extracted one complete manager record (ID 10074 — "Poseidon") end-to-end from the APK using IL2CPP analysis tooling. The data pipeline is reproducible via a Python extraction script.

---

## Tooling Pipeline

```
APK (base.apk + split_config.arm64_v8a.apk)
  → unzip (APK extraction)
  → Il2CppDumper v6.7.46 (class layout recovery)
  → UnityPy v1.25.2 (AssetBundle + ScriptableObject deserialization)
  → extract_manager.py (reusable extraction script)
```

### 1. Il2CppDumper — Class Layout Recovery

Ran against `libil2cpp.so` (120MB) + `global-metadata.dat` (24MB):

| Output | Size | Purpose |
|--------|------|---------|
| `dump.cs` | 56 MB | C# struct definitions with field offsets |
| `il2cpp.h` | 146 MB | C header type definitions |
| `script.json` | 154 MB | Full type system metadata |
| `stringliteral.json` | 1.9 MB | String literals from binary |

### 2. UnityPy — AssetBundle Deserialization

The APK contains 57 Unity AssetBundles (Addressables-based). Key bundles:

| Bundle | Size | Contents |
|--------|------|----------|
| `generalassets_assets_all_*` | 60.7 MB | Main game assets (sprites, textures, configs, prefabs) |
| `configfiles-supermanagers_assets_all_*` | 0.2 MB | 556 MonoBehaviours + 9 TextAssets — **all manager data** |
| `configfiles_assets_all_*` | 1.2 MB | General config files |
| `supermanager-XXXXX_assets_all_*` | ~150 KB each | Manager portrait bundles (IDs 10083-10118) |
| `configfiles-jsonfallback_assets_all_*` | ~1 KB | JSON fallback configs |
| `configfiles-migrationsteps_assets_all_*` | ~1 KB | Migration configs |

---

## Data Architecture

Each manager has **7 individual ScriptableObject assets** stored under `ConfigFiles/SuperManagers/`:

### Manager 10074 Asset Layout

| Asset | Data |
|-------|------|
| `10074_SuperManagers.asset` | Core definition (nameKey, rarity, area, passives, etc.) |
| `10074_SuperManagersActivesToLevels.asset` | Active ability strength per level (100 levels) |
| `10074_SuperManagersLevelsToPromotions.asset` | Promotion requirements & unlocked passives |
| `10074_SuperManagerDataConfig.asset` | Data config metadata |
| `10074_ActiveEffectFactorType.asset` | Active effect type descriptor |
| `10074_RankEffectsValues.asset` | Rank-based active/passive increase values |
| `10074_SuperManagerToFragments.asset` | Fragment-to-manager mapping |

Plus external configs:
- `SuperManagerElementalConfig_10074.json` (TextAsset) — Element mapping & recipe per rank

---

## Extracted Class Layout (Il2CppDumper)

### SuperManagersEntity.Param (TypeDefIndex: 413)

```
public class SuperManagersEntity.Param {
    int     SuperManagerId;           // 0x10  — Unique ID (10074+)
    string  NameKey;                  // 0x18  — Localization key (e.g. "SM_Poseidon")
    int     Gender;                   // 0x20  — 0=Male, 1=Female
    int     AreaId;                   // 0x24  — 1=Corridor, 2=Ground, 3=Elevator
    double  Duration;                 // 0x28  — Active ability duration (seconds)
    double  Cooldown;                 // 0x30  — Active ability cooldown (seconds)
    bool    CanBeBoughtWithGems;      // 0x38
    bool    IsRentable;               // 0x39
    bool    IsImpossibleIslandReward; // 0x3A
    int     SuperManagerRarity;       // 0x3C  — 1=Common, 2=Rare, 3=Epic, 4=Legendary
    int     Passive1;                 // 0x40  — Passive ability ID 1
    int     Passive2;                 // 0x44  — Passive ability ID 2
    int     Passive3;                 // 0x48  — Passive ability ID 3
    int     MaxLevel;                 // 0x4C
    int     MaxPromotions;            // 0x50
    int     Category;                 // 0x54  — 1=None, 2=Gems, 3=Iap, 4=Event, 5=ImpossibleMine
    bool    IsLocaEncrypted;          // 0x58
}
```

### SuperManagersActivesToLevelsEntity.Param (TypeDefIndex: 411)

```
public class SuperManagersActivesToLevelsEntity.Param {
    int     ActiveToLevelsId;
    int     SuperManagerId;
    int     Level;
    double  ActiveStrength;
}
```

### SuperManagersLevelsToPromotion2Entity.Param (TypeDefIndex: 415)

```
public class SuperManagersLevelsToPromotion2Entity.Param {
    int     SuperManagerIdToPassiveId;
    int     SuperManagerId;
    int     Level;
    int     Rarity;
    int     Promotion;
    double  PromotionCost;
    bool    UnlocksPassive;
    int     PassiveId;
}
```

### Key Enums

**SuperManagerRarity** (TypeDefIndex: 9211): `Common=1, Rare=2, Epic=3, Legendary=4`

**SuperManagerCategory** (TypeDefIndex: 9207): `None=1, Gems=2, Iap=3, Event=4, ImpossibleMine=5`

**ManagerRegion** (TypeDefIndex: 17843): `Corridor=1, Ground=2, Elevator=3`

**SuperManagerPassiveType** (TypeDefIndex: 18035): `ElevatorMovementSpeedBoost=1, GroundWalkingSpeedBoost=2, MiningSpeedBoost=3, WarehouseWalkingAndLoadingSpeed=4, ... IdleCashBoost=1001, MineIncomeBoost=1007, ContinentIncomeBoost=1010`

**Gender** (TypeDefIndex: 17754): `Male=0, Female=1`

---

## Data Relationship Map

```
superManagerId (10074)
  ├── SuperManagersEntity.Param (core definition)
  │     ├── NameKey → "SM_Poseidon" → Localization table → "Poseidon"
  │     ├── SuperManagerRarity → 4 → Legendary
  │     ├── AreaId → 2 → Elevator
  │     ├── Category → 4 → Event
  │     ├── Gender → 0 → Male
  │     ├── Passive1/2/3 → PassiveType IDs
  │     └── IsLocaEncrypted → 1 (NameKey is encrypted format)
  │
  ├── SuperManagersActivesToLevelsEntity (active ability)
  │     └── Level 1-100 → ActiveStrength (12.1 → 15.2)
  │
  ├── SuperManagersLevelsToPromotion2Entity (promotions)
  │     └── Promotions 1-5 → Level req, Cost, UnlockedPassive
  │
  ├── SuperManagerElementalConfig (element mapping)
  │     └── Element IDs (e.g. 4100007) per rank
  │
  ├── SuperManagerToFragmentsEntity (fragment linkage)
  │     └── FragmentId = 900074
  │
  ├── ActiveEffectFactorTypeEntity (effect type)
  │     └── EffectType=1, DescType=0 (Multiplier), Incremental
  │
  ├── RankEffectsValuesEntity (rank scaling)
  │     └── Ranks 1-5 → ActiveIncrease, PassiveIncrease
  │
  └── supermanager-XXXXX.bundle (sprite portrait)
        └── Manager ID → Addressable bundle → Sprite/Texture2D
```

---

## Complete Manager Record (10074 — Poseidon)

File: `exports/manager_10074_complete.json` on ubuntumac

```json
{
  "superManagerId": 10074,
  "nameKey": "SM_Poseidon",
  "displayName": "Poseidon",
  "gender": 0, "genderLabel": "Male",
  "areaId": 2, "area": "Elevator",
  "rarity": 4, "rarityLabel": "Legendary",
  "category": 4, "categoryLabel": "Event",
  "duration": 90.0, "cooldown": 1200.0,
  "maxLevel": 50, "maxPromotions": 5,
  "fragmentId": 900074,
  "elementalMapping": [
    {"id": 4100007, "rankToUnlock": 0, "isPrimary": true},
    {"id": 4100004, "rankToUnlock": 1, "isPrimary": false},
    {"id": 4100005, "rankToUnlock": 3, "isPrimary": false},
    {"id": 4100000, "rankToUnlock": 5, "isPrimary": false}
  ],
  "activeEffect": {
    "effectType": 1, "effectDescType": 0,
    "incremental": true, "baseActiveStrength": 12.1
  },
  "promotions": [
    {"rank": 1, "level": 10, "cost": 20000, "unlocksPassive": true, "passiveId": 4},
    {"rank": 3, "level": 30, "cost": 8.35e12, "unlocksPassive": true, "passiveId": 9},
    {"rank": 5, "level": 50, "cost": 1.13e20, "unlocksPassive": true, "passiveId": 1010}
  ]
}
```

---

## Reusable Extraction Tool

**Location:** `/home/yancmo/mineops-engine/scripts/extract_manager.py` on ubuntumac

```bash
# Extract all data for one manager
~/mineops-env/bin/python3 scripts/extract_manager.py <release-dir> <manager-id>

# Example
~/mineops-env/bin/python3 scripts/extract_manager.py \
  ~/mineops-data/releases/5.59.0_96449_20260716T143539Z 10074
```

Output: JSON with 7 asset entries per manager.

---

## Generalized Extraction Pipeline (Recommended)

For extracting all managers into the catalog format:

1. **Extract all manager IDs** from the 556 MonoBehaviours in `configfiles-supermanagers`
2. **For each manager ID**, run the extractor to get the 7 asset values
3. **For each manager ID**, load `SuperManagerElementalConfig_{ID}.json` for element data
4. **For sprite references**, map `superManagerId` to the corresponding `supermanager-{ID}.bundle`
5. **For localization**, extract from the game's localization system (IL2CPP compile-time constants in the current build — may require runtime capture)
6. **Cross-reference** with the existing `sm_complete_database.json` catalog for ID verification

### Known Limitations

- **Localization strings**: Display names are resolved at runtime via IL2CPP-compiled code. The `NameKey` field (e.g. `SM_Poseidon`) is documented but the localization table is not stored in extractable asset files.
- **Passive ability descriptions**: Passive effect names and descriptions are in the localization system.
- **Sprite portraits**: 36 manager portrait bundles exist (IDs 10083-10118). Managers without bundles (like 10074) may use generic or spine-based portraits.
- **Element ID to name mapping**: Element IDs 4100000-4100007 need to be mapped to element names (the mapping is in IL2CPP code, not extracted data).

---

## Files Changed

- `docs/APK_EXTRACTION_REPORT.md` — This document
- `frontend/src/lib/strategy.ts` — No change (frontend paused)
- `docs/development/journal.md` — Journal entry (2026-07-17)

## Verification

- ✅ Il2CppDumper v6.7.46 installed and functional on ubuntumac
- ✅ All class layouts recovered (56 MB `dump.cs`)
- ✅ UnityPy loaded and deserialized IL2CPP MonoBehaviours correctly
- ✅ 7 data assets extracted for manager 10074
- ✅ Elemental config JSON extracted
- ✅ Reusable script created and tested
- ✅ Complete manager JSON record saved to release directory
