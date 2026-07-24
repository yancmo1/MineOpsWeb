/**
 * Strategy Evaluation Tests
 *
 * Covers:
 *   - Representative managers ranked correctly
 *   - Rarity, rank, level contributions to score
 *   - Incomplete-data handling (missing active multipliers)
 *   - Upgrade priority detection
 *   - Per-area slot assignment
 *   - Reproducible for selected catalog release
 *
 * @vitest-environment jsdom
 */

import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { evaluateLineup, evaluateVerifiedLineup, managersFromVerifiedPackage } from "./strategy";
import type { CachedCatalogPackage } from "./catalog-cache";
import type { CatalogManager, PlayerManager } from "./db";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeManager(overrides: Partial<CatalogManager> & { id: string }): CatalogManager {
  return {
    name: overrides.id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    rarity: "Rare",
    type: "Mine Shaft",
    elements: [],
    ...overrides,
  };
}

function makeProgress(overrides: Partial<PlayerManager> & { managerId: string }): PlayerManager {
  return {
    level: 1,
    rank: 0,
    promoted: 0,
    fragments: 0,
    unlocked: true,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Basic ranking", () => {
  it("ranks a single unlocked manager", () => {
    const catalog = [makeManager({ id: "mgr-1", rarity: "Legendary", active: { multiplier: 10 } })];
    const progress = [makeProgress({ managerId: "mgr-1", level: 50, rank: 3, promoted: 2 })];

    const evalResult = evaluateLineup(catalog, progress);
    expect(evalResult.totalManagersConsidered).toBe(1);
    expect(evalResult.areaRecommendations["Mine Shaft"]).toHaveLength(1);
    expect(evalResult.areaRecommendations["Mine Shaft"][0].managerId).toBe("mgr-1");
  });

  it("skips locked managers", () => {
    const catalog = [makeManager({ id: "mgr-1" })];
    const progress = [makeProgress({ managerId: "mgr-1", unlocked: false })];

    const evalResult = evaluateLineup(catalog, progress);
    expect(evalResult.totalManagersConsidered).toBe(0);
  });

  it("ranks higher-score managers first within an area", () => {
    const catalog = [
      makeManager({ id: "mgr-strong", rarity: "Legendary", name: "Strong", active: { multiplier: 20 } }),
      makeManager({ id: "mgr-weak", rarity: "Common", name: "Weak", active: { multiplier: 2 } }),
    ];
    const progress = [
      makeProgress({ managerId: "mgr-strong", level: 50, rank: 3, promoted: 2 }),
      makeProgress({ managerId: "mgr-weak", level: 1, rank: 0, promoted: 0 }),
    ];

    const evalResult = evaluateLineup(catalog, progress);
    const mineShaft = evalResult.areaRecommendations["Mine Shaft"];
    expect(mineShaft[0].managerId).toBe("mgr-strong");
    expect(mineShaft[1].managerId).toBe("mgr-weak");
  });
});

describe("Score contributions", () => {
  it("higher rank increases score", () => {
    const catalog = [makeManager({ id: "mgr-test", rarity: "Rare", active: { multiplier: 5 } })];
    const lowRank = makeProgress({ managerId: "mgr-test", rank: 0, level: 10 });
    const highRank = makeProgress({ managerId: "mgr-test", rank: 3, level: 10 });

    const low = evaluateLineup(catalog, [lowRank]);
    const high = evaluateLineup(catalog, [highRank]);

    expect(high.areaRecommendations["Mine Shaft"][0].score).toBeGreaterThan(
      low.areaRecommendations["Mine Shaft"][0].score,
    );
  });

  it("higher level increases score", () => {
    const catalog = [makeManager({ id: "mgr-test", active: { multiplier: 5 } })];
    const lowLevel = makeProgress({ managerId: "mgr-test", level: 1 });
    const highLevel = makeProgress({ managerId: "mgr-test", level: 50 });

    const low = evaluateLineup(catalog, [lowLevel]);
    const high = evaluateLineup(catalog, [highLevel]);

    expect(high.areaRecommendations["Mine Shaft"][0].score).toBeGreaterThan(
      low.areaRecommendations["Mine Shaft"][0].score,
    );
  });
});

