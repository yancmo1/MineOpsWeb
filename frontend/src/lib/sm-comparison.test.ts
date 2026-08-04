import { describe, expect, it } from "vitest";
import { buildTierlist, compareManagersSideBySide } from "./sm-comparison";
import type { CatalogManager, PlayerManager } from "./db";

function manager(id: string, area: string, multiplier: number, rarity = "rare"): CatalogManager {
  return {
    id,
    name: `M ${id}`,
    rarity,
    type: area,
    elements: [],
    active: { multiplier, multiplierAt100: multiplier * 10 },
    activeLevels: [{ level: 1, value: multiplier }, { level: 30, value: multiplier * 3 }],
    rankEffects: [{ rank: 2, activeIncrease: 0.1 }],
    passives: [{ passiveId: 1007, type: "Mine Income Factor", multiplier: 1.44 }],
  };
}

function progress(managerId: string, level = 30, rank = 2, fragments = 0): PlayerManager {
  return { managerId, unlocked: true, level, rank, promoted: 1, fragments, updatedAt: "" };
}

describe("compareManagersSideBySide", () => {
  const shaftA = manager("sm-10001", "Mine Shaft", 50, "legendary");
  const shaftB = manager("sm-10002", "Mine Shaft", 20, "common");
  const elevator = manager("sm-10003", "Elevator", 30, "epic");

  it("compares unlocked managers sorted by heuristic score, using exact values", () => {
    const rows = compareManagersSideBySide([shaftA, shaftB, elevator], [progress("sm-10001"), progress("sm-10002"), progress("sm-10003")]);
    expect(rows).toHaveLength(3);
    // Sorted by heuristic score: shaftA (legendary, 150 base) > elevator (epic, 90) > shaftB (common, 60).
    const byId = (id: string) => rows.find((row) => row.managerId === id)!;
    expect(byId("sm-10001").activeValue).toBeCloseTo(150 * 1.1, 5); // 50*3 exact row, rank +10%
    expect(byId("sm-10003").activeValue).toBeCloseTo(90 * 1.1, 5);
    expect(byId("sm-10002").activeValue).toBeCloseTo(60 * 1.1, 5);
    expect(rows[0].managerId).toBe("sm-10001");
    expect(rows[2].managerId).toBe("sm-10002");
  });

  it("filters by area", () => {
    const rows = compareManagersSideBySide([shaftA, elevator], [progress("sm-10001"), progress("sm-10003")], new Map(), "Mine Shaft");
    expect(rows).toHaveLength(1);
    expect(rows[0].managerId).toBe("sm-10001");
  });

  it("skips locked managers and managers absent from the catalog", () => {
    const locked = { ...progress("sm-10001"), unlocked: false };
    const absent = { ...progress("sm-99999") };
    expect(compareManagersSideBySide([shaftA], [locked, absent])).toHaveLength(0);
  });

  it("applies equipment boost to the heuristic score", () => {
    const boostTable = new Map([[14091, 0.05]]);
    const base = compareManagersSideBySide([shaftA], [{ ...progress("sm-10001"), equipmentIds: [14091] }], boostTable);
    const none = compareManagersSideBySide([shaftA], [progress("sm-10001")]);
    expect(base[0].heuristicScore).toBeGreaterThan(none[0].heuristicScore);
    expect(base[0].equipmentBoost).toBeCloseTo(0.05, 5);
  });
});

describe("buildTierlist", () => {
  it("buckets managers into S/A/B/C bands by verified score", () => {
    const catalog = [
      manager("sm-10001", "Mine Shaft", 500, "legendary"), // ~441 → S
      manager("sm-10002", "Mine Shaft", 5, "epic"), // ~241 → A
      manager("sm-10003", "Elevator", 1, "rare"), // ~171 → B
      manager("sm-10004", "Warehouse", 0.3, "common"), // ~120 → C
    ];
    const players = ["sm-10001", "sm-10002", "sm-10003", "sm-10004"].map((id) => progress(id));
    const tierlist = buildTierlist(catalog, players);
    const tierOf = (id: string) => tierlist.find((entry) => entry.managerId === id)?.tier;
    expect(tierOf("sm-10001")).toBe("S");
    expect(tierOf("sm-10002")).toBe("A");
    expect(tierOf("sm-10003")).toBe("B");
    expect(tierOf("sm-10004")).toBe("C");
  });

  it("returns an empty tierlist without unlocked managers", () => {
    expect(buildTierlist([manager("sm-10001", "Mine Shaft", 10)], [])).toHaveLength(0);
  });
});
