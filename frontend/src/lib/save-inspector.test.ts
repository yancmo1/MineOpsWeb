import { describe, expect, it } from "vitest";
import { summarizeSave, formatSaveReport } from "./save-structure";

describe("summarizeSave", () => {
  it("lists drawer names, kinds, counts, and field names without values", () => {
    const structure = summarizeSave({ Data: { SuperManagers: { Managers: [{ Id: 1, Level: 30 }] }, MineSavegame: [{ Continent: 2, Shafts: [] }], SomeNumber: 42 }, Other: true });
    expect(structure.rootKeys).toEqual(["Data", "Other"]);
    const mine = structure.sections.find((s) => s.key === "MineSavegame")!;
    expect(mine.kind).toBe("list");
    expect(mine.count).toBe(1);
    expect(mine.fieldNames).toEqual(["Continent", "Shafts"]);
    expect(mine.interesting).toBe(true);
    expect(structure.sections[0].key).toBe("MineSavegame");
    const report = formatSaveReport(structure);
    expect(report).not.toContain("30");
    expect(report).toContain("MineSavegame");
  });
});

describe("deep peek", () => {
  it("expands one level inside mine-related drawers, names only", () => {
    const structure = summarizeSave({ Data: { Mines: [{ Elevator: { Level: 5, Workers: [1] }, Ground: { Shafts: [{ Depth: 1 }] } }] } });
    const mines = structure.sections.find((s) => s.key === "Mines")!;
    expect(mines.children.map((c) => c.key)).toEqual(["Elevator", "Ground"]);
    expect(mines.children[0].fieldNames).toEqual(["Level", "Workers"]);
  });
});

describe("mine id labels", () => {
  it("collects only MineId/MineNumber/ContinentType numbers", () => {
    const structure = summarizeSave({ Data: {
      ProgressionSavegames: [{ MineId: 1002, ElevatorLevel: 5 }],
      Mines: [{ MineNumber: 3, PrestigeCount: 9 }],
      ContinentSavegame: { UnlockSavegames: [{ ContinentType: 1, HasClaimedRewards: true }] },
    } });
    expect(structure.mineIds.progressionMineIds).toEqual([1002]);
    expect(structure.mineIds.saveMineNumbers).toEqual([3]);
    expect(structure.mineIds.continentTypes).toEqual([1]);
    const report = formatSaveReport(structure);
    expect(report).toContain("progression=[1002]");
    expect(report).not.toContain("PrestigeCount: 9");
  });
});

describe("mine table", () => {
  it("lists prestige and building levels per mine number, sorted", () => {
    const structure = summarizeSave({ Data: { Mines: [
      { MineNumber: 6000, PrestigeCount: 39, Selected: true, Elevator: { Level: 1832 }, Ground: { Level: 1813 }, MineRegion: { CurrentOrder: 0, UnlockState: 2 } },
      { MineNumber: 3, PrestigeCount: 5, Elevator: { Level: 2183 }, Ground: { Level: 2186 }, MineRegion: { CurrentOrder: 2, UnlockState: 2 } },
    ] } });
    expect(structure.mineTable).toEqual([
      "mine 3: prestige 5, elevator 2183, warehouse 2186, selected 0, regionOrder 2, unlockState 2, idleBase -/s, idleClosed -/s, idlePossible -/s, stored -",
      "mine 6000: prestige 39, elevator 1832, warehouse 1813, selected 1, regionOrder 0, unlockState 2, idleBase -/s, idleClosed -/s, idlePossible -/s, stored -",
    ]);
    expect(formatSaveReport(structure)).toContain("Mine table (prestige + levels only, no cash):");
  });
});
