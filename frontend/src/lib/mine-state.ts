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
  /** Live boost multiplier on this mine right now: the product of its
   * active buff Factors, times 2 when the Double Idle Cash boost is on.
   * Cracked from a real save (2026-10-08): buffs 4 x 3.13 with double
   * idle on = 25.04x, exactly the gap between the save's base idle and
   * the number the game shows. 1 when no boost is active. */
  idleBoost: number;
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

  // Global Double Idle Cash boost doubles every mine's idle (save-proven).
  const doubleIdle = asRow(data.Iaps)?.DoubleIdleCashBoostActive === true ? 2 : 1;
  const buffProduct = (row: Row): number => {
    const buffs = asRow(row.BuffCollection)?.Buffs;
    if (!Array.isArray(buffs)) return 1;
    return buffs.reduce((product, item) => {
      const buff = asRow(item);
      const factor = buff ? num(buff.Factor) : null;
      return buff && buff.State === 1 && factor != null && factor > 0 ? product * factor : product;
    }, 1);
  };

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
    // Match progression ONLY by MineId === MineNumber. Never fall back to
    // list position: the save's Mines order is shuffled, and a positional
    // match once showed mine 1's levels on special mine 5003.
    const prog = mineNumber != null ? progressionByMineId.get(mineNumber) : undefined;
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
      // Base idle; a few special mines only record the "possible" figure.
      idleCashPerSecond:
        bigNumberToValue(idle?.BigIdleCashWithoutBuffsPerSec) ??
        bigNumberToValue(idle?.PossibleBigIdleCashWithoutBuffsPerSec),
      cashPerSecondWhenClosed: bigNumberToValue(row.BigCashPerSecondWhenClosed),
      storedCash: bigNumberToValue(row.BigCashStored),
      idleBoost: buffProduct(row) * doubleIdle,
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
 * Mine name decoding — cracked from the player's own save numbers
 * (2026-10-08). ProgressionSavegames lists MineId 1..40 in order, and the
 * per-mine prestige/level table falls in a clean gradient across blocks
 * of five: that is the 8 continents in game order, 5 named mines each.
 *
 * Mines bigger than 40 are specials: 1000 / 5001-5003 / 6000 carry their
 * continent in the thousands digit, and 110001 stands alone. Specials are
 * labelled honestly as "Special" until the player confirms what they are
 * in game (6000 holds prestige 39 and all current manager assignments).
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

/** Special mines identified so far (confirmed in game by the player). */
export const SPECIAL_MINE_NAMES: Record<number, string> = {
  6000: "Everdeep",
};

/** The 5 mines on each continent, in unlock order (game data trail). */
export const CONTINENT_MINES: Record<number, string[]> = {
  0: ["Coal", "Gold", "Ruby", "Diamond", "Emerald"],
  1: ["Moonstone", "Amethyst", "Crystal", "Jade", "Sapphire"],
  2: ["Amber", "Topaz", "Sunstone", "Platinum", "Obsidian"],
  3: ["Heliodor", "Realgar", "Alexandrite", "Celestine", "Titanite"],
  4: ["Fluorite", "Quartz", "Aragonite", "Beryl", "Calcite"],
  5: ["Aquamarine", "Ammolite", "Azurite", "Pearl", "Turquoise"],
  6: ["Crysoberyl", "Labradorite", "Aventurine", "Jasper", "Carnelian"],
  7: ["Nautilus", "Atlantic", "Bermuda", "Siren", "Abyss"],
};

export interface DecodedMine {
  continentType: number | null;
  continentName: string;
  /** 0-based position on the continent (named mines only). */
  localIndex: number | null;
  label: string;
  special: boolean;
}

export function decodeMineNumber(mineNumber: number | null): DecodedMine | null {
  if (mineNumber == null || !Number.isFinite(mineNumber)) return null;
  if (mineNumber >= 1 && mineNumber <= 40) {
    const continentType = Math.floor((mineNumber - 1) / 5);
    const localIndex = (mineNumber - 1) % 5;
    const mineName = CONTINENT_MINES[continentType]?.[localIndex];
    return {
      continentType,
      continentName: CONTINENT_NAMES[continentType] ?? "Unknown continent",
      localIndex,
      label: mineName ?? `Mine ${mineNumber}`,
      special: false,
    };
  }
  const known = SPECIAL_MINE_NAMES[mineNumber];
  if (known) {
    const continentType = mineNumber >= 1000 && mineNumber < 10000 ? Math.floor(mineNumber / 1000) : null;
    return { continentType, continentName: continentType != null ? (CONTINENT_NAMES[continentType] ?? "Special mines") : "Special mines", localIndex: null, label: known, special: true };
  }
  if (mineNumber >= 1000 && mineNumber < 10000) {
    const continentType = Math.floor(mineNumber / 1000);
    const name = CONTINENT_NAMES[continentType];
    const local = mineNumber % 1000;
    if (name) {
      return {
        continentType,
        continentName: name,
        localIndex: null,
        label: local > 0 ? `${name} · Special ${local}` : `${name} · Special`,
        special: true,
      };
    }
  }
  return { continentType: null, continentName: "Special mines", localIndex: null, label: `Special mine ${mineNumber}`, special: true };
}

/** Idle cash/sec the way the game shows it: base rate x live boost. */
export function gameIdlePerSecond(mine: Pick<SaveMine, "idleCashPerSecond" | "cashPerSecondWhenClosed" | "idleBoost">): number | null {
  const base = mine.idleCashPerSecond ?? mine.cashPerSecondWhenClosed;
  return base == null ? null : base * (mine.idleBoost || 1);
}

export interface MineContinentGroup {
  continentType: number;
  name: string;
  mines: SaveMine[];
  /** Combined idle cash/sec across the continent's mines. */
  totalIdlePerSecond: number;
}

/** Group save mines by continent (decoded from the mine number), each
 * group sorted biggest idle earner first, groups in game order with the
 * special-mines group last. */
export function groupMinesByContinent(mines: SaveMine[]): MineContinentGroup[] {
  const idleOf = (m: SaveMine) => gameIdlePerSecond(m) ?? 0;
  const groups = new Map<number, SaveMine[]>();
  for (const mine of mines) {
    const type = decodeMineNumber(mine.mineNumber)?.continentType ?? -2;
    const list = groups.get(type) ?? [];
    list.push(mine);
    groups.set(type, list);
  }
  return [...groups.entries()]
    .map(([continentType, list]) => ({
      continentType,
      name: CONTINENT_NAMES[continentType] ?? "Special mines",
      mines: [...list].sort((a, b) => idleOf(b) - idleOf(a)),
      totalIdlePerSecond: list.reduce((sum, m) => sum + idleOf(m), 0),
    }))
    .sort((a, b) => (a.continentType < 0 ? 99 : a.continentType) - (b.continentType < 0 ? 99 : b.continentType));
}
