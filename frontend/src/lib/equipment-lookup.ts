/**
 * Build an equipment name lookup map from the active catalog package.
 * Maps equipmentId -> nameKey for display in the manager detail modal.
 */
import { CachedCatalogPackage } from "./catalog-cache";

export function buildEquipmentNameMap(pkg: CachedCatalogPackage | undefined): Map<number, string> {
  const map = new Map<number, string>();
  if (!pkg) return map;
  const core = pkg.artifacts["catalog-core.json"]?.content as Record<string, unknown> | undefined;
  if (!core) return map;
  const equipment = core.equipment as Array<{equipmentId: number; nameKey: string}> | undefined;
  if (!equipment) return map;
  for (const eq of equipment) {
    map.set(eq.equipmentId, eq.nameKey);
  }
  return map;
}
