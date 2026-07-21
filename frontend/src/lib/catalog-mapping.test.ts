/**
 * Catalog Mapping Resolver Tests
 *
 * Covers:
 *   - Matched IDs resolve to canonical names through mappings.json
 *   - Unmatched IDs remain unresolved (null canonicalId)
 *   - Overrides take priority over generated mappings
 *   - Re-interpretation of old snapshots with new catalog
 *   - Alias resolution
 *
 * @vitest-environment jsdom
 */

import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import {
  resolveId,
  resolveIds,
  getUnresolved,
  needsReinterpretation,
  type MappingOverride,
} from "./catalog-mapping";
import { storePackage, activatePackage, clearCache } from "./catalog-cache";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_RELEASE_ID = "test-release-1.0";
const MOCK_CATALOG_VERSION = "1.0.0-100000-test";
const MOCK_MANIFEST_HASH = "m".repeat(64);

/** Build a mock catalog-core artifact. */
function mockCatalogCore() {
  return {
    managers: [
      { canonicalId: "mgr-lorenzo", name: "Sir Lorenzo", rarity: "Legendary" },
      { canonicalId: "mgr-steiner", name: "Dr Steiner", rarity: "Epic" },
      { canonicalId: "mgr-bloom", name: "Professor Bloom", rarity: "Rare" },
    ],
    mines: [],
    equipment: [],
    research: [],
    collectibles: [],
    artifacts: [],
  };
}

/** Build a mock mappings.json artifact. */
function mockMappings() {
  return {
    idMappings: [
      { canonicalId: "mgr-lorenzo", kind: "kolibri_id", sourceValue: "kol-1001", confidence: "verified" },
      { canonicalId: "mgr-steiner", kind: "kolibri_id", sourceValue: "kol-1002", confidence: "verified" },
      { canonicalId: "mgr-bloom", kind: "kolibri_id", sourceValue: "kol-1003", confidence: "inferred" },
      { canonicalId: "mgr-lorenzo", kind: "unity_guid", sourceValue: "guid-abc", confidence: "verified" },
    ],
    aliases: [
      { canonicalId: "mgr-lorenzo", alias: "Lorenzo", kind: "abbreviation" },
      { canonicalId: "mgr-steiner", alias: "Dr S", kind: "abbreviation" },
    ],
  };
}

