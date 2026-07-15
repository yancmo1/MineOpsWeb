import { useEffect, useMemo, useState } from "react";
import { getSyncMetadata, loadProgress, rankThreshold, saveProgress, setSyncMetadata, strengthScore, type CatalogManager, type PlayerManager, type SyncMetadata } from "./lib/db";
import { fetchKolibri, type KolibriCredentials, type KolibriDiagnostics } from "./lib/kolibri";
import { type Tab, navigationItems, getTabLabel } from "./lib/navigation";
import { cleanDescription } from "./lib/textNormalization";
import { OverviewPage } from "./pages/OverviewPage";
import { MinesPage } from "./pages/MinesPage";
import { StrategyPage } from "./pages/StrategyPage";
import { ResourcesPage } from "./pages/ResourcesPage";
import { MorePage } from "./pages/MorePage";
import { ManagerCard } from "./components/ManagerCard";
import { ManagerDetailModal } from "./components/ManagerDetailModal";

type Department = "All" | "Mine Shaft" | "Elevator" | "Warehouse";
type Ownership = "unlocked" | "all";

type RemoteMaster = { id: string; name: string; rarity: string; area: string; gameId: number; sprite?: string; elements?: Array<{ element: string; effectiveness: string; rankReq: number }>; passives?: Array<{ type: string; value?: number; promoReq: number }>; activeL1?: number; activeL100?: number; cooldown?: number; duration?: number; descriptionLong?: string; descriptionShort?: string };
const areaName = (area: string) => ({ mineshaft: "Mine Shaft", elevator: "Elevator", warehouse: "Warehouse" }[area.toLowerCase()] ?? area);
const normalizeMaster = (item: RemoteMaster): CatalogManager => ({ id: item.id, name: item.name, rarity: item.rarity, type: areaName(item.area), gameId: item.gameId, sprite: item.sprite, elements: (item.elements ?? []).map((element) => `${element.element} (${element.effectiveness})`), active: { description: cleanDescription(item.descriptionLong ?? item.descriptionShort), multiplier: item.activeL1, duration: item.duration ? `${item.duration}s` : undefined, cooldown: item.cooldown ? `${item.cooldown}s` : undefined }, passives: (item.passives ?? []).map((passive) => ({ type: passive.type, promoReq: passive.promoReq, multiplier: passive.value, description: passive.type })) });

const departments: Department[] = ["All", "Mine Shaft", "Elevator", "Warehouse"];

