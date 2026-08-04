/**
 * Balanced lineup evaluation.
 *
 * Moves beyond "one best manager per area" to a real, explainable lineup:
 * multiple picks per operating area, each carrying verified score + equipment
 * boost, an evidence-based coverage role (income passive / upgrade-cost
 * reduction / burst), and clearly-labeled reference element notes. Element
 * effectiveness (SE/PE/NVE) is NOT in the APK-published catalog yet, so it
 * comes from the idle-miners.com-derived presentation enrichment and is
 * explicitly labeled reference-only — it never modifies the verified score.
 */

import type { CatalogManager } from "./db";
import { MANAGER_ENRICHMENT } from "./manager-enrichment";
import type { FrontierRosterEntry } from "./frontier-guide";
import type { EquipmentBoostTable } from "./equipment-effects";
import type { StrategyEvaluation } from "./strategy";

export interface LineupPick {
  managerId: string;
  name: string;
  area: string;
  /** 1st / 2nd / 3rd choice within the area. */
  rank: number;
  score: number;
  equipmentBoost: number;
  /** Evidence-based coverage roles from the frontier roster classification. */
  coverageTags: string[];
  /** Reference-only element notes (idle-miners.com sm-data); not scored. */
  elementNotes: string[];
  why: string;
  limitedData: boolean;
  missingData: string[];
}

export interface BalancedLineup {
  area: string;
  picks: LineupPick[];
  note: string;
}

const ENRICHMENT_BY_ID = new Map(MANAGER_ENRICHMENT.map((entry) => [entry.gameId, entry]));

function elementNotesFor(manager: CatalogManager | undefined): string[] {
  const gameId = manager?.gameId;
  if (typeof gameId !== "number") return [];
  const entry = ENRICHMENT_BY_ID.get(gameId);
  if (!entry || entry.elements.length === 0) return [];
  const strongest = entry.elements
    .filter((element) => element.effectiveness === "SE")
    .slice(0, 3)
    .map((element) => `${element.element}${element.rankReq > 0 ? ` (R${element.rankReq})` : ""}`);
  return strongest.length > 0
    ? [`Reference only: strong vs ${strongest.join(", ")}`]
    : [];
}

function coverageTagsFor(managerId: string, roster: FrontierRosterEntry[]): string[] {
  return roster.find((entry) => entry.managerId === managerId)?.tags ?? [];
}

/**
 * Build the balanced lineup from an existing evaluation. Picks are ranked by
 * verified score (with equipment) per area; coverage roles and reference
 * element notes are attached for explainability.
 */
export function buildBalancedLineup(
  catalog: CatalogManager[],
  evaluation: StrategyEvaluation,
  roster: FrontierRosterEntry[],
  boostTable: EquipmentBoostTable = new Map(),
): BalancedLineup[] {
  const managerById = new Map(catalog.map((manager) => [manager.id, manager]));
  const lineups: BalancedLineup[] = [];
  for (const [area, recommendations] of Object.entries(evaluation.areaRecommendations)) {
    const picks: LineupPick[] = recommendations.slice(0, 3).map((rec, index) => {
      const manager = managerById.get(rec.managerId);
      const tags = coverageTagsFor(rec.managerId, roster);
      const notes = elementNotesFor(manager);
      const boost = rec.equipmentBoost ?? 0;
      const whyParts: string[] = [`${rec.score.toFixed(1)} verified score`];
      if (boost > 0) whyParts.push(`+${(boost * 100).toFixed(0)}% equipment`);
      if (tags.length > 0) whyParts.push(tags.join(" / "));
      return {
        managerId: rec.managerId,
        name: rec.name,
        area,
        rank: index + 1,
        score: rec.score,
        equipmentBoost: boost,
        coverageTags: tags,
        elementNotes: notes,
        why: whyParts.join(" · "),
        limitedData: rec.limitedData,
        missingData: rec.missingData,
      };
    });
    if (picks.length === 0) continue;
    lineups.push({
      area,
      picks,
      note: picks.length > 1
        ? `${picks.length} assignable managers — ${picks[0].name} leads, ${picks[1].name} covers the ${picks[1].coverageTags.join("/") || "alternate"} role.`
        : `${picks[0].name} is the only assignable manager for this area.`,
    });
  }
  return lineups;
}

export { elementNotesFor, coverageTagsFor };
