import { describe, expect, it } from "vitest";
import { bigNumberToValue, extractMineState } from "./mine-state";

const root = {
  Data: {
    Mines: [
      {
        MineNumber: 3, PrestigeCount: 2, Selected: true,
        Elevator: { Id: 1, Level: 210 }, Ground: { Id: 2, Level: 180, NumberOfWorkers: 4 },
        Tier: { Corridors: [] },
        IdleSavegame: { BigIdleCashWithoutBuffsPerSec: { m: 1.5, e: 45 } },
        BigCashPerSecondWhenClosed: { m: 2, e: 45 }, BigCashStored: { m: 5, e: 47 },
      },
    ],
    ProgressionSavegames: [{ MineId: 3, ElevatorLevel: 210, WarehouseLevel: 180, CorridorLevels: [400, 380] }],
    ContinentSavegame: { UnlockSavegames: [{ ContinentType: 0 }, { ContinentType: 1 }] },
    SuperManagers: { Assignments: [{ ManagerId: 10001, MineNumber: 3, Area: "Elevator", Tier: 0 }] },
  },
};

describe("extractMineState", () => {
  it("reads mine levels, idle cash, continents, and assignments", () => {
    const state = extractMineState(root);
    expect(state.mines).toHaveLength(1);
    expect(state.mines[0]).toMatchObject({ mineNumber: 3, elevatorLevel: 210, warehouseLevel: 180, prestigeCount: 2, selected: true });
    expect(state.mines[0].corridorLevels).toEqual([400, 380]);
    expect(state.mines[0].idleCashPerSecond).toBeCloseTo(1.5e45, -30);
    expect(state.unlockedContinentTypes).toEqual([0, 1]);
    expect(state.assignments[0]).toMatchObject({ managerId: 10001, mineNumber: 3, area: "Elevator" });
  });

  it("converts {m, e} big numbers and tolerates plain numbers", () => {
    expect(bigNumberToValue({ m: 6.84, e: 42 })).toBeCloseTo(6.84e42, -30);
    expect(bigNumberToValue(12)).toBe(12);
    expect(bigNumberToValue("x")).toBeNull();
  });
});
