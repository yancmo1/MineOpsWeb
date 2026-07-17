/**
 * Strategy Evaluation Engine
 *
 * Consumes the verified active JSON catalog through the shared catalog client
 * and player progress to produce ranked lineup recommendations.
 *
 * Design principles:
 *   - Every recommendation cites its input data and calculation basis
 *   - Unknown mappings never create fabricated advice
 *   - Recommendations remain reproducible for a selected catalog release
 *   - Limited-data state when catalog/player data is unresolved
 *   - Does not invent bonuses for missing catalog attributes
 */

import type { CatalogManager, PlayerManager } from "./db";
import { strengthScore, effectiveActiveValue, rarityWeight, rankThreshold } from "./db";
import type { CachedCatalogPackage } from "./catalog-cache";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AreaNeed {
  /** Area name (e.g. "Mine Shaft", "Elevator", "Warehouse") */
  area: string;
  /** How many managers to recommend for this area */
  slots: number;
  /** Priority of this area (higher = more important) */
  priority: number;
}

export interface RecommendationInput {
  manager: CatalogManager;
  progress: PlayerManager;
}

export interface Recommendation {
  /** The manager being recommended */
  managerId: string;
  /** Display name from catalog */
  name: string;
  /** Operating area */
  area: string;
  /** Priority rank within the area (1 = top pick) */
  areaRank: number;
  /** Overall strength score */
  score: number;
  /** Rarity weight component */
  rarityScore: number;
  /** Level contribution */
  levelValue: number;
  /** Rank contribution */
  rankValue: number;
  /** Effective active value at current level */
  activeValue: number;
  /** Whether this manager is being suggested for upgrade priority */
  upgradePriority: boolean;
  /** Rationale for the recommendation */
  rationale: string;
  /** Catalog release used for this evaluation */
  catalogVersion: string | null;
  /** Whether this recommendation uses incomplete data */
  limitedData: boolean;
  /** Missing data flags, if any */
  missingData: string[];
}

