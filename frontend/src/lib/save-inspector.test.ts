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
