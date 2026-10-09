import { describe, expect, it } from "vitest";
import { rankPlays, bestPlay, loadMines, DEFAULT_MINES, effectiveRates, minesFromCatalogDomain, type MineProfile } from "./mission-board";
import type { CatalogManager, PlayerManager } from "./db";

const catalog: CatalogManager[] = [
  { id: "ranger-sue", name: "Ranger Sue", rarity: "legendary", type: "Mine Shaft", elements: [], active: { multiplier: 5, duration: 60, cooldown: 900 } },
  { id: "mr-turner", name: "Mr Turner", rarity: "legendary", type: "Mine Shaft", elements: [] },
  { id: "blingsley", name: "Blingsley", rarity: "epic", type: "Mine Shaft", elements: [] },
  { id: "dr-steiner", name: "Dr Steiner", rarity: "epic", type: "Mine Shaft", elements: [] },
  { id: "dr-lilly", name: "Dr Lilly", rarity: "epic", type: "Elevator", elements: [] },
  { id: "zi-galvani", name: "Zi Galvani", rarity: "legendary", type: "Mine Shaft", elements: [] },
  { id: "luxario", name: "Luxario", rarity: "legendary", type: "Warehouse", elements: [] },
];

function progress(ids: string[]): PlayerManager[] {
  return ids.map((id) => ({ managerId: id, level: 30, rank: 4, promoted: 3, fragments: 0, unlocked: true, updatedAt: "2026-10-08" }));
}

const fullRoster = progress(catalog.map((m) => m.id));

describe("rankPlays", () => {
  it("ranks the Lilly Elevator-Ahead play top in an elevator-strong mine", () => {
    const plays = rankPlays(catalog, fullRoster, { mineshaft: 7, elevator: 122, warehouse: 18 });
    expect(bestPlay(plays)?.id).toBe("elevator-ahead-lilly");
    expect(plays[0].playable).toBe(true);
  });

  it("keeps researched ceiling order ahead of a one-off rate fit", () => {
    const plays = rankPlays(catalog, fullRoster, { mineshaft: 200, elevator: 40, warehouse: 30 });
    expect(bestPlay(plays)?.id).toBe("elevator-ahead-lilly");
    expect(plays.find((p) => p.id === "shaft-ahead-rotation")?.profitabilityRank).toBe(5);
    expect(plays.find((p) => p.id === "elevator-ahead-lilly")?.howToRun.length).toBeGreaterThan(2);
  });

  it("marks locked chains unplayable with missing managers named", () => {
    const plays = rankPlays(catalog, fullRoster, { mineshaft: 7, elevator: 122, warehouse: 18 });
    const ic = plays.find((p) => p.id === "instant-cash-chain")!;
    expect(ic.playable).toBe(false);
    expect(ic.missing.join(" ")).toMatch(/Axiom/i);
  });

  it("uses bottleneck pace (min leg) for Balanced when rates exist", () => {
    const plays = rankPlays(catalog, fullRoster, { mineshaft: 7, elevator: 122, warehouse: 18 });
    const balanced = plays.find((p) => p.id === "balanced-idle")!;
    expect(balanced.bottleneckPace).toBe(7);
  });

  it("keeps every strategy present regardless of mine shape", () => {
    const plays = rankPlays(catalog, fullRoster, { mineshaft: null, elevator: null, warehouse: null });
    expect(plays.length).toBe(6);
    expect(plays.find((p) => p.id === "balanced-idle")?.paceScore).toBeNull();
  });
});

describe("mine profiles", () => {
  it("falls back to defaults with no stored mines", () => {
    const mines: MineProfile[] = loadMines({ getItem: () => null });
    expect(mines).toEqual(DEFAULT_MINES);
  });
});


describe("mine list and multipliers", () => {
  it("builds the mine list from the current catalog continent identities plus modes", () => {
    const mines = minesFromCatalogDomain({ continents: [{ continentType: 0, name: "Start" }, { continentType: 1, name: "Ice" }, { continentType: 99, name: "Bad" }] });
    expect(mines.map((m) => m.name)).toEqual(["Start", "Ice", "Bad", "Everdeep", "Frontier Mine"]);
    expect(mines[0].source).toBe("catalog");
  });

  it("applies per-leg multipliers only to burst pace fields", () => {
    expect(effectiveRates({ mineshaft: 10, elevator: 20, warehouse: 5 }, { mineshaft: 2, elevator: 3, warehouse: 4 })).toEqual({ mineshaft: 20, elevator: 60, warehouse: 20 });
  });
});

describe("catalog merge keeps save mines", () => {
  it("keeps the player's mainland save mines at the head of the list", async () => {
    const { minesFromCatalogDomain } = await import("./mission-board");
    const stored = [
      { id: "save-3", name: "Ruby", kind: "continent" as const, source: "save" as const,
        rates: { mineshaft: null, elevator: null, warehouse: null },
        multipliers: { mineshaft: 1, elevator: 1, warehouse: 1 } },
    ];
    const domain = { continents: [{ continentType: 0, name: "Start" }] };
    const next = minesFromCatalogDomain(domain, stored as never);
    expect(next[0].id).toBe("save-3");
    expect(next.some((m) => m.id === "continent-0")).toBe(true);
    expect(next.some((m) => m.id === "everdeep")).toBe(true);
  });
});
