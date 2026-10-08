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

describe("decodeMineNumber", () => {
  it("names normal mines in blocks of five per continent", async () => {
    const { decodeMineNumber } = await import("./mine-state");
    expect(decodeMineNumber(1)).toMatchObject({ continentType: 0, label: "Coal", special: false });
    expect(decodeMineNumber(3)).toMatchObject({ continentType: 0, label: "Ruby" });
    expect(decodeMineNumber(8)).toMatchObject({ continentType: 1, label: "Crystal" });
    expect(decodeMineNumber(10)).toMatchObject({ continentType: 1, label: "Sapphire" });
    expect(decodeMineNumber(13)).toMatchObject({ continentType: 2, label: "Sunstone" });
    expect(decodeMineNumber(40)).toMatchObject({ continentType: 7, label: "Abyss" });
  });

  it("labels specials honestly instead of inventing names", async () => {
    const { decodeMineNumber } = await import("./mine-state");
    expect(decodeMineNumber(5003)).toMatchObject({ continentType: 5, label: "Ancient · Special 3", special: true });
    expect(decodeMineNumber(6000)).toMatchObject({ continentType: 9000, label: "Everdeep", special: true });
    expect(decodeMineNumber(110001)).toMatchObject({ label: "Special mine 110001", special: true });
    expect(decodeMineNumber(null)).toBeNull();
  });

  it("gives Everdeep its own group, not Lost Desert", async () => {
    const { groupMinesByContinent } = await import("./mine-state");
    const mine = (mineNumber: number) => ({
      mineNumber, elevatorLevel: null, warehouseLevel: null, corridorLevels: [],
      idleCashPerSecond: null, cashPerSecondWhenClosed: null, cashStored: null,
      prestigeCount: null, idleBoost: 1,
    }) as never;
    const groups = groupMinesByContinent([mine(31), mine(6000)]);
    const lostDesert = groups.find((g) => g.name === "Lost Desert");
    const everdeep = groups.find((g) => g.name === "Everdeep");
    expect(lostDesert?.mines).toHaveLength(1);
    expect(everdeep?.mines).toHaveLength(1);
  });

  it("never pairs progression levels by list position", () => {
    const state = extractMineState({ Data: {
      Mines: [{ MineNumber: 5003, Elevator: { Level: 1491 }, Ground: { Level: 1472 }, IdleSavegame: {} }],
      ProgressionSavegames: [{ MineId: 1, ElevatorLevel: 2188, WarehouseLevel: 2196, CorridorLevels: [800] }],
    } });
    expect(state.mines[0].elevatorLevel).toBe(1491);
    expect(state.mines[0].corridorLevels).toEqual([]);
  });
});

describe("idle boost", () => {
  it("adds income boosts, then multiplies by the ad boost (game rules)", async () => {
    const { extractMineState, gameIdlePerSecond } = await import("./mine-state");
    const state = extractMineState({ Data: {
      Iaps: { DoubleCashBoostActive: true, DoubleIdleCashBoostActive: true },
      Mines: [{ MineNumber: 3, IdleSavegame: { BigIdleCashWithoutBuffsPerSec: { m: 1.27, e: 33 } },
        BuffCollection: { Buffs: [
          { Factor: 4, Type: 0, State: 1 }, { Factor: 3.13, Type: 1, State: 1 }, { Factor: 9, Type: 0, State: 0 },
        ] } }],
    } });
    // (2 cash + 4 income + 2 idle) x 3.13 ad = 25.04x
    expect(state.mines[0].idleBoost).toBeCloseTo(25.04, 2);
    expect(gameIdlePerSecond(state.mines[0])).toBeCloseTo(1.27e33 * 25.04, -25);
  });

  it("stacks a second and third income token additively, not multiplied", async () => {
    const { extractMineState } = await import("./mine-state");
    const state = extractMineState({ Data: {
      Iaps: { DoubleCashBoostActive: true, DoubleIdleCashBoostActive: true },
      Mines: [{ MineNumber: 3, IdleSavegame: {}, BuffCollection: { Buffs: [
        { Factor: 4, Type: 0, State: 1 }, { Factor: 2, Type: 0, State: 1 },
        { Factor: 5, Type: 0, State: 1 }, { Factor: 3.13, Type: 1, State: 1 },
      ] } }],
    } });
    // (2 + 4 + 2 + 5 + 2) x 3.13 = 46.95x — the game's own overview math.
    expect(state.mines[0].idleBoost).toBeCloseTo(46.95, 2);
  });

  it("stays at 1x with no active buffs", async () => {
    const { extractMineState } = await import("./mine-state");
    const state = extractMineState({ Data: { Mines: [{ MineNumber: 3, IdleSavegame: {} }] } });
    expect(state.mines[0].idleBoost).toBe(1);
  });
});
