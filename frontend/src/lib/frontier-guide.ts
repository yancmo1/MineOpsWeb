import type { CatalogManager, PlayerManager } from "./db";
import { strengthScore } from "./db";

export type FrontierPass = "free" | "premium" | "elite";

export interface FrontierBarrier {
  id: string;
  tier: string;
  shaft: number;
  costAfter: number;
  reward: { free: number; premium: number; elite: number };
}

/**
 * Frontier checkpoint data observed from Idle Master's Hub on 2026-08-01.
 * Costs are the site's "after" values (headpiece + pendrives assumption).
 * The live game can change these values, so this is reference data rather
 * than a claim that the current event is permanently identical.
 */
export const FRONTIER_BARRIERS: FrontierBarrier[] = ([
  ["I", 5, 29, 0, 0, 0], ["I", 10, 40, 0, 0, 0], ["I", 15, 60, 0, 0, 0], ["I", 20, 89, 0, 0, 0], ["I", 25, 119, 0, 0, 0],
  ["II", 5, 83, 400, 400, 500], ["II", 10, 103, 400, 0, 0], ["II", 15, 129, 0, 0, 0], ["II", 20, 169, 0, 0, 0], ["II", 25, 211, 0, 0, 0],
  ["III", 5, 146, 0, 0, 0], ["III", 10, 168, 500, 500, 600], ["III", 15, 203, 0, 0, 0], ["III", 20, 257, 700, 0, 0], ["III", 25, 314, 0, 0, 0],
  ["IV", 5, 215, 600, 600, 700], ["IV", 10, 250, 0, 0, 0], ["IV", 15, 296, 800, 0, 0], ["IV", 20, 368, 0, 0, 0], ["IV", 25, 444, 0, 0, 0],
  ["V", 5, 272, 600, 0, 700], ["V", 10, 325, 0, 0, 0], ["V", 15, 381, 0, 0, 0], ["V", 20, 470, 700, 0, 100], ["V", 25, 564, 0, 0, 0],
  ["VI", 5, 333, 600, 0, 700], ["VI", 10, 396, 0, 0, 0], ["VI", 15, 462, 0, 0, 0], ["VI", 20, 567, 700, 0, 100], ["VI", 25, 678, 0, 0, 0],
  ["VII", 5, 400, 600, 0, 700], ["VII", 10, 473, 0, 0, 0], ["VII", 15, 550, 0, 0, 0], ["VII", 20, 672, 800, 0, 0], ["VII", 25, 802, 0, 0, 0],
] as Array<[string, number, number, number, number, number]>).map(([tier, shaft, costAfter, free, premium, elite]) => ({
  id: `FM ${tier} ${shaft}`,
  tier,
  shaft,
  costAfter,
  reward: { free, premium, elite },
}));

export interface FrontierPlanRow {
  barrier: FrontierBarrier;
  cost: number;
  reward: number;
  balanceAfter: number;
  cleared: boolean;
}

export interface FrontierPlan {
  rows: FrontierPlanRow[];
  furthest: string | null;
  next: FrontierBarrier | null;
  remainingFc: number;
  startingFc: number;
  totalSpent: number;
  totalRewards: number;
}

