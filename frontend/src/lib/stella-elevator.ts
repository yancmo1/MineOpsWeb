/**
 * Stella's Lucky Elevator — mid-run bomb-decision calculator.
 *
 * Faithful TypeScript port of idle-miners.com's stella-decision/stella-calc
 * logic (DP probability model over risk floors with a revive budget). The
 * event mechanics (safe floors, bomb chance, revive ticket costs, Express
 * start floor) are MANUAL INPUTS — the APK does not publish them, so they are
 * provided by the player per event run, exactly like the Frontier playbook's
 * live inputs. Nothing is estimated from game files.
 */

export interface StellaMechanics {
  totalFloors: number;
  safeFloors: number[];
  bombChancePerRiskFloor: number; // 0..1
  continueCostsTickets: number[]; // revive cost schedule by revive index
  expressStartFloor: number;
}

export interface StellaInput {
  currentFloor: number;
  target: number;
  revivesUsed: number;
  elevatorTickets: number;
  expressTickets: number;
  justBombed: boolean;
}

export interface StellaOutcome {
  pReach: number;
  probMass: Record<number, number>;
  p5: number;
  p50: number;
  p95: number;
}

export function computeRiskPath(startFloor: number, target: number, safeFloors: number[]): number[] {
  const safeSet = new Set(safeFloors);
  const riskFloors: number[] = [];
  for (let f = startFloor + 1; f <= target; f++) {
    if (!safeSet.has(f)) riskFloors.push(f);
  }
  return riskFloors;
}

export function countRiskFloors(startFloor: number, target: number, safeFloors: number[]): number {
  return computeRiskPath(startFloor, target, safeFloors).length;
}

/** Cost of the i-th revive (0-based) from the ticket cost schedule. */
export function reviveCostAt(i: number, costs: number[]): number {
  if (!Array.isArray(costs) || costs.length === 0) return 1;
  return costs[Math.min(i, costs.length - 1)];
}

/** Max revives affordable starting at startIndex (0-based) with a ticket budget. */
export function maxFutureRevives(
  tickets: number,
  costs: number[],
  startIndex: number,
  maxRevives: number,
): number {
  if (!Number.isFinite(tickets) || tickets < 0) return 0;
  const cap = Number.isFinite(maxRevives) && maxRevives >= 0 ? Math.floor(maxRevives) : Infinity;
  let R = 0;
  let spent = 0;
  while (R < cap) {
    const c = reviveCostAt(startIndex + R, costs);
    if (spent + c > tickets) break;
    spent += c;
    R++;
    if (R > 200) break; // sanity cap
  }
  return R;
}

/**
 * Probability of reaching `target` from `startFloor` with at most R revives,
 * via DP over risk floors; plus p5/p50/p95 of the floor distribution.
 */
export function computeOutcomeWithRevives(
  startFloor: number,
  target: number,
  R: number,
  mechanics: StellaMechanics,
): StellaOutcome {
  if (target <= startFloor) {
    return { pReach: 1, probMass: { [startFloor]: 1 }, p5: startFloor, p50: startFloor, p95: startFloor };
  }
  const safeSet = new Set(mechanics.safeFloors);
  const bombChance = mechanics.bombChancePerRiskFloor;
  const surviveChance = 1 - bombChance;
  const totalRisks = countRiskFloors(startFloor, target, mechanics.safeFloors);
  const Rdp = Math.min(Math.max(0, Math.floor(R)), totalRisks);
  let dp = new Array<number>(Rdp + 1).fill(0);
  dp[0] = 1;
  const probMass: Record<number, number> = {};
  for (let f = startFloor + 1; f <= target; f++) {
    if (safeSet.has(f)) continue;
    const newDp = new Array<number>(Rdp + 1).fill(0);
    for (let k = 0; k <= Rdp; k++) {
      newDp[k] += dp[k] * surviveChance;
      if (k > 0) newDp[k] += dp[k - 1] * bombChance;
    }
    probMass[f - 1] = (probMass[f - 1] ?? 0) + dp[Rdp] * bombChance;
    dp = newDp;
  }
  let pReach = 0;
  for (let k = 0; k <= Rdp; k++) pReach += dp[k];
  if (Rdp >= totalRisks) pReach = 1;
  probMass[target] = (probMass[target] ?? 0) + pReach;
  const floors = Object.keys(probMass).map(Number).sort((a, b) => a - b);
  const cdfArr: Array<{ floor: number; cdf: number }> = [];
  let cum = 0;
  for (const floor of floors) {
    cum += probMass[floor];
    cdfArr.push({ floor, cdf: Math.min(1, cum) });
  }
  const pct = (p: number): number => {
    for (const entry of cdfArr) {
      if (entry.cdf >= p) return entry.floor;
    }
    return cdfArr[cdfArr.length - 1]?.floor ?? startFloor;
  };
  return { pReach, probMass, p5: pct(0.05), p50: pct(0.5), p95: pct(0.95) };
}

