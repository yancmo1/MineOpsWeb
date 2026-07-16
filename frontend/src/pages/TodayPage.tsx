import { CatalogManager, PlayerManager, rankThreshold, strengthScore } from "../lib/db";

interface OverviewPageProps {
  catalog: CatalogManager[];
  progress: PlayerManager[];
  lastSyncAt?: string;
  syncError?: string;
  syncStatus: "never" | "current" | "stale" | "offline";
}

export function TodayPage({
  catalog,
  progress,
  lastSyncAt,
  syncError,
  syncStatus,
}: OverviewPageProps) {
  const byId = new Map(catalog.map((m) => [m.id, m]));
  const unlocked = progress.filter((p) => p.unlocked);
  
  // Calculate rank-up opportunities with proper threshold checking
  const opportunities = unlocked
    .map((p) => ({
      player: p,
      manager: byId.get(p.managerId),
    }))
    .filter(
      (
        item,
      ): item is {
        player: PlayerManager;
        manager: CatalogManager;
      } =>
        Boolean(item.manager) &&
        item.player.fragments >=
          (rankThreshold(item.player.rank) ?? Infinity),
    )
    .sort(
      (a, b) =>
        strengthScore(b.manager, b.player) -
          strengthScore(a.manager, a.player) ||
        b.player.fragments - a.player.fragments ||
        a.manager.name.localeCompare(b.manager.name),
    );

  // Get strongest manager in each area
  const managers = progress
    .map((p) => ({ ...p, catalog: byId.get(p.managerId) }))
    .filter(
      (p): p is PlayerManager & { catalog: CatalogManager } =>
        Boolean(p.catalog) && p.unlocked,
    )
    .sort(
      (a, b) =>
        strengthScore(b.catalog, b) - strengthScore(a.catalog, a) ||
        a.catalog.name.localeCompare(b.catalog.name),
    );

  const areas = ["Mine Shaft", "Elevator", "Warehouse"];
  const strongest = areas
    .map((area) => managers.find((m) => m.catalog.type === area))
    .filter(Boolean);

  const hasCoverage = strongest.length > 0;
  const areasCount = new Set(strongest.map((m) => m?.catalog.type)).size;

  // Sync freshness display
  const freshness =
    syncStatus === "never"
      ? "No player data imported"
      : syncError
        ? `Sync error · ${syncError}`
        : syncStatus === "offline"
          ? "Offline · showing cached data"
          : lastSyncAt
            ? `Synced ${new Date(lastSyncAt).toLocaleString()}`
            : "Sync pending";

  return (
    <div className="overview-page">
      {/* Best Next Move - Full Width */}
      <section className="card-container best-next-move-full">
        <h2 className="card-title">Best Next Move</h2>
        {opportunities.length > 0 ? (
          <div className="best-move-card">
            <p style={{ marginBottom: "0.5rem" }}>
              <strong>Rank up {opportunities[0].manager.name}</strong>
            </p>
            <p className="muted" style={{ margin: 0 }}>
              <span style={{ color: "var(--accent-cyan)" }}>
                {opportunities[0].manager.type}
              </span>
              {" · "}
              Rank {opportunities[0].player.rank}
              {" · "}
              {opportunities[0].player.fragments} fragments available
            </p>
            <p
              className="muted"
              style={{ marginTop: "0.75rem", marginBottom: 0, fontSize: "0.85rem" }}
            >
              This is the strongest immediately actionable roster improvement found in the
              synced player data.
            </p>
          </div>
        ) : unlocked.length > 0 ? (
          <div className="best-move-card">
            <p style={{ marginBottom: "0.5rem" }}>
              <strong>Strongest owned: {managers[0]?.catalog.name}</strong>
            </p>
            <p className="muted" style={{ margin: 0 }}>
              <span style={{ color: "var(--accent-cyan)" }}>
                {managers[0]?.catalog.type}
              </span>
              {" · "}
              Level {managers[0]?.level}
              {" · "}
              Rank {managers[0]?.rank}
            </p>
            <p
              className="muted"
              style={{ marginTop: "0.75rem", marginBottom: 0, fontSize: "0.85rem" }}
            >
              No rank-ups are currently ready. Keep collecting fragments or import fresh player
              data.
            </p>
          </div>
        ) : (
          <p className="muted">Import player data to see recommendations.</p>
        )}
      </section>

      {/* Intelligence Hub - 2 Column Grid */}
      <div className="intelligence-hub">
        {/* Empire Snapshot */}
        <section className="card-container">
          <h2 className="card-title">Empire Snapshot</h2>
          <div className="metrics">
            <div className="metric-card">
              <strong>{unlocked.length}</strong>
              <span>Owned Managers</span>
            </div>
            <div className="metric-card">
              <strong>{opportunities.length}</strong>
              <span>Rank-ups Ready</span>
            </div>
            <div className="metric-card">
              <strong>{areasCount}</strong>
              <span>Areas Covered</span>
            </div>
          </div>
        </section>

        {/* Roster Leaders */}
        {hasCoverage && (
          <section className="card-container">
            <h2 className="card-title">Roster Leaders</h2>
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {strongest.map((item) =>
                item ? (
                  <div key={item.managerId} style={{ marginBottom: "0.75rem" }}>
                    <p style={{ margin: 0, fontSize: "0.875rem" }}>
                      <strong style={{ color: "var(--accent-cyan)" }}>
                        {item.catalog.type}
                      </strong>
                      {" · "}
                      {item.catalog.name}
                      <span className="muted">
                        {" · "}
                        Level {item.level}
                        {" · "}
                        Rank {item.rank}
                      </span>
                    </p>
                  </div>
                ) : null,
              )}
            </div>
          </section>
        )}
      </div>

      {/* Mine Intelligence - Full Width */}
      <section className="card-container">
        <h2 className="card-title">Mine Intelligence</h2>
        <p className="muted" style={{ marginBottom: 0 }}>
          Full mine-state analysis is the next dashboard milestone: cash balances, production
          concentration, bottlenecks, affordable upgrades, and time-based ROI.
        </p>
        <p className="muted" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
          Manager recommendations currently use deterministic imported player data.
        </p>
      </section>
    </div>
  );
}