export default function App() {
  const [catalog, setCatalog] = useState<CatalogManager[]>([]);
  const [progress, setProgress] = useState<PlayerManager[]>([]);
  const [metadata, setMetadata] = useState<SyncMetadata>({ status: "never" });
  const [tab, setTab] = useState<Tab>("overview");
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState<Department>("All");
  const [ownership, setOwnership] = useState<Ownership>("unlocked");
  const [selected, setSelected] = useState<CatalogManager | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [credentials, setCredentials] = useState<KolibriCredentials>({ kolibriId: import.meta.env.VITE_KOLIBRI_ID ?? "", authToken: import.meta.env.VITE_KOLIBRI_AUTH_TOKEN ?? "", saveGameKey: import.meta.env.VITE_KOLIBRI_SAVE_GAME_KEY ?? "0" });
  const [diagnostics, setDiagnostics] = useState<KolibriDiagnostics | null>(null);

  useEffect(() => { void (async () => { const response = await fetch("/catalog/sm_complete_database.json"); const json = await response.json() as { managers: CatalogManager[] }; let managers = json.managers; try { const remote = await (await fetch("/master/api/sm-data")).json() as RemoteMaster[]; if (Array.isArray(remote) && remote.length) managers = remote.map(normalizeMaster); } catch { /* bundled catalog remains usable offline */ } setCatalog(managers); setProgress(await loadProgress(managers)); setMetadata(await getSyncMetadata()); })(); }, []);
  const byId = useMemo(() => new Map(catalog.map((m) => [m.id, m])), [catalog]);
  const unlocked = progress.filter((p) => p.unlocked);
  const managers = useMemo(() => progress.map((p) => ({ ...p, catalog: byId.get(p.managerId) })).filter((p): p is PlayerManager & { catalog: CatalogManager } => Boolean(p.catalog)).filter((p) => ownership === "all" || p.unlocked).filter((p) => department === "All" || p.catalog.type === department).filter((p) => !query || p.catalog.name.toLowerCase().includes(query.toLowerCase())).sort((a, b) => strengthScore(b.catalog, b) - strengthScore(a.catalog, a) || a.catalog.name.localeCompare(b.catalog.name)), [progress, byId, ownership, department, query]);
  const strongest = departments.slice(1).map((name) => managers.filter((m) => m.unlocked && m.catalog.type === name)[0]).filter(Boolean);
  const opportunities = unlocked.map((p) => ({ p, m: byId.get(p.managerId)! })).filter(({ p }) => p.fragments > 0).sort((a, b) => b.p.fragments - a.p.fragments).slice(0, 4);

  async function syncNow() { setSyncing(true); const attemptedAt = new Date().toISOString(); try { if (!navigator.onLine) throw new Error("Offline — connect to the internet before syncing Kolibri."); const result = await fetchKolibri(credentials, catalog); await saveProgress(result.progress); setProgress(result.progress); setDiagnostics(result.diagnostics); const next: SyncMetadata = { ...metadata, lastAttemptAt: attemptedAt, lastSuccessfulSyncAt: attemptedAt, source: "Kolibri Capsule", status: "current", error: undefined }; await setSyncMetadata(next); setMetadata(next); } catch (error) { const next: SyncMetadata = { ...metadata, lastAttemptAt: attemptedAt, status: navigator.onLine ? "stale" : "offline", error: error instanceof Error ? error.message : "Kolibri sync failed" }; await setSyncMetadata(next); setMetadata(next); } finally { setSyncing(false); } }
  useEffect(() => { if (catalog.length && credentials.kolibriId && credentials.authToken && !metadata.lastSuccessfulSyncAt) void syncNow(); }, [catalog.length]);
  async function updateManager(p: PlayerManager, patch: Partial<PlayerManager>) { const next = progress.map((item) => item.managerId === p.managerId ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item); setProgress(next); await saveProgress(next); }
  const freshness = metadata.status === "never" ? "No player data imported" : metadata.error ? `Sync error · ${metadata.error}` : metadata.status === "offline" ? "Offline · showing cached data" : metadata.lastSuccessfulSyncAt ? `Synced ${new Date(metadata.lastSuccessfulSyncAt).toLocaleString()}` : "Sync pending";

  return (
    <main>
      {/* Header */}
      <header>
        <div>
          <p className="eyebrow">MINEOPS</p>
          <h1>
            {tab === "overview" ? "Command Center" : getTabLabel(tab)}
          </h1>
        </div>
        <button onClick={() => void syncNow()} disabled={syncing}>
          {syncing ? "Syncing…" : "Sync Now"}
        </button>
      </header>
      <p className="status" role="status">{metadata.status === "never" ? "No player data imported" : metadata.error ? `Sync error · ${metadata.error}` : metadata.status === "offline" ? "Offline · showing cached data" : metadata.lastSuccessfulSyncAt ? `Synced ${new Date(metadata.lastSuccessfulSyncAt).toLocaleString()}` : "Sync pending"}</p>

      {/* Page Content */}
      {tab === "overview" && <OverviewPage catalog={catalog} progress={progress} lastSyncAt={metadata.lastSuccessfulSyncAt} syncError={metadata.error} syncStatus={metadata.status} />}
      {tab === "mines" && <MinesPage />}
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

          {/* Ownership Segmented Control */}
          <div className="segmented-control" style={{ marginBottom: "1rem" }}>
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
      {tab === "strategy" && <StrategyPage catalog={catalog} progress={progress} />}
      {tab === "resources" && <ResourcesPage />}
      {tab === "more" && (
        <MorePage
          credentials={credentials}
          onCredentialsChange={setCredentials}
          syncing={syncing}
          onSyncNow={syncNow}
          diagnostics={diagnostics}
          metadata={metadata}
          catalogCount={catalog.length}
        />
      )}

      {/* Navigation */}
      <nav aria-label="Primary">
        {navigationItems.map((item) => (
          <button
            key={item.id}
            aria-current={tab === item.id ? "page" : undefined}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Manager Detail Modal */}
      {selected && (
        <ManagerDetailModal
          manager={selected}
          progress={progress.find((p) => p.managerId === selected.id)}
          onClose={() => setSelected(null)}
          onToggleOwnership={(p) => updateManager(p, { unlocked: !p.unlocked })}
        />
      )}
    </main>
  );
}
