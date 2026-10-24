import { useEffect, useMemo, useState, useRef, useCallback, Suspense, lazy } from "react";
import { getSyncMetadata, loadProgress, loadInventory, saveProgress, saveInventory, setSyncMetadata, getSettings, saveSettings, saveCredentials, getCredentials, type CatalogManager, type PlayerInventoryEntry, type PlayerManager, type SyncMetadata, type AppSettings, type PersistedCredentials } from "./lib/db";
import { fetchKolibri, type KolibriCredentials, type KolibriDiagnostics } from "./lib/kolibri";
import { type Tab, type ToolboxView, navigationItems, getTabLabel, hashForTab, tabFromHash, toolboxViewFromHash } from "./lib/navigation";
import { restoreAuth, getAuthStatus, onAuthChange, getClient, getBaseUrl, type AuthStatus } from "./lib/pocketbase";
import { pushStateToPB, pullNewerFromPB, getLocalRevision, updateSyncMetadata } from "./lib/sync";
import { saveSnapshot } from "./lib/snapshot";
import { saveImportRecord } from "./lib/import-history";
import { fetchCaptureStatus, type CaptureStatus } from "./lib/capture";
import { catalogClient, type LoadState } from "./lib/catalog-client";
import { managersFromVerifiedPackage } from "./lib/strategy";
import { HomePage } from "./pages/HomePage";
import { PlanPage } from "./pages/PlanPage";
import { loadGoal, saveGoal, type PlanGoal } from "./lib/goal-plan";
import { SnapshotHistory } from "./pages/SnapshotHistory";
import { ManagerDetailModal } from "./components/ManagerDetailModal";
import { buildEquipmentNameMap } from "./lib/equipment-lookup";
import { buildEquipmentEffectMap, type EquipmentEffectInfo } from "./lib/equipment-effects";
import { buildSyncFeedback, type SyncFeedback } from "./lib/sync-feedback";
import { mergeProgress } from "./lib/sync-merge";
import { loadMineState, saveMineState, type MineState } from "./lib/mine-state";
import { NavigationIcon } from "./components/NavigationIcon";
import { usePrefetch } from "./hooks/usePrefetch";
import { LoadingSkeleton } from "./components/LoadingSkeleton";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Lazy load the Toolbox (it composes the heavy Strategy/More pages).
const ToolboxPage = lazy(() => import("./pages/ToolboxPage").then(module => ({ default: module.ToolboxPage })));

function DataConfidenceBar({ metadata, catalogLoadState }: { metadata: SyncMetadata; catalogLoadState: LoadState }) {
  const player = metadata.status === "current"
    ? "Current imported roster"
    : metadata.status === "stale"
      ? "Roster may be out of date"
      : metadata.status === "offline"
        ? "Cached roster"
        : metadata.status === "never"
          ? "No roster imported"
          : "Roster sync pending";
  const catalog = catalogLoadState.phase === "active" || catalogLoadState.phase === "active_current"
    ? "Published verified catalog"
    : catalogLoadState.phase === "offline_cached"
      ? "Cached verified catalog"
      : catalogLoadState.phase === "active_stale"
        ? "Stale published catalog"
        : catalogLoadState.phase === "bootstrap_fallback"
          ? "Bootstrap catalog"
          : catalogLoadState.phase === "error" || catalogLoadState.phase === "verification_failed_using_previous"
            ? "Catalog recovery needed"
            : "Catalog loading";
  const cautious = metadata.status !== "current" || ["active_stale", "bootstrap_fallback", "error", "verification_failed_using_previous"].includes(catalogLoadState.phase);
  const confidence = cautious ? "Review before acting" : "Ready for recommendations";
  const releaseId = "releaseId" in catalogLoadState ? catalogLoadState.releaseId : null;
  const catalogVersion = "catalogVersion" in catalogLoadState ? catalogLoadState.catalogVersion : null;

  return <section className={`data-confidence-bar ${cautious ? "caution" : "ready"}`} aria-label="Recommendation data confidence">
    <div className="data-confidence-heading">
      <strong>Recommendation data</strong>
      <span className="data-confidence-state"><span aria-hidden="true" />{confidence}</span>
    </div>
    <div className="data-confidence-facts">
      <span><b>Player</b> {player}</span>
      <span><b>Catalog</b> {catalog}</span>
      {releaseId && <details>
        <summary>Details</summary>
        <span>{catalogVersion ? `Catalog ${catalogVersion} · ` : ""}Release {releaseId}</span>
      </details>}
    </div>
  </section>;
}

