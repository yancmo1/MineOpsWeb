/**
 * Everdeep team builder (borrowed shape from the idle-miners Chrono tool):
 * lay out the three slots by element first, then pick the best owned
 * manager for each slot using exact active values bent by element math,
 * and sum the team's unlocked passives from the master tables.
 */
import type { CatalogManager, PlayerManager } from "./db";
import { effectiveActiveValue } from "./db";
import { applyElementToActive, elementPairing, masterActiveValue, masterPassiveValue, masterRecordFor, passiveTypeName, type Effectiveness } from "./master-data";

export type AreaId = "mineshaft" | "elevator" | "warehouse";
export const AREA_LABELS: Record<AreaId, string> = { mineshaft: "Mineshaft", elevator: "Elevator", warehouse: "Warehouse" };

export interface TeamPick {
  area: AreaId;
  manager: CatalogManager;
  progress: PlayerManager;
  /** Active value before element math (exact where the master table has it). */
  baseActive: number;
  /** Active value after element math for the chosen slot element. */
  adjustedActive: number;
  effectiveness: Effectiveness | null;
  /** True when the pairing exists but the rank hasn't unlocked it yet. */
  elementLocked: boolean;
  exactFromMaster: boolean;
}

export interface PassiveTotal { type: string; name: string; total: number; multiplierLike: boolean }

export interface EverdeepTeam {
  picks: TeamPick[];
  passiveTotals: PassiveTotal[];
  /** Runner-up per area, so the player sees the next-best option too. */
  runnersUp: Partial<Record<AreaId, TeamPick>>;
}

const PROMO_REQ_BY_INDEX = [1, 3, 5];

export function buildEverdeepTeam(
  catalog: CatalogManager[],
  progress: PlayerManager[],
  slotElements: Record<AreaId, string | null>,
): EverdeepTeam {
  const progressById = new Map(progress.map((p) => [p.managerId, p]));
  const candidates: TeamPick[] = [];
  for (const manager of catalog) {
    const owned = progressById.get(manager.id);
    if (!owned?.unlocked) continue;
    const area = (manager.type ?? "").toLowerCase() as AreaId;
    if (!(area in AREA_LABELS)) continue;
    const master = masterRecordFor(manager);
    const exact = master ? masterActiveValue(master, owned.level, owned.rank) : null;
    const baseActive = exact ?? effectiveActiveValue(manager, owned);
    const element = slotElements[area];
    let adjustedActive = baseActive;
    let effectiveness: Effectiveness | null = null;
    let elementLocked = false;
    if (master && element) {
      const pairing = elementPairing(master, element, owned.rank);
      if (pairing) {
        effectiveness = pairing.effectiveness;
        elementLocked = !pairing.unlocked;
        if (pairing.unlocked && (master.type ?? 0) === 0) adjustedActive = applyElementToActive(baseActive, pairing.effectiveness);
      }
    }
    candidates.push({ area, manager, progress: owned, baseActive, adjustedActive, effectiveness, elementLocked, exactFromMaster: exact != null });
  }
  const picks: TeamPick[] = [];
  const runnersUp: Partial<Record<AreaId, TeamPick>> = {};
  for (const area of Object.keys(AREA_LABELS) as AreaId[]) {
    const ranked = candidates.filter((c) => c.area === area).sort((a, b) => b.adjustedActive - a.adjustedActive);
    if (ranked[0]) picks.push(ranked[0]);
    if (ranked[1]) runnersUp[area] = ranked[1];
  }
  const totals = new Map<string, PassiveTotal>();
  for (const pick of picks) {
    const master = masterRecordFor(pick.manager);
    if (!master) continue;
    master.passives.forEach(([type, fallback, promoReq], index) => {
      const required = promoReq ?? PROMO_REQ_BY_INDEX[index] ?? 1;
      if (pick.progress.promoted < required) return;
      const value = masterPassiveValue(type, pick.manager.rarity, pick.progress.rank, pick.progress.promoted) ?? fallback;
      if (value == null) return;
      const entry = totals.get(type) ?? { type, name: passiveTypeName(type), total: 0, multiplierLike: value < 10 };
      entry.total += value;
      totals.set(type, entry);
    });
  }
  return { picks, passiveTotals: [...totals.values()].sort((a, b) => a.name.localeCompare(b.name)), runnersUp };
}
