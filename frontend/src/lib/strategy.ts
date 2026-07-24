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
import { APK_MANAGER_NAMES } from "./manager-name-fallback";
import { MANAGER_ENRICHMENT } from "./manager-enrichment";

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
  const localization = pkg.artifacts["localization.json"]?.content;
  const mappings = pkg.artifacts["mappings.json"]?.content;
  if (!core || typeof core !== "object" || !Array.isArray((core as { managers?: unknown }).managers)) {
    return [];
  }

  const localizedNames = new Map<string, string>();
  const entries = localization && typeof localization === "object" ? (localization as { entries?: unknown }).entries : undefined;
  if (entries && typeof entries === "object") {
    for (const [canonicalId, entry] of Object.entries(entries)) {
      const value = typeof entry === "string" ? entry : entry && typeof entry === "object" && typeof (entry as { displayName?: unknown }).displayName === "string" ? (entry as { displayName: string }).displayName : undefined;
      if (value && !/^Manager \d+$/.test(value)) localizedNames.set(canonicalId, value);
    }
  }
  const aliases = new Map<string, string>();
  const aliasEntries = mappings && typeof mappings === "object" && Array.isArray((mappings as { aliases?: unknown }).aliases) ? (mappings as { aliases: Array<Record<string, unknown>> }).aliases : [];
  for (const alias of aliasEntries) if (typeof alias.canonicalId === "string" && typeof alias.alias === "string" && alias.alias) aliases.set(alias.canonicalId, alias.alias);

  const nameSourceCounts: Record<string, number> = {};
  const enrichmentByGameId = new Map(MANAGER_ENRICHMENT.map((manager) => [String(manager.gameId), manager]));
  const managers = (core as { managers: Array<Record<string, unknown>> }).managers.flatMap((item) => {
    const id = typeof item.canonicalId === "string" ? item.canonicalId : item.id;
    if (typeof id !== "string" || !id) return [];
    const extensions = item.extensions && typeof item.extensions === "object" ? item.extensions as Record<string, unknown> : {};
    const sourceIdentifiers = item.sourceIdentifiers && typeof item.sourceIdentifiers === "object" ? item.sourceIdentifiers as Record<string, unknown> : {};
    const nameKey = typeof extensions.nameKey === "string" ? extensions.nameKey : typeof sourceIdentifiers.nameKey === "string" ? sourceIdentifiers.nameKey : undefined;
    const gameId = typeof extensions.superManagerId === "number" ? extensions.superManagerId
      : typeof sourceIdentifiers.superManagerId === "number" ? Number(sourceIdentifiers.superManagerId)
        : Number(id.match(/(\d+)$/)?.[1] ?? NaN);
    const enrichment = enrichmentByGameId.get(String(gameId));
    const packageName = typeof item.name === "string" && item.name.trim() ? item.name : undefined;
    const localizedName = localizedNames.get(id);
    const aliasName = aliases.get(id);
    const derivedName = nameKey ? deriveManagerName(nameKey) : undefined;
    const fallbackName = APK_MANAGER_NAMES[id];
    const name = packageName ?? localizedName ?? aliasName ?? derivedName ?? fallbackName ?? enrichment?.name ?? id;
    const source = packageName ? "core" : localizedName ? "localization" : aliasName ? "alias" : derivedName ? "nameKey" : fallbackName ? "apk-fallback" : enrichment ? "master-data" : "canonical-id";
    nameSourceCounts[source] = (nameSourceCounts[source] ?? 0) + 1;

    // Read active ability from either top-level (legacy) or extensions.active (strict v2)
    const packageActive =
      (item.active && typeof item.active === "object")
        ? item.active as Record<string, unknown>
        : (extensions.active && typeof extensions.active === "object")
          ? extensions.active as Record<string, unknown>
          : undefined;
    const extensionActive = {
      description: typeof extensions.description === "string" ? extensions.description : undefined,
      multiplier: typeof extensions.activeStrength === "number" ? extensions.activeStrength : undefined,
      multiplierAt100: typeof extensions.activeStrength === "number" ? extensions.activeStrength : undefined,
      cooldown: typeof extensions.cooldown === "number" ? extensions.cooldown : undefined,
      duration: typeof extensions.duration === "number" ? extensions.duration : undefined,
    };
    const active = packageActive ?? extensionActive;

    // Read abilities array (v2 APK-extracted format)
    const abilities = Array.isArray(item.abilities) ? item.abilities as Array<Record<string, unknown>> : undefined;
    const firstAbility = abilities?.[0];
    const activeDescription = typeof active?.description === "string" && active.description.trim() && !/^Active:\s*SM_/i.test(active.description)
      ? active.description
      : enrichment?.descriptionLong;
    const activeMultiplier = typeof active?.multiplier === "number" ? active.multiplier : enrichment?.activeL1;
    const activeMultiplierAt100 = typeof active?.multiplierAt100 === "number" ? active.multiplierAt100 : enrichment?.activeL100;
    const activeCooldown = typeof active?.cooldown === "number" || typeof active?.cooldown === "string" ? active.cooldown : enrichment?.cooldown;
    const activeDuration = typeof active?.duration === "number" || typeof active?.duration === "string" ? active.duration : enrichment?.duration;

    // Read elements from top-level array, extensions.elements, or derive from element field
    const elements: string[] = Array.isArray(item.elements) && item.elements.length > 0
      ? item.elements.filter((value): value is string => typeof value === "string")
      : Array.isArray(extensions.elements) && extensions.elements.length > 0
        ? (extensions.elements as unknown[]).filter((value): value is string => typeof value === "string")
        : typeof item.element === "string"
          ? [item.element]
          : enrichment?.elements.map((element) => `${element.element} (${element.effectiveness})`) ?? [];

    // Read progression table (v2 APK-extracted)
    const progression = Array.isArray(item.progression)
      ? item.progression.map((p: Record<string, unknown>) => ({
          level: typeof p.level === "number" ? p.level : undefined,
          promotion: typeof p.promotion === "number" ? p.promotion : undefined,
          cost: typeof p.cost === "number" ? p.cost : undefined,
        })).filter(p => p.level != null)
      : undefined;

    // Read sprite refs
    const spriteRefs = Array.isArray(item.spriteRefs) && item.spriteRefs.length > 0
      ? item.spriteRefs.map((s: Record<string, unknown>) => ({
          name: typeof s.name === "string" ? s.name : undefined,
          filename: typeof s.filename === "string" ? s.filename : undefined,
          type: typeof s.type === "string" ? s.type : undefined,
        }))
      : undefined;

    // Read fragment IDs
    const fragmentIds = Array.isArray(item.fragmentIds)
      ? item.fragmentIds.map((f: Record<string, unknown>) => ({
          fragmentId: typeof f.fragmentId === "number" ? f.fragmentId : undefined,
        }))
      : undefined;

    return [{
      id,
      name,
      rarity: typeof item.rarity === "string" ? item.rarity : "unknown",
      type: typeof item.role === "string" ? item.role : (typeof item.type === "string" ? item.type : "Unknown area"),
      gameId,
      sprite: typeof item.sprite === "string" ? item.sprite : enrichment?.sprite,
      elements,
      active: active ? {
        description: activeDescription,
        multiplier: activeMultiplier,
        multiplierAt100: activeMultiplierAt100,
        cooldown: activeCooldown,
        duration: activeDuration,
      } : firstAbility ? {
        multiplier: typeof firstAbility.multiplier === "number" ? firstAbility.multiplier : undefined,
        multiplierAt100: typeof firstAbility.multiplierAt100 === "number" ? firstAbility.multiplierAt100 : undefined,
      } : undefined,
      abilities: abilities ? abilities.map((a) => ({
        multiplier: typeof a.multiplier === "number" ? a.multiplier : undefined,
        multiplierAt100: typeof a.multiplierAt100 === "number" ? a.multiplierAt100 : undefined,
        rankScaling: typeof a.rankScaling === "object" && a.rankScaling != null ? a.rankScaling as Record<string, { activeIncrease: number; passiveIncrease: number }> : undefined,
        effectType: typeof a.effectType === "object" && a.effectType != null ? {
          effectType: typeof (a.effectType as Record<string, unknown>).effectType === "number" ? (a.effectType as Record<string, unknown>).effectType as number : undefined,
          effectDescType: typeof (a.effectType as Record<string, unknown>).effectDescType === "number" ? (a.effectType as Record<string, unknown>).effectDescType as number : undefined,
          incremental: typeof (a.effectType as Record<string, unknown>).incremental === "number" ? (a.effectType as Record<string, unknown>).incremental as number : undefined,
        } : undefined,
      })) : undefined,
      passives: Array.isArray(item.passives) && item.passives.some((p) => Object.values(p).some((value) => value != null)) ? item.passives.map((p) => ({
        unlockLevel: typeof p.unlockLevel === "number" ? p.unlockLevel : undefined,
        description: typeof p.description === "string" ? p.description : undefined,
        multiplier: typeof p.multiplier === "number" ? p.multiplier : undefined,
        type: typeof p.type === "string" ? p.type : undefined,
        promoReq: typeof p.promoReq === "number" ? p.promoReq : undefined,
      })) : enrichment?.passives.map((passive) => ({
        unlockLevel: undefined,
        description: passive.type,
        multiplier: typeof passive.value === "number" ? passive.value : undefined,
        type: passive.type,
        promoReq: passive.promoReq,
      })),
      equipment: Array.isArray(item.equipment) ? item.equipment.map((equipment) => ({
        id: typeof equipment.id === "string" ? equipment.id : undefined,
        name: typeof equipment.name === "string" ? equipment.name : undefined,
        description: typeof equipment.description === "string" ? equipment.description : undefined,
        multiplier: typeof equipment.multiplier === "number" ? equipment.multiplier : undefined,
      })) : undefined,
      progression,
      spriteRefs,
      fragmentIds,
    }];
  });
  console.debug("[catalog-names] Hydrated manager names", {
    total: managers.length,
    sourceCounts: nameSourceCounts,
    samples: managers.filter((manager) => ["sm-10001", "sm-10066", "sm-10029"].includes(manager.id)).map((manager) => ({ id: manager.id, name: manager.name, gameId: manager.gameId })),
  });
  if (managers.some((manager) => manager.name === manager.id)) {
    console.warn("[catalog-names] Some managers still have canonical-ID labels", managers.filter((manager) => manager.name === manager.id).map((manager) => manager.id));
  }
  return managers;
}

/** Best-effort fallback for packages that preserve NameKey but lost localization. */
export function deriveManagerName(nameKey: string): string {
  return nameKey.replace(/^(SM_|SuperManager_|Manager_)/, "")
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .trim();
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
