/**
 * Goal planner: "pick one of YOUR mines + a target mineshaft number, get a
 * short plan in plain words." (Home -> My Plan refactor, 2026-10-23.)
 *
 * This module is a COMPOSITION of existing verified computations only:
 *   - deriveMineRates (mine-balancing.ts) + progression factors
 *     (progression.ts) for the mine's real pace and slowest leg,
 *   - rankPlays / bestPlay (mission-board.ts) for the best way to run it,
 *   - buildUpgradeRoi / nextUsefulInvestment (upgrade-roi.ts) for the one
 *     manager investment worth making,
 *   - the balancing table's own per-tier BaseCostBig + barrier rows for what
 *     opening the next shafts costs,
 *   - prestigeGainFactor (mine-balancing.ts) for the auto prestige step.
 *
 * Honesty rules (same as the rest of the app):
 *   - A step appears only when an existing computation backs it. Where the
 *     math cannot support a claim (e.g. a prestige payback time - prestiging
 *     resets the mine and no verified reset-tradeoff model exists), the step
 *     is framed as "consider" with the factor shown, never as "this pays".
 *   - Shaft-open costs are the game's table base costs (Mineshafts
 *     BaseCostBig per tier). Level-ups after opening grow from the same
 *     base via the table's CostIncreases and are NOT summed here.
 *   - The time estimate divides the total open cost by the mine's pace,
 *     which is the save's own idle (idle base x active buffs) whenever
 *     the save records it, and the table-derived pace only as a fallback.
 *     The fallback pace excludes artifacts and regular-manager passives
 *     (the documented calibration gap), so fallback estimates are
 *     labelled as from the game's tables, not a promise.
 */

import { formatCashValue } from "./cash-units";
import type { CatalogManager, PlayerManager } from "./db";
import {
  balancingConfigForMine,
  bigPairValue,
  deriveMineRates,
  prestigeGainFactor,
  type DerivedMineRates,
} from "./mine-balancing";
import {
  decodeMineNumber,
  groupMinesByContinent,
  saveIdlePerSecond,
  type MineState,
  type SaveMine,
} from "./mine-state";
import { bestPlay, rankPlays } from "./mission-board";
import { applyProgressionToRates, progressionFactorsForMine } from "./progression";
import { buildUpgradeRoi, nextUsefulInvestment } from "./upgrade-roi";

// ---------------------------------------------------------------------------
// Goal state (persisted like the mission board's mine profiles: localStorage)
// ---------------------------------------------------------------------------

export interface PlanGoal {
  /** Save mine number (SaveMine.mineNumber) the goal targets. */
  mineNumber: number;
  /** Target mineshaft number: "get this mine to Mineshaft N". */
  targetShaft: number;
}

const GOAL_STORAGE_KEY = "mineops.goal.v1";

