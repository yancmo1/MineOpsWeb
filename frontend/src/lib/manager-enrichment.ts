import { MANAGER_REFERENCE_DATABASE } from "./manager-reference-database";

/**
 * Presentation enrichment projected from the manager reference database.
 *
 * The database joins the supplied sm-data directory with sm-actives. Keep
 * this narrower view for callers that only need identity, descriptions, and
 * passive/element notes; full active tables remain available through the
 * database export.
 */
export interface ManagerEnrichment {
  gameId: number;
  name: string;
  sprite: string;
  activeL1?: number;
  activeL100?: number;
  cooldown?: number;
  duration?: number;
  descriptionLong?: string;
  elements: Array<{ element: string; effectiveness: string; rankReq: number }>;
  passives: Array<{ type: string; value?: number | null; promoReq: number }>;
}

export const MANAGER_ENRICHMENT: ManagerEnrichment[] = MANAGER_REFERENCE_DATABASE.map((manager) => ({
  gameId: manager.gameId,
  name: manager.name,
  sprite: manager.sprite,
  activeL1: manager.activeL1,
  activeL100: manager.activeL100,
  cooldown: manager.cooldown,
  duration: manager.duration,
  descriptionLong: manager.descriptionLong,
  elements: manager.elements,
  passives: manager.passives,
}));
