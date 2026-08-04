/**
 * Bottleneck detection and research priorities.
 *
 * Mine-economy balancing magnitudes are still undecoded in the published
 * package (raw bytes), so bottleneck detection here is ROSTER-BASED and
 * honest: the operating area with the weakest top pick is the player's
 * weakest link. Research priorities use the verified region/continent tags
 * from the published research-domain artifact — effect magnitudes are NOT
 * claimed (they remain in raw serialized bytes).
 */

import type { StrategyEvaluation } from "./strategy";

export type AreaName = "Mine Shaft" | "Warehouse" | "Elevator";

export interface ResearchNode {
  name: string;
  descriptionKey: string | null;
  region: AreaName | null;
  continent: string | null;
}

const REGION_TO_AREA: Record<string, AreaName> = {
  "Mine Shaft": "Mine Shaft",
  Warehouse: "Warehouse",
  Elevator: "Elevator",
};

/** Parse the published research-domain.json artifact (schema 1.0.0). */
export function researchNodesFromDomain(domain: unknown): ResearchNode[] {
  const records = Array.isArray(domain) ? domain
    : typeof domain === "object" && domain != null && Array.isArray((domain as { records?: unknown }).records)
      ? (domain as { records: Array<Record<string, unknown>> }).records
      : [];
  const nodes: ResearchNode[] = [];
  for (const record of records) {
    const fields = record.fields && typeof record.fields === "object" ? record.fields as Record<string, unknown> : {};
    const name = typeof record.name === "string" ? record.name : "";
    if (!name) continue;
    const regionName = typeof record.regionName === "string" ? record.regionName : undefined;
    nodes.push({
      name,
      descriptionKey: typeof fields.DescriptionKey === "string" ? fields.DescriptionKey : null,
      region: regionName && regionName in REGION_TO_AREA ? REGION_TO_AREA[regionName] : null,
      continent: typeof record.continentName === "string" ? record.continentName : null,
    });
  }
  return nodes;
}

export interface Bottleneck {
  area: AreaName;
  topScore: number;
  runnerUpArea: AreaName;
  runnerUpScore: number;
  note: string;
}

/** The area with the weakest top pick = the player's weakest link. */
export function bottleneckArea(evaluation: StrategyEvaluation): Bottleneck | null {
  const areas = Object.entries(evaluation.areaRecommendations)
    .map(([area, recs]) => ({ area: area as AreaName, topScore: recs[0]?.score ?? 0 }))
    .filter((entry) => entry.topScore > 0);
  if (areas.length < 2) return null;
  const sorted = [...areas].sort((a, b) => a.topScore - b.topScore);
  const weakest = sorted[0];
  const runnerUp = sorted[1];
  return {
    area: weakest.area,
    topScore: weakest.topScore,
    runnerUpArea: runnerUp.area,
    runnerUpScore: runnerUp.topScore,
    note: `${weakest.area} has the weakest top pick (${weakest.topScore.toFixed(1)} vs ${runnerUp.area}'s ${runnerUp.topScore.toFixed(1)}) — the most likely production bottleneck for this roster.`,
  };
}

export interface ResearchPriority {
  node: ResearchNode;
  priority: number;
  reason: string;
}

/**
 * Rank research nodes for the player's bottleneck. Region-matched nodes
 * (the skill affects the weak area) come first, then continent/manager nodes.
 * Effect magnitudes are not claimed — reasons cite verified tags only.
 */
export function researchPriorities(nodes: ResearchNode[], bottleneck: Bottleneck | null): ResearchPriority[] {
  const prioritized: ResearchPriority[] = [];
  for (const node of nodes) {
    let priority = 4;
    let reason = "Generic research node.";
    if (node.region && bottleneck && node.region === bottleneck.area) {
      priority = 1;
      reason = `Affects ${node.region}, your weakest area (${bottleneck.note.split(" — ")[0]}).`;
    } else if (node.region) {
      priority = 2;
      reason = `Affects ${node.region}; invest when that area becomes the bottleneck.`;
    } else if (node.continent === "Start") {
      priority = 3;
      reason = "Start-continent skill, always available.";
    }
    if (node.descriptionKey) {
      reason += ` Key: ${node.descriptionKey}.`;
    }
    prioritized.push({ node, priority, reason });
  }
  return prioritized.sort((a, b) => a.priority - b.priority);
}
