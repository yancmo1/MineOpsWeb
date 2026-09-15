import { describe, expect, it } from "vitest";
import type { CatalogManager, PlayerManager } from "./db";
import { buildTrackerBackup, serializeTrackerBackup, trackerKeyForManager, trackerKeyForName } from "./tracker-export";

const catalog: CatalogManager[] = [
  { id: "sm-10003", name: "Dr. Steiner", rarity: "legendary", type: "Mine Shaft", elements: [] },
  { id: "sm-10004", name: "Samantha Reiss", rarity: "legendary", type: "Warehouse", elements: [] },
];

const progress: PlayerManager[] = [{
  managerId: "sm-10003",
  unlocked: true,
  level: 30,
  rank: 3,
  promoted: 2,
  fragments: 17,
  updatedAt: "2026-09-14T00:00:00.000Z",
}];

describe("Idle Master's Hub tracker export", () => {
  it("converts display names to the target site's slug keys", () => {
    expect(trackerKeyForName("Dr. Steiner")).toBe("dr-steiner");
    expect(trackerKeyForName("Luna & Stella")).toBe("luna-and-stella");
    expect(trackerKeyForName("King O'Rekk")).toBe("king-orekk");
  });

  it("uses the target site's known aliases and skips duplicate variants", () => {
    expect(trackerKeyForManager({ id: "sm-10089", name: "H4V0C", rarity: "epic", type: "Mine Shaft", elements: [] })).toBe("h4v0c");
    expect(trackerKeyForManager({ id: "sm-10119", name: "Paige Cogsmith", rarity: "epic", type: "Mine Shaft", elements: [] })).toBe("paige-cogsmith");
    expect(trackerKeyForManager({ id: "sm-10054", name: "Robot", rarity: "rare", type: "Mine Shaft", elements: [] })).toBe("1dl3");
    expect(trackerKeyForManager({ id: "sm-10066", name: "Altitude", rarity: "rare", type: "Warehouse", elements: [] })).toBe("al-titude");
    expect(trackerKeyForManager({ id: "sm-10033", name: "Prof Maple", rarity: "epic", type: "Mine Shaft", elements: [] })).toBe("professor-maple");
    const backup = buildTrackerBackup([
      { id: "sm-10028", name: "Rabbid Blingsley", rarity: "epic", type: "Mine Shaft", elements: [] },
      { id: "sm-10025", name: "Rabbid Blingsley", rarity: "epic", type: "Mine Shaft", elements: [] },
    ], []);
    expect(Object.keys(backup)).toEqual(["rabbit-blingsley"]);
  });

  it("uses the corrected canonical identity for 1DL3", () => {
    expect(trackerKeyForManager({ id: "sm-10054", name: "1DL3", rarity: "rare", type: "Mine Shaft", elements: [] })).toBe("1dl3");
  });

  it("emits the strict flat manager format and preserves catalog order", () => {
    const backup = buildTrackerBackup(catalog, progress);

    expect(Object.keys(backup)).toEqual(["dr-steiner", "samantha-reiss"]);
    expect(backup["dr-steiner"]).toEqual({
      unlocked: true,
      rank: 3,
      level: 30,
      promoted: 2,
      fragments: 17,
      chronoExcluded: false,
      tierlistExcluded: false,
    });
    expect(backup["samantha-reiss"]).toEqual({
      unlocked: false,
      rank: 0,
      level: 1,
      promoted: 0,
      fragments: 0,
      chronoExcluded: false,
      tierlistExcluded: false,
    });
    expect(backup["sm-10003"]).toBeUndefined();
  });

  it("serializes valid JSON without adding app metadata", () => {
    const parsed: unknown = JSON.parse(serializeTrackerBackup(buildTrackerBackup(catalog, progress)));
    expect(parsed).toEqual(buildTrackerBackup(catalog, progress));
    expect(serializeTrackerBackup(buildTrackerBackup(catalog, progress))).toMatch(/\n$/);
  });
});
