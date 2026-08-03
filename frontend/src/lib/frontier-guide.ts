import type { CatalogManager, PlayerManager } from "./db";
import { strengthScore } from "./db";
import { activePassives } from "./passives";

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
  nextCost: number | null;
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
  const nextRow = rows.find((row) => !row.cleared);
  return {
    rows,
    furthest: clearedRows.at(-1)?.barrier.id ?? null,
    next: nextRow?.barrier ?? null,
    nextCost: nextRow?.cost ?? null,
    remainingFc: balance,
    startingFc: Math.max(0, frontierCredits),
    totalSpent,
    totalRewards,
  };
}

export const FRONTIER_RUSH_WAIT_THRESHOLD_MINUTES = 10;

export type FrontierRecommendationAction = "wait" | "spend_fc" | "run_burst";
export type FrontierRecommendationResource = "none" | "frontier-credits" | "free-skip" | "time-jump";

export interface FrontierLiveBarrierInput {
  currentCost: number | null;
  remainingWaitMinutes: number | null;
  frontierCredits: number;
  freeSkips: number;
  timeJumps: number;
}

export interface FrontierActionRecommendation {
  action: FrontierRecommendationAction;
  resource: FrontierRecommendationResource;
  title: string;
  reason: string;
  currentCost: number | null;
  remainingWaitMinutes: number | null;
  fcShortfall: number | null;
  assumptions: string[];
}

function nonNegativeFinite(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/**
 * Recommend one next action from the live barrier values the player can see.
 *
 * This is intentionally a conservative heuristic, not a complete event
 * simulator: it does not know event end time, Spark balance, cooldowns,
 * multiplier duration, or the mine's current cash/stockpile.
 */
export function recommendFrontierAction(input: FrontierLiveBarrierInput): FrontierActionRecommendation {
  const waitMinutes = input.remainingWaitMinutes == null ? null : nonNegativeFinite(input.remainingWaitMinutes);
  const credits = nonNegativeFinite(input.frontierCredits);
  const freeSkips = Math.floor(nonNegativeFinite(input.freeSkips));
  const timeJumps = Math.floor(nonNegativeFinite(input.timeJumps));
  const currentCost = input.currentCost != null && Number.isFinite(input.currentCost)
    ? nonNegativeFinite(input.currentCost)
    : null;
  const fcShortfall = currentCost == null ? null : Math.max(0, currentCost - credits);
  const assumptions = [
    "The live barrier cost is treated as the current Frontier Credit price to unlock this barrier.",
    "A barrier skip is treated as one free unlock and is preferred before spending FC.",
    "One Time Jump is treated as enough to remove the current barrier wait; MineOps does not inspect the item's denomination.",
    `Waiting ${FRONTIER_RUSH_WAIT_THRESHOLD_MINUTES} minutes or less is treated as cheaper than rushing when no free skip or Time Jump is needed.`,
    "A burst assumes the barrier is open after the recommended unlock/wait and that a usable multiplier, Sparks, and burst lineup are ready.",
  ];

  if (waitMinutes == null) {
    return {
      action: "wait",
      resource: "none",
      title: "Enter live wait time",
      reason: "The planner needs the barrier's remaining wait before it can distinguish waiting, rushing, or a burst. The reference FC path remains available below.",
      currentCost,
      remainingWaitMinutes: null,
      fcShortfall,
      assumptions,
    };
  }

  if (waitMinutes === 0) {
    return {
      action: "run_burst",
      resource: "none",
      title: "Run a burst",
      reason: "The barrier wait is over. Use the opening to build shaft stockpile, fire the shaft burst, then convert it through elevator/warehouse before spending.",
      currentCost,
      remainingWaitMinutes: waitMinutes,
      fcShortfall,
      assumptions,
    };
  }

  if (waitMinutes <= FRONTIER_RUSH_WAIT_THRESHOLD_MINUTES) {
    return {
      action: "wait",
      resource: "none",
      title: "Wait",
      reason: `Let the barrier timer run for about ${formatWaitMinutes(waitMinutes)}. Save skips, Time Jumps, and FC for a longer wait or a more valuable checkpoint reward.`,
      currentCost,
      remainingWaitMinutes: waitMinutes,
      fcShortfall,
      assumptions,
    };
  }

  if (freeSkips > 0) {
    return {
      action: "run_burst",
      resource: "free-skip",
      title: "Use a skip, then run a burst",
      reason: `Use 1 of your ${freeSkips} barrier skips to remove the ${formatWaitMinutes(waitMinutes)} wait, then run the burst while the opening is valuable.`,
      currentCost,
      remainingWaitMinutes: waitMinutes,
      fcShortfall,
      assumptions,
    };
  }

  if (timeJumps > 0) {
    return {
      action: "run_burst",
      resource: "time-jump",
      title: "Use a Time Jump, then run a burst",
      reason: `Use 1 of your ${timeJumps} Time Jumps to remove the ${formatWaitMinutes(waitMinutes)} barrier wait, then run the burst. Keep FC available for the next checkpoint or Spark recharge.`,
      currentCost,
      remainingWaitMinutes: waitMinutes,
      fcShortfall,
      assumptions,
    };
  }

  if (currentCost != null && currentCost > 0 && credits >= currentCost) {
    return {
      action: "spend_fc",
      resource: "frontier-credits",
      title: `Spend ${currentCost.toLocaleString()} FC`,
      reason: `The ${formatWaitMinutes(waitMinutes)} wait is longer than the default rush threshold and your FC balance covers the live barrier cost. Unlock it, then run the burst only when your multiplier and managers are ready.`,
      currentCost,
      remainingWaitMinutes: waitMinutes,
      fcShortfall: 0,
      assumptions,
    };
  }

  const shortfallText = currentCost == null
    ? "Enter the live barrier cost before spending FC."
    : currentCost === 0
      ? "The live barrier has no FC rush cost entered."
      : `You are ${fcShortfall?.toLocaleString() ?? "short"} FC short of the live cost.`;
  return {
    action: "wait",
    resource: "none",
    title: "Wait",
    reason: `Wait out the ${formatWaitMinutes(waitMinutes)} barrier. ${shortfallText} Preserve FC until the next reward or income window changes the tradeoff.`,
    currentCost,
    remainingWaitMinutes: waitMinutes,
    fcShortfall,
    assumptions,
  };
}

function formatWaitMinutes(minutes: number): string {
  if (Number.isInteger(minutes)) return `${minutes} minutes`;
  return `${minutes.toFixed(1)} minutes`;
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

function managerText(manager: CatalogManager, progress: PlayerManager): string {
  return [
    manager.active?.description,
    ...activePassives(manager.passives, progress).flatMap((passive) => [passive.description, passive.type]),
  ].filter(Boolean).join(" ").toLowerCase();
}

function frontierTags(manager: CatalogManager, progress: PlayerManager): FrontierTag[] {
  const text = managerText(manager, progress);
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
    const tags = frontierTags(manager, player);
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
