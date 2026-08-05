/**
 * Progress Tracker — the roster-completion roadmap.
 *
 * Ports idle-miners.com's "progress stages" concept onto OUR verified data:
 * each stage filters the owned roster by rarity, operating area, and passive
 * kind (MIF / CIF / MSUCR from the stable APK passive taxonomy), then checks
 * the promotion target. Every value comes from the published catalog + synced
 * player progress; nothing is estimated.
 */

import type { CatalogManager, CatalogPassive, PlayerManager } from "./db";
import { passiveTypeForId } from "./passives";

export type PassiveKind = "MIF" | "CIF" | "MSUCR";

const KIND_BY_CODE: Record<string, PassiveKind> = {
  MIF: "MIF",
  MSUCR: "MSUCR",
  CIF: "CIF",
};

/** Classify a passive by its stable APK id or type label. */
export function passiveKindOf(passive: CatalogPassive): PassiveKind | null {
  const code = (passive.passiveId != null ? passiveTypeForId(passive.passiveId) : undefined)
    ?? passive.type?.trim();
  if (code && KIND_BY_CODE[code]) return KIND_BY_CODE[code];
  const text = `${passive.type ?? ""} ${passive.description ?? ""}`.toLowerCase();
  if (/mine income|income factor/.test(text)) return "MIF";
  if (/cash income|continental income/.test(text)) return "CIF";
  if (/upgrade cost|cost reduction/.test(text)) return "MSUCR";
  return null;
}

export function hasPassiveKind(manager: CatalogManager, kind: PassiveKind): boolean {
  return (manager.passives ?? []).some((passive) => passiveKindOf(passive) === kind);
}

export function passiveUnlockPromo(manager: CatalogManager, kind: PassiveKind): number | null {
  for (const passive of manager.passives ?? []) {
    if (passiveKindOf(passive) !== kind) continue;
    if (typeof passive.promoReq === "number") return passive.promoReq;
    if (typeof (passive as { unlockPromo?: number }).unlockPromo === "number") {
      return (passive as { unlockPromo: number }).unlockPromo;
    }
  }
  return null;
}

export type Quantifier = "all" | "one";

export interface ProgressStage {
  id: number;
  title: string;
  subtitle: string;
  kind: PassiveKind | "any";
  area: string | null; // "Mine Shaft" | "Elevator" | "Warehouse" | null (any)
  rarities: string[];
  /** Promo target; null means "the passive's own unlock promo". */
  targetPromo: number | null;
  quantifier: Quantifier;
  optionalNote?: string;
}

export interface ProgressStageResult {
  stage: ProgressStage;
  /** Owned managers matching the stage filter. */
  qualifying: Array<{ manager: CatalogManager; promo: number; target: number }>;
  satisfied: number;
  complete: boolean;
  fraction: number;
}

export function matchesStage(stage: ProgressStage, manager: CatalogManager): boolean {
  if (stage.area && manager.type !== stage.area) return false;
  if (stage.rarities.length > 0 && !stage.rarities.includes(manager.rarity)) return false;
  if (stage.kind !== "any" && !hasPassiveKind(manager, stage.kind)) return false;
  return true;
}

export function stageTargetPromo(stage: ProgressStage, manager: CatalogManager): number | null {
  if (stage.targetPromo != null) return stage.targetPromo;
  if (stage.kind === "any") {
    // Per-manager income-passive unlock promo (MIF first, then CIF).
    return passiveUnlockPromo(manager, "MIF") ?? passiveUnlockPromo(manager, "CIF");
  }
  return passiveUnlockPromo(manager, stage.kind);
}

