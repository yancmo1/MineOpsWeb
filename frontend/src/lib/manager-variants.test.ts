import { describe, expect, it } from "vitest";
import { MANAGER_VARIANT_PAIRS, isVariantId, variantOf } from "./manager-variants";
import { evaluateLineup, type StrategyEvaluation } from "./strategy";
import type { CatalogManager, PlayerManager } from "./db";

describe("manager-variants classification", () => {
  it("classifies all six duplicate/legacy pairs", () => {
    expect(MANAGER_VARIANT_PAIRS).toHaveLength(6);
    const variants = MANAGER_VARIANT_PAIRS.map((pair) => pair.variantId);
    const canonicals = MANAGER_VARIANT_PAIRS.map((pair) => pair.canonicalId);
    // No id may be used twice and no variant may also be a canonical.
    expect(new Set(variants).size).toBe(6);
    expect(new Set(canonicals).size).toBe(6);
    expect(variants.filter((id) => canonicals.includes(id))).toHaveLength(0);
  });

  it("maps each variant id to its canonical twin", () => {
    for (const pair of MANAGER_VARIANT_PAIRS) {
      expect(variantOf(pair.variantId)).toBe(pair.canonicalId);
      expect(isVariantId(pair.variantId)).toBe(true);
      expect(isVariantId(pair.canonicalId)).toBe(false);
    }
  });

  it("returns null for non-variant ids", () => {
    expect(variantOf("sm-10001")).toBeNull();
    expect(isVariantId("sm-10001")).toBe(false);
  });

  it("documents the inverted Rabbid Blingsley pair", () => {
    const rabbits = MANAGER_VARIANT_PAIRS.find((pair) => pair.name === "Rabbid Blingsley");
    expect(rabbits).toBeDefined();
    expect(rabbits?.canonicalId).toBe("sm-10028");
    expect(rabbits?.variantId).toBe("sm-10025");
  });
});

describe("variant dedup in lineup evaluation", () => {
  function manager(id: string, type = "Mine Shaft", multiplier = 10): CatalogManager {
    return {
      id,
      name: `Manager ${id}`,
      rarity: "rare",
      type,
      elements: [],
      active: { multiplier, multiplierAt100: multiplier * 10 },
      activeLevels: [{ level: 1, value: multiplier }],
      variantOf: undefined,
    };
  }

  function progress(managerId: string, unlocked = true, level = 30, rank = 3): PlayerManager {
    return {
      managerId,
      unlocked,
      level,
      rank,
      promoted: 1,
      fragments: 0,
      updatedAt: new Date().toISOString(),
    };
  }

  it("does not double-count a variant when both twins are owned", () => {
    const blingsley = manager("sm-10005");
    const blingsleyVariant = { ...manager("sm-10021"), variantOf: "sm-10005" };
    const catalog = [blingsley, blingsleyVariant];
    const result = evaluateLineup(catalog, [progress("sm-10005"), progress("sm-10021")]);
    const scored = result.areaRecommendations["Mine Shaft"] ?? [];
    // Only the canonical twin is scored; the variant is folded in.
    expect(scored.map((rec) => rec.managerId)).toEqual(["sm-10005"]);
    expect(result.totalManagersConsidered).toBe(1);
  });

  it("scores the canonical twin when only the variant id has progress", () => {
    const blingsley = manager("sm-10005");
    const blingsleyVariant = { ...manager("sm-10021"), variantOf: "sm-10005" };
    const catalog = [blingsley, blingsleyVariant];
    const result = evaluateLineup(catalog, [progress("sm-10021")]);
    const scored = result.areaRecommendations["Mine Shaft"] ?? [];
    expect(scored.map((rec) => rec.managerId)).toEqual(["sm-10005"]);
    expect(result.totalManagersConsidered).toBe(1);
  });

  it("keeps an unlocked variant as unevaluated when no twin is in the catalog", () => {
    const catalog = [manager("sm-10001")];
    const result = evaluateLineup(catalog, [progress("sm-10021")], null) as StrategyEvaluation;
    // Progress remaps to sm-10005 which is absent, so the player's row stays
    // unevaluated (listed under its own id, not silently dropped).
    expect(result.unevaluated.some((item) => item.managerId === "sm-10021")).toBe(true);
    expect(result.totalManagersConsidered).toBe(0);
  });
});
