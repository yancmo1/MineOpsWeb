/**
 * Super Manager side-by-side comparison and tierlist, built on VERIFIED data.
 *
 * Comparison uses exact active-level rows, verified rank effects, verified
 * promotions/passives, and the documented heuristic score (with equipment).
 * The tierlist buckets unlocked managers into S/A/B/C bands from the same
 * verified score. Game-parity power score is not yet available (field names
 * unverified), so the label always says "heuristic" — never "game power".
 */

import type { CatalogManager, PlayerManager } from "./db";
import { strengthScore, effectiveActiveValue, rarityWeight } from "./db";
import type { EquipmentBoostTable } from "./equipment-effects";
import { applyEquipmentBoost, equipmentBoostFor } from "./equipment-effects";

export interface ManagerComparisonRow {
  managerId: string;
  name: string;
  area: string;
  rarity: string;
  level: number;
  rank: number;
  promotion: number;
  /** Exact active value at the player's level (verified row). */
  activeValue: number;
  /** Verified rank active increase as a percentage (0 when no row). */
  rankActiveIncreasePct: number;
  passiveCount: number;
  equipmentBoost: number;
  heuristicScore: number;
}

/** Compare unlocked managers at their current progress, sorted by score. */
export function compareManagersSideBySide(
  catalog: CatalogManager[],
  progress: PlayerManager[],
  boostTable: EquipmentBoostTable = new Map(),
  areaFilter?: string,
): ManagerComparisonRow[] {
  const byId = new Map(catalog.map((manager) => [manager.id, manager]));
  const rows: ManagerComparisonRow[] = [];
  for (const player of progress) {
    if (!player.unlocked) continue;
    const manager = byId.get(player.managerId);
    if (!manager) continue;
    if (areaFilter && manager.type !== areaFilter) continue;
    const activeValue = effectiveActiveValue(manager, player);
    const rankRow = manager.rankEffects?.find((row) => row.rank === player.rank);
    const boost = equipmentBoostFor(boostTable, player.equipmentIds);
    rows.push({
      managerId: manager.id,
      name: manager.name ?? manager.id,
      area: manager.type,
      rarity: manager.rarity,
      level: player.level,
      rank: player.rank,
      promotion: player.promoted,
      activeValue,
      rankActiveIncreasePct: (rankRow?.activeIncrease ?? 0) * 100,
      passiveCount: manager.passives?.length ?? 0,
      equipmentBoost: boost,
      heuristicScore: applyEquipmentBoost(strengthScore(manager, player), boost),
    });
  }
  return rows.sort((a, b) => b.heuristicScore - a.heuristicScore);
}

export type TierBand = "S" | "A" | "B" | "C";

export interface TierlistEntry {
  managerId: string;
  name: string;
  area: string;
  rarity: string;
  heuristicScore: number;
  tier: TierBand;
  tierNote: string;
}

const TIER_BREAKS: Array<{ band: TierBand; min: number; note: string }> = [
  { band: "S", min: 250, note: "Elite — every area", },
  { band: "A", min: 200, note: "Strong core", },
  { band: "B", min: 150, note: "Situational", },
  { band: "C", min: -Infinity, note: "Roster filler", },
];

/** Rank unlocked managers into S/A/B/C bands by verified heuristic score. */
export function buildTierlist(
  catalog: CatalogManager[],
  progress: PlayerManager[],
  boostTable: EquipmentBoostTable = new Map(),
): TierlistEntry[] {
  const rows = compareManagersSideBySide(catalog, progress, boostTable);
  return rows.map((row) => {
    const tier = TIER_BREAKS.find((breakpoint) => row.heuristicScore >= breakpoint.min) ?? TIER_BREAKS[TIER_BREAKS.length - 1];
    return {
      managerId: row.managerId,
      name: row.name,
      area: row.area,
      rarity: row.rarity,
      heuristicScore: row.heuristicScore,
      tier: tier.band,
      tierNote: tier.note,
    };
  });
}

export { rarityWeight };
