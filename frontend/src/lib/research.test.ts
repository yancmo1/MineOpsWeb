import { describe, expect, it } from "vitest";
import { bottleneckArea, researchNodesFromDomain, researchPriorities } from "./research";
import type { StrategyEvaluation } from "./strategy";

const RESEARCH_DOMAIN = {
  schemaVersion: "1.0.0",
  domain: "research",
  count: 3,
  records: [
    { name: "ElevatorManagerCooldownSkillNodeConfig.asset", regionName: "Elevator", fields: { DescriptionKey: "ElevatorManagerCooldownSkill" } },
    { name: "MainlandCorridorSkillNodeConfig.asset", regionName: "Mine Shaft", fields: { DescriptionKey: "x{0} Mine Shaft boost in Mainland" } },
    { name: "StartContinentPrestigeCostReductionSkillConfig.asset", continentName: "Start", fields: { DescriptionKey: "SkillPrestigeCostContinental" } },
    { name: "SuperManager047_Atlas.asset", fields: { m_Name: "SuperManager047_Atlas" } },
  ],
};

describe("researchNodesFromDomain", () => {
  it("parses region, continent, and description keys from the published artifact", () => {
    const nodes = researchNodesFromDomain(RESEARCH_DOMAIN);
    expect(nodes).toHaveLength(4);
    const elevator = nodes.find((node) => node.name.includes("ElevatorManagerCooldown"));
    expect(elevator?.region).toBe("Elevator");
    expect(elevator?.descriptionKey).toBe("ElevatorManagerCooldownSkill");
    const corridor = nodes.find((node) => node.name.includes("MainlandCorridor"));
    expect(corridor?.region).toBe("Mine Shaft");
    const start = nodes.find((node) => node.name.includes("StartContinent"));
    expect(start?.continent).toBe("Start");
  });

  it("skips records without a name", () => {
    expect(researchNodesFromDomain({ records: [{ fields: {} }, { name: "X.asset" }] })).toHaveLength(1);
  });
});

describe("bottleneckArea", () => {
  function evaluationWith(scores: Record<string, number>): StrategyEvaluation {
    return {
      areaRecommendations: Object.fromEntries(
        Object.entries(scores).map(([area, score]) => [area, [{ managerId: "x", name: area, area, areaRank: 1, score, rarityScore: 1, levelValue: 1, rankValue: 1, activeValue: 1, upgradePriority: false, rationale: "", catalogVersion: "t", limitedData: false, missingData: [], equipmentBoost: 0 }]]),
      ),
      totalManagersConsidered: 1,
      unevaluated: [],
      upgradePriorities: [],
      catalogVersion: "t",
    } as unknown as StrategyEvaluation;
  }

  it("flags the area with the weakest top pick", () => {
    const bottleneck = bottleneckArea(evaluationWith({ "Mine Shaft": 200, Elevator: 150, Warehouse: 300 }));
    expect(bottleneck?.area).toBe("Elevator");
    expect(bottleneck?.note).toContain("Elevator");
  });

  it("returns null when fewer than two areas have picks", () => {
    expect(bottleneckArea(evaluationWith({ "Mine Shaft": 200 }))).toBeNull();
  });
});

describe("researchPriorities", () => {
  const nodes = researchNodesFromDomain(RESEARCH_DOMAIN);
  const bottleneck = { area: "Elevator" as const, topScore: 150, runnerUpArea: "Mine Shaft" as const, runnerUpScore: 200, note: "x" };

  it("puts region-matched bottleneck nodes first", () => {
    const priorities = researchPriorities(nodes, bottleneck);
    expect(priorities[0].priority).toBe(1);
    expect(priorities[0].node.region).toBe("Elevator");
    expect(priorities[0].reason).toContain("weakest area");
  });

  it("ranks other regions second and Start-continent third, never claiming magnitudes", () => {
    const priorities = researchPriorities(nodes, bottleneck);
    const byName = (name: string) => priorities.find((item) => item.node.name.includes(name));
    expect(byName("MainlandCorridor")?.priority).toBe(2);
    expect(byName("StartContinent")?.priority).toBe(3);
    for (const item of priorities) {
      expect(item.reason).not.toMatch(/\+\d+(\.\d+)?\s*x|percent/i);
    }
  });
});
