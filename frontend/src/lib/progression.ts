/**
 * Player-progression multipliers for the derived mine rates: the research
 * skill tree and collectibles, from the game's own entity tables
 * (progression-data.ts - extracted 2026-10-23 from the game's bin/Data
 * entity assets; they are NOT in the APK bundles or the remote config).
 *
 * What is applied here, and only when the save proves ownership:
 *   - SkillNodeType 2  (AllMines): ParamX on every leg of every mine.
 *   - SkillNodeType 14 (ContinentMines): ParamX on every leg of mines
 *     whose continentType equals the node's ParamY.
 *   - SkillNodeType 1  (SingleMine): ParamX on every leg of the mine
 *     whose (save) mine number equals ParamY. Several nodes can target
 *     the same mine; distinct owned nodes multiply.
 *   - SkillNodeType 28/26/24 (CorridorGainPerSecond / ElevatorLoadingSpeed
 *     / WarehouseLoadingSpeed): ParamX on that leg for mines whose
 *     continentType equals ParamY.
 *   - Collectibles: the collectible's ProductionFactor at its saved level
 *     on its own leg (Corridor -> shaft, Elevator -> elevator,
 *     Ground -> warehouse), for save entries not in Locked state.
 * Skill ParamX is the cumulative factor at the owned level (SkillLevels
 * rows), not a per-level increment.
 *
 * Deliberately NOT applied (data extracted, semantics not pinned):
 *   - Capacity skill nodes (25/27/29): this model has no trip mechanics -
 *     warehouse rate is loading rate x workers and the elevator is a
 *     single car, so a capacity factor has nothing honest to act on.
 *   - Artifacts: saved unlocks are parsed (mine-state.ts) but the
 *     artifact bonus-tree composition (add vs multiply, upgrade tiers)
 *     is not established from the data, so no factor is guessed.
 *   - Collectible SecondaryEffectFactor (Continental/GlobalIncome):
 *     target resolution is not pinned; ABProductionFactor is an A/B-test
 *     variant whose assignment is server-side and unknowable locally.
 *   - Mainland boost nodes (15/17/19): their ParamY encodings (difficulty
 *     0-2, the 2000 group id, area ids 1-3) are not fully pinned.
 *   - Cost / ad / manager-effect / gem skill nodes: not production rates.
 */
import type { DerivedMineRates } from "./mine-balancing";
import { COLLECTIBLE_PRODUCTION, SKILL_PRODUCTION } from "./progression-data";

/** Save-proven progression ownership (from mine-state.ts). */
export interface OwnedProgression {
  /** SkillId -> owned level (SkillSavegames). */
  skills: Record<number, number>;
  /** Collectible savegame entries: id, level, state (0 Locked, 1 Unlocked, 2 Active). */
  collectibles: Array<{ id: number; level: number; state: number }>;
}

/** Per-leg progression multipliers for one mine (1 = nothing applies). */
export interface ProgressionFactors {
  shaft: number;
  elevator: number;
  warehouse: number;
}

/**
 * A mine's continentType from its global mine number, mirroring
 * mine-tables.ts continentOfMine (mainland mines 1..40, five per
 * continent: 0 Start, 1 Ice, 2 Fire, 3 Dawn, 4 Dusk, 5 Ancient,
 * 6 LostDesert, 7 Underwater). Null outside 1..40 - continent-scoped
 * skills then simply do not apply (SingleMine/AllMines still can).
 */
export function continentTypeOfMine(mineNumber: number | null): number | null {
  if (mineNumber == null || !Number.isFinite(mineNumber) || mineNumber < 1 || mineNumber > 40) return null;
  return Math.floor((mineNumber - 1) / 5);
}

function factorAt(x: number[], level: number): number {
  if (level <= 0) return 1;
  const idx = Math.min(Math.floor(level), x.length - 1);
  return x[idx] ?? 1;
}

/** Compute the progression multipliers for one mine from owned progression. */
export function progressionFactorsForMine(
  mineNumber: number | null,
  owned: OwnedProgression | null | undefined,
): ProgressionFactors {
  const factors: ProgressionFactors = { shaft: 1, elevator: 1, warehouse: 1 };
  if (!owned) return factors;
  const continent = continentTypeOfMine(mineNumber);

  for (const [idText, level] of Object.entries(owned.skills)) {
    if (!(level > 0)) continue;
    const row = SKILL_PRODUCTION[Number(idText)];
    if (!row) continue;
    const x = factorAt(row.x, level);
    if (x === 1) continue;
    switch (row.effect) {
      case 2: // AllMines
        factors.shaft *= x;
        factors.elevator *= x;
        factors.warehouse *= x;
        break;
      case 14: // ContinentMines
        if (continent != null && row.target === continent) {
          factors.shaft *= x;
          factors.elevator *= x;
          factors.warehouse *= x;
        }
        break;
      case 1: // SingleMine
        if (mineNumber != null && row.target === mineNumber) {
          factors.shaft *= x;
          factors.elevator *= x;
          factors.warehouse *= x;
        }
        break;
      case 28: // CorridorGainPerSecond -> shaft leg
        if (continent != null && row.target === continent) factors.shaft *= x;
        break;
      case 26: // ElevatorLoadingSpeed -> elevator leg
        if (continent != null && row.target === continent) factors.elevator *= x;
        break;
      case 24: // WarehouseLoadingSpeed -> warehouse leg
        if (continent != null && row.target === continent) factors.warehouse *= x;
        break;
      default:
        // 25/27/29 capacity nodes and anything else: not rate factors.
        break;
    }
  }

  for (const entry of owned.collectibles) {
    if (entry.state <= 0 || !(entry.level > 0)) continue; // Locked or unleveled: no factor
    const row = COLLECTIBLE_PRODUCTION[entry.id];
    if (!row) continue;
    const f = factorAt(row.f, entry.level);
    if (f === 1) continue;
    if (row.type === "Corridor") factors.shaft *= f;
    else if (row.type === "Elevator") factors.elevator *= f;
    else if (row.type === "Ground") factors.warehouse *= f;
  }

  return factors;
}

/** True when any progression factor is in play (for UI notes). */
export function hasProgressionFactors(factors: ProgressionFactors): boolean {
  return factors.shaft !== 1 || factors.elevator !== 1 || factors.warehouse !== 1;
}

/**
 * Scale derived rates by progression factors, recomputing the slowest
 * leg / sustainable output. Prestige stays as recorded on the input
 * (it is already folded into the legs by deriveMineRates).
 */
export function applyProgressionToRates(rates: DerivedMineRates, factors: ProgressionFactors): DerivedMineRates {
  if (!hasProgressionFactors(factors)) return rates;
  const legs: Array<[DerivedMineRates["slowestLeg"], number]> = [
    ["shaft", rates.shaftPerSecond * factors.shaft],
    ["elevator", rates.elevatorPerSecond * factors.elevator],
    ["warehouse", rates.warehousePerSecond * factors.warehouse],
  ];
  const slowest = legs.reduce((a, b) => (b[1] < a[1] ? b : a));
  return {
    shaftPerSecond: legs[0][1],
    elevatorPerSecond: legs[1][1],
    warehousePerSecond: legs[2][1],
    outputPerSecond: slowest[1],
    slowestLeg: slowest[0],
    prestigeFactor: rates.prestigeFactor,
  };
}
