/**
 * Catalog Cache — IndexedDB-backed storage for verified catalog packages.
 *
 * Each catalog package is stored by its compound identity:
 *   [releaseId, manifestHash]
 *
 * The cache supports:
 *   - Storing a complete verified package (all artifact JSON objects)
 *   - Retrieving the active (currently activated) package
 *   - Listing all cached packages with metadata
 *   - Evicting old packages (keep last-known-good + current)
 *   - Checking if a specific release+hash is already cached
 *
 * Immutability: a stored package is never modified in-place.
 * Activation creates a new entry or updates the "active" pointer.
 */

import Dexie, { type EntityTable } from "dexie";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CatalogArtifact {
  /** Artifact filename (e.g. "catalog-core.json") */
  filename: string;
  /** Parsed JSON content of the artifact */
  content: unknown;
  /** Verified SHA-256 from manifest */
  sha256: string;
  /** Verified byte count */
  bytes: number;
  /** Schema version declared in manifest */
  schemaVersion: string;
}

export interface CachedCatalogPackage {
  /** Compound key: `${releaseId}::${manifestHash}` */
  id: string;
  /** Source release identity */
  releaseId: string;
  /** SHA-256 of the manifest */
  manifestHash: string;
  /** Deterministic catalog version string */
  catalogVersion: string;
  /** Human-readable game version */
  gameVersion: string;
  /** Numeric game version code */
  gameVersionCode: number;
  /** Manifest schema version (e.g. "2.0.0") */
  manifestSchemaVersion: string;
  /** ISO-8601 timestamp when this package was cached */
  cachedAt: string;
  /** ISO-8601 timestamp when this package was last verified */
  verifiedAt: string;
  /** Client version that performed the verification */
  clientVersion: string;
  /** Version of the verification logic that last verified this package */
  verificationVersion: number;
  /** Storage base URL the artifacts were fetched from */
  storageBaseUrl: string;
  /** All verified artifacts, keyed by filename */
  artifacts: Record<string, CatalogArtifact>;
  /** Total size of all artifacts in bytes (sum of manifest-declared byte values after verification) */
  totalBytes: number;
  /** Whether this is the currently active package for the app */
  isActive: boolean;
  /** Whether this is a pending activation (in-progress switch) */
  isPendingActivation: boolean;
  /** Whether this is the bundled bootstrap (last-known-good) package */
  isBootstrap: boolean;
  /** Package origin source for diagnostics */
  source: "published" | "cache" | "bootstrap";
  /** Verification state after loading */
  verificationState: "verified" | "degraded" | "failed";
  /** Any non-fatal warnings from verification */
  warnings: string[];
}

export interface CatalogCacheStatus {
  /** Number of packages in the cache */
  packageCount: number;
  /** Total approximate bytes stored */
  totalCacheBytes: number;
  /** Active package releaseId (or null) */
  activeReleaseId: string | null;
  /** Active package manifestHash (or null) */
  activeManifestHash: string | null;
  /** ISO-8601 timestamp of the most recent activation */
  lastActivatedAt: string | null;
  /** Whether a bootstrap package exists in cache */
  hasBootstrap: boolean;
}

// ---------------------------------------------------------------------------
// Dexie database
// ---------------------------------------------------------------------------

class CatalogCacheDb extends Dexie {
  packages!: EntityTable<CachedCatalogPackage, "id">;

  constructor() {
    super("mineops_catalog_cache");
    this.version(1).stores({
      packages: "id, releaseId, manifestHash, isActive, isBootstrap, isPendingActivation, cachedAt",
    });
  }
}

const cacheDb = new CatalogCacheDb();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Store a verified catalog package in the cache.
 * If a package with the same id already exists, it is replaced.
 */
export async function storePackage(pkg: CachedCatalogPackage): Promise<void> {
  await cacheDb.packages.put(pkg);
}

/**
 * Check if a specific release+hash combination is already cached.
 */