export interface StrategyEvaluation {
  /** The catalog release these recommendations are based on */
  catalogVersion: string | null;
  /** Immutable package identity used for a reproducible result. */
  catalogReleaseId: string | null;
  manifestHash: string | null;
  /** When this evaluation was produced */
  evaluatedAt: string;
  /** Per-area ranked recommendations */
  areaRecommendations: Record<string, Recommendation[]>;
  /** Overall upgrade priorities (managers that would benefit most) */
  upgradePriorities: Recommendation[];
  /** Managers that couldn't be evaluated due to missing data */
  unevaluated: Array<{ managerId: string; name: string; reason: string }>;
  /** Number of managers considered */
  totalManagersConsidered: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MISSING_ACTIVE_FIELD = "active.multiplier";
const MISSING_LEVEL = "level < 1";

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate all unlocked managers and produce ranked lineup recommendations.
 *
 * @param catalog Full catalog of all managers
 * @param progress Current player progress
 * @returns StrategyEvaluation with per-area ranks, upgrade priorities, and rationales
 */
export function evaluateLineup(
  catalog: CatalogManager[],
  progress: PlayerManager[],
  packageIdentity: Pick<CachedCatalogPackage, "catalogVersion" | "releaseId" | "manifestHash"> | null = null,
): StrategyEvaluation {
  const byId = new Map(catalog.map((m) => [m.id, m]));
  const progressMap = new Map(progress.map((p) => [p.managerId, p]));
  const catalogVersion = packageIdentity?.catalogVersion ?? null;

  const recommendations: Recommendation[] = [];
  const unevaluated: Array<{ managerId: string; name: string; reason: string }> = [];

  for (const player of progress) {
    if (player.unlocked && !byId.has(player.managerId)) {
      unevaluated.push({
        managerId: player.managerId,
        name: player.managerId,
        reason: "This unlocked manager is not present in the verified catalog package.",
      });
    }
  }

  for (const manager of catalog) {
    const player = progressMap.get(manager.id);

    if (!player || !player.unlocked) {
      // Only evaluate unlocked managers; locked ones can't be assigned
      continue;
    }

    const missingData: string[] = [];
    let limitedData = false;

    // Check for missing catalog attributes
    if (!manager.active?.multiplier && !manager.active?.multiplierAt100) {
      missingData.push(MISSING_ACTIVE_FIELD);
      limitedData = true;
    }

    const activeValue = effectiveActiveValue(manager, player);
    const score = strengthScore(manager, player);
    const rarityScore = rarityWeight(manager.rarity);

    // Level and rank contributions
    const levelValue = player.level * 1.5;
    const rankValue = player.rank * 20;

    // Upgrade priority: managers close to next rank threshold or with high fragment-to-level ratio
    const fragmentsTowardsNext = calculateFragmentsTowardsNext(player);
    const upgradePriority = fragmentsTowardsNext > 0.5 || (player.level < 50 && player.rank < 3);

    // Build rationale
    const rationale = buildRationale(manager, player, score, activeValue, missingData);

    recommendations.push({
      managerId: manager.id,
      name: manager.name ?? manager.id,
      area: manager.type,
      areaRank: 0, // computed below
      score,
      rarityScore,
      levelValue,
      rankValue,
      activeValue,
      upgradePriority,
      rationale,
      catalogVersion,
      limitedData,
      missingData,
    });
  }

  // Sort by score descending
  recommendations.sort((a, b) => b.score - a.score);

  // Assign area ranks
  const areaRecommendations: Record<string, Recommendation[]> = {};
  for (const rec of recommendations) {
    if (!areaRecommendations[rec.area]) {
      areaRecommendations[rec.area] = [];
    }
    areaRecommendations[rec.area].push(rec);
  }

  // Sort within each area by score descending, assign ranks
  for (const area of Object.keys(areaRecommendations)) {
    areaRecommendations[area].sort((a, b) => b.score - a.score);
    areaRecommendations[area].forEach((rec, i) => {
      rec.areaRank = i + 1;
    });
  }

  // Upgrade priorities: top 5 managers with highest upgrade benefit
  const upgradePriorities = recommendations
    .filter((r) => r.upgradePriority)
    .sort((a, b) => {
      // Managers with limited data get lower upgrade priority
      if (a.limitedData !== b.limitedData) return a.limitedData ? 1 : -1;
      return b.score - a.score;
    })
    .slice(0, 5);

  return {
    catalogVersion,
    catalogReleaseId: packageIdentity?.releaseId ?? null,
    manifestHash: packageIdentity?.manifestHash ?? null,
    evaluatedAt: new Date().toISOString(),
    areaRecommendations,
    upgradePriorities,
    unevaluated,
    totalManagersConsidered: recommendations.length,
  };
}

/**
 * Read manager facts only from a verified catalog package.  Catalog artifacts
 * preserve source-shaped manager records, so this adapter intentionally maps
 * only fields the strategy engine understands and leaves unknown effects out
 * of scoring.
 */
export function managersFromVerifiedPackage(pkg: CachedCatalogPackage): CatalogManager[] {
  const core = pkg.artifacts["catalog-core.json"]?.content;
  if (!core || typeof core !== "object" || !Array.isArray((core as { managers?: unknown }).managers)) {
    return [];
  }

  return (core as { managers: Array<Record<string, unknown>> }).managers.flatMap((item) => {
    const id = typeof item.canonicalId === "string" ? item.canonicalId : item.id;
    if (typeof id !== "string" || !id) return [];

    const active = item.active && typeof item.active === "object"
      ? item.active as Record<string, unknown>
      : undefined;
    return [{
      id,
      name: typeof item.name === "string" ? item.name : id,
      rarity: typeof item.rarity === "string" ? item.rarity : "unknown",
      type: typeof item.type === "string" ? item.type : "Unknown area",
      elements: Array.isArray(item.elements) ? item.elements.filter((value): value is string => typeof value === "string") : [],
      active: active ? {
        description: typeof active.description === "string" ? active.description : undefined,
        multiplier: typeof active.multiplier === "number" ? active.multiplier : undefined,
        multiplierAt100: typeof active.multiplierAt100 === "number" ? active.multiplierAt100 : undefined,
      } : undefined,
    }];
  });
}

/** Evaluate a selected immutable package, retaining release evidence. */
export function evaluateVerifiedLineup(pkg: CachedCatalogPackage, progress: PlayerManager[]): StrategyEvaluation {
  return evaluateLineup(managersFromVerifiedPackage(pkg), progress, pkg);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Calculate how close a manager is to the next rank threshold (0-1).
 */
function calculateFragmentsTowardsNext(player: PlayerManager): number {
  const threshold = rankThreshold(player.rank);
  if (threshold == null || threshold === 0) return 0;
  return Math.min(player.fragments / threshold, 1);
}

/**
 * Build human-readable rationale for a recommendation.
 */
function buildRationale(
  manager: CatalogManager,
  player: PlayerManager,
  score: number,
  activeValue: number,
  missingData: string[],
): string {
  const parts: string[] = [];

  if (missingData.length === 0) {
    parts.push(`Score ${score.toFixed(1)}`);
  } else {
    parts.push(`Score ${score.toFixed(1)} (limited data — ${missingData.join(", ")})`);
  }

  parts.push(`Level ${player.level}`);
  if (player.rank > 0) parts.push(`Rank ${player.rank}`);
  if (player.promoted > 0) parts.push(`+${player.promoted} promo`);
  parts.push(`${manager.rarity}`);

  if (activeValue > 1) {
    parts.push(`Active: ${activeValue.toFixed(1)}×`);
  }

  // Check for fragment progress
  const threshold = rankThreshold(player.rank);
  if (threshold != null && player.fragments > 0) {
    const pct = Math.round((player.fragments / threshold) * 100);
    if (pct >= 100) {
      parts.push("⬆ Ready to rank up!");
    } else if (pct >= 50) {
      parts.push(`${pct}% to next rank`);
    }
  }

  return parts.join(" · ");
}
