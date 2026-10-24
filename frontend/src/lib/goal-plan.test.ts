import { beforeAll, describe, expect, it } from "vitest";
import type { CatalogManager, PlayerManager } from "./db";
import type { MineState, SaveMine } from "./mine-state";
import {
  buildGoalPlan,
  defaultTargetShaft,
  formatDuration,
  goalPickerGroups,
  loadGoal,
  mineFacts,
  saveGoal,
  shaftOpenCost,
  topEarners,
} from "./goal-plan";

// Minimal localStorage so goal persistence can be tested in the node env.
beforeAll(() => {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    key: () => null,
    length: 0,
  } as Storage;
});

function makeMine(partial: Partial<SaveMine> & { mineNumber: number }): SaveMine {
  return {
    mineId: null,
    elevatorLevel: null,
    warehouseLevel: null,
    corridorLevels: [],
    prestigeCount: 0,
    selected: false,
    idleCashPerSecond: null,
    cashPerSecondWhenClosed: null,
    storedCash: null,
    idleBoost: 1,
    ...partial,
  };
}

function stateOf(mines: SaveMine[]): MineState {
  return { mines, unlockedContinentTypes: [], assignments: [] };
}

const catalog: CatalogManager[] = [
  { id: "ranger-sue", name: "Ranger Sue", rarity: "legendary", type: "Mine Shaft", elements: [], active: { multiplier: 5, duration: 60, cooldown: 900 } },
  { id: "mr-turner", name: "Mr Turner", rarity: "legendary", type: "Mine Shaft", elements: [] },
  { id: "blingsley", name: "Blingsley", rarity: "epic", type: "Mine Shaft", elements: [] },
  { id: "dr-steiner", name: "Dr Steiner", rarity: "epic", type: "Mine Shaft", elements: [] },
  { id: "dr-lilly", name: "Dr Lilly", rarity: "epic", type: "Elevator", elements: [] },
  { id: "zi-galvani", name: "Zi Galvani", rarity: "legendary", type: "Mine Shaft", elements: [] },
  { id: "luxario", name: "Luxario", rarity: "legendary", type: "Warehouse", elements: [] },
];

const fullRoster: PlayerManager[] = catalog.map((m) => ({
  managerId: m.id, level: 30, rank: 4, promoted: 3, fragments: 0, unlocked: true, updatedAt: "2026-10-08",
}));

/** Coal (mine 1): 5 shafts open, modest levels, never prestiged. */
const coal = makeMine({
  mineNumber: 1,
  corridorLevels: [10, 8, 5, 3, 1],
  elevatorLevel: 10,
  warehouseLevel: 10,
  prestigeCount: 0,
  idleCashPerSecond: 1000,
});

/** Obsidian (mine 15): 30 shafts, deep levels, prestige 5 (game fixture). */
const obsidian = makeMine({
  mineNumber: 15,
  corridorLevels: Array.from({ length: 30 }, (_, k) => Math.round(800 - (800 - 590) * (k / 29))),
  elevatorLevel: 1997,
  warehouseLevel: 2003,
  prestigeCount: 5,
  idleCashPerSecond: 7.31e88,
});

describe("goal persistence", () => {
  it("round-trips a goal and clears back to null", () => {
    saveGoal(null);
    expect(loadGoal()).toBeNull();
    saveGoal({ mineNumber: 15, targetShaft: 31 });
    expect(loadGoal()).toEqual({ mineNumber: 15, targetShaft: 31 });
    saveGoal(null);
    expect(loadGoal()).toBeNull();
  });

  it("defaults the target to the next shaft", () => {
    expect(defaultTargetShaft(coal)).toBe(6);
    expect(defaultTargetShaft(obsidian)).toBe(31);
  });
});

