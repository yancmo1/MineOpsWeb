import { describe, expect, it } from "vitest";
import { rankPlays, bestPlay, loadMines, DEFAULT_MINES, type MineProfile } from "./mission-board";
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

  it("ranks Shaft-Ahead top when shafts are the strongest leg", () => {
    const plays = rankPlays(catalog, fullRoster, { mineshaft: 200, elevator: 40, warehouse: 30 });
    expect(bestPlay(plays)?.id).toBe("shaft-ahead-rotation");
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