/** Seed a mock active catalog. */
async function seedCatalog() {
  await clearCache();
  const pkg = {
    id: `${MOCK_RELEASE_ID}::${MOCK_MANIFEST_HASH}`,
    releaseId: MOCK_RELEASE_ID,
    manifestHash: MOCK_MANIFEST_HASH,
    catalogVersion: MOCK_CATALOG_VERSION,
    gameVersion: "1.0.0",
    gameVersionCode: 100000,
    manifestSchemaVersion: "2.0.0",
    cachedAt: new Date().toISOString(),
    verifiedAt: new Date().toISOString(),
    clientVersion: "0.2.0",
    verificationVersion: 1,
    storageBaseUrl: "./",
    artifacts: {
      "mappings.json": {
        filename: "mappings.json",
        content: mockMappings(),
        sha256: "a".repeat(64),
        bytes: 400,
        schemaVersion: "1.0.0",
      },
      "catalog-core.json": {
        filename: "catalog-core.json",
        content: mockCatalogCore(),
        sha256: "b".repeat(64),
        bytes: 300,
        schemaVersion: "1.0.0",
      },
    },
    totalBytes: 700,
    isActive: false,
    isPendingActivation: false,
    isBootstrap: false,
    source: "published" as const,
    verificationState: "verified" as const,
    warnings: [],
  };
  await storePackage(pkg);
  await activatePackage(MOCK_RELEASE_ID, MOCK_MANIFEST_HASH);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(async () => {
  await clearCache();
});

describe("Matched IDs", () => {
  it("resolves a known kolibri_id to a canonical ID through mappings.json", async () => {
    await seedCatalog();
    const evidence = await resolveId("kol-1001");
    expect(evidence.resolution).toBe("mapping");
    expect(evidence.canonicalId).toBe("mgr-lorenzo");
    expect(evidence.displayName).toBe("Sir Lorenzo");
    expect(evidence.confidence).toBe("verified");
  });

  it("resolves multiple IDs at once", async () => {
    await seedCatalog();
    const results = await resolveIds([
      { sourceValue: "kol-1001" },
      { sourceValue: "kol-1002" },
    ]);
    expect(results.size).toBe(2);
    expect(results.get("kol-1001")!.canonicalId).toBe("mgr-lorenzo");
    expect(results.get("kol-1002")!.canonicalId).toBe("mgr-steiner");
  });
});

describe("Unmatched IDs", () => {
  it("returns unresolved for an unknown kolibri_id", async () => {
    await seedCatalog();
    const evidence = await resolveId("kol-9999");
    expect(evidence.resolution).toBe("unresolved");
    expect(evidence.canonicalId).toBeNull();
    expect(evidence.displayName).toBeNull();
  });

  it("getUnresolved returns only unresolved IDs", async () => {
    await seedCatalog();
    const unresolved = await getUnresolved(["kol-1001", "kol-9999", "kol-8888"]);
    expect(unresolved).toHaveLength(2);
    expect(unresolved.map((u) => u.sourceValue).sort()).toEqual(["kol-8888", "kol-9999"].sort());
  });
});

describe("Alias resolution", () => {
  it("resolves through aliases when mapping not found", async () => {
    await seedCatalog();
    const evidence = await resolveId("Lorenzo");
    expect(evidence.resolution).toBe("alias");
    expect(evidence.canonicalId).toBe("mgr-lorenzo");
    expect(evidence.displayName).toBe("Sir Lorenzo");
  });
});

describe("Manual overrides", () => {
  it("overrides take priority over generated mappings", async () => {
    await seedCatalog();
    const overrides: MappingOverride[] = [
      {
        id: "ov-1",
        sourceKind: "kolibri_id",
        sourceValue: "kol-1001",
        canonicalId: "mgr-steiner",
        confidence: "manual",
        reason: "User correction",
        createdBy: "admin",
        createdAt: new Date().toISOString(),
      },
    ];
    // Normally kol-1001 maps to mgr-lorenzo, but override sends it to mgr-steiner
    const evidence = await resolveId("kol-1001", "kolibri_id", overrides);
    expect(evidence.resolution).toBe("override");
    expect(evidence.canonicalId).toBe("mgr-steiner");
    expect(evidence.confidence).toBe("manual");
  });

  it("override confidence is reported correctly", async () => {
    await seedCatalog();
    const overrides: MappingOverride[] = [
      {
        id: "ov-2",
        sourceKind: "kolibri_id",
        sourceValue: "kol-9999",
        canonicalId: "mgr-bloom",
        confidence: "inferred",
        reason: "Best guess",
        createdBy: "system",
        createdAt: new Date().toISOString(),
      },
    ];
    const evidence = await resolveId("kol-9999", "kolibri_id", overrides);
    expect(evidence.resolution).toBe("override");
    expect(evidence.confidence).toBe("inferred");
  });
});

describe("Catalog version tracking", () => {
  it("evidence includes the active catalog version", async () => {
    await seedCatalog();
    const evidence = await resolveId("kol-1001");
    expect(evidence.catalogVersion).toBe(MOCK_CATALOG_VERSION);
    expect(evidence.releaseId).toBe(MOCK_RELEASE_ID);
  });

  it("needsReinterpretation returns false when same catalog", async () => {
    await seedCatalog();
    const needs = await needsReinterpretation(MOCK_CATALOG_VERSION);
    expect(needs).toBe(false);
  });

  it("needsReinterpretation returns true for a different catalog", async () => {
    await seedCatalog();
    const needs = await needsReinterpretation("0.9.0-090000-old");
    expect(needs).toBe(true);
  });
});

describe("Edge cases", () => {
  it("returns unresolved with null fields when no catalog is active", async () => {
    // No catalog seeded
    const evidence = await resolveId("any-id");
    expect(evidence.resolution).toBe("unresolved");
    expect(evidence.canonicalId).toBeNull();
  });

  it("handles empty source value gracefully", async () => {
    await seedCatalog();
    const evidence = await resolveId("", "kolibri_id");
    expect(evidence.resolution).toBe("unresolved");
  });

  it("resolves by different source kind", async () => {
    await seedCatalog();
    const evidence = await resolveId("guid-abc", "unity_guid");
    expect(evidence.resolution).toBe("mapping");
    expect(evidence.canonicalId).toBe("mgr-lorenzo");
  });
});