export async function isCached(releaseId: string, manifestHash: string): Promise<boolean> {
  const id = `${releaseId}::${manifestHash}`;
  const count = await cacheDb.packages.where("id").equals(id).count();
  return count > 0;
}

/**
 * Retrieve a cached package by releaseId and manifestHash.
 */
export async function getPackage(releaseId: string, manifestHash: string): Promise<CachedCatalogPackage | undefined> {
  const id = `${releaseId}::${manifestHash}`;
  return cacheDb.packages.get(id);
}

/**
 * Get the currently active package.
 */
export async function getActivePackage(): Promise<CachedCatalogPackage | undefined> {
  const all = await cacheDb.packages.toArray();
  return all.find((p) => p.isActive === true);
}

/**
 * Activate a cached package. Deactivates any previously active package.
 */
export async function activatePackage(releaseId: string, manifestHash: string): Promise<void> {
  await cacheDb.transaction("rw", cacheDb.packages, async () => {
    // Deactivate all currently active packages
    const all = await cacheDb.packages.toArray();
    for (const pkg of all) {
      if (pkg.isActive) {
        await cacheDb.packages.update(pkg.id, { isActive: false });
      }
    }

    // Activate the target package
    const id = `${releaseId}::${manifestHash}`;
    await cacheDb.packages.update(id, { isActive: true });
  });
}

/**
 * Get the bootstrap (last-known-good) package.
 */
export async function getBootstrapPackage(): Promise<CachedCatalogPackage | undefined> {
  const all = await cacheDb.packages.toArray();
  return all.find((p) => p.isBootstrap === true);
}

/**
 * List all cached packages, newest first.
 */
export async function listPackages(): Promise<CachedCatalogPackage[]> {
  return cacheDb.packages.orderBy("cachedAt").reverse().toArray();
}

/**
 * Evict old packages, keeping the active package, the bootstrap package,
 * any package with a pending activation, the last-known-good package
 * (the one that was active before the current), and up to `keepCount`
 * most recent additional packages.
 */
export async function evictOldPackages(keepCount = 2): Promise<number> {
  const all = await cacheDb.packages.orderBy("cachedAt").reverse().toArray();
  const toKeep = new Set<string>();
  let kept = 0;

  // Find the last-known-good (the most recent active package that is not the current active)
  // This ensures eviction never removes recovery assets that would be needed
  // if a new activation fails.
  const activeIdx = all.findIndex((p) => p.isActive);

  for (let i = 0; i < all.length; i++) {
    const pkg = all[i];
    // Always keep: active, bootstrap, pending-activation packages
    if (pkg.isActive || pkg.isBootstrap || pkg.isPendingActivation) {
      toKeep.add(pkg.id);
    }
    // Also keep the last-known-good (the most recent formerly-active package)
    // if a newer active package exists and this one was previously active
    else if (activeIdx >= 0 && i > activeIdx && i <= activeIdx + 1) {
      toKeep.add(pkg.id);
    }
    // Keep up to keepCount most recent other packages
    else if (kept < keepCount) {
      toKeep.add(pkg.id);
      kept++;
    }
  }

  let evicted = 0;
  for (const pkg of all) {
    if (!toKeep.has(pkg.id)) {
      await cacheDb.packages.delete(pkg.id);
      evicted++;
    }
  }

  return evicted;
}

/**
 * Get cache status summary.
 */
export async function getCacheStatus(): Promise<CatalogCacheStatus> {
  const all = await cacheDb.packages.toArray();
  const active = all.find((p) => p.isActive);
  const bootstrap = all.find((p) => p.isBootstrap);

  return {
    packageCount: all.length,
    totalCacheBytes: all.reduce((sum, p) => sum + p.totalBytes, 0),
    activeReleaseId: active?.releaseId ?? null,
    activeManifestHash: active?.manifestHash ?? null,
    lastActivatedAt: active?.cachedAt ?? null,
    hasBootstrap: !!bootstrap,
  };
}

/**
 * Clear the entire catalog cache.
 */
export async function clearCache(): Promise<void> {
  await cacheDb.packages.clear();
}
