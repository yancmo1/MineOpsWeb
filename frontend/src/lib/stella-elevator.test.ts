import { describe, expect, it } from "vitest";
import {
  assessRunState,
  computeBombDecision,
  computeOutcomeWithRevives,
  computeRiskPath,
  countRiskFloors,
  maxFutureRevives,
  pReachWithRevives,
  reviveCostAt,
  stellaComputeCost,
  type StellaMechanics,
} from "./stella-elevator";

const mechanics: StellaMechanics = {
  totalFloors: 60,
  safeFloors: [1, 10, 20, 30, 40, 50, 60],
  bombChancePerRiskFloor: 0.15,
  continueCostsTickets: [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6],
  expressStartFloor: 30,
};

describe("risk path", () => {
  it("computeRiskPath excludes safe floors", () => {
    expect(computeRiskPath(1, 12, mechanics.safeFloors)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 11, 12]);
    expect(countRiskFloors(1, 60, mechanics.safeFloors)).toBe(53);
  });

  it("reviveCostAt uses the schedule and caps at the last entry", () => {
    expect(reviveCostAt(0, mechanics.continueCostsTickets)).toBe(1);
    expect(reviveCostAt(5, mechanics.continueCostsTickets)).toBe(3);
    expect(reviveCostAt(99, mechanics.continueCostsTickets)).toBe(6);
  });

  it("maxFutureRevives respects the budget and the cap", () => {
    expect(maxFutureRevives(5, mechanics.continueCostsTickets, 0, 99)).toBe(3); // 1+1+2=4 ≤ 5, next 2 → 6 > 5
    expect(maxFutureRevives(5, mechanics.continueCostsTickets, 2, 99)).toBe(2); // 2+2
    expect(maxFutureRevives(1, mechanics.continueCostsTickets, 0, 1)).toBe(1);
    expect(maxFutureRevives(0, mechanics.continueCostsTickets, 0, 99)).toBe(0);
  });
});

describe("outcome DP", () => {
  it("target at or before start has pReach 1", () => {
    expect(pReachWithRevives(30, 30, 0, mechanics)).toBe(1);
    expect(pReachWithRevives(30, 20, 0, mechanics)).toBe(1);
  });

  it("single risk floor: pReach equals survive chance, and one revive makes it certain", () => {
    // Floors 1→3 with floor 2 the only risk (bomb chance 0.15).
    const m: StellaMechanics = { ...mechanics, safeFloors: [1, 3] };
    expect(pReachWithRevives(1, 3, 0, m)).toBeCloseTo(0.85, 10);
    expect(pReachWithRevives(1, 3, 1, m)).toBe(1);
  });

  it("two independent risk floors with revives form a binomial chain", () => {
    const m: StellaMechanics = { ...mechanics, bombChancePerRiskFloor: 0.5, safeFloors: [1, 4] };
    // 2 risks (floors 2,3), p=0.5.
    expect(pReachWithRevives(1, 4, 0, m)).toBeCloseTo(0.25, 10);
    expect(pReachWithRevives(1, 4, 1, m)).toBeCloseTo(0.75, 10);
    expect(pReachWithRevives(1, 4, 2, m)).toBe(1);
  });

  it("percentiles are monotone in revives", () => {
    const out0 = computeOutcomeWithRevives(1, 60, 0, mechanics);
    const out5 = computeOutcomeWithRevives(1, 60, 5, mechanics);
    expect(out5.p50).toBeGreaterThanOrEqual(out0.p50);
    expect(out5.p95).toBeGreaterThanOrEqual(out0.p95);
  });
});

