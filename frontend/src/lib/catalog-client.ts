/**
 * Catalog Client — loads, verifies, caches, and activates catalog packages.
 *
 * Workflow:
 *   1. Read active release metadata from PocketBase (catalog_publication)
 *   2. Check IndexedDB cache — if already cached and verified, activate
 *   3. If not cached: fetch manifest.json from storage
 *   4. Validate manifest schema version and hash against PocketBase
 *   5. Fetch all required artifacts, verify SHA-256 + byte count
 *   6. Store the verified package in IndexedDB
 *   7. Atomically activate it
 *
 * Offline / first-launch:
 *   - Uses a bundled bootstrap package in /catalog/bootstrap/
 *   - Never erases player state if catalog loading fails
 *   - Keeps the last-known-good package active on failure
 *   - Never blends artifacts from different releases
 */

import { getClient, getBaseUrl } from "./pocketbase";
import {
  storePackage,
  getActivePackage,
  getBootstrapPackage,
  activatePackage,
  isCached,
  getPackage,
  evictOldPackages,
  getCacheStatus,
  listPackages,
  type CachedCatalogPackage,
  type CatalogArtifact,
  type CatalogCacheStatus,
} from "./catalog-cache";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PublicationMetadata {
  activeReleaseId: string;
  manifestHash: string;
  activatedAt: string;
  activatedBy: string;
  previousReleaseId: string;
  notes: string;
}

export interface ManifestArtifactEntry {
  filename: string;
  contentType: string;
  sha256: string;
  bytes: number;
  schemaVersion: string;
  recordCount: number;
  required: boolean;
  path: string;
}

export interface CatalogManifest {
  manifestSchemaVersion: string;
  catalogVersion: string;
  releaseId: string;
  gameVersion: string;
  gameVersionCode: number;
  generatedAt: string;
  status: string;
  artifacts: ManifestArtifactEntry[];
  counts: Record<string, number>;
  storage: { baseUrl: string; cdnUrl: string | null };
}

export type LoadState =
  | { phase: "idle" }
  | { phase: "checking_publication" }
  | { phase: "fetching_manifest" }
  | { phase: "verifying_manifest" }
  | { phase: "fetching_artifacts"; loaded: number; total: number }
  | { phase: "verifying_artifacts" }
  | { phase: "caching" }
  | { phase: "activating" }
  | { phase: "active"; releaseId: string; manifestHash: string; catalogVersion: string }
  | { phase: "active_current"; releaseId: string; manifestHash: string; catalogVersion: string }
  | { phase: "active_stale"; releaseId: string; manifestHash: string; catalogVersion: string; reason: string }
  | { phase: "offline_cached"; releaseId: string; manifestHash: string; catalogVersion: string }
  | { phase: "bootstrap_fallback"; releaseId: string; manifestHash: string; catalogVersion: string; reason?: string }
  | { phase: "verification_failed_using_previous"; releaseId: string; manifestHash: string; catalogVersion: string; error: string; code: string }
  | { phase: "error"; error: string; code: string };

