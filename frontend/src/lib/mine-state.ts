/**
 * Mine state from the Kolibri save — the drawers the sync parser used to
 * ignore. Verified by names-only inspection of a real save (2026-10-08):
 *
 * - Data.Mines[] (46): Elevator {Level...}, Ground {Level, NumberOfWorkers},
 *   Tier {Corridors}, PrestigeCount, Selected, MineNumber,
 *   IdleSavegame {BigIdleCashWithoutBuffsPerSec...},
 *   BigCashPerSecondWhenClosed {m, e}, BigCashStored {m, e}.
 * - Data.ProgressionSavegames[] (40): MineId, ElevatorLevel, WarehouseLevel,
 *   CorridorLevels[] — per-mine levels.
 * - Data.ContinentSavegame.UnlockSavegames[]: ContinentType (catalog uses
 *   the same continentType numbers), HasClaimedRewards.
 * - Data.SuperManagers.Assignments[] (12): ManagerId, MineNumber, Area, Tier.
 *
 * Big game numbers are stored as { m, e } (mantissa x 10^exponent).
 * Everything extracted here stays in the browser, same as the rest of sync.
 * Fields are optional end to end: if the save shape shifts, we show less,
 * never invented numbers.
 */

export interface SaveMine {
  /** MineNumber from the save; the stable per-mine key we were given. */
  mineNumber: number | null;
  /** MineId from ProgressionSavegames when a row matches by position/number. */
  mineId: number | null;
  elevatorLevel: number | null;
  warehouseLevel: number | null;
  /** Shaft (corridor) levels, deepest first as stored. */
  corridorLevels: number[];
  prestigeCount: number | null;
  selected: boolean;
  /** Game's own idle cash/sec for this mine (no buffs), base units. */
  idleCashPerSecond: number | null;
  /** Cash per second recorded when the mine was closed, base units. */
  cashPerSecondWhenClosed: number | null;
  /** Stored (uncollected) cash, base units. */
  storedCash: number | null;
}

export interface SaveAssignment {
  managerId: number | null;
  mineNumber: number | null;
  area: string | null;
  tier: number | null;
}

export interface MineState {
  mines: SaveMine[];
  /** ContinentType numbers the player has unlocked (catalog-compatible). */
  unlockedContinentTypes: number[];
  assignments: SaveAssignment[];
}

type Row = Record<string, unknown>;

function asRow(value: unknown): Row | null {
  return typeof value === "object" && value != null && !Array.isArray(value) ? (value as Row) : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Game big-number { m, e } -> plain number (m x 10^e). Null when not that shape. */
export function bigNumberToValue(value: unknown): number | null {
  const row = asRow(value);
  if (!row) return num(value);
  const m = num(row.m);
  const e = num(row.e);
  if (m == null || e == null) return null;
  return m * 10 ** e;
}

export function extractMineState(root: Record<string, unknown>): MineState {
  const data = asRow(root.Data) ?? root;

  const progression = Array.isArray(data.ProgressionSavegames) ? data.ProgressionSavegames : [];
  const progressionByMineId = new Map<number, Row>();
  for (const item of progression) {
    const row = asRow(item);
    const mineId = row ? num(row.MineId) : null;
    if (row && mineId != null) progressionByMineId.set(mineId, row);
  }

  const minesRaw = Array.isArray(data.Mines) ? data.Mines : [];
  const mines: SaveMine[] = minesRaw.map((item, index) => {
    const row = asRow(item) ?? {};
    const elevator = asRow(row.Elevator);
    const ground = asRow(row.Ground);
    const idle = asRow(row.IdleSavegame);
    const mineNumber = num(row.MineNumber);
    // Progression rows keyed by MineId; MineId appears to track MineNumber.
    // Fall back to same-position row when the key does not line up, and keep
    // levels from Mines[].Elevator/Ground as the primary source.
    const prog = (mineNumber != null ? progressionByMineId.get(mineNumber) : undefined) ?? asRow(progression[index]) ?? undefined;
    const corridorLevels = Array.isArray(prog?.CorridorLevels)
      ? (prog!.CorridorLevels as unknown[]).map(num).filter((v): v is number => v != null)
      : [];
    return {
      mineNumber,
      mineId: prog ? num(prog.MineId) : null,
      elevatorLevel: num(prog?.ElevatorLevel) ?? num(elevator?.Level),
      warehouseLevel: num(prog?.WarehouseLevel) ?? num(ground?.Level),
      corridorLevels,
      prestigeCount: num(row.PrestigeCount),
      selected: row.Selected === true,
      idleCashPerSecond: bigNumberToValue(idle?.BigIdleCashWithoutBuffsPerSec),
      cashPerSecondWhenClosed: bigNumberToValue(row.BigCashPerSecondWhenClosed),
      storedCash: bigNumberToValue(row.BigCashStored),
    };
  });

  const continent = asRow(data.ContinentSavegame);
  const unlocks = Array.isArray(continent?.UnlockSavegames) ? continent!.UnlockSavegames : [];
  const unlockedContinentTypes = unlocks
    .map((item) => num(asRow(item)?.ContinentType))
    .filter((v): v is number => v != null);

  const superManagers = asRow(data.SuperManagers);
  const assignmentsRaw = Array.isArray(superManagers?.Assignments) ? superManagers!.Assignments : [];
  const assignments: SaveAssignment[] = assignmentsRaw.map((item) => {
    const row = asRow(item) ?? {};
    return {
      managerId: num(row.ManagerId),
      mineNumber: num(row.MineNumber),
      area: typeof row.Area === "string" ? row.Area : null,
      tier: num(row.Tier),
    };
  });

  return { mines, unlockedContinentTypes, assignments };
}

const STORAGE_KEY = "mineops.saveMines.v1";

export function saveMineState(storage: Pick<Storage, "setItem">, state: MineState): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function loadMineState(storage: Pick<Storage, "getItem">): MineState | null {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MineState;
    return Array.isArray(parsed.mines) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Mine numbers look like continentType x 1000 + mine-on-that-continent:
 * the save shows 5003 alongside 3, 32, 33, 34 — 5003 reads as continent 5
 * (Ancient), mine 3; the small numbers are Start-continent mines.
 * Continent type numbers match the catalog's mine-economy domain.
 */
export const CONTINENT_NAMES: Record<number, string> = {
  0: "Start",
  1: "Ice",
  2: "Fire",
  3: "Dawn",
  4: "Dusk",
  5: "Ancient",
  6: "Lost Desert",
  7: "Underwater",
  3000: "Impossible Island",
};

export function decodeMineNumber(mineNumber: number | null): { continentType: number; localNumber: number; label: string } | null {
  if (mineNumber == null || !Number.isFinite(mineNumber)) return null;
  const continentType = Math.floor(mineNumber / 1000);
  const localNumber = mineNumber % 1000;
  const name = CONTINENT_NAMES[continentType];
  return { continentType, localNumber, label: name ? `${name} · Mine ${localNumber}` : `Mine ${mineNumber}` };
}