export function pReachWithRevives(
  startFloor: number,
  target: number,
  R: number,
  mechanics: StellaMechanics,
): number {
  return computeOutcomeWithRevives(startFloor, target, R, mechanics).pReach;
}

export interface RunState {
  label: string;
  tone: "good" | "mild-good" | "neutral" | "mild-bad" | "bad";
  risksCleared: number;
  expectedBombs: number;
  actualBombs: number;
}

/**
 * Run-state heuristic: how many bombs the player absorbed vs the expectation
 * across resolved risk floors. Assumes start from floor 1; a rough signal,
 * not a claim. Returns null when fewer than 4 risk floors were resolved.
 */
export function assessRunState(
  currentFloor: number,
  bombsTaken: number,
  mechanics: StellaMechanics,
  currentRiskPending: boolean,
): RunState | null {
  const safeSet = new Set(mechanics.safeFloors);
  const lastResolvedFloor = currentRiskPending ? currentFloor - 1 : currentFloor;
  let risksFromOne = 0;
  for (let f = 2; f <= lastResolvedFloor; f++) {
    if (!safeSet.has(f)) risksFromOne++;
  }
  if (risksFromOne < 4) return null;
  const p = mechanics.bombChancePerRiskFloor;
  const expected = risksFromOne * p;
  const stdev = Math.sqrt(risksFromOne * p * (1 - p));
  const z = (bombsTaken - expected) / Math.max(0.5, stdev);
  let label: string;
  let tone: RunState["tone"];
  if (z >= 1.5) {
    label = "Unlucky run";
    tone = "bad";
  } else if (z >= 0.6) {
    label = "Below average";
    tone = "mild-bad";
  } else if (z <= -1.0) {
    label = "Lucky run";
    tone = "good";
  } else if (z <= -0.4) {
    label = "Above average";
    tone = "mild-good";
  } else {
    label = "Average run";
    tone = "neutral";
  }
  return { label, tone, risksCleared: risksFromOne, expectedBombs: expected, actualBombs: bombsTaken };
}

export interface StellaOption {
  id: "A" | "B" | "C";
  label: string;
  data: StellaOptionData;
}

export type StellaOptionData =
  | { viable: true; pReach: number; p5: number; p50: number; p95: number; startFloor?: number; futureRevives: number; afterTix: number; clearCost: number; autoTarget?: boolean; targetReached?: boolean }
  | { viable: false; reason: string };

export interface StellaDecision {
  options: StellaOption[];
  best: StellaOption | null;
  currentFloor: number;
  target: number;
  revivesUsed: number;
  clearCost: number;
  elevatorTix: number;
  expressTix: number;
  justBombed: boolean;
  onSafeFloor: boolean;
  currentRiskPending: boolean;
  atFreshStart: boolean;
  targetReached: boolean;
  runState: RunState | null;
}

function attachOutcome(
  opt: { pReach: number; p5: number; p50: number; p95: number },
  startFloor: number,
  target: number,
  revives: number,
  mechanics: StellaMechanics,
): void {
  const out = computeOutcomeWithRevives(startFloor, target, revives, mechanics);
  opt.pReach = out.pReach;
  opt.p5 = out.p5;
  opt.p50 = out.p50;
  opt.p95 = out.p95;
}

