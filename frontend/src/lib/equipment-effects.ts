/**
 * Equipment-aware scoring using the lossless equipment-domain balancing rows.
 *
 * The published equipment-domain.json carries 36 equipment definitions (most
 * with undecoded effects) plus a `balancing` array of VERIFIED rows:
 * `{ equipmentId, level, value }` (e.g. equipment 14091 at level 5 = 0.05).
 * Only these verified rows influence scoring — undecoded effect semantics are
 * never fabricated. Player ownership arrives via `PlayerManager.equipmentIds`.
 */

import type { CachedCatalogPackage } from "./catalog-cache";

export interface EquipmentBalancingRow {
  equipmentId: number;
  level: number;
  value: number;
}

/** equipmentId -> strongest verified balancing value (max level row). */
export type EquipmentBoostTable = ReadonlyMap<number, number>;

/**
 * Build the boost table from the equipment-domain artifact. Values come only
 * from `balancing` rows where `value` is a finite number. For an equipment
 * with multiple balancing levels, the highest `level` row wins.
 */
export function buildEquipmentBoostTable(pkg: CachedCatalogPackage | undefined): EquipmentBoostTable {
  const table = new Map<number, number>();
  if (!pkg) return table;
  const domain = pkg.artifacts["equipment-domain.json"]?.content as { balancing?: Array<Record<string, unknown>> } | undefined;
  const rows = Array.isArray(domain?.balancing) ? domain.balancing : [];
  const bestByEquipment = new Map<number, { level: number; value: number }>();
  for (const row of rows) {
    const equipmentId = row.equipmentId;
    const value = row.value;
    const level = typeof row.level === "number" && Number.isFinite(row.level) ? row.level : 0;
    if (typeof equipmentId !== "number" || typeof value !== "number" || !Number.isFinite(value)) continue;
    const existing = bestByEquipment.get(equipmentId);
    if (!existing || level > existing.level) {
      bestByEquipment.set(equipmentId, { level, value });
    }
  }
  for (const [equipmentId, best] of bestByEquipment) {
    table.set(equipmentId, best.value);
  }
  return table;
}

/** Total verified boost for a player's assigned equipment. */
export function equipmentBoostFor(table: EquipmentBoostTable, equipmentIds: number[] | undefined): number {
  if (!equipmentIds) return 0;
  let total = 0;
  for (const id of equipmentIds) {
    const value = table.get(id);
    if (typeof value === "number") total += value;
  }
  return total;
}

/** Apply a verified equipment boost as a multiplicative factor on a score. */
export function applyEquipmentBoost(score: number, boost: number): number {
  return boost > 0 ? score * (1 + boost) : score;
}
