/**
 * Upgrade ROI ranking.
 *
 * Ranks the next useful investments across the owned roster using VERIFIED
 * data only:
 *   - level: marginal active gain from the exact active-level rows
 *     (gain(L→L+1) = activeValue(L+1) − activeValue(L));
 *   - promotion: verified PromotionCost from the APK promotion milestones and
 *     the passive-unlock gain when the milestone unlocks a passive;
 *   - rank: verified rankEffect active increase vs the fragment cost from the
 *     documented rank thresholds.
 *
 * Level-up costs are NOT published in the catalog yet, so level ROI reports
 * the exact gain with `cost: null` instead of fabricating a cost curve.
 */

import type { CatalogManager, PlayerManager } from "./db";
import { rankThreshold } from "./db";

export type UpgradeKind = "level" | "promotion" | "rank";

export interface UpgradeRoiItem {
  managerId: string;
  name: string;
  kind: UpgradeKind;
  from: number;
  to: number;
  /** Marginal gain in active multiplier units (verified). */
  gain: number;
  /** Verified cost when published; null when the cost curve is not available. */
  cost: number | null;
  costUnit: string;
  /** gain / cost when both are known, otherwise null. */
  roi: number | null;
  unlocksPassive: boolean;
  rationale: string;
}

export function activeValueAt(manager: CatalogManager, level: number): number | undefined {
  const row = manager.activeLevels?.find((candidate) => candidate.level === level);
  if (row?.value != null && Number.isFinite(row.value)) return row.value;
  return undefined;
}

/** Marginal active gain for leveling L → L+1 from exact rows. */
export function levelGain(manager: CatalogManager, level: number): number | null {
  const current = activeValueAt(manager, level);
  const next = activeValueAt(manager, level + 1);
  if (current == null || next == null) return null;
  return next - current;
}

function fragmentsToNextRank(progress: PlayerManager): { threshold: number | null; needed: number | null } {
  const threshold = rankThreshold(progress.rank);
  if (threshold == null) return { threshold: null, needed: null };
  const needed = Math.max(0, threshold - progress.fragments);
  return { threshold, needed };
}

/**
 * Build the ranked upgrade-ROI list for the owned roster. Items with a known
 * ROI sort first (best gain per cost), then known-gain items, then the rest.
 */
export function buildUpgradeRoi(catalog: CatalogManager[], progress: PlayerManager[]): UpgradeRoiItem[] {
  const byId = new Map(catalog.map((manager) => [manager.id, manager]));
  const items: UpgradeRoiItem[] = [];

  for (const player of progress) {
    if (!player.unlocked) continue;
    const manager = byId.get(player.managerId);
    if (!manager) continue;

    // 1) Next level
    const levelGainValue = levelGain(manager, player.level);
    if (levelGainValue != null) {
      items.push({
        managerId: manager.id,
        name: manager.name ?? manager.id,
        kind: "level",
        from: player.level,
        to: player.level + 1,
        gain: levelGainValue,
        cost: null,
        costUnit: "unknown (level cost curve not published)",
        roi: null,
        unlocksPassive: false,
        rationale: `Level ${player.level}→${player.level + 1} raises the active value by +${levelGainValue.toFixed(3)}x (exact row). The per-level cost curve is not published yet.`,
      });
    }

    // 2) Next promotion (verified PromotionCost + passive unlock gain)
    const nextPromotion = manager.promotions?.find((row) => row.promotion === player.promoted + 1);
    if (nextPromotion) {
      const passiveGain = nextPromotion.unlocksPassive
        ? manager.passives?.find((passive) => passive.passiveId === nextPromotion.passiveId)?.multiplier ?? 0
        : 0;
      const cost = nextPromotion.cost ?? null;
      items.push({
        managerId: manager.id,
        name: manager.name ?? manager.id,
        kind: "promotion",
        from: player.promoted,
        to: player.promoted + 1,
        gain: passiveGain,
        cost,
        costUnit: "shards (PromotionCost)",
        roi: cost != null && cost > 0 && passiveGain > 0 ? passiveGain / cost : null,
        unlocksPassive: nextPromotion.unlocksPassive ?? false,
        rationale: nextPromotion.unlocksPassive
          ? `Promotion ${player.promoted + 1} at level ${nextPromotion.level} unlocks a passive (+${passiveGain.toFixed(2)}x) for ${cost ?? "unknown"} shards.`
          : `Promotion ${player.promoted + 1} at level ${nextPromotion.level} for ${cost ?? "unknown"} shards; discrete gain is the continued level curve (not a single jump).`,
      });
    }

    // 3) Next rank (verified rank effect vs fragment cost)
    const nextRankEffect = manager.rankEffects?.find((row) => row.rank === player.rank + 1);
    const { needed } = fragmentsToNextRank(player);
    if (nextRankEffect && needed != null) {
      items.push({
        managerId: manager.id,
        name: manager.name ?? manager.id,
        kind: "rank",
        from: player.rank,
        to: player.rank + 1,
        gain: nextRankEffect.activeIncrease ?? 0,
        cost: needed,
        costUnit: "fragments",
        roi: needed > 0 ? (nextRankEffect.activeIncrease ?? 0) / needed : null,
        unlocksPassive: false,
        rationale: `Rank ${player.rank}→${player.rank + 1} adds +${((nextRankEffect.activeIncrease ?? 0) * 100).toFixed(0)}% to active value for ${needed} fragments.`,
      });
    }
  }

  return items.sort((a, b) => {
    const aRoi = a.roi ?? -1;
    const bRoi = b.roi ?? -1;
    if (aRoi !== bRoi) return bRoi - aRoi;
    return b.gain - a.gain;
  });
}

/** The single most useful next investment, or null when the roster is empty. */
export function nextUsefulInvestment(items: UpgradeRoiItem[]): UpgradeRoiItem | null {
  return items[0] ?? null;
}
