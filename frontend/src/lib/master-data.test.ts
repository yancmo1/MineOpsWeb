import { describe, expect, it } from "vitest";
import { applyElementToActive, elementPairing, masterActiveValue, masterPassiveValue, masterRecordFor } from "./master-data";
import { buildEverdeepTeam } from "./everdeep-team";
import type { CatalogManager, PlayerManager } from "./db";

describe("master data", () => {
  it("resolves managers by gameId and gives exact level/rank actives", () => {
    const lilly = masterRecordFor({ gameId: 10008, name: "Dr. Lilly" });
    expect(lilly?.name).toBe("Dr. Lilly");
    const value = masterActiveValue(lilly!, 30, 3);
    expect(value).toBeGreaterThan(2.55);
    // rankInc grows the base: rank 5 beats rank 0 at the same level.
    expect(masterActiveValue(lilly!, 30, 5)!).toBeGreaterThan(masterActiveValue(lilly!, 30, 0)!);
  });

  it("covers the undocumented managers", () => {
    expect(masterRecordFor({ name: "Damian Jones" })).not.toBeNull();
    expect(masterRecordFor({ name: "Jade Kim" })).not.toBeNull();
  });

  it("applies element math the game's way", () => {
    expect(applyElementToActive(3, "SE")).toBeCloseTo(4.5);
    expect(applyElementToActive(3, "PE")).toBeCloseTo(2.2);
    expect(applyElementToActive(3, "NVE")).toBeCloseTo(1.4);
    const sue = masterRecordFor({ name: "Ranger Sue" })!;
    expect(elementPairing(sue, "sand", 0)?.effectiveness).toBe("SE");
    expect(elementPairing(sue, "dark", 0)?.unlocked).toBe(false);
  });

  it("reads passive tables by rarity, rank, promotion", () => {
    expect(masterPassiveValue("CR", "epic", 3, 3)).not.toBeNull();
  });
});

describe("everdeep team", () => {
  it("picks the strongest owned manager per area with element applied", () => {
    const catalog: CatalogManager[] = [
      { id: "a", name: "Dr. Lilly", rarity: "epic", type: "elevator", gameId: 10008, elements: [] },
      { id: "b", name: "Damian Jones", rarity: "epic", type: "elevator", gameId: 10029, elements: [] },
    ];
    const progress: PlayerManager[] = [
      { managerId: "a", level: 30, rank: 2, promoted: 1, fragments: 0, unlocked: true, updatedAt: "" },
      { managerId: "b", level: 30, rank: 4, promoted: 3, fragments: 0, unlocked: true, updatedAt: "" },
    ];
    const team = buildEverdeepTeam(catalog, progress, { mineshaft: null, elevator: "flame", warehouse: null });
    expect(team.picks).toHaveLength(1);
    expect(team.picks[0].manager.name).toBe("Dr. Lilly"); // Super Effective on flame beats a bigger base that is weak there
  });
});
