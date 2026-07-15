import { describe, expect, it } from "vitest";
import { rankThreshold, strengthScore, type CatalogManager, type PlayerManager } from "./db";

const manager: CatalogManager = { id: "sir_lorenzo", name: "Sir Lorenzo", rarity: "Legendary", type: "Mine Shaft", elements: [], active: { multiplier: 10 } };
const progress: PlayerManager = { managerId: manager.id, level: 10, rank: 2, promoted: 2, fragments: 50, unlocked: true, updatedAt: new Date().toISOString() };

describe("iOS-derived manager calculations", () => {
  it("uses the documented rank thresholds", () => { expect(rankThreshold(0)).toBe(15); expect(rankThreshold(1)).toBe(30); expect(rankThreshold(2)).toBe(50); expect(rankThreshold(3)).toBe(80); expect(rankThreshold(4)).toBeUndefined(); });
  it("returns a deterministic score from active value and progress", () => { expect(strengthScore(manager, progress)).toBeCloseTo(Math.log10(10) * 100 + 15 + 40 + 20 + 25); });
});
