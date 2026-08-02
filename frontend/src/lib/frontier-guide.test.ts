import { describe, expect, it } from "vitest";
import { buildFrontierRoster, planFrontierCheckpoints } from "./frontier-guide";
import type { CatalogManager, PlayerManager } from "./db";

function manager(overrides: Partial<CatalogManager> & { id: string }): CatalogManager {
  return { name: overrides.id, rarity: "Rare", type: "Mine Shaft", elements: [], ...overrides };
}

function player(managerId: string, overrides: Partial<PlayerManager> = {}): PlayerManager {
  return { managerId, level: 10, rank: 0, promoted: 0, fragments: 0, unlocked: true, updatedAt: "2026-08-01T00:00:00Z", ...overrides };
}

describe("Frontier checkpoint planning", () => {
  it("spends FC and applies checkpoint rewards in order", () => {
    const result = planFrontierCheckpoints("FM I 25", 119, "free");
    expect(result.furthest).toBe("FM I 25");
    expect(result.next?.id).toBe("FM II 5");
    expect(result.remainingFc).toBe(0);
  });

  it("uses premium and elite reward paths without changing barrier costs", () => {
    const free = planFrontierCheckpoints("FM II 5", 83, "free");
    const elite = planFrontierCheckpoints("FM II 5", 83, "elite");
    expect(free.rows[0].balanceAfter).toBe(400);
    expect(elite.rows[0].balanceAfter).toBe(500);
    expect(elite.furthest).not.toBe(free.furthest);
  });

  it("does not invent progress when the next barrier is unaffordable", () => {
    const result = planFrontierCheckpoints("FM V 25", 100, "free");
    expect(result.furthest).toBeNull();
    expect(result.next?.id).toBe("FM V 25");
    expect(result.rows[0].cleared).toBe(false);
  });
});

describe("Frontier roster guidance", () => {
  it("surfaces passive and cost-reduction signals from owned manager data", () => {
    const catalog = [
      manager({ id: "sue", name: "Ranger Sue", passives: [{ description: "Mine Income Factor +20%" }] }),
      manager({ id: "goodman", name: "Goodman Jr.", passives: [{ description: "Mine upgrade cost reduction" }] }),
    ];
    const roster = buildFrontierRoster(catalog, [player("sue"), player("goodman")]);
    expect(roster[0].tags).toContain("Income passive");
    expect(roster[1].tags).toContain("Upgrade-cost reduction");
  });
});
