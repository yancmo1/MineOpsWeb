import { describe, expect, it } from "vitest";
import { buildUpgradeRoi, levelGain, nextUsefulInvestment } from "./upgrade-roi";
import type { CatalogManager, PlayerManager } from "./db";

function manager(overrides: Partial<CatalogManager> = {}): CatalogManager {
  return {
    id: "sm-10001",
    name: "Lee Vatori",
    rarity: "rare",
    type: "Mine Shaft",
    elements: [],
    active: { multiplier: 4.25 },
    activeLevels: [
      { level: 1, value: 4.25 },
      { level: 10, value: 6.5 },
      { level: 11, value: 6.8 },
      { level: 20, value: 12.0 },
    ],
    promotions: [
      { level: 10, promotion: 1, cost: 5, unlocksPassive: true, passiveId: 1007 },
      { level: 20, promotion: 2, cost: 3040, unlocksPassive: false },
    ],
    passives: [{ passiveId: 1007, type: "Mine Income Factor", multiplier: 1.44 }],
    rankEffects: [{ rank: 1, activeIncrease: 0.1 }],
    ...overrides,
  };
}

function progress(level = 9, rank = 0, promoted = 0, fragments = 0): PlayerManager {
  return { managerId: "sm-10001", unlocked: true, level, rank, promoted, fragments, updatedAt: "" };
}

describe("levelGain (exact rows)", () => {
  it("computes the marginal active gain from exact rows", () => {
    expect(levelGain(manager(), 10)).toBeCloseTo(0.3, 5); // 6.8 - 6.5
    expect(levelGain(manager(), 20)).toBeNull(); // no level-21 row
  });
});

describe("buildUpgradeRoi", () => {
  it("produces level, promotion, and rank items with verified data", () => {
    const items = buildUpgradeRoi([manager()], [progress(10, 0, 0, 5)]);
    const kinds = items.map((item) => item.kind);
    expect(kinds).toContain("level");
    expect(kinds).toContain("promotion");
    expect(kinds).toContain("rank");

    const level = items.find((item) => item.kind === "level");
    expect(level?.gain).toBeCloseTo(0.3, 5); // level 10 → 11: 6.8 - 6.5
    const promo = items.find((item) => item.kind === "promotion");
    expect(promo?.cost).toBe(5);
    expect(promo?.unlocksPassive).toBe(true);
    expect(promo?.gain).toBeCloseTo(1.44, 5);
    const rank = items.find((item) => item.kind === "rank");
    expect(rank?.cost).toBe(10); // rankThreshold(0)=15 - 5 fragments
    expect(rank?.gain).toBeCloseTo(0.1, 5);
  });

  it("sorts ROI-known items first and best-gain-first within ties", () => {
    // Promotion has ROI = 1.44/5 = 0.288; rank has 0.1/10 = 0.01; level ROI null.
    const items = buildUpgradeRoi([manager()], [progress(10, 0, 0, 5)]);
    expect(items[0].kind).toBe("promotion");
    expect(items[0].roi).toBeCloseTo(0.288, 3);
  });

  it("marks level cost as unknown instead of fabricating a curve", () => {
    const items = buildUpgradeRoi([manager()], [progress(10, 0, 0, 5)]);
    const level = items.find((item) => item.kind === "level");
    expect(level?.cost).toBeNull();
    expect(level?.rationale).toContain("not published yet");
  });

  it("skips locked managers and managers absent from the catalog", () => {
    const locked = { ...progress(9), unlocked: false };
    const absent = { ...progress(9), managerId: "sm-99999" };
    expect(buildUpgradeRoi([manager()], [locked, absent])).toHaveLength(0);
  });

  it("nextUsefulInvestment returns the top ranked item", () => {
    const items = buildUpgradeRoi([manager()], [progress(10, 0, 0, 5)]);
    expect(nextUsefulInvestment(items)?.kind).toBe("promotion");
    expect(nextUsefulInvestment([])).toBeNull();
  });
});
