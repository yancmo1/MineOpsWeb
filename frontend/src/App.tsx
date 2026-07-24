import { useEffect, useMemo, useState, useRef } from "react";
import { getSyncMetadata, loadProgress, rankThreshold, saveProgress, setSyncMetadata, strengthScore, getSettings, saveSettings, saveCredentials, getCredentials, type CatalogManager, type PlayerManager, type SyncMetadata, type AppSettings, type PersistedCredentials } from "./lib/db";
import { fetchKolibri, type KolibriCredentials, type KolibriDiagnostics } from "./lib/kolibri";
import { type Tab, navigationItems, getTabLabel } from "./lib/navigation";
import { restoreAuth, getAuthStatus, onAuthChange, getClient, getBaseUrl, type AuthStatus } from "./lib/pocketbase";
import { pushStateToPB, pullNewerFromPB, getLocalRevision, updateSyncMetadata } from "./lib/sync";
import { saveSnapshot } from "./lib/snapshot";
import { saveImportRecord } from "./lib/import-history";
import { fetchCaptureStatus, type CaptureStatus } from "./lib/capture";
import { catalogClient, type LoadState } from "./lib/catalog-client";
import { managersFromVerifiedPackage } from "./lib/strategy";
import { TodayPage } from "./pages/TodayPage";
import { SnapshotHistory } from "./pages/SnapshotHistory";
import { StrategyPage } from "./pages/StrategyPage";
import { MorePage } from "./pages/MorePage";
import { ManagerCard } from "./components/ManagerCard";
import { ManagerDetailModal } from "./components/ManagerDetailModal";
import { buildEquipmentNameMap } from "./lib/equipment-lookup";
import { NavigationIcon } from "./components/NavigationIcon";
import { compareManagers, defaultOwnership, sortOptions, type ManagersOwnership, type ManagersSortOption } from "./lib/managers-view";

type Department = "All" | "Mine Shaft" | "Elevator" | "Warehouse";
type Ownership = ManagersOwnership;
type SortOption = ManagersSortOption;

const departments: Department[] = ["All", "Mine Shaft", "Elevator", "Warehouse"];
const rarities: string[] = ["legendary", "epic", "rare", "common"];

