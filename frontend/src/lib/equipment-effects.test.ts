import { describe, expect, it } from "vitest";
import { applyEquipmentBoost, buildEquipmentBoostTable, equipmentBoostFor } from "./equipment-effects";
import { evaluateLineup } from "./strategy";
import type { CachedCatalogPackage } from "./catalog-cache";
import type { CatalogManager, PlayerManager } from "./db";

// Real balancing rows from the lossless equipment-domain.json:
// equipment 14091 @ level 5 = 0.05, equipment 14092 @ level 10 = 0.05.
function packageWithBalancing(rows: Array<Record<string, unknown>>): CachedCatalogPackage {
  return {
    catalogVersion: "test-fixture",
    releaseId: "test-fixture",
    manifestHash: "0".repeat(64),
    artifacts: {
      "equipment-domain.json": {
        content: { balancing: rows },
        bytes: 0,
        sha256: "0".repeat(64),
      },
    },
  } as unknown as CachedCatalogPackage;
}

describe("buildEquipmentBoostTable", () => {
  it("builds from verified balancing rows only", () => {
    const table = buildEquipmentBoostTable(packageWithBalancing([
      { equipmentId: 14091, level: 5, value: 0.05 },
      { equipmentId: 14092, level: 10, value: 0.05 },
    ]));
    expect(table.get(14091)).toBe(0.05);
    expect(table.get(14092)).toBe(0.05);
    expect(table.size).toBe(2);
  });

  it("keeps the highest balancing level per equipment", () => {
    const table = buildEquipmentBoostTable(packageWithBalancing([
      { equipmentId: 14091, level: 1, value: 0.01 },
      { equipmentId: 14091, level: 5, value: 0.05 },
    ]));
    expect(table.get(14091)).toBe(0.05);
  });

  it("ignores rows without a finite numeric value", () => {
    const table = buildEquipmentBoostTable(packageWithBalancing([
      { equipmentId: 14091, level: 5, value: "x" },
      { equipmentId: 99999, level: 1, value: 0.1 },
      { not: "an equipment row" },
    ]));
    expect(table.get(14091)).toBeUndefined();
    expect(table.get(99999)).toBe(0.1);
  });

  it("returns an empty table without a package", () => {
    expect(buildEquipmentBoostTable(undefined).size).toBe(0);
  });
});

describe("equipmentBoostFor / applyEquipmentBoost", () => {
  it("sums verified boosts for assigned equipment", () => {
    const table = new Map([[14091, 0.05], [14092, 0.05]]);
    expect(equipmentBoostFor(table, [14091])).toBeCloseTo(0.05, 5);
    expect(equipmentBoostFor(table, [14091, 14092])).toBeCloseTo(0.1, 5);
    expect(equipmentBoostFor(table, [99999])).toBe(0);
    expect(equipmentBoostFor(table, undefined)).toBe(0);
  });

  it("applies boost as a multiplicative factor only when positive", () => {
    expect(applyEquipmentBoost(200, 0.05)).toBeCloseTo(210, 5);
    expect(applyEquipmentBoost(200, 0)).toBe(200);
  });
});

describe("equipment-aware lineup scoring (before/after)", () => {
  const manager: CatalogManager = {
    id: "sm-10001",
    name: "Lee Vatori",
    rarity: "rare",
    type: "Mine Shaft",
    elements: [],
    active: { multiplier: 10 },
    activeLevels: [{ level: 1, value: 10 }, { level: 30, value: 50 }],
  };
  const baseProgress: PlayerManager = {
    managerId: "sm-10001",
    unlocked: true,
    level: 30,
    rank: 3,
    promoted: 1,
    fragments: 0,
    updatedAt: "",
  };
  const boostTable = buildEquipmentBoostTable(packageWithBalancing([
    { equipmentId: 14091, level: 5, value: 0.05 },
  ]));

  it("scores higher with verified equipment assigned (after) than without (before)", () => {
    const before = evaluateLineup([manager], [{ ...baseProgress, equipmentIds: undefined }], null);
    const after = evaluateLineup([manager], [{ ...baseProgress, equipmentIds: [14091] }], null, boostTable);
    const beforeRec = before.areaRecommendations["Mine Shaft"]?.[0];
    const afterRec = after.areaRecommendations["Mine Shaft"]?.[0];
    expect(afterRec?.equipmentBoost).toBeCloseTo(0.05, 5);
    expect(afterRec?.score).toBeGreaterThan(beforeRec?.score ?? 0);
    expect(beforeRec?.equipmentBoost).toBe(0);
  });

  it("does not boost when assigned equipment has no verified balancing row", () => {
    const result = evaluateLineup([manager], [{ ...baseProgress, equipmentIds: [99999] }], null, boostTable);
    expect(result.areaRecommendations["Mine Shaft"]?.[0]?.equipmentBoost).toBe(0);
  });
});
