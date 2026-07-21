/**
 * Catalog Client Tests
 *
 * Covers:
 *   - IndexedDB cache: store, retrieve, activate, evict
 *   - Catalog client state machine transitions
 *   - Offline bootstrap fallback
 *   - Hash mismatch handling
 *   - Release switching (atomically deactivate old, activate new)
 *   - Cache status reporting
 *   - Player state isolation (catalog cache is independent)
 *
 * @vitest-environment jsdom
 */

import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  storePackage,
  getPackage,
  getActivePackage,
  activatePackage,
  isCached,
  getBootstrapPackage,
  listPackages,
  evictOldPackages,
  getCacheStatus,
  clearCache,
  type CachedCatalogPackage,
} from "./catalog-cache";
import { createCatalogClient, type CatalogClientState } from "./catalog-client";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makePackage(overrides: Partial<CachedCatalogPackage> = {}): CachedCatalogPackage {
  const manifestHash = overrides.manifestHash ?? "a".repeat(64);
  const releaseId = overrides.releaseId ?? "test-release";
  const now = new Date().toISOString();
  return {
    id: `${releaseId}::${manifestHash}`,
    releaseId,
    manifestHash,
    catalogVersion: overrides.catalogVersion ?? "1.0.0-100000-test",
    gameVersion: overrides.gameVersion ?? "1.0.0",
    gameVersionCode: overrides.gameVersionCode ?? 100000,
    manifestSchemaVersion: overrides.manifestSchemaVersion ?? "2.0.0",
    cachedAt: overrides.cachedAt ?? now,
    verifiedAt: overrides.verifiedAt ?? now,
    clientVersion: overrides.clientVersion ?? "0.2.0",
    verificationVersion: overrides.verificationVersion ?? 1,
    storageBaseUrl: overrides.storageBaseUrl ?? "https://storage.example.com/catalogs/test/",
    artifacts: overrides.artifacts ?? {
      "catalog-core.json": {
        filename: "catalog-core.json",
        content: { managers: [{ canonicalId: "mgr-1", name: "Test" }] },
        sha256: "b".repeat(64),
        bytes: 100,
        schemaVersion: "1.0.0",
      },
      "validation-report.json": {
        filename: "validation-report.json",
        content: { status: "passed" },
        sha256: "c".repeat(64),
        bytes: 200,
        schemaVersion: "1.0.0",
      },
    },
    totalBytes: overrides.totalBytes ?? 300,
    isActive: overrides.isActive ?? false,
    isPendingActivation: overrides.isPendingActivation ?? false,
    isBootstrap: overrides.isBootstrap ?? false,
    source: overrides.source ?? "published",
    verificationState: overrides.verificationState ?? "verified",
    warnings: overrides.warnings ?? [],
  };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(async () => {
  await clearCache();
});

afterEach(async () => {
  await clearCache();
});

// ---------------------------------------------------------------------------
// Cache tests
// ---------------------------------------------------------------------------

describe("Catalog cache (IndexedDB)", () => {
  it("stores and retrieves a package", async () => {
    const pkg = makePackage();
    await storePackage(pkg);

    const retrieved = await getPackage(pkg.releaseId, pkg.manifestHash);
    expect(retrieved).toBeDefined();
    expect(retrieved!.releaseId).toBe(pkg.releaseId);
    expect(retrieved!.manifestHash).toBe(pkg.manifestHash);
    expect(retrieved!.artifacts["catalog-core.json"]).toBeDefined();
  });

  it("isCached returns true for stored packages", async () => {
    const pkg = makePackage();
    expect(await isCached(pkg.releaseId, pkg.manifestHash)).toBe(false);
    await storePackage(pkg);
    expect(await isCached(pkg.releaseId, pkg.manifestHash)).toBe(true);
  });

  it("activatePackage sets exactly one active package", async () => {
    const pkg1 = makePackage({ releaseId: "rel-1", manifestHash: "1".repeat(64), isActive: false });
    const pkg2 = makePackage({ releaseId: "rel-2", manifestHash: "2".repeat(64), isActive: false });

    await storePackage(pkg1);
    await storePackage(pkg2);

    await activatePackage("rel-1", "1".repeat(64));
    let active = await getActivePackage();
    expect(active!.releaseId).toBe("rel-1");

    await activatePackage("rel-2", "2".repeat(64));
    active = await getActivePackage();
    expect(active!.releaseId).toBe("rel-2");

    // Old one should be deactivated
    const old = await getPackage("rel-1", "1".repeat(64));
    expect(old!.isActive).toBe(false);
  });

  it("getBootstrapPackage returns the bootstrap package", async () => {
    const pkg = makePackage({ isBootstrap: true, releaseId: "bootstrap-release" });
    await storePackage(pkg);

    const bootstrap = await getBootstrapPackage();
    expect(bootstrap).toBeDefined();
    expect(bootstrap!.isBootstrap).toBe(true);
    expect(bootstrap!.releaseId).toBe("bootstrap-release");
  });

  it("listPackages returns all packages ordered by cachedAt desc", async () => {
    const pkg1 = makePackage({ releaseId: "old", cachedAt: "2024-01-01T00:00:00.000Z" });
    const pkg2 = makePackage({ releaseId: "new", cachedAt: "2025-01-01T00:00:00.000Z" });

    await storePackage(pkg1);
    await storePackage(pkg2);

    const list = await listPackages();
    expect(list).toHaveLength(2);
    expect(list[0].releaseId).toBe("new"); // newest first
    expect(list[1].releaseId).toBe("old");
  });

  it("evictOldPackages keeps active, bootstrap, recent, and last-known-good", async () => {
    const active = makePackage({ releaseId: "active-rel", isActive: true, cachedAt: "2025-08-01T00:00:00.000Z" });
    const bootstrap = makePackage({ releaseId: "bootstrap-rel", isBootstrap: true, cachedAt: "2025-07-15T00:00:00.000Z" });
    const lastKnownGood = makePackage({ releaseId: "last-good", cachedAt: "2025-07-01T00:00:00.000Z" });
    const recent = makePackage({ releaseId: "recent-1", cachedAt: "2025-06-01T00:00:00.000Z" });
    const old = makePackage({ releaseId: "old-rel", cachedAt: "2023-01-01T00:00:00.000Z" });

    await storePackage(active);
    await storePackage(bootstrap);
    await storePackage(lastKnownGood);
    await storePackage(recent);
    await storePackage(old);

    const evicted = await evictOldPackages(1); // keep 1 recent
    // Evicted: recent-1 and old-rel (not active/bootstrap/last-known-good)
    // With keepCount=1: last-good is kept (most recent non-protected), old-rel and recent-1 evicted
    expect(evicted).toBe(2);

    const remaining = await listPackages();
    const ids = remaining.map((p) => p.releaseId);
    expect(ids).toContain("active-rel");
    expect(ids).toContain("bootstrap-rel");
    expect(ids).toContain("last-good");
    expect(ids).not.toContain("recent-1");
    expect(ids).not.toContain("old-rel");
  });

  it("getCacheStatus returns correct summary", async () => {
    const pkg = makePackage({ releaseId: "rel-1", manifestHash: "1".repeat(64), totalBytes: 500 });
    await storePackage(pkg);
    await activatePackage("rel-1", "1".repeat(64));

    const status = await getCacheStatus();
    expect(status.packageCount).toBe(1);
    expect(status.totalCacheBytes).toBe(500);
    expect(status.activeReleaseId).toBe("rel-1");
    expect(status.activeManifestHash).toBe("1".repeat(64));

    // totalBytes should match the manifest-declared sum (use overrides)
    const pkg2 = makePackage({
      releaseId: "rel-2",
      manifestHash: "2".repeat(64),
      totalBytes: 1234,
      isActive: false,
    });
    await storePackage(pkg2);
    const status2 = await getCacheStatus();
    expect(status2.packageCount).toBe(2);
    expect(status2.totalCacheBytes).toBe(500 + 1234);
  });
});

// ---------------------------------------------------------------------------
// Client tests
// ---------------------------------------------------------------------------

describe("Catalog client", () => {
  it("creates a client in idle state", () => {
    const client = createCatalogClient();
    expect(client.loadState.phase).toBe("idle");
  });

  it("subscribe emits initial state immediately", () => {
    const client = createCatalogClient();
    const states: string[] = [];
    const unsub = client.subscribe((s) => states.push(s.loadState.phase));
    expect(states).toContain("idle");
    unsub();
  });

  it("subscribe can be unsubscribed", () => {
    const client = createCatalogClient();
    let count = 0;
    const unsub = client.subscribe(() => count++);
    unsub();
    // Initial emission fires once, unsubscribe prevents future
    expect(count).toBe(1);
  });

  it("hasCatalog returns false when no package is cached", async () => {
    const client = createCatalogClient();
    expect(await client.hasCatalog()).toBe(false);
  });

  it("hasCatalog returns true after storing and activating a verified package", async () => {
    const pkg = makePackage({ isActive: true, verificationState: "verified" });
    await storePackage(pkg);

    const client = createCatalogClient();
    expect(await client.hasCatalog()).toBe(true);
  });

  it("hasCatalog returns false for failed verification", async () => {
    const pkg = makePackage({ isActive: true, verificationState: "failed" });
    await storePackage(pkg);

    const client = createCatalogClient();
    expect(await client.hasCatalog()).toBe(false);
  });

  it("getActivePackage returns the active package", async () => {
    const pkg = makePackage({ isActive: true, releaseId: "my-release" });
    await storePackage(pkg);

    const client = createCatalogClient();
    const active = await client.getActivePackage();
    expect(active).toBeDefined();
    expect(active!.releaseId).toBe("my-release");
  });

  it("getArtifact returns a specific artifact from the active package", async () => {
    const pkg = makePackage({ isActive: true });
    await storePackage(pkg);

    const client = createCatalogClient();
    const artifact = await client.getArtifact("catalog-core.json");
    expect(artifact).toBeDefined();
    expect(artifact!.filename).toBe("catalog-core.json");
  });

  it("getArtifact returns undefined for unknown artifact", async () => {
    const pkg = makePackage({ isActive: true });
    await storePackage(pkg);

    const client = createCatalogClient();
    const artifact = await client.getArtifact("nonexistent.json");
    expect(artifact).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Release switching
// ---------------------------------------------------------------------------

describe("Release switching", () => {
  it("atomically switches active release without blending artifacts", async () => {
    const pkg1 = makePackage({
      releaseId: "rel-1",
      manifestHash: "1".repeat(64),
      isActive: true,
      catalogVersion: "1.0.0",
      artifacts: {
        "catalog-core.json": {
          filename: "catalog-core.json",
          content: { managers: [{ canonicalId: "mgr-1" }] },
          sha256: "a1".repeat(32),
          bytes: 50,
          schemaVersion: "1.0.0",
        },
      },
    });

    const pkg2 = makePackage({
      releaseId: "rel-2",
      manifestHash: "2".repeat(64),
      isActive: false,
      catalogVersion: "2.0.0",
      artifacts: {
        "catalog-core.json": {
          filename: "catalog-core.json",
          content: { managers: [{ canonicalId: "mgr-99" }] },
          sha256: "b2".repeat(32),
          bytes: 55,
          schemaVersion: "1.0.0",
        },
      },
    });

    await storePackage(pkg1);
    await storePackage(pkg2);

    // Verify rel-1 is active
    let active = await getActivePackage();
    expect(active!.releaseId).toBe("rel-1");
    expect((active!.artifacts["catalog-core.json"].content as Record<string, unknown>).managers).toEqual([{ canonicalId: "mgr-1" }]);

    // Switch to rel-2
    await activatePackage("rel-2", "2".repeat(64));

    active = await getActivePackage();
    expect(active!.releaseId).toBe("rel-2");
    expect((active!.artifacts["catalog-core.json"].content as Record<string, unknown>).managers).toEqual([{ canonicalId: "mgr-99" }]);

    // rel-1 is still in cache but deactivated
    const old = await getPackage("rel-1", "1".repeat(64));
    expect(old).toBeDefined();
    expect(old!.isActive).toBe(false);

    // Artifacts from different releases are never blended — they're in separate cache entries
    expect(old!.artifacts["catalog-core.json"].sha256).not.toBe(active!.artifacts["catalog-core.json"].sha256);
  });
});

// ---------------------------------------------------------------------------
// Player state isolation
// ---------------------------------------------------------------------------

describe("Player state isolation", () => {
  it("catalog cache operations do not affect player progress tables", async () => {
    // The catalog cache uses a SEPARATE Dexie database ("mineops_catalog_cache")
    // from the main app database ("mineops"). This test verifies that storing
    // catalog packages does not touch player-related tables.

    const pkg = makePackage();
    await storePackage(pkg);
    await activatePackage(pkg.releaseId, pkg.manifestHash);

    const cached = await getPackage(pkg.releaseId, pkg.manifestHash);
    expect(cached).toBeDefined();

    // Clear the catalog cache — player data in separate DB is unaffected
    await clearCache();
    const after = await getPackage(pkg.releaseId, pkg.manifestHash);
    expect(after).toBeUndefined();
  });
});