export default function App() {
  const [catalog, setCatalog] = useState<CatalogManager[]>([]);
  const [progress, setProgress] = useState<PlayerManager[]>([]);
  const [metadata, setMetadata] = useState<SyncMetadata>({ status: "never" });
  const [settings, setSettings] = useState<AppSettings>({ autoSync: false });
  const [tab, setTab] = useState<Tab>("overview");
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState<Department>("All");
  const [ownership, setOwnership] = useState<Ownership>(defaultOwnership);
  const [sort, setSort] = useState<SortOption>("recommended");
  const [selectedRarities, setSelectedRarities] = useState<Set<string>>(new Set());
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<CatalogManager | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [credentials, setCredentials] = useState<KolibriCredentials>({ kolibriId: import.meta.env.VITE_KOLIBRI_ID ?? "", authToken: import.meta.env.VITE_KOLIBRI_AUTH_TOKEN ?? "", saveGameKey: import.meta.env.VITE_KOLIBRI_SAVE_GAME_KEY ?? "0" });

  // Load saved credentials from IndexedDB on mount
  useEffect(() => {
    void (async () => {
      const saved = await getCredentials();
      if (saved) {
        setCredentials(saved);
      }
    })();
  }, []);

  // Persist credentials to IndexedDB whenever they change
  function handleCredentialsChange(next: KolibriCredentials) {
    setCredentials(next);
    void saveCredentials(next as PersistedCredentials);
  }
  const [diagnostics, setDiagnostics] = useState<KolibriDiagnostics | null>(null);
  const [navExpanded, setNavExpanded] = useState(true);
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ authenticated: false });
  const [showSnapshotHistory, setShowSnapshotHistory] = useState(false);
  const [captureStatus, setCaptureStatus] = useState<CaptureStatus>({ healthy: false });
  const [equipmentNameMap, setEquipmentNameMap] = useState<Map<number, string>>(new Map());
  const hasAutoSynced = useRef(false);

  // Close sort menu on click outside
  useEffect(() => {
    if (!showSortMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showSortMenu]);

  useEffect(() => {
    // Restore PB auth session
    restoreAuth();
    setAuthStatus(getAuthStatus());

    // Listen for auth changes (e.g. on sign-in/out from MorePage)
    let progressRef: PlayerManager[] = [];
    const unsub = onAuthChange((status) => {
      setAuthStatus(status);
      void refreshCaptureStatus();
      // When a user signs in on this device, pull latest from PB immediately
      if (status.authenticated && progressRef.length > 0) {
        void (async () => {
          const loadedMetadata = await getSyncMetadata();
          const pbSnapshot = await pullNewerFromPB(getLocalRevision(loadedMetadata));
          if (pbSnapshot) {
            setProgress(pbSnapshot.progress);
            await saveProgress(pbSnapshot.progress);
            setMetadata(pbSnapshot.metadata);
            await setSyncMetadata(pbSnapshot.metadata);
          }
          // Push any local state that PB doesn't have yet
          void pushStateToPB(progressRef, loadedMetadata);
        })();
      }
    });

    let unsubCat: (() => void) | undefined;
    let appliedCatalogKey = "";

    const applyActiveCatalog = async (reason: string): Promise<number> => {
      const pkg = await catalogClient.getActivePackage();
      if (!pkg) return 0;
      const managers = managersFromVerifiedPackage(pkg);
      if (managers.length === 0) {
        console.warn("[app] Active catalog contains no managers", { reason, releaseId: pkg.releaseId, source: pkg.source });
        return 0;
      }
      const key = `${pkg.releaseId}::${pkg.manifestHash}`;
      if (key === appliedCatalogKey) return managers.length;
      appliedCatalogKey = key;
      console.debug("[app] Applying catalog", { reason, releaseId: pkg.releaseId, source: pkg.source, count: managers.length, sm10066: managers.find((manager) => manager.id === "sm-10066")?.name });
      setCatalog(managers);
      setEquipmentNameMap(buildEquipmentNameMap(pkg));
      const localProgress = await loadProgress(managers);
      progressRef = localProgress;
      setProgress(localProgress);
      return managers.length;
    };

    unsubCat = catalogClient.subscribe((state) => {
      const phase = state.loadState.phase;
      if (["active", "active_current", "active_stale", "offline_cached", "bootstrap_fallback"].includes(phase)) {
        void applyActiveCatalog(`state:${phase}`);
      }
    });

    void (async () => {
      await applyActiveCatalog("startup");
      // Auto-sync must never run against the cached bootstrap/test fixture.
      // Wait until the published package has had a chance to activate first.
      await catalogClient.loadActiveCatalog();
      await applyActiveCatalog("after-load");
      const loadedMetadata = await getSyncMetadata();
      setMetadata(loadedMetadata);
      const loadedSettings = await getSettings();
      setSettings(loadedSettings);

      // Pull newer PB snapshot on launch (cross-device catch-up)
      if (getAuthStatus().authenticated) {
        const pbSnapshot = await pullNewerFromPB(getLocalRevision(loadedMetadata));
        if (pbSnapshot) {
          progressRef = pbSnapshot.progress;
          setProgress(pbSnapshot.progress);
          await saveProgress(pbSnapshot.progress);
          setMetadata(pbSnapshot.metadata);
          await setSyncMetadata(pbSnapshot.metadata);
        }
      }

      // Fetch capture status (non-blocking)
      void refreshCaptureStatus();

      // Auto-sync once on initial load if enabled and no previous sync
      if (!hasAutoSynced.current && loadedSettings.autoSync && progressRef.length > 0 && credentials.kolibriId && credentials.authToken && !loadedMetadata.lastSuccessfulSyncAt) {
        hasAutoSynced.current = true;
        setTimeout(() => { void syncNow(); }, 100);
      }
    })();

    // Push to PB when the user closes the tab (best-effort, fire-and-forget)
    const handleBeforeUnload = () => {
      if (getAuthStatus().authenticated && progressRef.length > 0) {
        // Copy the current metadata; pushStateToPB catches all errors
        const meta: SyncMetadata = { ...metadata };
        pushStateToPB(progressRef, meta);
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      unsub();
      if (unsubCat) unsubCat();
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  const byId = useMemo(() => new Map(catalog.map((m) => [m.id, m])), [catalog]);

  const managers = useMemo(() => {
    let items = progress
      .map((p) => ({ ...p, catalog: byId.get(p.managerId) }))
      .filter((p): p is PlayerManager & { catalog: CatalogManager } => Boolean(p.catalog));

    // Ownership filter
    if (ownership === "unlocked") {
      items = items.filter((p) => p.unlocked);
    }

    // Department filter
    if (department !== "All") {
      items = items.filter((p) => p.catalog.type === department);
    }

    // Rarity filter
    if (selectedRarities.size > 0) {
      items = items.filter((p) => selectedRarities.has(p.catalog.rarity.toLowerCase()));
    }

    // Search
    if (query) {
      const q = query.toLowerCase();
      items = items.filter((p) => p.catalog.name.toLowerCase().includes(q));
    }

    // Sort
    items.sort((a, b) => compareManagers(a, b, sort, strengthScore, rankThreshold));

    return items;
  }, [progress, byId, ownership, department, selectedRarities, query, sort]);

  const unlocked = progress.filter((p) => p.unlocked);
  const strongest = departments.slice(1).map((name) => managers.filter((m) => m.unlocked && m.catalog.type === name)[0]).filter(Boolean);
  const opportunities = unlocked.map((p) => ({ p, m: byId.get(p.managerId)! })).filter(({ p }) => p.fragments > 0).sort((a, b) => b.p.fragments - a.p.fragments).slice(0, 4);

  function toggleRarity(rarity: string) {
    setSelectedRarities((prev) => {
      const next = new Set(prev);
      if (next.has(rarity)) {
        next.delete(rarity);
      } else {
        next.add(rarity);
      }
      return next;
    });
  }

  async function syncNow() {
    setSyncing(true);
    const attemptedAt = new Date().toISOString();
    try {
      if (!navigator.onLine) throw new Error("Offline — connect to the internet before syncing Kolibri.");
      const result = await fetchKolibri(credentials, catalog);
      // Merge with existing progress: preserve data for unresolved managers
      // so a partial sync doesn't reset all progress to unlocked=false.
      const existingProgress = await loadProgress(catalog);
      const existingById = new Map(existingProgress.map((p) => [p.managerId, p]));
      const mergedProgress = result.progress.map((p) => {
        const existing = existingById.get(p.managerId);
        // If the new progress has unlocked=false and the manager had existing
        // progress with unlocked=true, keep the existing data (sync didn't touch it).
        if (existing && !p.unlocked && existing.unlocked) return existing;
        // The current save shape omits fragment counts. Never erase a known
        // local/manual fragment count just because this sync could not read it.
        if (existing && p.fragmentSource === "unavailable" && existing.fragments > 0) {
          return { ...p, fragments: existing.fragments, fragmentSource: existing.fragmentSource ?? "manual" };
        }
        return p;
      });
      await saveProgress(mergedProgress);
      setProgress(mergedProgress);
      // Debug: verify stats after sync
      const unlocked = mergedProgress.filter(p => p.unlocked);
      console.log("[sync] Sync complete:", unlocked.length, "unlocked managers. First 3:",
        unlocked.slice(0, 3).map(p => `${p.managerId} Lv${p.level} R${p.rank} P${p.promoted}`).join(", "));
      setDiagnostics(result.diagnostics);

      // Get active catalog metadata for import traceability
      const pkg = await catalogClient.getActivePackage();
      const catalogVersion = result.catalogVersion ?? pkg?.catalogVersion ?? null;
      const manifestHash = pkg?.manifestHash ?? null;

      const next: SyncMetadata = {
        ...metadata,
        lastAttemptAt: attemptedAt,
        lastSuccessfulSyncAt: attemptedAt,
        source: "Kolibri Capsule",
        status: "current",
        error: undefined,
      };
      await setSyncMetadata(next);
      setMetadata(next);

      // Save local snapshot with catalog metadata + unresolved IDs
      const unresolvedIds = result.unresolved.length > 0
        ? result.unresolved.map((u) => u.sourceValue)
        : undefined;

      const snapshot = await saveSnapshot(
        result.progress,
        next,
        "Kolibri Capsule",
        { nameMap: new Map(catalog.map((m) => [m.id, m.name])) },
        catalogVersion,
        unresolvedIds,
      );

      // Save sanitized import record (no credentials, no raw payloads)
      const newlyUnlocked = snapshot.summary.includes("Unlocked")
        ? parseInt(snapshot.summary.match(/\d+/)?.[0] ?? "0", 10)
        : 0;
      const importStatus = result.diagnostics.unknownManagerCount > 0 ? "partially_succeeded" : "succeeded";

      await saveImportRecord({
        importedAt: attemptedAt,
        source: "kolibri",
        status: importStatus,
        managerCount: result.diagnostics.managerCount,
        unresolvedCount: result.diagnostics.unknownManagerCount,
        resolvedCount: result.diagnostics.managerCount - result.diagnostics.unknownManagerCount,
        newlyUnlocked,
        catalogVersion,
        manifestHash,
        snapshotId: snapshot.id ?? null,
        diagnosticsSummary: `HTTP ${result.diagnostics.statusCode}, ${result.diagnostics.payloadFormat}, ${result.diagnostics.rawBytes}b`,
      });

      // Push to PB (fire-and-forget — never blocks the user)
      void pushStateToPB(
        result.progress,
        next,
        catalogVersion ?? undefined,
        manifestHash ?? undefined,
        unresolvedIds,
        "kolibri",
      );
    } catch (error) {
      const next: SyncMetadata = {
        ...metadata,
        lastAttemptAt: attemptedAt,
        status: navigator.onLine ? "stale" : "offline",
        error: error instanceof Error ? error.message : "Kolibri sync failed",
      };
      await setSyncMetadata(next);
      setMetadata(next);
    } finally {
      setSyncing(false);
    }
  }

  async function updateManager(p: PlayerManager, patch: Partial<PlayerManager>) { const next = progress.map((item) => item.managerId === p.managerId ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item); setProgress(next); await saveProgress(next); }

  async function refreshCaptureStatus() {
    const status = await fetchCaptureStatus();
    setCaptureStatus(status);
  }
  const freshness = metadata.status === "never" ? "No player data imported" : metadata.error ? `Sync error · ${metadata.error}` : metadata.status === "offline" ? "Offline · showing cached data" : metadata.lastSuccessfulSyncAt ? `Synced ${new Date(metadata.lastSuccessfulSyncAt).toLocaleString()}` : "Sync pending";

  return (
    <main data-nav-expanded={navExpanded}>
      {/* Header */}
      <header>
        <div>
          <p className="eyebrow">MINEOPS</p>
          <h1>
            {getTabLabel(tab)}
          </h1>
          <p className="header-sync-status">
            {freshness}
            {authStatus.authenticated && (
              <span style={{ marginLeft: "0.5rem", opacity: 0.6 }}>· PB</span>
            )}
          </p>
        </div>
        <button className="sync-button" onClick={() => void syncNow()} disabled={syncing} aria-label="Sync player data">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
          <span className="sync-button-text">{syncing ? "Syncing…" : "Sync player"}</span>
        </button>
      </header>

      {/* Page Content */}
      {tab === "overview" && <TodayPage catalog={catalog} progress={progress} lastSyncAt={metadata.lastSuccessfulSyncAt} syncError={metadata.error} syncStatus={metadata.status} />}
      {tab === "managers" && (
        <>
          {/* Search */}
          <div className="toolbar">
            <input
              type="search"
              aria-label="Search managers"
              placeholder="Search managers"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="manager-count-badge">
              {managers.length}/{catalog.length}
            </div>
          </div>

          {/* Department Filter Chips */}
          <div className="filter-chips">
            {departments.map((dept) => (
              <button
                key={dept}
                className={`filter-chip ${department === dept ? "active" : ""}`}
                onClick={() => setDepartment(dept)}
              >
                {dept}
              </button>
            ))}
          </div>

          {/* Rarity Filter Chips */}
          <div className="filter-chips" style={{ marginBottom: "0.5rem" }}>
            {rarities.map((rarity) => {
              const isSelected = selectedRarities.has(rarity);
              return (
                <button
                  key={rarity}
                  className={`filter-chip filter-chip-${rarity} ${isSelected ? "active" : ""}`}
                  onClick={() => toggleRarity(rarity)}
                >
                  {rarity.charAt(0).toUpperCase() + rarity.slice(1)}
                </button>
              );
            })}
          </div>

          {/* Ownership + Sort Controls */}
          <div className="manager-controls-row">
            <div className="segmented-control">
              <button
                className={ownership === "unlocked" ? "active" : ""}
                onClick={() => setOwnership("unlocked")}
              >
                Unlocked
              </button>
              <button
                className={ownership === "all" ? "active" : ""}
                onClick={() => setOwnership("all")}
              >
                All Managers
              </button>
            </div>

            {/* Sort Dropdown */}
            <div className="sort-dropdown" ref={sortMenuRef}>
              <button
                className="sort-trigger"
                onClick={() => setShowSortMenu((v) => !v)}
                aria-label="Sort managers"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M6 12h12M10 18h4"/>
                </svg>
                <span className="sort-trigger-label">{sortOptions.find((o) => o.value === sort)?.label ?? "Sort"}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </button>

              {showSortMenu && (
                <div className="sort-menu">
                  {sortOptions.map((option) => (
                    <button
                      key={option.value}
                      className={`sort-option ${sort === option.value ? "active" : ""}`}
                      onClick={() => {
                        setSort(option.value);
                        setShowSortMenu(false);
                      }}
                    >
                      {sort === option.value && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Manager Grid */}
          <section className="grid">
            {managers.length === 0 ? (
              <div className="empty-state" style={{ gridColumn: "1 / -1" }}>
                <h3>No managers found</h3>
                <p>Try adjusting your filters or search term.</p>
              </div>
            ) : (
              managers.map((item) => (
                <ManagerCard
                  key={item.managerId}
                  manager={item}
                  onClick={() => setSelected(item.catalog)}
                />
              ))
            )}
          </section>
        </>
      )}
      {tab === "strategy" && <StrategyPage progress={progress} />}
      {tab === "more" && (
        <MorePage
          credentials={credentials}
          onCredentialsChange={handleCredentialsChange}
          syncing={syncing}
          onSyncNow={syncNow}
          diagnostics={diagnostics}
          metadata={metadata}
          catalogCount={catalog.length}
          settings={settings}
          onSettingsChange={setSettings}
          authStatus={authStatus}
          onAuthChange={() => setAuthStatus(getAuthStatus())}
          onOpenSnapshotHistory={() => setShowSnapshotHistory(true)}
          captureStatus={captureStatus}
          onRefreshCaptureStatus={refreshCaptureStatus}
        />
      )}

      {/* Navigation */}
      <nav aria-label="Primary" data-expanded={navExpanded}>
        <button
          className="nav-minimize-btn"
          onClick={() => setNavExpanded(!navExpanded)}
          aria-label={navExpanded ? "Collapse navigation" : "Expand navigation"}
          title={navExpanded ? "Collapse" : "Expand"}
        >
          {navExpanded ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          )}
        </button>
        {navigationItems.map((item) => (
          <button
            key={item.id}
            aria-current={tab === item.id ? "page" : undefined}
            onClick={() => setTab(item.id)}
            title={!navExpanded ? item.label : undefined}
          >
            <NavigationIcon tab={item.id} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Manager Detail Modal */}
      {selected && (
        <ManagerDetailModal
          manager={selected}
          progress={progress.find((p) => p.managerId === selected.id)}
          equipmentNameMap={equipmentNameMap}
          onClose={() => setSelected(null)}
        />
      )}

      {/* Snapshot History Modal */}
      {showSnapshotHistory && (
        <SnapshotHistory
          catalog={catalog}
          activeProgress={progress}
          onRollback={async (restored) => {
            setProgress(restored);
            await saveProgress(restored);
          }}
          onClose={() => setShowSnapshotHistory(false)}
        />
      )}
    </main>
  );
}
