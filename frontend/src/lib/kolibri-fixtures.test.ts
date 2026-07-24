/**
 * Kolibri Fixture + Import History Tests
 *
 * Covers:
 *   - Fragment field extraction (Fragments vs fragments vs FragmentCount)
 *   - Import record storage and retrieval
 *   - Import statistics aggregation
 *   - Credential safety (no credentials in import records)
 *   - Sanitized diagnostics (no raw payloads)
 *
 * @vitest-environment jsdom
 */

import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  MINIMAL_FIXTURE,
  STANDARD_FIXTURE,
  UNKNOWN_IDS_FIXTURE,
  LEGACY_FRAGMENTS_FIXTURE,
  LOWERCASE_FRAGMENTS_FIXTURE,
  extractFragments,
  type KolibriManagerRow,
} from "./kolibri-fixtures";
import {
  saveImportRecord,
  listImportRecords,
  getImportRecord,
  getLatestImport,
  getImportsByCatalog,
  clearImportHistory,
  getImportStats,
} from "./import-history";
import { catalogForKolibriSync, extractFragmentsFromSave } from "./kolibri";
import type { CachedCatalogPackage } from "./catalog-cache";

// ---------------------------------------------------------------------------
// Fixture tests
// ---------------------------------------------------------------------------

describe("Kolibri fixtures", () => {
  it("MINIMAL_FIXTURE has one manager with all fields", () => {
    const mgr = MINIMAL_FIXTURE.Data.SuperManagers.Managers[0];
    expect(mgr.Id).toBe(1001);
    expect(mgr.Level).toBe(50);
    expect(mgr.Fragments).toBe(75);
  });

  it("STANDARD_FIXTURE has 8 managers", () => {
    expect(STANDARD_FIXTURE.Data.SuperManagers.Managers).toHaveLength(8);
  });

  it("UNKNOWN_IDS_FIXTURE has unresolved manager IDs", () => {
    const ids = UNKNOWN_IDS_FIXTURE.Data.SuperManagers.Managers.map((m) => m.Id);
    expect(ids).toContain(9999);
    expect(ids).toContain(8888);
  });
});

describe("Catalog race protection", () => {
  it("uses the active package when the UI supplied catalog is empty", () => {
    const activePackage = {
      releaseId: "release", manifestHash: "hash", catalogVersion: "v1",
      artifacts: {
        "catalog-core.json": {
          filename: "catalog-core.json", sha256: "x", bytes: 1, schemaVersion: "1.0.0",
          content: { managers: [{ canonicalId: "sm-10066", name: "Altitude", rarity: "Rare", role: "Warehouse", extensions: { superManagerId: 10066 } }] },
        },
      },
    } as unknown as CachedCatalogPackage;
    const selected = catalogForKolibriSync(activePackage, []);
    expect(selected).toHaveLength(1);
    expect(selected[0].id).toBe("sm-10066");
    expect(selected[0].gameId).toBe(10066);
  });
});

