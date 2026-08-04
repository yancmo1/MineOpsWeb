import { describe, expect, it } from "vitest";
import { effectiveActiveValue, hasExactActiveLevelRow, strengthScore } from "./db";
import { evaluateLineup } from "./strategy";
import type { CatalogManager, PlayerManager } from "./db";

/**
 * Scoring invariants:
 *  1. Exact active-level rows only — never linear interpolation.
 *  2. No anonymous modifiers — every score term is documented (formula lock).
 *  3. Unresolved/limited managers stay in the evaluation with visible
 *     provenance (limitedData + missingData reasons) or in `unevaluated`.
 */

function manager(overrides: Partial<CatalogManager> = {}): CatalogManager {
  return {
    id: "sm-10001",
    name: "Lee Vatori",
    rarity: "rare",
    type: "Mine Shaft",
    elements: [],
    active: { multiplier: 10, multiplierAt100: 100 },
    activeLevels: [
      { level: 1, value: 10 },
      { level: 100, value: 100 },
    ],
    ...overrides,
  };
}

function progress(level: number, overrides: Partial<PlayerManager> = {}): PlayerManager {
  return {
    managerId: "sm-10001",
    unlocked: true,
    level,
    rank: 0,
    promoted: 0,
    fragments: 0,
    updatedAt: "",
    ...overrides,
  };
}

describe("invariant: exact active-level rows, never interpolation", () => {
  it("returns the exact row for the player's level when present", () => {
    const m = manager({ activeLevels: [{ level: 1, value: 10 }, { level: 50, value: 500 }, { level: 100, value: 1000 }] });
    expect(effectiveActiveValue(m, progress(50))).toBe(500);
    expect(effectiveActiveValue(m, progress(100))).toBe(1000);
  });

  it("never interpolates between level 1 and 100 when an interior row is missing", () => {
    // Only level 1 (10x) and level 100 (100x) rows exist. Linear interpolation
    // would claim 55x at level 50; the invariant requires the honest level-1 base.
    const m = manager();
    expect(hasExactActiveLevelRow(m, 50)).toBe(false);
    expect(effectiveActiveValue(m, progress(50))).toBe(10);
  });

  it("flags limitedData with a reason when the exact level row is missing", () => {
    const result = evaluateLineup([manager()], [progress(50)]);
    const rec = result.areaRecommendations["Mine Shaft"]?.[0];
    expect(rec?.limitedData).toBe(true);
    expect(rec?.missingData).toContain("exact active value at level 50");
  });

  it("does not flag limitedData when the exact level row exists", () => {
    const m = manager({ activeLevels: [{ level: 1, value: 10 }, { level: 50, value: 500 }, { level: 100, value: 1000 }] });
    const result = evaluateLineup([m], [progress(50)]);
    expect(result.areaRecommendations["Mine Shaft"]?.[0]?.limitedData).toBe(false);
  });
});

describe("invariant: no anonymous modifiers (formula lock)", () => {
  it("strengthScore equals the documented term sum", () => {
    const m = manager({ activeLevels: [{ level: 1, value: 10 }, { level: 30, value: 50 }, { level: 100, value: 1000 }] });
    const p = progress(30, { rank: 3, promoted: 1 });
    // strengthScore = log10(activeValue)*100 + level*1.5 + rank*20 + promoted*10 + rarityWeight
    // rarityWeight(rare) = 12; activeValue at level 30 = 50.
    const expected = Math.log10(50) * 100 + 30 * 1.5 + 3 * 20 + 1 * 10 + 12;
    expect(strengthScore(m, p)).toBeCloseTo(expected, 5);
  });

  it("rank effects are additive percentages, not hidden multipliers", () => {
    const m = manager({
      activeLevels: [{ level: 1, value: 10 }, { level: 30, value: 50 }],
      rankEffects: [{ rank: 3, activeIncrease: 0.46 }],
    });
    // 50 * (1 + 0.46) — documented additive percentage.
    expect(effectiveActiveValue(m, progress(30, { rank: 3 }))).toBeCloseTo(73, 5);
  });
});

describe("invariant: unresolved managers excluded with visible provenance", () => {
  it("keeps unlocked managers absent from the catalog in unevaluated", () => {
    const result = evaluateLineup([manager()], [progress(30, { managerId: "sm-99999" })]);
    expect(result.unevaluated.some((item) => item.managerId === "sm-99999")).toBe(true);
    expect(result.unevaluated[0]?.reason).toContain("not present in the verified catalog package");
  });

  it("never invents bonuses for missing catalog attributes", () => {
    const incomplete = manager({ active: undefined, activeLevels: undefined, rankEffects: undefined });
    const result = evaluateLineup([incomplete], [progress(30)]);
    const rec = result.areaRecommendations["Mine Shaft"]?.[0];
    expect(rec?.limitedData).toBe(true);
    expect(rec?.missingData).toContain("active.multiplier");
    // Score uses the documented base terms only (no fabricated active value).
    expect(rec?.score).toBeGreaterThanOrEqual(0);
  });
});