describe("mineFacts + topEarners", () => {
  it("derives facts from the save: shafts, levels, prestige factor", () => {
    const facts = mineFacts(obsidian, stateOf([obsidian]))!;
    expect(facts.label).toBe("Obsidian");
    expect(facts.shaftCount).toBe(30);
    expect(facts.topShaftLevel).toBe(800);
    expect(facts.prestigeCount).toBe(5);
    expect(facts.prestigeFactor).toBe(110); // game's own table, mine-balancing.test.ts
    expect(facts.rates?.slowestLeg).toBe("elevator"); // game agrees: elevator is Obsidian's slow leg
    expect(facts.paceSource).toBe("tables");
  });

  it("falls back to the game's idle number when levels are unknown", () => {
    const idleOnly = makeMine({ mineNumber: 2, idleCashPerSecond: 500 });
    const facts = mineFacts(idleOnly, stateOf([idleOnly]))!;
    expect(facts.rates).toBeNull();
    expect(facts.pacePerSecond).toBe(500);
    expect(facts.paceSource).toBe("game");
  });

  it("ranks his mines biggest earner first and honours the limit", () => {
    const idleOnly = makeMine({ mineNumber: 2, idleCashPerSecond: 500 });
    const earners = topEarners(stateOf([coal, obsidian, idleOnly]), 2);
    expect(earners.map((entry) => entry.mineNumber)).toEqual([15, 1]);
    expect(topEarners(null)).toEqual([]);
  });

  it("groups the picker by continent with his mines nested inside", () => {
    const groups = goalPickerGroups(stateOf([coal, obsidian]));
    expect(groups.map((group) => group.continentName)).toEqual(["Start", "Fire"]);
    expect(groups[1].mines[0].label).toBe("Obsidian");
  });
});

describe("shaftOpenCost", () => {
  it("prices shafts from the game's table and skips zero padding barriers", () => {
    const cost = shaftOpenCost(1, 5, 12)!;
    expect(cost.perShaft.map((row) => row.shaft)).toEqual([6, 7, 8, 9, 10, 11, 12]);
    expect(cost.totalBaseCost).toBeGreaterThan(0);
    // The after-5 barrier row is 0 cost / 0 time (padding); after-10 is real.
    expect(cost.barriers.map((barrier) => barrier.afterShaft)).toEqual([10]);
    expect(cost.barrierBreakSecondsTotal).toBe(3600);
  });

  it("returns null when there is nothing to open or the table can't price it", () => {
    expect(shaftOpenCost(1, 7, 7)).toBeNull();
    expect(shaftOpenCost(999999, 1, 2)).toBeNull();
  });
});

describe("buildGoalPlan", () => {
  it("builds plain steps from the verified computations", () => {
    const plan = buildGoalPlan({ mineNumber: 1, targetShaft: 12 }, stateOf([coal]), catalog, fullRoster)!;
    expect(plan.targetReached).toBe(false);
    const kinds = plan.steps.map((step) => step.kind);
    expect(kinds).toContain("run"); // best play from rankPlays on derived rates
    expect(kinds).toContain("bottleneck");
    expect(kinds).toContain("open");
    expect(kinds).toContain("prestige"); // P0 x1 -> P1 x10 in the game's table

    const open = plan.steps.find((step) => step.kind === "open")!;
    expect(open.title).toContain("Mineshafts 6–12");
    expect(open.why).toContain("Barrier after Mineshaft 10");

    const run = plan.steps.find((step) => step.kind === "run")!;
    expect(run.chips.length).toBeGreaterThan(0); // crew rides along with the play

    const prestige = plan.steps.find((step) => step.kind === "prestige")!;
    expect(prestige.text).toContain("×10");
    expect(prestige.title).toMatch(/consider/i); // never claims the reset "pays"

    expect(plan.estimatedSeconds).not.toBeNull();
    expect(plan.estimatedSeconds!).toBeGreaterThan(0);
  });

  it("says the goal is met instead of inventing work", () => {
    const plan = buildGoalPlan({ mineNumber: 15, targetShaft: 25 }, stateOf([obsidian]), catalog, fullRoster)!;
    expect(plan.targetReached).toBe(true);
    expect(plan.openCost).toBeNull();
    expect(plan.estimatedSeconds).toBeNull();
    expect(plan.steps.map((step) => step.kind)).toContain("done");
  });

  it("returns null without a save or for a mine he doesn't have", () => {
    expect(buildGoalPlan({ mineNumber: 1, targetShaft: 6 }, null, catalog, fullRoster)).toBeNull();
    expect(buildGoalPlan({ mineNumber: 42, targetShaft: 6 }, stateOf([coal]), catalog, fullRoster)).toBeNull();
  });
});

describe("formatDuration", () => {
  it("humanizes idle-pace estimates", () => {
    expect(formatDuration(30)).toBe("under 2 min");
    expect(formatDuration(3600)).toBe("about 1 h");
    expect(formatDuration(90000)).toBe("about 1 d 1 h");
  });
});
