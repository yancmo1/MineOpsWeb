import { describe, expect, it } from "vitest";
import { buildBalancedLineup, coverageTagsFor, elementNotesFor } from "./lineup";
import { evaluateLineup } from "./strategy";
import { buildFrontierRoster } from "./frontier-guide";
import type { CatalogManager, PlayerManager } from "./db";

function manager(id: string, type: string, multiplier: number, rarity = "rare", gameId?: number): CatalogManager {
  return {
    id,
    name: `Manager ${id}`,
    rarity,
    type,
    elements: [],
    gameId,
    active: { multiplier, multiplierAt100: multiplier * 10 },
    activeLevels: [{ level: 1, value: multiplier }, { level: 30, value: multiplier * 3 }],
    passives: [{ passiveId: 1007, type: "Mine Income Factor", multiplier: 1.44, promoReq: 1, unlockLevel: 30 }],
  };
}

function progress(managerId: string, level = 30, rank = 2): PlayerManager {
  return { managerId, unlocked: true, level, rank, promoted: 1, fragments: 0, updatedAt: "" };
}

describe("buildBalancedLineup", () => {
  const shaftA = manager("sm-10001", "Mine Shaft", 10, "rare");
  const shaftB = manager("sm-10002", "Mine Shaft", 8, "common");
  const elevator = manager("sm-10003", "Elevator", 12, "legendary");
  const catalog = [shaftA, shaftB, elevator];
  const players = [progress("sm-10001"), progress("sm-10002"), progress("sm-10003")];

  it("ranks multiple picks per area (not just the top one)", () => {
    const evaluation = evaluateLineup(catalog, players);
    const roster = buildFrontierRoster(catalog, players);
    const lineups = buildBalancedLineup(catalog, evaluation, roster);
    const shaft = lineups.find((lineup) => lineup.area === "Mine Shaft");
    expect(shaft).toBeDefined();
    expect(shaft!.picks.length).toBeGreaterThanOrEqual(2);
    expect(shaft!.picks[0].rank).toBe(1);
    expect(shaft!.picks[0].score).toBeGreaterThan(shaft!.picks[1].score);
  });

  it("attaches coverage roles from the frontier roster classification", () => {
    const evaluation = evaluateLineup(catalog, players);
    const roster = buildFrontierRoster(catalog, players);
    const lineups = buildBalancedLineup(catalog, evaluation, roster);
    const first = lineups[0].picks[0];
    // Income-passive managers (MIF passive) get the tag from the roster.
    expect(first.coverageTags.some((tag) => /income/i.test(tag))).toBe(true);
    expect(first.why).toContain("verified score");
  });

  it("applies equipment boost to the why text when present", () => {
    const evaluation = evaluateLineup(catalog, players, null, new Map([[14091, 0.05]]));
    const roster = buildFrontierRoster(catalog, players);
    const lineups = buildBalancedLineup(catalog, evaluation, roster);
    // No player has equipment assigned here, so no boost text appears.
    for (const lineup of lineups) {
      for (const pick of lineup.picks) {
        expect(pick.equipmentBoost).toBe(0);
        expect(pick.why).not.toContain("equipment");
      }
    }
  });

  it("adds reference-only element notes when enrichment exists", () => {
    // Asterion (10061) has SE elements in the enrichment table.
    const asterion = manager("sm-10061", "Mine Shaft", 15, "legendary", 10061);
    const evaluation = evaluateLineup([asterion], [progress("sm-10061")]);
    const lineups = buildBalancedLineup([asterion], evaluation, []);
    expect(lineups[0].picks[0].elementNotes[0]).toContain("Reference only");
  });

  it("returns an empty list when no recommendations exist", () => {
    expect(buildBalancedLineup([], { areaRecommendations: {} } as never, [])).toHaveLength(0);
  });
});

describe("helpers", () => {
  it("coverageTagsFor finds the roster entry", () => {
    const roster = [{ managerId: "sm-10001", tags: ["Income passive"] }] as never as Array<{ managerId: string; tags: string[] }>;
    expect(coverageTagsFor("sm-10001", roster as never)).toEqual(["Income passive"]);
    expect(coverageTagsFor("sm-99999", roster as never)).toEqual([]);
  });

  it("elementNotesFor returns nothing without a gameId or enrichment", () => {
    expect(elementNotesFor(undefined)).toEqual([]);
    expect(elementNotesFor(manager("sm-10001", "Mine Shaft", 10))).toEqual([]);
  });
});