describe("Incomplete data handling", () => {
  it("flags limited data when active.multiplier is missing", () => {
    const catalog = [makeManager({ id: "mgr-no-active" })]; // no active.multiplier
    const progress = [makeProgress({ managerId: "mgr-no-active", level: 10 })];

    const evalResult = evaluateLineup(catalog, progress);
    const rec = evalResult.areaRecommendations["Mine Shaft"][0];
    expect(rec.limitedData).toBe(true);
    expect(rec.missingData).toContain("active.multiplier");
  });

  it("does not fabricate bonuses for unknown data", () => {
    const catalog = [makeManager({ id: "mgr-limited" })]; // no active
    const progress = [makeProgress({ managerId: "mgr-limited", level: 1 })];

    const evalResult = evaluateLineup(catalog, progress);
    const rec = evalResult.areaRecommendations["Mine Shaft"][0];
    expect(rec.rationale).toContain("limited data");
    expect(rec.activeValue).toBe(1); // default fallback, not a fabricated bonus
  });
});

describe("Upgrade priorities", () => {
  it("identifies managers close to next rank", () => {
    const catalog = [makeManager({ id: "mgr-ready", rarity: "Rare", active: { multiplier: 5 } })];
    const progress = [makeProgress({ managerId: "mgr-ready", fragments: 15, rank: 0, level: 10 })];

    const evalResult = evaluateLineup(catalog, progress);
    expect(evalResult.upgradePriorities.length).toBeGreaterThanOrEqual(1);
    expect(evalResult.upgradePriorities.map((r) => r.managerId)).toContain("mgr-ready");
  });

  it("limits upgrade priorities to top 5", () => {
    const catalog = Array.from({ length: 10 }, (_, i) =>
      makeManager({ id: `mgr-${i}`, rarity: "Rare", active: { multiplier: 5 } }),
    );
    const progress = catalog.map((m) =>
      makeProgress({ managerId: m.id, level: 10, rank: 0, fragments: 10 }),
    );

    const evalResult = evaluateLineup(catalog, progress);
    expect(evalResult.upgradePriorities.length).toBeLessThanOrEqual(5);
  });
});

describe("Per-area assignments", () => {
  it("recommends managers across multiple areas", () => {
    const catalog = [
      makeManager({ id: "mgr-shaft", type: "Mine Shaft", active: { multiplier: 5 } }),
      makeManager({ id: "mgr-elev", type: "Elevator", active: { multiplier: 5 } }),
      makeManager({ id: "mgr-ware", type: "Warehouse", active: { multiplier: 5 } }),
    ];
    const progress = catalog.map((m) => makeProgress({ managerId: m.id, level: 10 }));

    const evalResult = evaluateLineup(catalog, progress);
    expect(evalResult.areaRecommendations["Mine Shaft"]).toHaveLength(1);
    expect(evalResult.areaRecommendations["Elevator"]).toHaveLength(1);
    expect(evalResult.areaRecommendations["Warehouse"]).toHaveLength(1);
  });

  it("reports total managers considered", () => {
    const catalog = Array.from({ length: 5 }, (_, i) =>
      makeManager({ id: `mgr-${i}`, active: { multiplier: 3 } }),
    );
    const progress = catalog.map((m) => makeProgress({ managerId: m.id }));

    const evalResult = evaluateLineup(catalog, progress);
    expect(evalResult.totalManagersConsidered).toBe(5);
  });
});

describe("Rationale", () => {
  it("includes score in rationale", () => {
    const catalog = [makeManager({ id: "mgr-test", active: { multiplier: 5 } })];
    const progress = [makeProgress({ managerId: "mgr-test", level: 10, rank: 2 })];

    const evalResult = evaluateLineup(catalog, progress);
    const rec = evalResult.areaRecommendations["Mine Shaft"][0];
    expect(rec.rationale).toContain("Score");
    expect(rec.rationale).toContain("Level 10");
    expect(rec.rationale).toContain("Rank 2");
  });
});