describe("assessRunState", () => {
  it("returns null with fewer than 4 resolved risk floors", () => {
    // Floor 4 resolves only floors 2–3 = 2 risk floors → not meaningful.
    expect(assessRunState(4, 0, mechanics, false)).toBeNull();
  });

  it("labels an unlucky run (many bombs vs expectation)", () => {
    // 58 risk floors resolved from floor 1 with p=0.15 → expected ~8.7 bombs.
    const state = assessRunState(60, 20, mechanics, false);
    expect(state).not.toBeNull();
    expect(state!.label).toBe("Unlucky run");
    expect(state!.tone).toBe("bad");
  });

  it("labels a lucky run (few bombs)", () => {
    const state = assessRunState(60, 0, mechanics, false);
    expect(state!.label).toBe("Lucky run");
    expect(state!.tone).toBe("good");
  });

  it("labels an average run near expectation", () => {
    const state = assessRunState(60, 8, mechanics, false);
    expect(state!.label).toBe("Average run");
  });
});

describe("computeBombDecision", () => {
  it("fresh start with big budget keeps continuing viable", () => {
    const decision = computeBombDecision(
      { currentFloor: 1, target: 30, revivesUsed: 0, elevatorTickets: 50, expressTickets: 1, justBombed: false },
      mechanics,
    );
    expect(decision.targetReached).toBe(false);
    expect(decision.atFreshStart).toBe(true);
    const a = decision.options.find((o) => o.id === "A")!;
    expect(a.data.viable).toBe(true);
    if (a.data.viable) {
      expect(a.data.pReach).toBeGreaterThan(0.5);
      expect(a.data.afterTix).toBe(50);
    }
  });

  it("reports target reached and marks restart options unviable", () => {
    const decision = computeBombDecision(
      { currentFloor: 40, target: 30, revivesUsed: 0, elevatorTickets: 10, expressTickets: 1, justBombed: false },
      mechanics,
    );
    expect(decision.targetReached).toBe(true);
    // A is viable and auto-targets (reference behavior); B/C are suppressed.
    const a = decision.options.find((o) => o.id === "A")!;
    expect(a.data.viable).toBe(true);
    if (a.data.viable) expect(a.data.autoTarget).toBe(true);
    for (const option of decision.options.filter((o) => o.id !== "A")) {
      if (option.data.viable) {
        throw new Error(`expected ${option.id} unviable but it was viable`);
      }
      expect(option.data.reason).toBe("Target already reached");
    }
    expect(decision.best).not.toBeNull();
    expect(decision.best!.id).toBe("A");
  });

  it("a just-bombed player without clear tickets cannot continue", () => {
    const decision = computeBombDecision(
      { currentFloor: 5, target: 30, revivesUsed: 3, elevatorTickets: 0, expressTickets: 1, justBombed: true },
      mechanics,
    );
    const a = decision.options.find((o) => o.id === "A")!;
    if (a.data.viable) {
      throw new Error("expected A unviable without tickets");
    }
    expect(a.data.reason).toContain("Not enough tickets to clear");
  });

  it("recommends the highest-pReach viable option when A is far behind", () => {
    // Deep into the run with few tickets: Express (B) skips to floor 30 → pReach 1.
    const decision = computeBombDecision(
      { currentFloor: 10, target: 40, revivesUsed: 5, elevatorTickets: 3, expressTickets: 1, justBombed: false },
      mechanics,
    );
    expect(decision.best).not.toBeNull();
    expect(decision.best!.id).toBe("B");
  });
});

describe("stellaComputeCost", () => {
  it("costs one entry ticket plus revives from floor 1", () => {
    const cost = stellaComputeCost(31, false, mechanics, 50);
    expect(cost.startFloor).toBe(1);
    expect(cost.ticketCost).toBeGreaterThan(0);
    expect(cost.affordable).toBe(true);
    expect(cost.pReach).toBeGreaterThan(0);
  });

  it("Express start skips entry cost and auto-reaches low targets", () => {
    const cost = stellaComputeCost(20, true, mechanics, 0);
    expect(cost.startFloor).toBe(30);
    expect(cost.ticketCost).toBe(0);
    expect(cost.pReach).toBe(1);
  });
});
