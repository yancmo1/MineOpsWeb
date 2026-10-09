/**
 * Master-data lookups over MASTER_SM (see master-sm-data.ts).
 * - Exact active values for every manager/level/rank — including the
 *   managers the game documents only as "++/--" (Damian Jones, Jade Kim).
 * - Element effectiveness: the game's own factors (decompiled reference):
 *   actives SE x1.5 / PE x0.6 / NVE x0.2, where PE/NVE only shrink the
 *   part of the multiplier above 1x. An element pairing only counts once
 *   the manager's rank reaches its rankReq.
 * - Passive values by type/rarity/rank/promotion from the master tables.
 */
import { MASTER_PASSIVE_TABLES, MASTER_SM, type MasterSmRecord } from "./master-sm-data";

export type { MasterSmRecord };

const byGameId = new Map<number, MasterSmRecord>();
const bySlug = new Map<string, MasterSmRecord>();
for (const record of MASTER_SM) {
  if (record.gameId != null) byGameId.set(record.gameId, record);
  bySlug.set(record.id, record);
}

export function slugifyName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").replace("dr-", "dr-");
}

export function masterRecordFor(manager: { id?: string; name?: string; gameId?: number }): MasterSmRecord | null {
  if (manager.gameId != null && byGameId.has(manager.gameId)) return byGameId.get(manager.gameId)!;
  if (manager.name && bySlug.has(slugifyName(manager.name))) return bySlug.get(slugifyName(manager.name))!;
  if (manager.id && bySlug.has(manager.id)) return bySlug.get(manager.id)!;
  return null;
}

/** Exact active value: baseRaw[level] x (1 + rankInc[rank]). Levels cap at 50 in this table. */
export function masterActiveValue(record: MasterSmRecord, level: number, rank: number): number | null {
  if (record.base.length === 0) return null;
  const base = record.base[Math.min(Math.max(level, 1), record.base.length) - 1];
  const inc = record.rankInc[Math.min(Math.max(rank, 0), record.rankInc.length - 1)] ?? 0;
  return base * (1 + inc);
}

export type Effectiveness = "SE" | "PE" | "NVE";

export const ELEMENTS = ["nature", "sand", "dark", "frost", "light", "water", "flame", "wind", "order", "chaos"] as const;

/** Element pairing for a manager at a rank — null when the rank hasn't unlocked it yet. */
export function elementPairing(record: MasterSmRecord, element: string, rank: number): { effectiveness: Effectiveness; rankReq: number; unlocked: boolean } | null {
  const row = record.elements.find(([el]) => el === element);
  if (!row) return null;
  return { effectiveness: row[1] as Effectiveness, rankReq: row[2], unlocked: rank >= row[2] };
}

/** Apply element effectiveness to an active multiplier (type 0). PE/NVE shrink only the part above 1x. */
export function applyElementToActive(value: number, effectiveness: Effectiveness): number {
  if (effectiveness === "SE") return value * 1.5;
  const factor = effectiveness === "PE" ? 0.6 : 0.2;
  return 1 + (value - 1) * factor;
}

/** Passive value from the master tables: [rarity][R<rank>][promotion step]. Null when not tabulated. */
export function masterPassiveValue(type: string, rarity: string, rank: number, promoted: number): number | null {
  const table = MASTER_PASSIVE_TABLES[type];
  if (!table) return null;
  const byRank = table.tables[rarity.toLowerCase()];
  const row = byRank?.[`R${Math.min(Math.max(rank, 0), 5)}`];
  if (!row || row.length === 0) return null;
  return row[Math.min(Math.max(promoted, 1), row.length) - 1] ?? row[row.length - 1];
}

export function passiveTypeName(type: string): string {
  return MASTER_PASSIVE_TABLES[type]?.name ?? type;
}