describe("Verified release evidence", () => {
  it("fills omitted sprite and ability fields from manager master data", () => {
    const pkg = {
      releaseId: "release", manifestHash: "hash", catalogVersion: "v1",
      artifacts: {
        "catalog-core.json": {
          filename: "catalog-core.json", sha256: "x", bytes: 1, schemaVersion: "1.0.0",
          content: { managers: [{ canonicalId: "sm-10066", name: null, rarity: "rare", role: "Warehouse", extensions: { superManagerId: 10066 }, active: null, abilities: [], passives: [], spriteRefs: [] }] },
        },
      },
    } as unknown as CachedCatalogPackage;
    const manager = managersFromVerifiedPackage(pkg)[0];
    expect(manager.name).toBe("Altitude");
    expect(manager.sprite).toBe("AlTitude");
    expect(manager.active?.description).toContain("resources from Warehouse workers");
    expect(manager.active?.cooldown).toBe(1800);
  });

  const verifiedPackage: CachedCatalogPackage = {
    id: "release-1::abc", releaseId: "release-1", manifestHash: "abc", catalogVersion: "1.2.3",
    gameVersion: "1", gameVersionCode: 1, manifestSchemaVersion: "2.0.0", cachedAt: "2026-01-01T00:00:00Z",
    verifiedAt: "2026-01-01T00:00:00Z", clientVersion: "test", verificationVersion: 1, storageBaseUrl: "/",
    totalBytes: 1, isActive: true, isPendingActivation: false, isBootstrap: false, source: "published", verificationState: "verified", warnings: [],
    artifacts: { "catalog-core.json": { filename: "catalog-core.json", sha256: "x", bytes: 1, schemaVersion: "1.0.0", content: { managers: [{ canonicalId: "mgr-verified", name: "Verified", rarity: "Rare", type: "Elevator", active: { multiplier: 3 } }] } } },
  };

  it("uses only catalog-core managers and retains immutable package evidence", () => {
    const result = evaluateVerifiedLineup(verifiedPackage, [makeProgress({ managerId: "mgr-verified" })]);
    expect(result.catalogReleaseId).toBe("release-1");
    expect(result.catalogVersion).toBe("1.2.3");
    expect(result.manifestHash).toBe("abc");
    expect(result.areaRecommendations.Elevator[0].name).toBe("Verified");
  });

  it("excludes unknown unlocked IDs instead of making advice up", () => {
    const result = evaluateVerifiedLineup(verifiedPackage, [makeProgress({ managerId: "not-mapped" })]);
    expect(result.totalManagersConsidered).toBe(0);
    expect(result.unevaluated[0].reason).toContain("not present");
  });

  it("returns no manager facts when catalog-core is unavailable", () => {
    expect(managersFromVerifiedPackage({ ...verifiedPackage, artifacts: {} })).toEqual([]);
  });

  it("hydrates names from localization and preserves game IDs/passives", () => {
    const pkg = {
      ...verifiedPackage,
      artifacts: {
        "catalog-core.json": {
          ...verifiedPackage.artifacts["catalog-core.json"],
          content: { managers: [{ canonicalId: "sm-10029", name: null, role: "Elevator", rarity: "Rare", extensions: { superManagerId: 10029 }, passives: [{ description: "Boost" }] }] },
        },
        "localization.json": {
          filename: "localization.json", sha256: "x", bytes: 1, schemaVersion: "1.0.0",
          content: { entries: { "sm-10029": { displayName: "Dr. Nova" } } },
        },
      },
    } as CachedCatalogPackage;
    const [manager] = managersFromVerifiedPackage(pkg);
    expect(manager.name).toBe("Dr. Nova");
    expect(manager.gameId).toBe(10029);
    expect(manager.passives?.[0].description).toBe("Boost");
  });

  it("derives a display name from NameKey when localization is missing", () => {
    const pkg = {
      ...verifiedPackage,
      artifacts: { "catalog-core.json": { ...verifiedPackage.artifacts["catalog-core.json"], content: { managers: [{ canonicalId: "sm-10001", name: null, role: "Elevator", rarity: "Common", sourceIdentifiers: { nameKey: "SM_LeeVatori" } }] } } },
    } as CachedCatalogPackage;
    expect(managersFromVerifiedPackage(pkg)[0].name).toBe("Lee Vatori");
  });

  it("uses the bundled APK name fallback when the active package has no name source", () => {
    const pkg = {
      ...verifiedPackage,
      artifacts: { "catalog-core.json": { ...verifiedPackage.artifacts["catalog-core.json"], content: { managers: [{ canonicalId: "sm-10066", name: null, role: "Warehouse", rarity: "Rare" }] } } },
    } as CachedCatalogPackage;
    expect(managersFromVerifiedPackage(pkg)[0].name).toBe("Altitude");
  });
});
