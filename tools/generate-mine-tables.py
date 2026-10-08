#!/usr/bin/env python3
"""Generate frontend/src/lib/mine-tables.ts from the game's own fallback
config TextAssets (the "ready-made tables" found by the 2026-10-08 APK
deep-dive, dig #1).

Source: Idle Miner Tycoon APK release 5.63.0_97356_20260914T134142Z on
ubuntumac (~/mineops-data/releases/<id>/extracted/base.apk), bundles
  - configfiles-jsonfallback_assets_all_*.bundle
  - generalassets_assets_all_*.bundle
read with ~/mineops-env/bin/python + UnityPy (read-only). The parsed raw
JSONs live in /tmp/mineops-data-raw/ (provenance) and are the input here.

Usage:
  python3 tools/generate-mine-tables.py [raw-json-dir] [out-ts]

Defaults: raw dir /tmp/mineops-data-raw, out frontend/src/lib/mine-tables.ts
Re-run after a new APK release is processed and the TextAssets re-dumped.
Nothing in the output is invented: values are copied 1:1 from the game.
"""
import json
import pathlib
import sys

RAW = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/mineops-data-raw")
OUT = pathlib.Path(
    sys.argv[2] if len(sys.argv) > 2 else "frontend/src/lib/mine-tables.ts"
)

RELEASE = "5.63.0_97356_20260914T134142Z"


def load(name):
    return json.loads((RAW / f"{name}.json").read_text())


def compact(obj):
    return json.dumps(obj, separators=(",", ":"))


mine_cfg = load("mine_unlock_and_prestige_cost_fallback_config")
factor = {int(g): {int(m): v for m, v in rows.items()} for g, rows in mine_cfg["normalMineFactorOverride"].items()}
cost = {int(g): {int(m): v for m, v in rows.items()} for g, rows in mine_cfg["normalMineCostOverride"].items()}
difficulty = {int(m): v for m, v in mine_cfg["normalMineDifficultyOverride"].items()}

unlocks = load("continent_unlock_fallback")["continentsUnlockConfig"]
unlocks = [
    {
        "continent": u["continentType"],
        "unlockCost": u["unlockCost"],
        "unlockPrestigeCountRequired": u["unlockPrestigeCountRequired"],
        "rewardsPrestigeCountRequired": u["rewardsPrestigeCountRequired"],
        "rewards": u["rewards"],
    }
    for u in unlocks
]

rewards_raw = load("continent_prestige_reward_fallback_config")["prestigeRewardListConfig"]
rewards = {}
for row in rewards_raw:
    rewards.setdefault(row["continentType"], {})[row["prestige"]] = row["reward"]

elemental = load("ElementalMinesDefaultConfig")
elemental_mines = {}
for mine_id, cfg in elemental["mineConfigs"].items():
    elemental_mines[int(mine_id)] = {
        "unlockCost": cfg["unlockCost"],
        "mainElement": cfg["elementConfig"]["mainElement"],
        "difficultyMultipliers": cfg["difficultyMultipliers"],
    }
required_prestige = elemental["requiredPrestigeForUnlock"]

features = load("FeatureUnlockFallbackConfig")["features"]
pouches = load("elemental_essence_recipe_fallback")["pouches"]["pouchContents"]


def num_map(mapping):
    """{0: {1: 1, 2: 3}} -> TS object literal text with numeric keys."""
    lines = []
    for key in sorted(mapping):
        inner = ",".join(f"{k}:{compact(v)}" for k, v in sorted(mapping[key].items()))
        lines.append(f"  {key}: {{{inner}}}")
    return "{\n" + ",\n".join(lines) + "\n}"


def flat_map(mapping):
    inner = ",".join(f"{k}:{compact(v)}" for k, v in sorted(mapping.items()))
    return "{" + inner + "}"


header = f"""/**
 * Mine economy fallback tables, lifted 1:1 from the game's own config
 * (APK deep-dive dig #1, 2026-10-08). DO NOT EDIT BY HAND - regenerate
 * with tools/generate-mine-tables.py.
 *
 * Source: Idle Miner Tycoon release {RELEASE} (ubuntumac capture),
 * TextAssets in the configfiles-jsonfallback + generalassets bundles:
 *   mine_unlock_and_prestige_cost_fallback_config,
 *   continent_unlock_fallback, continent_prestige_reward_fallback_config,
 *   ElementalMinesDefaultConfig, FeatureUnlockFallbackConfig,
 *   elemental_essence_recipe_fallback.
 *
 * These are the game's offline fallbacks for pieces of its remote config:
 * honest game numbers, but the live server config wins any disagreement.
 * The per-level shaft/elevator/warehouse production tables are NOT here -
 * the game downloads those at runtime (they exist in no APK file).
 */"""

