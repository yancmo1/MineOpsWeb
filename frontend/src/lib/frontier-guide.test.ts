import { describe, expect, it } from "vitest";
import { buildFrontierRoster, planFrontierCheckpoints, recommendFrontierAction } from "./frontier-guide";
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

  it("uses the entered live cost for the current barrier only", () => {
    const result = planFrontierCheckpoints("FM I 25", 100, "free", 95);
    expect(result.rows[0].cost).toBe(95);
    expect(result.nextCost).toBe(83);
  });
});

describe("Frontier live next-action recommendation", () => {
  const base = {
    currentCost: 600,
    frontierCredits: 600,
    freeSkips: 0,
    timeJumps: 0,
  };

  it("recommends waiting through a short timer", () => {
    const result = recommendFrontierAction({ ...base, remainingWaitMinutes: 5 });
    expect(result.action).toBe("wait");
    expect(result.resource).toBe("none");
    expect(result.reason).toContain("5 minutes");
  });

  it("recommends spending FC when a long wait is affordable", () => {
    const result = recommendFrontierAction({ ...base, remainingWaitMinutes: 30 });
    expect(result.action).toBe("spend_fc");
    expect(result.resource).toBe("frontier-credits");
    expect(result.fcShortfall).toBe(0);
  });

  it("recommends a burst when the timer is already open", () => {
    const result = recommendFrontierAction({ ...base, remainingWaitMinutes: 0 });
    expect(result.action).toBe("run_burst");
    expect(result.resource).toBe("none");
  });

  it("uses a free skip or Time Jump before spending FC on a long wait", () => {
    const skip = recommendFrontierAction({ ...base, remainingWaitMinutes: 30, freeSkips: 1 });
    const jump = recommendFrontierAction({ ...base, remainingWaitMinutes: 30, timeJumps: 1 });
    expect(skip.action).toBe("run_burst");
    expect(skip.resource).toBe("free-skip");
    expect(jump.action).toBe("run_burst");
    expect(jump.resource).toBe("time-jump");
  });

  it("does not recommend an FC spend without a live cost", () => {
    const result = recommendFrontierAction({ ...base, currentCost: null, remainingWaitMinutes: 30 });
    expect(result.action).toBe("wait");
    expect(result.title).toBe("Wait");
    expect(result.reason).toContain("Enter the live barrier cost");
  });

  it("asks for the live wait instead of assuming the timer is open", () => {
    const result = recommendFrontierAction({ ...base, remainingWaitMinutes: null });
    expect(result.action).toBe("wait");
    expect(result.title).toBe("Enter live wait time");
  });
});

describe("Frontier roster guidance", () => {
  it("surfaces passive and cost-reduction signals from owned manager data", () => {
    const catalog = [
      manager({ id: "sue", name: "Ranger Sue", passives: [{ description: "Mine Income Factor +20%", unlockLevel: 10 }] }),
      manager({ id: "goodman", name: "Goodman Jr.", passives: [{ description: "Mine upgrade cost reduction", unlockLevel: 10 }] }),
    ];
    const roster = buildFrontierRoster(catalog, [player("sue"), player("goodman")]);
    expect(roster[0].tags).toContain("Income passive");
    expect(roster[1].tags).toContain("Upgrade-cost reduction");
  });

  it("only uses passives unlocked by the player's promotion", () => {
    const catalog = [manager({
      id: "turner",
      name: "Mr. Turner",
      passives: [{ type: "MIF", description: "Mine Income Factor", multiplier: 1.44, promoReq: 3 }],
    })];

    const beforeUnlock = buildFrontierRoster(catalog, [player("turner", { level: 29, promoted: 2 })]);
    const afterUnlock = buildFrontierRoster(catalog, [player("turner", { level: 30, promoted: 3 })]);
    expect(beforeUnlock[0].tags).not.toContain("Income passive");
    expect(afterUnlock[0].tags).toContain("Income passive");
  });
});
