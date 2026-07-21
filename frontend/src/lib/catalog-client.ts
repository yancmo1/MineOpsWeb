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
const TEST_FIXTURE_PATH = "/catalog/test-fixture/manifest.json";
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

    const baseUrl = getBaseUrl().replace(/\/+$/, "");
    const url = `${baseUrl}/api/collections/catalog_publication/records?page=1&perPage=1`;
    console.log("[catalog] fetchPublicationMetadata URL:", url);

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        // 404 means the collection hasn't been deployed yet — expected fallback state.
        // Keep this out of the warning channel; unexpected statuses remain actionable.
        if (response.status === 404) {
          console.debug("[catalog-client] catalog_publication collection unavailable; using cached/bootstrap catalog");
        } else {
          console.warn("[catalog-client] catalog_publication request failed:", response.status);
        }
        return null;
      }
      const body = (await response.json()) as { items: Array<Record<string, unknown>> };
      if (!body.items || body.items.length === 0) return null;

      const record = body.items[0];
      const activeId = record.activeReleaseId as string;

      if (!activeId || activeId.length === 0) return null;

      return {
        activeReleaseId: activeId,
        manifestHash: record.manifestSha256 as string,
        activatedAt: record.activatedAt as string,
        activatedBy: record.activatedBy as string,
        previousReleaseId: record.previousReleaseId as string,
        notes: record.notes as string,
      };
    } catch (err) {
      // Network error or timeout — will fall through to cache/bootstrap
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

    const manifestUrl = storageBaseUrl.includes("mineops-pb.shepswork.com")
      ? `${storageBaseUrl.replace(/\/$/, "")}?file=manifest.json`
      : `${storageBaseUrl.replace(/\/$/, "")}/manifest.json`;
    console.log("[catalog] manifest URL:", manifestUrl);
    let manifestRaw: string;
    try {
      const response = await fetch(manifestUrl);
      console.log("[catalog] manifest fetch status:", response.status);
      if (!response.ok) {
        setState({ phase: "error", error: `Failed to fetch manifest: ${manifestUrl} status=${response.status}`, code: "MANIFEST_FETCH_FAILED" });
        return null;
      }
      manifestRaw = await response.text();
      console.log("[catalog] manifest body length:", manifestRaw.length);
    } catch (e) {
      console.log("[catalog] manifest fetch exception:", String(e));
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
      const artifactUrl = storageBaseUrl.includes("mineops-pb.shepswork.com")
        ? `${storageBaseUrl.replace(/\/$/, "")}?file=${entry.path}`
        : `${storageBaseUrl.replace(/\/$/, "")}/${entry.path}`;

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
  // Test fixture package (dev-only fallback for frontend development)
  // -----------------------------------------------------------------------

  async function loadTestFixturePackage(): Promise<CachedCatalogPackage | null> {
    try {
      const manifestRaw = await (await fetch(TEST_FIXTURE_PATH)).text();
      const manifest = JSON.parse(manifestRaw) as CatalogManifest;
      const manifestHash = await sha256(manifestRaw);

      // Check if already cached
      const existing = await getPackage(manifest.releaseId, manifestHash);
      if (existing) return existing;

      // Load all artifacts from test-fixture directory
      const artifacts: Record<string, CatalogArtifact> = {};
      let totalBytes = 0;

      for (const entry of manifest.artifacts) {
        try {
          const artifactUrl = `/catalog/test-fixture/${entry.path}`;
          const raw = await (await fetch(artifactUrl)).text();
          const actualHash = await sha256(raw);
          const actualBytes = new TextEncoder().encode(raw).length;

          if (actualHash !== entry.sha256 || actualBytes !== entry.bytes) {
            console.warn(`[catalog-client] Test fixture artifact verification failed: ${entry.filename}`);
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
            console.error(`[catalog-client] Failed to load required test-fixture artifact: ${entry.filename}`);
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
        storageBaseUrl: "/catalog/test-fixture/",
        artifacts,
        totalBytes,
        isActive: false,
        isPendingActivation: false,
        isBootstrap: false,
        source: "bootstrap",
        verificationState: "verified",
        warnings: [],
      };

      await storePackage(pkg);
      return pkg;
    } catch (err) {
      console.debug("[catalog-client] Test fixture package not available (expected in production):", err);
      return null;
    }
  }

  // -----------------------------------------------------------------------
  // Main load flow
  // -----------------------------------------------------------------------

  let activeLoad: Promise<void> | null = null;

  async function loadActiveCatalogImpl(): Promise<void> {
    console.log("[catalog] loadActiveCatalogImpl started. PB_URL:", getBaseUrl(), "DEV:", import.meta.env.DEV);
    try {
      // 1. Try to get publication metadata from PocketBase
      const pub = await fetchPublicationMetadata();
      console.log("[catalog] publication result:", pub ? `found: ${pub.activeReleaseId}` : "null");

      if (pub) {
        // 2. Check if already cached and verified
        const cached_ = await isCached(pub.activeReleaseId, pub.manifestHash);
        console.log("[catalog] isCached:", cached_);
        if (cached_) {
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
          console.log("[catalog] storage release query:", releaseResult.items.length, "items");
          if (releaseResult.items.length > 0) {
            storageBaseUrl = (releaseResult.items[0] as Record<string, unknown>).storageBaseUrl as string || "";
            console.log("[catalog] storageBaseUrl:", storageBaseUrl);
          }
        } catch (e) {
          console.log("[catalog] storage URL fetch failed:", String(e));
        }

        if (!storageBaseUrl) {
          console.log("[catalog] No storage URL — falling back to bootstrap");
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
        console.log("[catalog] Fetching manifest from storageBaseUrl:", storageBaseUrl);
        const manifestResult = await fetchAndValidateManifest(storageBaseUrl, pub.manifestHash);
        console.log("[catalog] manifestResult:", manifestResult ? "success" : "null");
        if (!manifestResult) return; // Error state already set

        const { manifest } = manifestResult;
        console.log("[catalog] Manifest loaded:", manifest.releaseId, manifest.status, "artifacts:", manifest.artifacts.length);

        // 5. Fetch and verify artifacts
        console.log("[catalog] Fetching artifacts...");
        const artifacts = await fetchAndVerifyArtifacts(manifest, storageBaseUrl);
        console.log("[catalog] artifacts result:", artifacts ? Object.keys(artifacts).length + " artifacts" : "null");
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

      // No publication metadata — try test fixture (dev), then cache, then bootstrap
      if (import.meta.env.DEV) {
        const testFixture = await loadTestFixturePackage();
        if (testFixture) {
          await safeActivate(testFixture.releaseId, testFixture.manifestHash);
          await refreshCacheStatus();
          setState({
            phase: "active",
            releaseId: testFixture.releaseId,
            manifestHash: testFixture.manifestHash,
            catalogVersion: testFixture.catalogVersion,
          });
          return;
        }
      }

      // Try cached active package
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

  async function loadActiveCatalog(): Promise<void> {
    // React Strict Mode intentionally mounts effects twice in development.
    // Share the in-flight load so that it does not duplicate PB/storage requests.
    if (activeLoad) return activeLoad;
    activeLoad = loadActiveCatalogImpl().finally(() => { activeLoad = null; });
    return activeLoad;
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