/** Sequential checkpoint planner. It deliberately does not model wait time. */
export function planFrontierCheckpoints(
  currentBarrierId: string,
  frontierCredits: number,
  pass: FrontierPass = "free",
  currentCostOverride?: number,
): FrontierPlan {
  const start = Math.max(0, FRONTIER_BARRIERS.findIndex((barrier) => barrier.id === currentBarrierId));
  let balance = Math.max(0, frontierCredits);
  const rows: FrontierPlanRow[] = [];
  let totalSpent = 0;
  let totalRewards = 0;

  for (let index = start; index < FRONTIER_BARRIERS.length; index += 1) {
    const barrier = FRONTIER_BARRIERS[index];
    const cost = index === start && currentCostOverride != null && currentCostOverride >= 0 ? currentCostOverride : barrier.costAfter;
    const reward = barrier.reward[pass];
    if (balance < cost) {
      rows.push({ barrier, cost, reward, balanceAfter: balance, cleared: false });
      break;
    }
    balance -= cost;
    balance += reward;
    totalSpent += cost;
    totalRewards += reward;
    rows.push({ barrier, cost, reward, balanceAfter: balance, cleared: true });
  }

  const clearedRows = rows.filter((row) => row.cleared);
  return {
    rows,
    furthest: clearedRows.at(-1)?.barrier.id ?? null,
    next: rows.find((row) => !row.cleared)?.barrier ?? null,
    remainingFc: balance,
    startingFc: Math.max(0, frontierCredits),
    totalSpent,
    totalRewards,
  };
}

export type FrontierTag = "Income passive" | "Upgrade-cost reduction" | "Shaft burst" | "Elevator/warehouse burst" | "Support";

export interface FrontierRosterEntry {
  managerId: string;
  name: string;
  area: string;
  level: number;
  rank: number;
  score: number;
  tags: FrontierTag[];
  why: string;
}

function managerText(manager: CatalogManager): string {
  return [
    manager.active?.description,
    ...(manager.passives ?? []).flatMap((passive) => [passive.description, passive.type]),
  ].filter(Boolean).join(" ").toLowerCase();
}

function frontierTags(manager: CatalogManager): FrontierTag[] {
  const text = managerText(manager);
  const tags: FrontierTag[] = [];
  if (text.includes("income factor") || text.includes("mine income") || text.includes("continent income")) tags.push("Income passive");
  if (text.includes("upgrade cost") || text.includes("cost reduction") || text.includes("mine upgrade")) tags.push("Upgrade-cost reduction");
  if (manager.type.toLowerCase().includes("shaft")) tags.push("Shaft burst");
  if (manager.type.toLowerCase().includes("elevator") || manager.type.toLowerCase().includes("warehouse")) tags.push("Elevator/warehouse burst");
  if (tags.length === 0) tags.push("Support");
  return tags;
}

function whyForTags(tags: FrontierTag[]): string {
  if (tags.includes("Income passive")) return "Keep assigned for its passive income contribution when it is not being used for an active run.";
  if (tags.includes("Upgrade-cost reduction")) return "Use before buying a major shaft/elevator/warehouse upgrade; cost reduction is a force multiplier on every spark window.";
  if (tags.includes("Shaft burst")) return "Reserve for a shaft-focused burst, especially immediately after a barrier opens or a Frontier multiplier is active.";
  if (tags.includes("Elevator/warehouse burst")) return "Use after shaft stockpiles are ready so the transport side can convert the run into spendable cash.";
  return "Treat as a flexible support slot until MineOps has a verified effect mapping for this manager.";
}

/** Convert the synced owned roster into Frontier-specific, explainable priorities. */
export function buildFrontierRoster(catalog: CatalogManager[], progress: PlayerManager[]): FrontierRosterEntry[] {
  const byId = new Map(catalog.map((manager) => [manager.id, manager]));
  return progress.filter((player) => player.unlocked).flatMap((player) => {
    const manager = byId.get(player.managerId);
    if (!manager) return [];
    const tags = frontierTags(manager);
    return [{
      managerId: manager.id,
      name: manager.name,
      area: manager.type,
      level: player.level,
      rank: player.rank,
      score: strengthScore(manager, player),
      tags,
      why: whyForTags(tags),
    }];
  }).sort((a, b) => {
    const aPriority = a.tags.includes("Income passive") ? 3 : a.tags.includes("Upgrade-cost reduction") ? 2 : 1;
    const bPriority = b.tags.includes("Income passive") ? 3 : b.tags.includes("Upgrade-cost reduction") ? 2 : 1;
    return bPriority - aPriority || b.score - a.score;
  });
}