/** Mid-run decision between A (continue), B (Express restart), C (fresh restart). */
export function computeBombDecision(input: StellaInput, mechanics: StellaMechanics): StellaDecision {
  const costs = mechanics.continueCostsTickets ?? [];
  const currentFloor = Math.max(1, Math.min(mechanics.totalFloors, Math.floor(input.currentFloor)));
  const target = Math.max(1, Math.min(mechanics.totalFloors, Math.floor(input.target)));
  const revivesUsed = Math.max(0, Math.floor(input.revivesUsed));
  const elevatorTix = Math.max(0, Math.floor(input.elevatorTickets));
  const expressTix = Math.max(0, Math.floor(input.expressTickets));

  const safeSet = new Set(mechanics.safeFloors);
  const onSafeFloor = safeSet.has(currentFloor);
  const justBombed = !!input.justBombed && !onSafeFloor;
  const atFreshStart = currentFloor === 1 && revivesUsed === 0 && !justBombed;
  const clearCost = reviveCostAt(revivesUsed, costs);
  const pendingClearCost = justBombed ? clearCost : 0;
  const currentRiskPending = !justBombed && !onSafeFloor && currentFloor <= target;
  const targetReached = currentFloor >= target && !justBombed && !currentRiskPending;
  const continueStartFloor = currentRiskPending ? currentFloor - 1 : currentFloor;
  const continueRiskCount = countRiskFloors(continueStartFloor, target, mechanics.safeFloors);

  // Option A: continue from currentFloor (with or without paying a clear cost).
  let a: StellaOptionData;
  if (targetReached) {
    a = { viable: true, targetReached: true, clearCost: 0, afterTix: elevatorTix, futureRevives: 0, pReach: 1, p5: currentFloor, p50: currentFloor, p95: currentFloor, autoTarget: true };
  } else if (justBombed && clearCost > elevatorTix) {
    a = { viable: false, reason: `Not enough tickets to clear (need ${clearCost}, have ${elevatorTix})` };
  } else {
    const costPaid = justBombed ? clearCost : 0;
    const afterTix = elevatorTix - costPaid;
    const futureStart = justBombed ? revivesUsed + 1 : revivesUsed;
    const futureA = maxFutureRevives(afterTix, costs, futureStart, continueRiskCount);
    a = { viable: true, clearCost: costPaid, afterTix, futureRevives: futureA, pReach: 0, p5: 0, p50: 0, p95: 0 };
    attachOutcome(a, continueStartFloor, target, futureA, mechanics);
  }

  // Option B: ditch and restart with Express ticket (lands at expressStartFloor).
  const expressStart = mechanics.expressStartFloor;
  let b: StellaOptionData;
  if (targetReached) {
    b = { viable: false, reason: "Target already reached" };
  } else if (pendingClearCost > elevatorTix) {
    b = { viable: false, reason: `Not enough tickets to clear before restarting (need ${pendingClearCost}, have ${elevatorTix})` };
  } else if (expressTix < 1) {
    b = { viable: false, reason: "No Express Tickets" };
  } else if (target <= expressStart) {
    b = { viable: true, startFloor: expressStart, clearCost: pendingClearCost, afterTix: elevatorTix - pendingClearCost, futureRevives: 0, pReach: 1, p5: expressStart, p50: expressStart, p95: expressStart, autoTarget: true };
  } else {
    const afterClearB = elevatorTix - pendingClearCost;
    const futureB = maxFutureRevives(afterClearB, costs, 0, countRiskFloors(expressStart, target, mechanics.safeFloors));
    b = { viable: true, startFloor: expressStart, clearCost: pendingClearCost, afterTix: afterClearB, futureRevives: futureB, pReach: 0, p5: 0, p50: 0, p95: 0 };
    attachOutcome(b, expressStart, target, futureB, mechanics);
  }

  // Option C: ditch and restart from floor 1 with a regular Elevator Ticket.
  let c: StellaOptionData;
  if (targetReached) {
    c = { viable: false, reason: "Target already reached" };
  } else if (atFreshStart) {
    c = { viable: false, reason: "You are already at floor 1 with no revives used — same as continuing" };
  } else if (pendingClearCost > elevatorTix) {
    c = { viable: false, reason: `Not enough tickets to clear before restarting (need ${pendingClearCost}, have ${elevatorTix})` };
  } else if (elevatorTix - pendingClearCost < 1) {
    c = { viable: false, reason: "Not enough tickets for a fresh entry" };
  } else {
    const afterClearC = elevatorTix - pendingClearCost - 1;
    const futureC = maxFutureRevives(afterClearC, costs, 0, countRiskFloors(1, target, mechanics.safeFloors));
    c = { viable: true, startFloor: 1, clearCost: pendingClearCost, afterTix: afterClearC, futureRevives: futureC, pReach: 0, p5: 0, p50: 0, p95: 0 };
    attachOutcome(c, 1, target, futureC, mechanics);
  }

  const optionALabel = targetReached
    ? "Target already reached"
    : justBombed
      ? "Clear the bomb"
      : atFreshStart
        ? "Continue (you are already at the start)"
        : onSafeFloor
          ? `Pick floor ${currentFloor} reward, keep going`
          : "Keep going from current floor";
  const optionBLabel = atFreshStart
    ? `Use Express Ticket now → skip to floor ${expressStart}`
    : justBombed
      ? "Clear, collect rewards & restart with Express Ticket"
      : onSafeFloor
        ? `Pick floor ${currentFloor} reward, end run, restart with Express Ticket`
        : "Collect rewards & restart with Express Ticket";
  const optionCLabel = atFreshStart
    ? "Restart from floor 1 (Elevator Ticket)"
    : justBombed
      ? "Clear, collect rewards & restart from floor 1"
      : onSafeFloor
        ? `Pick floor ${currentFloor} reward, end run, restart from floor 1`
        : "Collect rewards & restart from floor 1 (Elevator Ticket)";

  const options: StellaOption[] = [
    { id: "A", label: optionALabel, data: a },
    { id: "B", label: optionBLabel, data: b },
    { id: "C", label: optionCLabel, data: c },
  ];

type ViableStellaOption = Extract<StellaOptionData, { viable: true }>;

  // Best pick: prefer A when within ~5pp pReach of the highest viable option,
  // gated on a minimum absolute pReach (so the bias doesn't apply when every
  // option is hopeless).
  const viables = options.filter((option): option is StellaOption & { data: ViableStellaOption } => option.data.viable);
  let best: StellaOption | null = null;
  if (viables.length) {
    const maxP = Math.max(...viables.map((option) => option.data.pReach));
    const aOpt = viables.find((option) => option.id === "A") ?? null;
    if (aOpt && aOpt.data.pReach >= 0.05 && aOpt.data.pReach >= maxP - 0.05) {
      best = aOpt;
    } else {
      best = viables.reduce((prev, option) => (option.data.pReach > prev.data.pReach ? option : prev));
    }
  }

  const runState = assessRunState(currentFloor, revivesUsed + (justBombed ? 1 : 0), mechanics, currentRiskPending);

  return {
    options,
    best,
    currentFloor,
    target,
    revivesUsed,
    clearCost,
    elevatorTix,
    expressTix,
    justBombed,
    onSafeFloor,
    currentRiskPending,
    atFreshStart,
    targetReached,
    runState,
  };
}

