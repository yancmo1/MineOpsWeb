import { describe, expect, it } from "vitest";
import { rankThreshold, strengthScore, effectiveActiveValue, rarityWeight, raritySortWeight, isRankUpReady, type CatalogManager, type PlayerManager } from "./db";

const manager: CatalogManager = { id: "sir_lorenzo", name: "Sir Lorenzo", rarity: "Legendary", type: "Mine Shaft", elements: [], active: { multiplier: 10 } };
const progress: PlayerManager = { managerId: manager.id, level: 10, rank: 2, promoted: 2, fragments: 50, unlocked: true, updatedAt: new Date().toISOString() };

const managerWithScaling: CatalogManager = { id: "dr_steiner", name: "Dr Steiner", rarity: "Epic", type: "Mine Shaft", elements: [], active: { multiplier: 5, multiplierAt100: 80 } };

describe("iOS-derived manager calculations", () => {
  it("uses the documented rank thresholds", () => { expect(rankThreshold(0)).toBe(15); expect(rankThreshold(1)).toBe(30); expect(rankThreshold(2)).toBe(50); expect(rankThreshold(3)).toBe(80); expect(rankThreshold(4)).toBeUndefined(); });
  it("returns a deterministic score from effective active value and progress", () => { expect(strengthScore(manager, progress)).toBeCloseTo(Math.log10(10) * 100 + 15 + 40 + 20 + 25, 1); });
  it("effectiveActiveValue falls back to active.multiplier when no multiplierAt100", () => { expect(effectiveActiveValue(manager, progress)).toBe(10); });
  it("effectiveActiveValue never interpolates: uses level-1 base when no exact row exists", () => {
    const p: PlayerManager = { managerId: "dr_steiner", level: 50, rank: 0, promoted: 0, fragments: 0, unlocked: true, updatedAt: "" };
    // No activeLevels table → the documented level-1 base (5) is returned.
    // Linear interpolation (5 + (80-5)*0.5 = 42.5) is intentionally forbidden.
    expect(effectiveActiveValue(managerWithScaling, p)).toBe(5);
  });
  it("effectiveActiveValue uses the exact row when present (any level)", () => {
    const exact: CatalogManager = {
      id: "dr_steiner", name: "Dr Steiner", rarity: "Epic", type: "Mine Shaft", elements: [],
      active: { multiplier: 5, multiplierAt100: 80 },
      activeLevels: [{ level: 50, value: 42.5 }, { level: 999, value: 80 }],
    };
    const p: PlayerManager = { managerId: "dr_steiner", level: 50, rank: 0, promoted: 0, fragments: 0, unlocked: true, updatedAt: "" };
    expect(effectiveActiveValue(exact, p)).toBe(42.5);
  });
  it("rarityWeight returns correct weights", () => { expect(rarityWeight("Legendary")).toBe(25); expect(rarityWeight("Epic")).toBe(18); expect(rarityWeight("Rare")).toBe(12); expect(rarityWeight("Common")).toBe(6); expect(rarityWeight("Unknown")).toBe(0); });
  it("raritySortWeight returns integer sort weights", () => { expect(raritySortWeight("Legendary")).toBe(4); expect(raritySortWeight("Epic")).toBe(3); expect(raritySortWeight("Rare")).toBe(2); expect(raritySortWeight("Common")).toBe(1); expect(raritySortWeight("Unknown")).toBe(0); });
  it("isRankUpReady returns true when fragments >= threshold", () => {
    const p: PlayerManager = { managerId: "test", level: 1, rank: 0, promoted: 0, fragments: 15, unlocked: true, updatedAt: "" };
    expect(isRankUpReady(p)).toBe(true);
  });
  it("isRankUpReady returns false when fragments < threshold", () => {
    const p: PlayerManager = { managerId: "test", level: 1, rank: 0, promoted: 0, fragments: 14, unlocked: true, updatedAt: "" };
    expect(isRankUpReady(p)).toBe(false);
  });
  it("isRankUpReady returns false for locked managers", () => {
    const p: PlayerManager = { managerId: "test", level: 1, rank: 0, promoted: 0, fragments: 999, unlocked: false, updatedAt: "" };
    expect(isRankUpReady(p)).toBe(false);
  });
  it("isRankUpReady returns false for unknown rank thresholds", () => {
    const p: PlayerManager = { managerId: "test", level: 1, rank: 999, promoted: 0, fragments: 999, unlocked: true, updatedAt: "" };
    expect(isRankUpReady(p)).toBe(false);
  });
});