export const PROGRESS_STAGES: ProgressStage[] = [
  {
    id: 1, kind: "MIF", area: null, rarities: ["rare"], targetPromo: 3, quantifier: "all",
    title: "Get all rare MIF managers to P30",
    subtitle: "Foundation: every rare-tier Mine Income Factor SM at promo 3. Paywalled SMs are marked optional below.",
  },
  {
    id: 2, kind: "any", area: "Mine Shaft", rarities: ["epic"], targetPromo: 3, quantifier: "all",
    title: "Get all mineshaft epic MIF & CIF managers to P30",
    subtitle: "Every mineshaft epic whose MIF or CIF activates at P30 or earlier. P50-unlock epics move to stage 5.",
  },
  {
    id: 3, kind: "any", area: "Warehouse", rarities: [], targetPromo: 3, quantifier: "one",
    title: "Get one warehouse P30 MIF/CIF manager",
    subtitle: "Warehouse income is the biggest passive pool; secure one MIF/CIF warehouse SM at promo 3.",
  },
  {
    id: 4, kind: "MSUCR", area: "Mine Shaft", rarities: [], targetPromo: 3, quantifier: "all",
    title: "Get all mineshaft MSUCR managers to P30",
    subtitle: "Mineshaft Upgrade Cost Reduction makes every shaft purchase cheaper — a force multiplier.",
  },
  {
    id: 5, kind: "any", area: "Mine Shaft", rarities: ["epic"], targetPromo: 5, quantifier: "all",
    title: "Get all mineshaft epic MIF & CIF managers to P50",
    subtitle: "Long-haul: push P50-unlock epics (and the P30 set) to their full promo-5 passive.",
  },
  {
    id: 6, kind: "MSUCR", area: "Mine Shaft", rarities: [], targetPromo: 3, quantifier: "all",
    title: "Get all non-legendary mineshaft MSUCR managers to P30",
    subtitle: "Non-legendary cost reducers are the cheap, reliable backbone.",
  },
  {
    id: 7, kind: "MSUCR", area: "Mine Shaft", rarities: [], targetPromo: 5, quantifier: "all",
    title: "Get all non-legendary mineshaft MSUCR managers to P50",
    subtitle: "Max every non-legendary cost reducer.",
  },
  {
    id: 8, kind: "any", area: "Mine Shaft", rarities: ["legendary"], targetPromo: null, quantifier: "all",
    title: "Push every legendary mineshaft income SM to its MIF/CIF unlock promo",
    subtitle: "Legendary income passives unlock at their own promo milestone; reach it for each.",
  },
  {
    id: 9, kind: "MSUCR", area: "Mine Shaft", rarities: ["legendary"], targetPromo: 3, quantifier: "all",
    title: "Get all legendary mineshaft MSUCR managers to P30",
    subtitle: "Legendary cost reducers at promo 3.",
  },
  {
    id: 10, kind: "MSUCR", area: "Mine Shaft", rarities: ["legendary"], targetPromo: 5, quantifier: "all",
    title: "Get all legendary mineshaft MSUCR managers to P50",
    subtitle: "Legendary cost reducers fully maxed.",
  },
  {
    id: 11, kind: "any", area: "Elevator", rarities: ["legendary"], targetPromo: 5, quantifier: "one",
    title: "Get one legendary elevator P50 MIF/CIF manager",
    subtitle: "Elevator income often bottlenecks; one maxed legendary covers it.",
  },
  {
    id: 12, kind: "any", area: "Warehouse", rarities: ["legendary"], targetPromo: 5, quantifier: "one",
    title: "Get one legendary warehouse P50 MIF/CIF manager",
    subtitle: "One fully maxed warehouse income SM.",
  },
  {
    id: 13, kind: "any", area: null, rarities: [], targetPromo: 5, quantifier: "all",
    title: "Completionist: max every remaining manager to P50",
    subtitle: "Everything else — all areas, all rarities — at full promo 5.",
  },
];

/**
 * Evaluate every stage against the owned roster. A manager counts as
 * qualifying when it matches the stage filter and the player owns it.
 */
export function evaluateProgressStages(
  catalog: CatalogManager[],
  progress: PlayerManager[],
  stages: ProgressStage[] = PROGRESS_STAGES,
): ProgressStageResult[] {
  const progressByManager = new Map(progress.map((player) => [player.managerId, player]));
  const results: ProgressStageResult[] = [];
  for (const stage of stages) {
    const qualifying = catalog
      .filter((manager) => matchesStage(stage, manager) && progressByManager.get(manager.id)?.unlocked)
      .map((manager) => {
        const player = progressByManager.get(manager.id)!;
        return {
          manager,
          promo: player.promoted,
          target: stageTargetPromo(stage, manager) ?? 3,
        };
      });
    const satisfied = qualifying.filter((entry) => entry.promo >= entry.target).length;
    results.push({
      stage,
      qualifying,
      satisfied,
      complete: stage.quantifier === "all" ? qualifying.length > 0 && satisfied === qualifying.length : satisfied > 0,
      fraction: qualifying.length > 0 ? satisfied / qualifying.length : 0,
    });
  }
  return results;
}

export function progressSummary(results: ProgressStageResult[]): { complete: number; total: number; pct: number } {
  const complete = results.filter((result) => result.complete).length;
  return { complete, total: results.length, pct: Math.round((complete / results.length) * 100) };
}