/** Cost model: tickets needed to reach `target` from the chosen start. */
export function stellaComputeCost(
  target: number,
  expressStart: boolean,
  mechanics: StellaMechanics,
  budget: number,
): { startFloor: number; target: number; ticketCost: number; affordable: boolean; remaining: number; pReach: number } {
  const totalFloors = mechanics.totalFloors;
  const t = Math.max(1, Math.min(totalFloors, Math.floor(target)));
  const startFloor = expressStart ? mechanics.expressStartFloor : 1;
  const entryCost = expressStart ? 0 : 1;
  if (t <= startFloor) {
    return { startFloor, target: t, ticketCost: 0, affordable: true, remaining: Math.max(0, budget), pReach: 1 };
  }
  const risks = countRiskFloors(startFloor, t, mechanics.safeFloors);
  const revives = maxFutureRevives(Math.max(0, budget - entryCost), mechanics.continueCostsTickets ?? [], 0, risks);
  const spent = (() => {
    let s = 0;
    for (let i = 0; i < revives; i++) s += reviveCostAt(i, mechanics.continueCostsTickets ?? []);
    return s;
  })();
  const ticketCost = entryCost + spent;
  const pReach = pReachWithRevives(startFloor, t, revives, mechanics);
  return {
    startFloor,
    target: t,
    ticketCost,
    affordable: ticketCost <= Math.max(0, budget),
    remaining: Math.max(0, budget - ticketCost),
    pReach,
  };
}
