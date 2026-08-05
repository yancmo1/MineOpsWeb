import { describe, expect, it } from "vitest";
import {
  MAX_PROMO,
  crystalCostAfterDiscount,
  maxPromoForRank,
  minPromoForLevel,
  minRankForLevel,
  minRankForPromo,
  planCrystalSpend,
} from "./crystal-planner";

const costTable = {
  bluePerLevel: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45], // L1→2=0, L2→3=5, ... L6→7=25
  redPerPromo: [0, 50, 100, 200, 400, 800], // P0→1=50 ... P4→5=800
};

// Table with costs across all 50 levels for the shortfall/gate tests.
const fullCostTable = {
  bluePerLevel: Array.from({ length: 50 }, (_, index) => (index === 0 ? 0 : 100)),
  redPerPromo: [0, 50, 100, 200, 400, 800],
};

describe("structural gates (ported game mechanics)", () => {
  it("minPromoForLevel bands by decade", () => {
    expect(minPromoForLevel(5)).toBe(0);
    expect(minPromoForLevel(10)).toBe(0);
    expect(minPromoForLevel(11)).toBe(1);
    expect(minPromoForLevel(21)).toBe(2);
    expect(minPromoForLevel(31)).toBe(3);
    expect(minPromoForLevel(41)).toBe(4);
    expect(minPromoForLevel(50)).toBe(4);
  });

  it("maxPromoForRank and rank gates", () => {
    expect(maxPromoForRank(1)).toBe(1);
    expect(maxPromoForRank(3)).toBe(3);
    expect(minRankForLevel(25)).toBe(2);
    expect(minRankForLevel(45)).toBe(4);
    expect(minRankForPromo(3)).toBe(3);
    expect(minRankForPromo(1)).toBe(0);
  });
});

describe("planCrystalSpend", () => {
  it("sums level and promo steps, applies discount, checks budgets", () => {
    const result = planCrystalSpend({
      fromLevel: 1,
      toLevel: 6,
      fromPromo: 0,
      toPromo: 2,
      costTable,
      blueBudget: 100,
      redBudget: 300,
      discountPct: 0,
    });
    expect(result.blueLevels).toBe(5);
    expect(result.redPromos).toBe(2);
    // Levels 2..6 → 5+10+15+20+25 = 75 blue; promos 1..2 → 50+100 = 150 red.
    expect(result.blueCost).toBe(75);
    expect(result.redCost).toBe(150);
    expect(result.blueBudgetOk).toBe(true);
    expect(result.redBudgetOk).toBe(true);
    expect(result.gates.every((gate) => gate.ok)).toBe(true);
    expect(result.steps.filter((step) => step.kind === "level")).toHaveLength(5);
    expect(result.steps.filter((step) => step.kind === "promo")).toHaveLength(2);
  });

  it("applies the discount to both colors", () => {
    const result = planCrystalSpend({
      fromLevel: 1,
      toLevel: 6,
      fromPromo: 0,
      toPromo: 2,
      costTable,
      blueBudget: 50,
      redBudget: null,
      discountPct: 50,
    });
    expect(result.blueCost).toBe(38); // round(75 * 0.5)
    expect(result.redCost).toBe(75);
    expect(result.redBudgetOk).toBe(true); // unlimited red
  });

  it("flags gate violations and budget shortfalls", () => {
    const result = planCrystalSpend({
      fromLevel: 31,
      toLevel: 40,
      fromPromo: 1,
      toPromo: 1,
      costTable: fullCostTable,
      blueBudget: 0,
      redBudget: 0,
      discountPct: 0,
    });
    expect(result.gates.some((gate) => !gate.ok)).toBe(true);
    expect(result.blueBudgetOk).toBe(false);
    expect(result.redBudgetOk).toBe(true); // no promo steps → cost 0
  });

  it("clamps out-of-range inputs", () => {
    const result = planCrystalSpend({
      fromLevel: -5,
      toLevel: 99,
      fromPromo: -1,
      toPromo: 99,
      costTable,
      blueBudget: 1e9,
      redBudget: 1e9,
      discountPct: 0,
    });
    expect(result.blueLevels).toBe(MAX_PROMO >= 0 ? 49 : 0); // L1..L50
    expect(result.redPromos).toBe(5); // P0..P5
  });
});

describe("crystalCostAfterDiscount", () => {
  it("clamps discount to 0..100 and rounds", () => {
    expect(crystalCostAfterDiscount(100, 0)).toBe(100);
    expect(crystalCostAfterDiscount(100, 33)).toBe(67);
    expect(crystalCostAfterDiscount(100, 150)).toBe(0);
    expect(crystalCostAfterDiscount(100, -10)).toBe(100);
    expect(crystalCostAfterDiscount(101, 10)).toBe(91); // round(90.9)
  });
});