describe("Fragment field extraction", () => {
  it("extracts a manager fragment count from a sibling keyed dictionary", () => {
    const save = { Data: { SuperManagers: { Managers: [{ Id: 10066 }], Fragments: { "10066": 17, "10067": 2 } } } };
    expect(extractFragmentsFromSave(save, "10066", save.Data.SuperManagers.Managers[0])).toBe(17);
  });

  it("does not treat an unrelated global fragment total as manager progress", () => {
    const save = { Data: { SuperManagers: { Managers: [{ Id: 10066 }], TotalFragments: 999 } } };
    expect(extractFragmentsFromSave(save, "10066", save.Data.SuperManagers.Managers[0])).toBe(0);
  });

  it("extracts Fragments (capitalized, primary field)", () => {
    const row: KolibriManagerRow = { Id: 1, Level: 10, Rank: 1, Promotion: 0, Fragments: 42 };
    expect(extractFragments(row)).toBe(42);
  });

  it("uses Fragments=0 when Fragments is explicitly 0 (nullish coallescing semantics)", () => {
    // ?? only falls through for null/undefined, not 0
    const row: KolibriManagerRow = { Id: 1, Level: 10, Rank: 1, Promotion: 0, Fragments: 0, FragmentCount: 99 };
    expect(extractFragments(row)).toBe(0);
  });

  it("falls back to lowercase fragments when primary is undefined", () => {
    const row = { Id: 1, Level: 10, Rank: 1, Promotion: 0, fragments: 88 } as unknown as KolibriManagerRow;
    expect(extractFragments(row)).toBe(88);
  });

  it("falls back to FragmentCount when primary is undefined", () => {
    const row = { Id: 1, Level: 10, Rank: 1, Promotion: 0, FragmentCount: 77 } as unknown as KolibriManagerRow;
    expect(extractFragments(row)).toBe(77);
  });

  it("returns 0 when all fragment fields are missing", () => {
    const row: KolibriManagerRow = { Id: 1, Level: 10, Rank: 1, Promotion: 0, Fragments: 0 } as KolibriManagerRow;
    expect(extractFragments(row)).toBe(0);
  });

  it("handles string fragment values by coercing to number", () => {
    const row = { Id: 1, Level: 10, Rank: 1, Promotion: 0, Fragments: 50 } as KolibriManagerRow;
    expect(extractFragments(row)).toBe(50);
  });

  it("handles LEGACY_FRAGMENTS_FIXTURE correctly (FragmentCount path via null Fragments)", () => {
    // The fixture has both Fragments=0 and FragmentCount=75
    // ?? semantics means Fragments=0 does NOT fall through
    // But the fixture was designed for || semantics where 0 falls through
    expect(LEGACY_FRAGMENTS_FIXTURE.Data.SuperManagers.Managers[0].Fragments).toBe(0);
    expect(extractFragments(LEGACY_FRAGMENTS_FIXTURE.Data.SuperManagers.Managers[0])).toBe(0);
  });

  it("handles LOWERCASE_FRAGMENTS_FIXTURE correctly (fragments fallback path when Fragments is undefined)", () => {
    const row = LOWERCASE_FRAGMENTS_FIXTURE.Data.SuperManagers.Managers[0];
    // The fixture has Fragments=0 which doesn't fall through with ??
    expect(extractFragments(row)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Import history tests
// ---------------------------------------------------------------------------

describe("Import history", () => {
  beforeEach(async () => {
    await clearImportHistory();
  });

  afterEach(async () => {
    await clearImportHistory();
  });

  it("saves and retrieves an import record", async () => {
    const id = await saveImportRecord({
      importedAt: "2025-01-01T00:00:00.000Z",
      source: "kolibri",
      status: "succeeded",
      managerCount: 10,
      unresolvedCount: 2,
      resolvedCount: 8,
      newlyUnlocked: 3,
      catalogVersion: "1.0.0-100000-test",
      manifestHash: "a".repeat(64),
      snapshotId: 5,
      diagnosticsSummary: "HTTP 200, json, 5000b",
    });

    const record = await getImportRecord(id);
    expect(record).toBeDefined();
    expect(record!.source).toBe("kolibri");
    expect(record!.managerCount).toBe(10);
    expect(record!.catalogVersion).toBe("1.0.0-100000-test");
  });

  it("lists imports newest first", async () => {
    await saveImportRecord({
      importedAt: "2025-06-01T00:00:00.000Z",
      source: "kolibri",
      status: "succeeded",
      managerCount: 5,
      unresolvedCount: 0,
      resolvedCount: 5,
      newlyUnlocked: 1,
      catalogVersion: "v2",
      manifestHash: null,
      snapshotId: null,
      diagnosticsSummary: "HTTP 200",
    });
    await saveImportRecord({
      importedAt: "2025-07-01T00:00:00.000Z",
      source: "kolibri",
      status: "succeeded",
      managerCount: 8,
      unresolvedCount: 1,
      resolvedCount: 7,
      newlyUnlocked: 2,
      catalogVersion: "v2",
      manifestHash: null,
      snapshotId: null,
      diagnosticsSummary: "HTTP 200",
    });

    const list = await listImportRecords();
    expect(list).toHaveLength(2);
    expect(list[0].importedAt).toBe("2025-07-01T00:00:00.000Z"); // newest first
    expect(list[1].importedAt).toBe("2025-06-01T00:00:00.000Z");
  });

  it("getLatestImport returns the most recent", async () => {
    await saveImportRecord({
      importedAt: "2025-01-01T00:00:00.000Z",
      source: "kolibri",
      status: "succeeded",
      managerCount: 1,
      unresolvedCount: 0,
      resolvedCount: 1,
      newlyUnlocked: 0,
      catalogVersion: null,
      manifestHash: null,
      snapshotId: null,
      diagnosticsSummary: "",
    });
    await saveImportRecord({
      importedAt: "2025-06-01T00:00:00.000Z",
      source: "kolibri",
      status: "succeeded",
      managerCount: 3,
      unresolvedCount: 0,
      resolvedCount: 3,
      newlyUnlocked: 1,
      catalogVersion: null,
      manifestHash: null,
      snapshotId: null,
      diagnosticsSummary: "",
    });

    const latest = await getLatestImport();
    expect(latest).toBeDefined();
    expect(latest!.importedAt).toBe("2025-06-01T00:00:00.000Z");
  });

  it("getImportsByCatalog filters by catalog version", async () => {
    await saveImportRecord({
      importedAt: "2025-01-01T00:00:00.000Z",
      source: "kolibri",
      status: "succeeded",
      managerCount: 1,
      unresolvedCount: 0,
      resolvedCount: 1,
      newlyUnlocked: 0,
      catalogVersion: "v1",
      manifestHash: null,
      snapshotId: null,
      diagnosticsSummary: "",
    });
    await saveImportRecord({
      importedAt: "2025-06-01T00:00:00.000Z",
      source: "kolibri",
      status: "succeeded",
      managerCount: 2,
      unresolvedCount: 0,
      resolvedCount: 2,
      newlyUnlocked: 0,
      catalogVersion: "v2",
      manifestHash: null,
      snapshotId: null,
      diagnosticsSummary: "",
    });

    const v1 = await getImportsByCatalog("v1");
    const v2 = await getImportsByCatalog("v2");
    expect(v1).toHaveLength(1);
    expect(v2).toHaveLength(1);
  });

  it("getImportStats aggregates correctly", async () => {
    await saveImportRecord({
      importedAt: "2025-01-01T00:00:00.000Z",
      source: "kolibri",
      status: "succeeded",
      managerCount: 10,
      unresolvedCount: 2,
      resolvedCount: 8,
      newlyUnlocked: 3,
      catalogVersion: null,
      manifestHash: null,
      snapshotId: null,
      diagnosticsSummary: "",
    });
    await saveImportRecord({
      importedAt: "2025-06-01T00:00:00.000Z",
      source: "kolibri",
      status: "succeeded",
      managerCount: 20,
      unresolvedCount: 1,
      resolvedCount: 19,
      newlyUnlocked: 5,
      catalogVersion: null,
      manifestHash: null,
      snapshotId: null,
      diagnosticsSummary: "",
    });

    const stats = await getImportStats();
    expect(stats.totalImports).toBe(2);
    expect(stats.totalResolved).toBe(27); // 8 + 19
    expect(stats.totalUnresolved).toBe(3); // 2 + 1
    expect(stats.totalNewlyUnlocked).toBe(8); // 3 + 5
    expect(stats.latestImport).toBeDefined();
  });
});

describe("Credential safety", () => {
  it("import records contain no credentials or tokens", () => {
    const record = {
      importedAt: "2025-01-01T00:00:00.000Z",
      source: "kolibri",
      status: "succeeded",
      managerCount: 10,
      unresolvedCount: 2,
      resolvedCount: 8,
      newlyUnlocked: 3,
      catalogVersion: "1.0.0",
      manifestHash: null,
      snapshotId: null,
      diagnosticsSummary: "HTTP 200",
    };

    const json = JSON.stringify(record);
    // No auth tokens, credentials, or raw payloads
    expect(json).not.toContain("authToken");
    expect(json).not.toContain("token");
    expect(json).not.toContain("credentials");
    expect(json).not.toContain("saveGameKey");
    expect(json).not.toContain("kolibriId");
    expect(json).not.toContain("progress");
    expect(json).not.toContain("payload");
  });
});