export interface CatalogClientState {
  loadState: LoadState;
  cacheStatus: CatalogCacheStatus;
  /** Subscribe to state changes */
  subscribe: (cb: (state: CatalogClientState) => void) => () => void;
  /** Load the active catalog (online or from cache) */
  loadActiveCatalog: () => Promise<void>;
  /** Force-reload even if already cached */
  reloadCatalog: () => Promise<void>;
  /** Get the currently active package content */
  getActivePackage: () => Promise<CachedCatalogPackage | undefined>;
  /** List cached packages for non-destructive diagnostics and recovery guidance. */
  getCachedPackages: () => Promise<CachedCatalogPackage[]>;
  /** Get a specific artifact from the active package */
  getArtifact: (filename: string) => Promise<CatalogArtifact | undefined>;
  /** Check if the client has a usable catalog */
  hasCatalog: () => Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPPORTED_MANIFEST_MAJOR = 2;
const BOOTSTRAP_PATH = "/catalog/bootstrap/manifest.json";
/** Bump when the verification logic changes — older cached entries will be revalidated. */
const CLIENT_VERSION = "0.2.0";
const VERIFICATION_VERSION = 1;

// ---------------------------------------------------------------------------
// Multi-tab concurrency protection
// ---------------------------------------------------------------------------

/**
 * Activate a package using the Web Locks API, if available, to prevent
 * concurrent activation from multiple browser tabs.
 *
 * Falls back to direct activation if Web Locks is not available
 * (non-secure context or older browser).
 */
async function safeActivate(releaseId: string, manifestHash: string): Promise<void> {
  try {
    if ("locks" in navigator) {
      await navigator.locks.request(`mineops-catalog-activate-${releaseId}`, { ifAvailable: true }, async () => {
        await activatePackage(releaseId, manifestHash);
      });
    } else {
      await activatePackage(releaseId, manifestHash);
    }
  } catch {
    // Web Locks not available — fall back to direct activation
    await activatePackage(releaseId, manifestHash);
  }
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

type StateListener = (state: CatalogClientState) => void;

export function createCatalogClient(): CatalogClientState {
  const listeners = new Set<StateListener>();

  let loadState: LoadState = { phase: "idle" };
  let cacheStatus: CatalogCacheStatus = {
    packageCount: 0,
    totalCacheBytes: 0,
    activeReleaseId: null,
    activeManifestHash: null,
    lastActivatedAt: null,
    hasBootstrap: false,
  };

  function emit() {
    const state: CatalogClientState = {
      loadState,
      cacheStatus,
      subscribe,
      loadActiveCatalog,
      reloadCatalog,
      getActivePackage: getActivePkg,
      getCachedPackages: listPackages,
      getArtifact,
      hasCatalog,
    };
    for (const cb of listeners) {
      cb(state);
    }
  }

  function setState(next: LoadState) {
    loadState = next;
    emit();
  }

  async function refreshCacheStatus() {
    cacheStatus = await getCacheStatus();
    emit();
  }

  function subscribe(cb: StateListener): () => void {
    listeners.add(cb);
    // Immediately emit current state
    cb({
      loadState,
      cacheStatus,
      subscribe,
      loadActiveCatalog,
      reloadCatalog,
      getActivePackage: getActivePkg,
      getCachedPackages: listPackages,
      getArtifact,
      hasCatalog,
    });
    return () => { listeners.delete(cb); };
  }

  async function getActivePkg(): Promise<CachedCatalogPackage | undefined> {
    return getActivePackage();
  }

  async function getArtifact(filename: string): Promise<CatalogArtifact | undefined> {
    const pkg = await getActivePackage();
    return pkg?.artifacts[filename];
  }

  async function hasCatalog(): Promise<boolean> {
    const pkg = await getActivePackage();
    return !!pkg && pkg.verificationState !== "failed";
  }

  // -----------------------------------------------------------------------
  // SHA-256 verification (Web Crypto API)
  // -----------------------------------------------------------------------

  async function sha256(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // -----------------------------------------------------------------------
  // Fetch helpers
  // -----------------------------------------------------------------------

  async function fetchJson(url: string): Promise<unknown> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText} for ${url}`);
    }
    return response.json();
  }

  // -----------------------------------------------------------------------
  // Publication metadata from PocketBase
  // -----------------------------------------------------------------------

  async function fetchPublicationMetadata(): Promise<PublicationMetadata | null> {
    setState({ phase: "checking_publication" });

    try {
      const pb = getClient();
      const result = await pb.collection("catalog_publication").getList(1, 1);
      if (result.items.length === 0) return null;

      const record = result.items[0];
      const activeId = (record as Record<string, unknown>).activeReleaseId as string;

      if (!activeId || activeId.length === 0) return null;

      return {
        activeReleaseId: activeId,
        manifestHash: (record as Record<string, unknown>).manifestSha256 as string,
        activatedAt: (record as Record<string, unknown>).activatedAt as string,
        activatedBy: (record as Record<string, unknown>).activatedBy as string,
        previousReleaseId: (record as Record<string, unknown>).previousReleaseId as string,
        notes: (record as Record<string, unknown>).notes as string,
      };
    } catch (err) {
      // PocketBase unreachable — will fall through to cache/bootstrap
      console.warn("[catalog-client] Cannot reach PocketBase for publication metadata:", err);
      return null;
    }
  }

  // -----------------------------------------------------------------------
  // Manifest fetch + validation
  // -----------------------------------------------------------------------

  async function fetchAndValidateManifest(
    storageBaseUrl: string,
    expectedHash: string,
  ): Promise<{ manifest: CatalogManifest; manifestRaw: string } | null> {
    setState({ phase: "fetching_manifest" });

    const manifestUrl = `${storageBaseUrl.replace(/\/$/, "")}/manifest.json`;
    let manifestRaw: string;
    try {
      const response = await fetch(manifestUrl);
      manifestRaw = await response.text();
    } catch {
      setState({ phase: "error", error: `Failed to fetch manifest: ${manifestUrl}`, code: "MANIFEST_FETCH_FAILED" });
      return null;
    }

    setState({ phase: "verifying_manifest" });

    // Verify manifest hash
    const actualHash = await sha256(manifestRaw);
    if (actualHash !== expectedHash) {
      setState({
        phase: "error",
        error: `Manifest hash mismatch. Expected: ${expectedHash.slice(0, 12)}..., actual: ${actualHash.slice(0, 12)}...`,
        code: "MANIFEST_HASH_MISMATCH",
      });
      return null;
    }

    let manifest: CatalogManifest;
    try {
      manifest = JSON.parse(manifestRaw) as CatalogManifest;
    } catch {
      setState({ phase: "error", error: "Manifest is not valid JSON.", code: "MANIFEST_INVALID_JSON" });
      return null;
    }

    // Validate manifest schema version
    const manifestMajor = parseInt((manifest.manifestSchemaVersion || "0").split(".")[0], 10);
    if (manifestMajor > SUPPORTED_MANIFEST_MAJOR) {
      setState({
        phase: "error",
        error: `Unsupported manifest schema v${manifest.manifestSchemaVersion}. Maximum supported: v${SUPPORTED_MANIFEST_MAJOR}.x`,
        code: "MANIFEST_SCHEMA_UNSUPPORTED",
      });
      return null;
    }

    if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length === 0) {
      setState({ phase: "error", error: "Manifest has no artifacts array.", code: "MANIFEST_NO_ARTIFACTS" });
      return null;
    }

    return { manifest, manifestRaw };
  }

  // -----------------------------------------------------------------------
  // Artifact fetch + verification
  // -----------------------------------------------------------------------

  async function fetchAndVerifyArtifacts(
    manifest: CatalogManifest,
    storageBaseUrl: string,
  ): Promise<Record<string, CatalogArtifact> | null> {
    const requiredArtifacts = manifest.artifacts.filter((a) => a.required);
    const totalRequired = requiredArtifacts.length;

    setState({ phase: "fetching_artifacts", loaded: 0, total: totalRequired });

    const warnings: string[] = [];
    const artifacts: Record<string, CatalogArtifact> = {};

    for (let i = 0; i < manifest.artifacts.length; i++) {
      const entry = manifest.artifacts[i];
      const artifactUrl = `${storageBaseUrl.replace(/\/$/, "")}/${entry.path}`;

      let raw: string;
      try {
        const response = await fetch(artifactUrl);
        if (!response.ok) {
          if (entry.required) {
            setState({
              phase: "error",
              error: `Failed to fetch required artifact ${entry.filename}: HTTP ${response.status}`,
              code: "ARTIFACT_FETCH_FAILED",
            });
            return null;
          }
          warnings.push(`Optional artifact ${entry.filename} not fetchable: HTTP ${response.status}`);
          continue;
        }
        raw = await response.text();
      } catch {
        if (entry.required) {
          setState({
            phase: "error",
            error: `Network error fetching required artifact: ${entry.filename}`,
            code: "ARTIFACT_NETWORK_ERROR",
          });
          return null;
        }
        warnings.push(`Optional artifact ${entry.filename}: network error`);
        continue;
      }

      // Verify byte count
      const actualBytes = new TextEncoder().encode(raw).length;
      if (actualBytes !== entry.bytes) {
        if (entry.required) {
          setState({
            phase: "error",
            error: `Byte count mismatch for ${entry.filename}: expected ${entry.bytes}, got ${actualBytes}`,
            code: "ARTIFACT_BYTE_MISMATCH",
          });
          return null;
        }
        warnings.push(`Optional artifact ${entry.filename}: byte count mismatch`);
        continue;
      }

      // Verify SHA-256
      const actualHash = await sha256(raw);
      if (actualHash !== entry.sha256) {
        if (entry.required) {
          setState({
            phase: "error",
            error: `Hash mismatch for ${entry.filename}: expected ${entry.sha256.slice(0, 12)}..., got ${actualHash.slice(0, 12)}...`,
            code: "ARTIFACT_HASH_MISMATCH",
          });
          return null;
        }
        warnings.push(`Optional artifact ${entry.filename}: hash mismatch (skipped)`);
        continue;
      }

      // Parse JSON
      let content: unknown;
      try {
        content = JSON.parse(raw);
      } catch {
        if (entry.required) {
          setState({ phase: "error", error: `${entry.filename} is not valid JSON.`, code: "ARTIFACT_INVALID_JSON" });
          return null;
        }
        warnings.push(`Optional artifact ${entry.filename}: invalid JSON (skipped)`);
        continue;
      }

      artifacts[entry.filename] = {
        filename: entry.filename,
        content,
        sha256: actualHash,
        bytes: actualBytes,
        schemaVersion: entry.schemaVersion,
      };

      if (entry.required) {
        setState({ phase: "fetching_artifacts", loaded: Object.keys(artifacts).filter((k) => {
          const a = manifest.artifacts.find((e) => e.filename === k);
          return a?.required;
        }).length, total: totalRequired });
      }
    }

    // Verify all required artifacts were loaded
    const loadedRequired = requiredArtifacts.filter((a) => artifacts[a.filename]).length;
    if (loadedRequired < totalRequired) {
      const missing = requiredArtifacts.filter((a) => !artifacts[a.filename]).map((a) => a.filename);
      setState({
        phase: "error",
        error: `Missing required artifacts: ${missing.join(", ")}`,
        code: "MISSING_REQUIRED_ARTIFACTS",
      });
      return null;
    }

    setState({ phase: "verifying_artifacts" });

    return artifacts;
  }

  // -----------------------------------------------------------------------
  // Bootstrap package (bundled, first-launch / offline fallback)
  // -----------------------------------------------------------------------

  async function loadBootstrapPackage(): Promise<CachedCatalogPackage | null> {
    try {
      const manifestRaw = await (await fetch(BOOTSTRAP_PATH)).text();
      const manifest = JSON.parse(manifestRaw) as CatalogManifest;
      const manifestHash = await sha256(manifestRaw);

      // Check if bootstrap is already cached
      const existing = await getPackage(manifest.releaseId, manifestHash);
      if (existing) return existing;

      // Load all artifacts from bootstrap directory
      const artifacts: Record<string, CatalogArtifact> = {};
      let totalBytes = 0;

      for (const entry of manifest.artifacts) {
        try {
          const artifactUrl = `/catalog/bootstrap/${entry.path}`;
          const raw = await (await fetch(artifactUrl)).text();
          const actualHash = await sha256(raw);
          const actualBytes = new TextEncoder().encode(raw).length;

          if (actualHash !== entry.sha256 || actualBytes !== entry.bytes) {
            console.warn(`[catalog-client] Bootstrap artifact verification failed: ${entry.filename}`);
            if (entry.required) return null;
            continue;
          }

          artifacts[entry.filename] = {
            filename: entry.filename,
            content: JSON.parse(raw),
            sha256: actualHash,
            bytes: actualBytes,
            schemaVersion: entry.schemaVersion,
          };
          totalBytes += entry.bytes;
        } catch {
          if (entry.required) {
            console.error(`[catalog-client] Failed to load required bootstrap artifact: ${entry.filename}`);
            return null;
          }
        }
      }

      const pkg: CachedCatalogPackage = {
        id: `${manifest.releaseId}::${manifestHash}`,
        releaseId: manifest.releaseId,
        manifestHash,
        catalogVersion: manifest.catalogVersion,
        gameVersion: manifest.gameVersion,
        gameVersionCode: manifest.gameVersionCode,
        manifestSchemaVersion: manifest.manifestSchemaVersion,
        cachedAt: new Date().toISOString(),
        verifiedAt: new Date().toISOString(),
        clientVersion: CLIENT_VERSION,
        verificationVersion: VERIFICATION_VERSION,
        storageBaseUrl: "/catalog/bootstrap/",
        artifacts,
        totalBytes,
        isActive: false,
        isPendingActivation: false,
        isBootstrap: true,
        source: "bootstrap",
        verificationState: "verified",
        warnings: [],
      };

      await storePackage(pkg);
      return pkg;
    } catch (err) {
      console.error("[catalog-client] Bootstrap package load failed:", err);
      return null;
    }
  }

  // -----------------------------------------------------------------------
  // Main load flow
  // -----------------------------------------------------------------------

  async function loadActiveCatalog(): Promise<void> {
    try {
      // 1. Try to get publication metadata from PocketBase
      const pub = await fetchPublicationMetadata();

      if (pub) {
        // 2. Check if already cached and verified
        if (await isCached(pub.activeReleaseId, pub.manifestHash)) {
          const cached = await getPackage(pub.activeReleaseId, pub.manifestHash);
          if (cached && cached.verificationState === "verified") {
            // Already have it — just activate
            // Revalidate: if verification version changed, re-cache
            if (cached.verificationVersion !== VERIFICATION_VERSION || cached.clientVersion !== CLIENT_VERSION) {
              // Verification logic changed — fall back to stale cached version
              // but mark that re-fetch is needed. The stale package is still usable.
              setState({ phase: "activating" });
              await safeActivate(pub.activeReleaseId, pub.manifestHash);
              await refreshCacheStatus();
              setState({
                phase: "active_stale",
                releaseId: pub.activeReleaseId,
                manifestHash: pub.manifestHash,
                catalogVersion: cached.catalogVersion,
                reason: `Cached with verification v${cached.verificationVersion}; current v${VERIFICATION_VERSION}. Re-fetching...`,
              });
              // Fall through to re-fetch below (the `return` is omitted intentionally)
            } else {
              setState({ phase: "activating" });
              await safeActivate(pub.activeReleaseId, pub.manifestHash);
              await refreshCacheStatus();
              setState({
                phase: "active_current",
                releaseId: pub.activeReleaseId,
                manifestHash: pub.manifestHash,
                catalogVersion: cached.catalogVersion,
              });
              return;
            }
          }
        }

        // 3. Need to fetch from storage. First, get the release record for storage URL.
        let storageBaseUrl = "";
        try {
          const pb = getClient();
          const releaseResult = await pb.collection("catalog_releases").getList(1, 1, {
            filter: `releaseId = "${pub.activeReleaseId}"`,
          });
          if (releaseResult.items.length > 0) {
            storageBaseUrl = (releaseResult.items[0] as Record<string, unknown>).storageBaseUrl as string || "";
          }
        } catch {
          // Can't get storage URL — try the publication metadata's own path
        }

        if (!storageBaseUrl) {
          // If no storage URL in PocketBase, try fetching manifest directly from
          // a known location. For now, fall back to bootstrap.
          setState({ phase: "bootstrap_fallback", releaseId: "", manifestHash: "", catalogVersion: "", reason: "No storage URL available for release " + pub.activeReleaseId });
          const bootstrap = await loadBootstrapPackage();
          if (bootstrap) {
            await activatePackage(bootstrap.releaseId, bootstrap.manifestHash);
            await refreshCacheStatus();
            setState({
              phase: "active",
              releaseId: bootstrap.releaseId,
              manifestHash: bootstrap.manifestHash,
              catalogVersion: bootstrap.catalogVersion,
            });
            return;
          }
          setState({ phase: "error", error: "Cannot load catalog: no storage URL and no bootstrap package available.", code: "NO_CATALOG_AVAILABLE" });
          return;
        }

        // 4. Fetch and validate manifest
        const manifestResult = await fetchAndValidateManifest(storageBaseUrl, pub.manifestHash);
        if (!manifestResult) return; // Error state already set

        const { manifest } = manifestResult;

        // 5. Fetch and verify artifacts
        const artifacts = await fetchAndVerifyArtifacts(manifest, storageBaseUrl);
        if (!artifacts) return; // Error state already set

        // 6. Store in cache
        setState({ phase: "caching" });

        // Use manifest-declared byte values (verified against actual fetched content)
        let totalBytes = 0;
        for (const entry of manifest.artifacts) {
          if (artifacts[entry.filename]) {
            totalBytes += entry.bytes; // Use manifest-declared bytes, not JS string length
          }
        }

        const now = new Date().toISOString();
        const pkg: CachedCatalogPackage = {
          id: `${manifest.releaseId}::${pub.manifestHash}`,
          releaseId: manifest.releaseId,
          manifestHash: pub.manifestHash,
          catalogVersion: manifest.catalogVersion,
          gameVersion: manifest.gameVersion,
          gameVersionCode: manifest.gameVersionCode,
          manifestSchemaVersion: manifest.manifestSchemaVersion,
          cachedAt: now,
          verifiedAt: now,
          clientVersion: CLIENT_VERSION,
          verificationVersion: VERIFICATION_VERSION,
          storageBaseUrl,
          artifacts,
          totalBytes,
          isActive: false,
          isPendingActivation: true,
          isBootstrap: false,
          source: "published",
          verificationState: "verified",
          warnings: [],
        };

        await storePackage(pkg);
        await evictOldPackages(2);

        // 7. Activate via safe (multi-tab protected) path
        setState({ phase: "activating" });
        await safeActivate(manifest.releaseId, pub.manifestHash);
        await refreshCacheStatus();

        setState({
          phase: "active_current",
          releaseId: manifest.releaseId,
          manifestHash: pub.manifestHash,
          catalogVersion: manifest.catalogVersion,
        });
        return;
      }

      // No publication metadata — try cache, then bootstrap
      const active = await getActivePackage();
      if (active) {
        setState({
          phase: "offline_cached",
          releaseId: active.releaseId,
          manifestHash: active.manifestHash,
          catalogVersion: active.catalogVersion,
        });
        return;
      }

      // Last resort: bootstrap
      const bootstrap = await loadBootstrapPackage();
      if (bootstrap) {
        await safeActivate(bootstrap.releaseId, bootstrap.manifestHash);
        await refreshCacheStatus();
        setState({
          phase: "bootstrap_fallback",
          releaseId: bootstrap.releaseId,
          manifestHash: bootstrap.manifestHash,
          catalogVersion: bootstrap.catalogVersion,
        });
        return;
      }

      setState({ phase: "error", error: "Cannot load any catalog. No publication, no cache, no bootstrap.", code: "NO_CATALOG_AVAILABLE" });
    } catch (err) {
      // On failure, try to use the previously active package
      const previous = await getActivePackage();
      if (previous) {
        setState({
          phase: "verification_failed_using_previous",
          releaseId: previous.releaseId,
          manifestHash: previous.manifestHash,
          catalogVersion: previous.catalogVersion,
          error: `Unexpected error: ${err}`,
          code: "VERIFICATION_FAILED_USING_PREVIOUS",
        });
        return;
      }
      setState({ phase: "error", error: `Unexpected error: ${err}`, code: "UNEXPECTED_ERROR" });
    }
  }

  async function reloadCatalog(): Promise<void> {
    setState({ phase: "idle" });
    await loadActiveCatalog();
  }

  // Initialize cache status
  refreshCacheStatus();

  return {
    get loadState() { return loadState; },
    get cacheStatus() { return cacheStatus; },
    subscribe,
    loadActiveCatalog,
    reloadCatalog,
    getActivePackage: getActivePkg,
    getCachedPackages: listPackages,
    getArtifact,
    hasCatalog,
  };
}

/** Singleton catalog client instance. */
export const catalogClient = createCatalogClient();
