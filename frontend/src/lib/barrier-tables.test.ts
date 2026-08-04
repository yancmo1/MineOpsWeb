import { describe, expect, it } from "vitest";
import { prestigeTiming, verifiedBarrierTableFromDomain } from "./barrier-tables";
import type { StrategyEvaluation } from "./strategy";

describe("verifiedBarrierTableFromDomain", () => {
  it("reports unavailable with the reference-table reason when no barriers are emitted", () => {
    const status = verifiedBarrierTableFromDomain({ records: [] });
    expect(status.available).toBe(false);
    expect(status.barriers).toEqual([]);
    expect(status.reason).toContain("reference FRONTIER_BARRIERS");
  });

  it("parses a release-scoped verified table when emitted", () => {
    const status = verifiedBarrierTableFromDomain({
      barriers: [
        { tier: "I", shaft: 5, costAfter: 29, rewardFree: 0, rewardPremium: 0, rewardElite: 0 },
        { tier: "II", shaft: 10, costAfter: 103, rewardFree: 400, rewardPremium: 0, rewardElite: 0 },
        { tier: "III", shaft: 20, costAfter: 257, rewardFree: 700, rewardPremium: 0, rewardElite: 0 },
      ],
    });
    expect(status.available).toBe(true);
    expect(status.barriers).toHaveLength(3);
    expect(status.barriers[0]).toMatchObject({ id: "FM I 5", tier: "I", shaft: 5, costAfter: 29 });
    expect(status.barriers[2].reward.free).toBe(700);
  });

  it("fails validation when emitted rows are malformed", () => {
    const status = verifiedBarrierTableFromDomain({ barriers: [{ tier: 1, shaft: "x" }] });
    expect(status.available).toBe(false);
  });
});

describe("prestigeTiming", () => {
  const manager = (id: string, area: string) => ({
    id,
    name: id,
    rarity: "rare",
    type: area,
    elements: [],
    active: { multiplier: 10 },
  });
  const progress = (managerId: string) => ({ managerId, unlocked: true, level: 30, rank: 2, promoted: 1, fragments: 0, updatedAt: "" });
  const evaluation = (areas: string[]): StrategyEvaluation => ({
    areaRecommendations: Object.fromEntries(areas.map((area, i) => [area, [{ managerId: `m${i}`, name: `m${i}`, area, areaRank: 1, score: 100 + i, rarityScore: 1, levelValue: 1, rankValue: 1, activeValue: 1, upgradePriority: false, rationale: "", catalogVersion: "t", limitedData: false, missingData: [], equipmentBoost: 0 }]])),
    totalManagersConsidered: 1,
    unevaluated: [],
    upgradePriorities: [],
    catalogVersion: "t",
  } as unknown as StrategyEvaluation);

  it("reports roster readiness and never claims income-timing math", () => {
    const catalog = [manager("a", "Mine Shaft"), manager("b", "Elevator"), manager("c", "Warehouse")];
    const timing = prestigeTiming(catalog, [progress("a"), progress("b"), progress("c")], evaluation(["Mine Shaft", "Elevator", "Warehouse"]));
    expect(timing.ready).toBe(true);
    expect(timing.areasCovered).toBe(3);
    expect(timing.checklist.some((item) => item.includes("All three"))).toBe(true);
    expect(timing.note).toContain("not decoded");
  });

  it("identifies the weakest covered area and flags missing coverage", () => {
    const catalog = [manager("a", "Mine Shaft"), manager("b", "Elevator")];
    const timing = prestigeTiming(catalog, [progress("a"), progress("b")], evaluation(["Mine Shaft", "Elevator"]));
    expect(timing.areasCovered).toBe(2);
    expect(timing.bottleneckArea).toBe("Mine Shaft");
    expect(timing.checklist.some((item) => item.includes("2/3"))).toBe(true);
  });
});