types = """
export interface RewardItem { id: number; amount: number }

export interface ContinentUnlock {
  /** Game continent key, e.g. "Ice", "LostDesert". */
  continent: string;
  unlockCost: number;
  unlockPrestigeCountRequired: number;
  rewardsPrestigeCountRequired: number;
  rewards: RewardItem[];
}

export interface ElementalDifficultyStep {
  costMultiplier: number;
  barrierTimeMultiplier: number;
  prestigeIncomeIncreaseFactor: number;
  prestigeCost: number;
}

export interface ElementalMineConfig {
  unlockCost: number;
  mainElement: string;
  difficultyMultipliers: ElementalDifficultyStep[];
}

export interface FeatureUnlockVariant {
  key: string;
  forceLocked?: boolean;
  mineMilestone?: { unlockMineId: number; unlockMineShaft: number; unlockPrestige?: number };
  cashPayment?: { unlockCashType: number; unlockCashAmount: number };
}

export interface EssencePouch {
  pouchId: number;
  randomElementalEssence: Array<{ minAmount: number; maxAmount: number }>;
  epicEssenceDropChance: number;
  legendaryEssenceDropChance: number;
  randomEpicEssence: { minAmount: number; maxAmount: number };
  randomLegendaryEssence: { minAmount: number; maxAmount: number };
}
"""

body = f"""
/**
 * Prestige income factor per mine: PRESTIGE_FACTOR_OVERRIDE[continent][mine].
 * The game keys rows by continent (0=Start, 1=Ice, ... app continentType)
 * and columns by the GLOBAL mine number 1..40; each continent reads only
 * its own five mines. Underwater (continent 7) has no fallback rows.
 */
export const PRESTIGE_FACTOR_OVERRIDE: Record<number, Record<number, number>> = {num_map(factor)};

/** Mine cost override rows, same [continent][mine] keying; sparse by design. */
export const MINE_COST_OVERRIDE: Record<number, Record<number, number>> = {num_map(cost)};

/** Difficulty per mine, keyed by global mine number 1..40. */
export const MINE_DIFFICULTY_OVERRIDE: Record<number, number> = {flat_map(difficulty)};

/** Continent unlock rows (Start is not listed: it is open by default). */
export const CONTINENT_UNLOCKS: ContinentUnlock[] = {compact(unlocks)};

/** Prestige rewards: PRESTIGE_REWARDS[game continent][prestige level]. */
export const PRESTIGE_REWARDS: Record<string, Record<number, RewardItem>> = {compact(rewards)};

/** Elemental (competitive) mines 5001-5020, keyed by mine number. */
export const ELEMENTAL_MINES: Record<number, ElementalMineConfig> = {compact(elemental_mines)};

/** Prestiges needed somewhere before elemental mines open. */
export const ELEMENTAL_REQUIRED_PRESTIGE = {required_prestige};

/** Feature unlock milestones, keyed by feature name. */
export const FEATURE_UNLOCKS: Record<string, FeatureUnlockVariant[]> = {compact(features)};

/** Elemental essence pouch contents. */
export const ESSENCE_POUCHES: EssencePouch[] = {compact(pouches)};

// ---------------------------------------------------------------- lookups

/** App continentType -> the game's own continent key for these tables. */
const CONTINENT_GAME_KEY: Record<number, string> = {{
  0: "Regular", 1: "Ice", 2: "Fire", 3: "Dawn", 4: "Dusk",
  5: "Ancient", 6: "LostDesert", 7: "Underwater",
}};

function continentOfMine(mineId: number): number | null {{
  if (!Number.isFinite(mineId) || mineId < 1 || mineId > 40) return null;
  return Math.floor((mineId - 1) / 5);
}}

/** Prestige income boost for a normal mine (1..40), e.g. x14. Null if unknown. */
export function prestigeFactorFor(mineId: number): number | null {{
  const continent = continentOfMine(mineId);
  if (continent == null) return null;
  return PRESTIGE_FACTOR_OVERRIDE[continent]?.[mineId] ?? null;
}}

/** Same lookup by continent + 0-based position on the continent. */
export function prestigeFactorAt(continentType: number, localIndex: number): number | null {{
  if (localIndex < 0 || localIndex > 4) return null;
  return prestigeFactorFor(continentType * 5 + localIndex + 1);
}}

/** Raw mine cost override for a normal mine, or null when the game sets none. */
export function mineCostOverrideFor(mineId: number): number | null {{
  const continent = continentOfMine(mineId);
  if (continent == null) return null;
  return MINE_COST_OVERRIDE[continent]?.[mineId] ?? null;
}}

/** Difficulty number for a normal mine, or null when unknown. */
export function mineDifficultyFor(mineId: number): number | null {{
  if (continentOfMine(mineId) == null) return null;
  return MINE_DIFFICULTY_OVERRIDE[mineId] ?? null;
}}

/** Unlock cost/requirements for a continent, or null (Start: open by default). */
export function continentUnlockFor(continentType: number): ContinentUnlock | null {{
  const key = CONTINENT_GAME_KEY[continentType];
  if (!key) return null;
  return CONTINENT_UNLOCKS.find((u) => u.continent === key) ?? null;
}}

/** Reward for prestiging a continent to the given level, or null. */
export function prestigeRewardFor(continentType: number, prestigeLevel: number): RewardItem | null {{
  const key = CONTINENT_GAME_KEY[continentType];
  if (!key) return null;
  return PRESTIGE_REWARDS[key]?.[prestigeLevel] ?? null;
}}

/** Elemental mine config for special mines 5001-5020, or null. */
export function elementalConfigFor(mineId: number): ElementalMineConfig | null {{
  return ELEMENTAL_MINES[mineId] ?? null;
}}
"""

OUT.write_text(header + types + body)
print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")