export default function App() {
  const [catalog, setCatalog] = useState<CatalogManager[]>([]);
  const [catalogLoadState, setCatalogLoadState] = useState<LoadState>(catalogClient.loadState);
  const [progress, setProgress] = useState<PlayerManager[]>([]);
  const [inventory, setInventory] = useState<PlayerInventoryEntry[]>([]);
  const [metadata, setMetadata] = useState<SyncMetadata>({ status: "never" });
  const [settings, setSettings] = useState<AppSettings>({ autoSync: false, focusTargetLevel: 30 });
  const [tab, setTab] = useState<Tab>(() => typeof window === "undefined" ? "home" : tabFromHash(window.location.hash));
  const [toolboxView, setToolboxView] = useState<ToolboxView>(() => typeof window === "undefined" ? "menu" : toolboxViewFromHash(window.location.hash) ?? "menu");
  const [goal, setGoal] = useState<PlanGoal | null>(() => loadGoal());
  const [selected, setSelected] = useState<CatalogManager | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [credentials, setCredentials] = useState<KolibriCredentials>({ kolibriId: import.meta.env.VITE_KOLIBRI_ID ?? "", authToken: import.meta.env.VITE_KOLIBRI_AUTH_TOKEN ?? "", saveGameKey: import.meta.env.VITE_KOLIBRI_SAVE_GAME_KEY ?? "0" });

  useEffect(() => { void loadInventory().then(setInventory); }, []);

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
  const [mineState, setMineState] = useState<MineState | null>(() => loadMineState(window.localStorage));
  const [navExpanded, setNavExpanded] = useState(true);
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ authenticated: false });
  const [showSnapshotHistory, setShowSnapshotHistory] = useState(false);
  const [captureStatus, setCaptureStatus] = useState<CaptureStatus>({ healthy: false });
  const [equipmentNameMap, setEquipmentNameMap] = useState<Map<number, string>>(new Map());
  const [equipmentEffectMap, setEquipmentEffectMap] = useState<ReadonlyMap<number, EquipmentEffectInfo>>(new Map());
  const [syncFeedback, setSyncFeedback] = useState<SyncFeedback | null>(() => {
    try {
      const stored = localStorage.getItem("mineops-last-sync-feedback");
      return stored ? JSON.parse(stored) as SyncFeedback : null;
    } catch {
      return null;
    }
  });
  const hasAutoSynced = useRef(false);

  const navigateToTab = useCallback((next: Tab, view?: ToolboxView) => {
    setTab(next);
    if (view) setToolboxView(view);
    if (typeof window !== "undefined") {
      const nextHash = hashForTab(next);
      if (window.location.hash !== nextHash) {
        window.history.pushState({}, "", nextHash);
      }
    }
  }, []);

  const openToolbox = useCallback((view: ToolboxView) => navigateToTab("toolbox", view), [navigateToTab]);

  function handleMakePlan(next: PlanGoal) {
    setGoal(next);
    saveGoal(next);
    navigateToTab("plan");
  }

  useEffect(() => {
    const syncTabFromHash = () => {
      const next = tabFromHash(window.location.hash);
      setTab(next);
      const view = toolboxViewFromHash(window.location.hash);
      if (view) setToolboxView(view);
      const canonicalHash = hashForTab(next);
      if (window.location.hash !== canonicalHash) {
        window.history.replaceState({}, "", canonicalHash);
      }
    };

    syncTabFromHash();
    window.addEventListener("hashchange", syncTabFromHash);
    window.addEventListener("popstate", syncTabFromHash);
    return () => {
      window.removeEventListener("hashchange", syncTabFromHash);
      window.removeEventListener("popstate", syncTabFromHash);
    };
  }, []);

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
      setEquipmentEffectMap(buildEquipmentEffectMap(pkg));
      const localProgress = await loadProgress(managers);
      progressRef = localProgress;
      setProgress(localProgress);
      return managers.length;
    };

    unsubCat = catalogClient.subscribe((state) => {
      setCatalogLoadState(state.loadState);
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
      setSettings({ ...loadedSettings, focusTargetLevel: loadedSettings.focusTargetLevel ?? 30 });

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

  // Initialize prefetch hook for hover-based navigation prefetching
  const { attachHoverPrefetch, prefetchLikelyRoutes, prefetchApi, prefetchRouteChunks } = usePrefetch({ hoverDelay: 50 });

  // Prefetch likely routes on mount and when tab changes
  useEffect(() => {
    prefetchLikelyRoutes(`/${tab}`);
    // Prefetch catalog API data for better performance
    prefetchApi('/api/catalog/active');
    prefetchApi('/api/catalog/versions');
  }, [tab, prefetchLikelyRoutes, prefetchApi]);

  // Attach hover prefetch to navigation buttons (documents + chunks)
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!navRef.current) return;
    const cleanup = attachHoverPrefetch(navRef.current, ['/toolbox'], 'document');
    return cleanup;
  }, [attachHoverPrefetch]);

  // Prefetch route chunks when hovering over nav items
  useEffect(() => {
    if (!navRef.current) return;
    const navButtons = navRef.current.querySelectorAll('button[aria-current], button[data-tab]');
    navButtons.forEach(button => {
      const tab = button.getAttribute('data-tab') || button.getAttribute('aria-current');
      if (tab && tab !== 'page') {
        const route = `/${tab}`;
        button.addEventListener('mouseenter', () => {
          prefetchRouteChunks(route);
        }, { once: true });
      }
    });
    return () => {
      navButtons.forEach(button => {
        const tab = button.getAttribute('data-tab') || button.getAttribute('aria-current');
        if (tab && tab !== 'page') {
          const route = `/${tab}`;
          button.removeEventListener('mouseenter', () => {
            prefetchRouteChunks(route);
          });
        }
      });
    };
  }, [prefetchRouteChunks]);

  async function syncNow() {
    setSyncing(true);
    const attemptedAt = new Date().toISOString();
    try {
      if (!navigator.onLine) throw new Error("Offline — connect to the internet before syncing Kolibri.");
      const result = await fetchKolibri(credentials, catalog);
      // Merge with existing progress: preserve data for unresolved managers
      // so a partial sync doesn't reset all progress to unlocked=false.
      // Preserved rows are marked stale (see lib/sync-merge.ts) so they can
      // never drive an upgrade suggestion from pre-promotion data.
      const existingProgress = await loadProgress(catalog);
      const mergedProgress = mergeProgress(existingProgress, result.progress);
      const feedback = buildSyncFeedback(existingProgress, mergedProgress, attemptedAt);
      setSyncFeedback(feedback);
      try { localStorage.setItem("mineops-last-sync-feedback", JSON.stringify(feedback)); } catch { /* feedback is best effort */ }
      await saveProgress(mergedProgress);
      await saveInventory(result.inventory);
      setInventory(result.inventory);
      setProgress(mergedProgress);
      // Debug: verify stats after sync
      const unlocked = mergedProgress.filter(p => p.unlocked);
      console.log("[sync] Sync complete:", unlocked.length, "unlocked managers. First 3:",
        unlocked.slice(0, 3).map(p => `${p.managerId} Lv${p.level} R${p.rank} P${p.promoted}`).join(", "));
      setDiagnostics(result.diagnostics);
      setMineState(result.mineState);
      saveMineState(window.localStorage, result.mineState);

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

  function handleSettingsChange(next: AppSettings) {
    setSettings(next);
    void saveSettings(next);
  }

  async function refreshCaptureStatus() {
    const status = await fetchCaptureStatus();
    setCaptureStatus(status);
  }
  const freshness = metadata.status === "never" ? "No player data imported" : metadata.error ? `Sync error · ${metadata.error}` : metadata.status === "offline" ? "Offline · showing cached data" : metadata.lastSuccessfulSyncAt ? `Synced ${new Date(metadata.lastSuccessfulSyncAt).toLocaleString()}` : "Sync pending";

  return (
    <main className={`app-shell ${navExpanded ? "nav-open" : "nav-collapsed"}`} data-nav-expanded={navExpanded}>
      {/* Header */}
      <header className="topbar">
        <div className="topbar-context">
          <h1>
            {getTabLabel(tab)}
          </h1>
          <p className="header-sync-status">
            {freshness}
            {authStatus.authenticated && (
              <span className="header-cloud-status">Cloud connected</span>
            )}
          </p>
        </div>
        <div className="topbar-actions">
          <span className={`topbar-catalog-status ${catalogLoadState.phase === "active" || catalogLoadState.phase === "active_current" ? "verified" : "review"}`}>
            <span aria-hidden="true" />
            {catalogLoadState.phase === "active" || catalogLoadState.phase === "active_current" ? "Catalog verified" : "Catalog needs review"}
          </span>
          <button className="sync-button" onClick={() => void syncNow()} disabled={syncing} aria-label="Sync player data">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
          <span className="sync-button-text">{syncing ? "Syncing…" : "Sync player"}</span>
          </button>
        </div>
      </header>

      {/* Page Content */}
      <div className="app-content">
      <ErrorBoundary>
      {tab !== "home" && <DataConfidenceBar metadata={metadata} catalogLoadState={catalogLoadState} />}
      {tab === "home" && <HomePage mineState={mineState} lastSyncAt={metadata.lastSuccessfulSyncAt} syncError={metadata.error} syncStatus={metadata.status} syncing={syncing} onSyncNow={() => void syncNow()} onOpenData={() => openToolbox("data")} goal={goal} onMakePlan={handleMakePlan} />}
      {tab === "plan" && <PlanPage catalog={catalog} progress={progress} mineState={mineState} goal={goal} onPickGoal={() => navigateToTab("home")} />}
      {tab === "toolbox" && (
        <Suspense fallback={<LoadingSkeleton variant="page" />}>
          <ToolboxPage
            view={toolboxView}
            onViewChange={setToolboxView}
            catalog={catalog}
            progress={progress}
            inventory={inventory}
            mineState={mineState}
            settings={settings}
            onSettingsChange={handleSettingsChange}
            onSelectManager={setSelected}
            credentials={credentials}
            onCredentialsChange={handleCredentialsChange}
            syncing={syncing}
            onSyncNow={syncNow}
            diagnostics={diagnostics}
            syncFeedback={syncFeedback}
            metadata={metadata}
            authStatus={authStatus}
            onAuthChange={() => setAuthStatus(getAuthStatus())}
            onOpenSnapshotHistory={() => setShowSnapshotHistory(true)}
            captureStatus={captureStatus}
            onRefreshCaptureStatus={refreshCaptureStatus}
          />
        </Suspense>
      )}

      {/* Navigation */}
      <nav ref={navRef} className="primary-nav" aria-label="Primary" data-expanded={navExpanded}>
        <div className="nav-brand">
          <span className="nav-brand-mark" aria-hidden="true">MO</span>
          <span className="nav-brand-copy"><strong>MineOps</strong><small>Mission playbook</small></span>
        </div>
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
        <div className="nav-items">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              className="nav-item"
              data-tab={item.id}
              aria-current={tab === item.id ? "page" : undefined}
              onClick={() => navigateToTab(item.id)}
              title={!navExpanded ? item.label : undefined}
            >
              <NavigationIcon tab={item.id} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
        <div className="nav-footer">
          <span className="nav-footer-dot" aria-hidden="true" />
          <span><strong>{metadata.status === "current" ? "Data current" : "Review data status"}</strong><small>{catalog.length} catalog records</small></span>
        </div>
      </nav>

      {/* Manager Detail Modal */}
      {selected && (
        <ManagerDetailModal
          manager={selected}
          progress={progress.find((p) => p.managerId === selected.id)}
          equipmentNameMap={equipmentNameMap}
          equipmentEffectMap={equipmentEffectMap}
          focusTargetLevel={settings.focusTargetLevel ?? 30}
          isUpgradeFocus={settings.focusManagerId === selected.id}
          onSetUpgradeFocus={(targetLevel) => handleSettingsChange({ ...settings, focusManagerId: selected.id, focusTargetLevel: targetLevel })}
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
      </ErrorBoundary>
      </div>
    </main>
  );
}