export function loadGoal(): PlanGoal | null {
  try {
    const raw = localStorage.getItem(GOAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PlanGoal>;
    if (typeof parsed.mineNumber !== "number" || typeof parsed.targetShaft !== "number") return null;
    if (!Number.isFinite(parsed.mineNumber) || !Number.isFinite(parsed.targetShaft)) return null;
    return { mineNumber: parsed.mineNumber, targetShaft: Math.max(1, Math.round(parsed.targetShaft)) };
  } catch {
    return null;
  }
}

export function saveGoal(goal: PlanGoal | null): void {
  try {
    if (goal == null) localStorage.removeItem(GOAL_STORAGE_KEY);
    else localStorage.setItem(GOAL_STORAGE_KEY, JSON.stringify(goal));
  } catch {
    // Storage can be unavailable (private mode); the goal just won't persist.
  }
}

/** Sensible default target: the next shaft after the ones already open. */
export function defaultTargetShaft(mine: SaveMine): number {
  return Math.max(1, mine.corridorLevels.length + 1);
}

/** Highest shaft the game's table knows for this mine (null when unknown). */
export function maxKnownShaft(mineNumber: number): number | null {
  const config = balancingConfigForMine(mineNumber);
  return config ? config.tiers.length : null;
}

// ---------------------------------------------------------------------------
// Shared per-mine facts
// ---------------------------------------------------------------------------

export interface MineFacts {
  mine: SaveMine;
  mineNumber: number;
  label: string;
  continentName: string;
  shaftCount: number;
  topShaftLevel: number | null;
  elevatorLevel: number | null;
  warehouseLevel: number | null;
  prestigeCount: number;
  /** Prestige income factor the game applies at the current count. */
  prestigeFactor: number;
  /** Derived rates with skills/collectibles folded in; null when the
   *  balancing tables cannot model this mine. */
  rates: DerivedMineRates | null;
  /** Cash/sec the plan uses: the save's own idle (idle base x active
   *  buffs) when the save records it, else derived table output. Null
   *  when neither exists. The save's number is the game's own idle, so it
   *  always wins over the table derivation. */
  pacePerSecond: number | null;
  paceSource: "tables" | "save" | null;
  /** The save's own idle cash/sec (base x active buffs), when stored. */
  saveIdlePerSecond: number | null;
}

export function mineFacts(mine: SaveMine, mineState: MineState): MineFacts | null {
  if (mine.mineNumber == null) return null;
  const mineNumber = mine.mineNumber;
  const decoded = decodeMineNumber(mineNumber);
  const prestigeCount = mine.prestigeCount ?? 0;
  let rates: DerivedMineRates | null = null;
  if (mine.corridorLevels.length > 0) {
    const derived = deriveMineRates(
      mineNumber,
      mine.corridorLevels,
      mine.elevatorLevel,
      mine.warehouseLevel,
      mine.prestigeCount,
    );
    if (derived) {
      rates = applyProgressionToRates(
        derived,
        progressionFactorsForMine(mineNumber, { skills: mineState.skills ?? {}, collectibles: mineState.collectibles ?? [] }),
      );
    }
  }
  const saveIdle = saveIdlePerSecond(mine);
  const derivedPace = rates && rates.outputPerSecond > 0 ? rates.outputPerSecond : null;
  return {
    mine,
    mineNumber,
    label: decoded?.label ?? `Mine ${mineNumber}`,
    continentName: decoded?.continentName ?? "Special mines",
    shaftCount: mine.corridorLevels.length,
    topShaftLevel: mine.corridorLevels.length > 0 ? Math.max(...mine.corridorLevels) : null,
    elevatorLevel: mine.elevatorLevel,
    warehouseLevel: mine.warehouseLevel,
    prestigeCount,
    prestigeFactor: prestigeGainFactor(mineNumber, prestigeCount),
    rates,
    pacePerSecond: saveIdle != null && saveIdle > 0 ? saveIdle : derivedPace,
    paceSource: saveIdle != null && saveIdle > 0 ? "save" : derivedPace != null ? "tables" : null,
    saveIdlePerSecond: saveIdle,
  };
}

/**
 * His mines ranked by real pace, biggest earner first. Mines whose pace
 * cannot be established at all sort last (they are still his mines).
 */
export function topEarners(mineState: MineState | null, limit = 4): MineFacts[] {
  if (!mineState) return [];
  const facts = mineState.mines
    .map((mine) => mineFacts(mine, mineState))
    .filter((entry): entry is MineFacts => entry != null);
  facts.sort((a, b) => (b.pacePerSecond ?? -1) - (a.pacePerSecond ?? -1));
  return facts.slice(0, limit);
}

/** His mines grouped by continent for the nested goal picker. */
export function goalPickerGroups(mineState: MineState | null): Array<{
  continentType: number;
  continentName: string;
  mines: MineFacts[];
}> {
  if (!mineState) return [];
  return groupMinesByContinent(mineState.mines).map((group) => ({
    continentType: group.continentType,
    continentName: group.name,
    mines: group.mines
      .map((mine) => mineFacts(mine, mineState))
      .filter((entry): entry is MineFacts => entry != null),
  })).filter((group) => group.mines.length > 0);
}

// ---------------------------------------------------------------------------
// Shaft opening cost, straight from the game's balancing table
// ---------------------------------------------------------------------------

export interface ShaftOpenCost {
  /** Sum of the table base costs for tiers (fromShaft, toShaft]. */
  totalBaseCost: number;
  perShaft: Array<{ shaft: number; baseCost: number }>;
  /** Barriers crossed on the way (tier barriers from the same table). */
  barriers: Array<{ afterShaft: number; cost: number; breakSeconds: number }>;
  barrierCostTotal: number;
  barrierBreakSecondsTotal: number;
}

/**
 * What opening shafts costs, from the balancing table only. Returns null
 * when the table cannot price the whole range (unknown mine or a tier the
 * table doesn't carry) - the plan then stays qualitative about cost.
 */
export function shaftOpenCost(mineNumber: number, fromShaft: number, toShaft: number): ShaftOpenCost | null {
  if (toShaft <= fromShaft) return null;
  const config = balancingConfigForMine(mineNumber);
  if (!config) return null;
  const perShaft: Array<{ shaft: number; baseCost: number }> = [];
  let totalBaseCost = 0;
  for (let shaft = fromShaft + 1; shaft <= toShaft; shaft += 1) {
    const tier = config.tiers.find((row) => row.tier === shaft);
    if (!tier) return null;
    const baseCost = bigPairValue(tier.cost);
    perShaft.push({ shaft, baseCost });
    totalBaseCost += baseCost;
  }
  const barriers = config.barriers
    .filter((barrier) => barrier.afterTier >= fromShaft && barrier.afterTier < toShaft)
    // Zero-cost, zero-time barrier rows are table padding, not real gates.
    .filter((barrier) => bigPairValue(barrier.cost) > 0 || barrier.breakTimeInSeconds > 0)
    .map((barrier) => ({
      afterShaft: barrier.afterTier,
      cost: bigPairValue(barrier.cost),
      breakSeconds: barrier.breakTimeInSeconds,
    }));
  return {
    totalBaseCost,
    perShaft,
    barriers,
    barrierCostTotal: barriers.reduce((sum, barrier) => sum + barrier.cost, 0),
    barrierBreakSecondsTotal: barriers.reduce((sum, barrier) => sum + barrier.breakSeconds, 0),
  };
}

// ---------------------------------------------------------------------------
// The plan
// ---------------------------------------------------------------------------

export type PlanStepKind = "run" | "bottleneck" | "open" | "invest" | "prestige" | "done";

export interface PlanStep {
  id: string;
  kind: PlanStepKind;
  title: string;
  text: string;
  /** Crew names to have working (from the play's verified lineup). */
  chips: string[];
  /** Collapsed "Why?" detail: the numbers behind the step. */
  why: string | null;
}

export interface GoalPlan {
  goal: PlanGoal;
  facts: MineFacts;
  targetShaft: number;
  targetReached: boolean;
  openCost: ShaftOpenCost | null;
  /** Idle-pace estimate for earning the shaft-open cash; null when either
   *  the cost or the pace is unknown. Excludes barrier break time, which
   *  is reported separately on the open step. */
  estimatedSeconds: number | null;
  /** Prestige factor one more prestige would give (auto from the table). */
  nextPrestigeFactor: number;
  steps: PlanStep[];
}

const LEG_LABEL: Record<DerivedMineRates["slowestLeg"], string> = {
  shaft: "Mineshafts",
  elevator: "Elevator",
  warehouse: "Warehouse",
};

function legLevel(facts: MineFacts, leg: DerivedMineRates["slowestLeg"]): number | null {
  if (leg === "elevator") return facts.elevatorLevel;
  if (leg === "warehouse") return facts.warehouseLevel;
  return facts.topShaftLevel;
}

export function buildGoalPlan(
  goal: PlanGoal,
  mineState: MineState | null,
  catalog: CatalogManager[],
  progress: PlayerManager[],
): GoalPlan | null {
  if (!mineState) return null;
  const mine = mineState.mines.find((entry) => entry.mineNumber === goal.mineNumber);
  if (!mine) return null;
  const facts = mineFacts(mine, mineState);
  if (!facts) return null;

  const targetShaft = Math.max(1, Math.round(goal.targetShaft));
  const targetReached = targetShaft <= facts.shaftCount;
  const openCost = targetReached ? null : shaftOpenCost(facts.mineNumber, facts.shaftCount, targetShaft);
  const totalCashNeeded = openCost ? openCost.totalBaseCost + openCost.barrierCostTotal : null;
  const estimatedSeconds = totalCashNeeded != null && facts.pacePerSecond != null && facts.pacePerSecond > 0
    ? totalCashNeeded / facts.pacePerSecond
    : null;
  const nextPrestigeFactor = prestigeGainFactor(facts.mineNumber, facts.prestigeCount + 1);

  const steps: PlanStep[] = [];

  // 1. The best way to run this mine, from the verified play ranking fed
  //    with this mine's derived leg rates.
  if (facts.rates) {
    const plays = rankPlays(catalog, progress, {
      mineshaft: facts.rates.shaftPerSecond,
      elevator: facts.rates.elevatorPerSecond,
      warehouse: facts.rates.warehousePerSecond,
    });
    const play = bestPlay(plays);
    if (play) {
      steps.push({
        id: "run-best-play",
        kind: "run",
        title: `Run it this way: ${play.title}`,
        text: play.nextStep,
        chips: play.lineup.map((pick) => `${pick.area}: ${pick.name}`),
        why: [
          play.why,
          play.howToRun.length > 0 ? `How: ${play.howToRun.join(" ")}` : null,
        ].filter(Boolean).join(" ") || null,
      });
    }

    // 2. The slow leg caps the whole mine; say which one and where it is.
    const leg = facts.rates.slowestLeg;
    const level = legLevel(facts, leg);
    steps.push({
      id: "fix-bottleneck",
      kind: "bottleneck",
      title: `Level up the ${LEG_LABEL[leg].toLowerCase()} — it's the slow part`,
      text: `Everything in this mine waits on the ${LEG_LABEL[leg].toLowerCase()}. Put upgrade cash there first${level != null ? ` (now level ${level.toLocaleString("en-US")})` : ""}.`,
      chips: [],
      why: `From the game's tables at your levels: Mineshafts ${formatCashValue(facts.rates.shaftPerSecond)}/s, Elevator ${formatCashValue(facts.rates.elevatorPerSecond)}/s, Warehouse ${formatCashValue(facts.rates.warehousePerSecond)}/s. The mine only earns at the slowest leg's pace (${formatCashValue(facts.rates.outputPerSecond)}/s).`,
    });
  }

  // 3. Open the shafts up to the target, priced from the game's table.
  if (targetReached) {
    steps.push({
      id: "target-reached",
      kind: "done",
      title: `You're already at Mineshaft ${facts.shaftCount}`,
      text: "This goal is met. Pick a higher target shaft on Home, or work the steps above to make this mine earn faster.",
      chips: [],
      why: null,
    });
  } else if (openCost) {
    const range = openCost.perShaft.length === 1
      ? `Mineshaft ${openCost.perShaft[0].shaft}`
      : `Mineshafts ${openCost.perShaft[0].shaft}–${openCost.perShaft[openCost.perShaft.length - 1].shaft}`;
    const barrierNote = openCost.barriers.length > 0
      ? ` A barrier sits in the way: breaking it costs ${formatCashValue(openCost.barrierCostTotal)} and takes ${formatDuration(openCost.barrierBreakSecondsTotal)}.`
      : "";
    steps.push({
      id: "open-shafts",
      kind: "open",
      title: `Open ${range}`,
      text: `The game's table price to open ${openCost.perShaft.length === 1 ? "it" : "them"} is ${formatCashValue(openCost.totalBaseCost)} cash.${barrierNote} Level-ups after opening cost more and aren't counted here.`,
      chips: [],
      why: [
        ...openCost.perShaft.map((row) => `Mineshaft ${row.shaft}: ${formatCashValue(row.baseCost)}`),
        ...openCost.barriers.map((barrier) => `Barrier after Mineshaft ${barrier.afterShaft}: ${formatCashValue(barrier.cost)}, ${formatDuration(barrier.breakSeconds)} to break`),
      ].join(" · "),
    });
  } else {
    steps.push({
      id: "open-shafts-unpriced",
      kind: "open",
      title: `Open up to Mineshaft ${targetShaft}`,
      text: "The game's downloaded tables don't price these deeper shafts yet, so there's no honest cost to show. The steps above still get you there fastest.",
      chips: [],
      why: null,
    });
  }

  // 4. The one manager investment the ROI ranking puts first.
  const investment = nextUsefulInvestment(buildUpgradeRoi(catalog, progress));
  if (investment) {
    steps.push({
      id: "invest",
      kind: "invest",
      title: `Invest in ${investment.name}`,
      text: investment.rationale,
      chips: [investment.name],
      why: `Top of the upgrade ranking from your real roster numbers (${investment.kind} ${investment.from} → ${investment.to}).`,
    });
  }

  // 5. Prestige, auto-figured from the game's table. Framed as "consider":
  //    the factor gain is exact table data, but no verified model prices
  //    the reset tradeoff, so the plan never claims it "pays".
  if (nextPrestigeFactor > facts.prestigeFactor) {
    steps.push({
      id: "prestige",
      kind: "prestige",
      title: "Consider prestiging before the push",
      text: `Prestige is figured from the game data automatically — you're at P${facts.prestigeCount} (×${fmtFactor(facts.prestigeFactor)} on every rate here). One more prestige makes it ×${fmtFactor(nextPrestigeFactor)}. It also resets this mine's shafts and levels, so it fits best when progress has slowed anyway.`,
      chips: [],
      why: `Prestige factors come from the game's own per-mine table (mainland_prestige_modifiers / RemoteMineGlobal): P${facts.prestigeCount} = ×${fmtFactor(facts.prestigeFactor)}, P${facts.prestigeCount + 1} = ×${fmtFactor(nextPrestigeFactor)}.`,
    });
  }

  return {
    goal: { mineNumber: facts.mineNumber, targetShaft },
    facts,
    targetShaft,
    targetReached,
    openCost,
    estimatedSeconds,
    nextPrestigeFactor,
    steps,
  };
}

/** Prestige factors print whole when whole (x110), trimmed otherwise. */
export function fmtFactor(value: number): string {
  if (Number.isInteger(value)) return value.toLocaleString("en-US");
  return String(Math.round(value * 100) / 100);
}

/** "about 3 h 20 min" style duration for plan estimates. */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "—";
  if (totalSeconds < 90) return "under 2 min";
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) return `about ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  if (hours < 24) return restMinutes > 0 ? `about ${hours} h ${restMinutes} min` : `about ${hours} h`;
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours > 0 ? `about ${days} d ${restHours} h` : `about ${days} d`;
}
