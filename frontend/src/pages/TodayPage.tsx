import { CatalogManager, PlayerManager, rankThreshold, strengthScore, type AppSettings } from "../lib/db";
import { buildUpgradeFocus, clampFocusLevel, FOCUS_LEVELS } from "../lib/upgrade-focus";

interface OverviewPageProps {
  catalog: CatalogManager[];
  progress: PlayerManager[];
  lastSyncAt?: string;
  syncError?: string;
  syncStatus: "never" | "current" | "stale" | "offline";
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

export function TodayPage({
  catalog,
  progress,
  lastSyncAt,
  syncError,
  syncStatus,
  settings,
  onSettingsChange,
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

  // Sync freshness display and recovery guidance
  const freshness =
    syncStatus === "never"
      ? "No player data imported"
      : syncError
        ? "Sync failed"
        : syncStatus === "offline"
          ? "Offline · showing cached data"
          : lastSyncAt
            ? `Synced ${new Date(lastSyncAt).toLocaleString()}`
            : "Sync pending";

  const freshnessGuidance =
    syncStatus === "never"
      ? "Import player data in More to get a roster-specific recommendation."
      : syncError
        ? "Your saved roster is still available. Open More to retry the sync."
        : syncStatus === "offline"
          ? "Recommendations use cached data until you reconnect and sync again."
          : syncStatus === "stale"
            ? "Sync before making upgrade decisions if your in-game roster has changed."
            : "Recommendations use your imported roster and verified catalog data.";

  const focus = settings.focusManagerId
    ? progress
      .map((player) => ({ player, manager: byId.get(player.managerId) }))
      .find((entry): entry is { player: PlayerManager; manager: CatalogManager } => entry.player.managerId === settings.focusManagerId && Boolean(entry.manager) && entry.player.unlocked)
    : undefined;

  function setFocus(managerId: string, targetLevel: number) {
    const player = progress.find((item) => item.managerId === managerId);
    const nextTarget = clampFocusLevel(targetLevel, player?.level ?? 1);
    onSettingsChange({ ...settings, focusManagerId: managerId, focusTargetLevel: nextTarget });
  }

  return (
    <div className="overview-page">
      <p className="overview-data-status" role={syncError ? "alert" : "status"}>
        <strong>Data status:</strong> {freshness}. {freshnessGuidance}
      </p>

      <section className="upgrade-focus-card" aria-labelledby="upgrade-focus-title">
        <div className="upgrade-focus-heading">
          <div>
            <p className="eyebrow">Personal milestone</p>
            <h2 id="upgrade-focus-title">Upgrade focus</h2>
          </div>
          {focus && <span className="upgrade-focus-status">{focus.manager.name}</span>}
        </div>
        <div className="upgrade-focus-controls">
          <label>
            <span>Super Manager</span>
            <select
              aria-label="Super Manager upgrade focus"
              value={settings.focusManagerId ?? ""}
              onChange={(event) => setFocus(event.target.value, settings.focusTargetLevel ?? 30)}
            >
              <option value="">Choose a manager</option>
              {progress.filter((player) => player.unlocked).map((player) => {
                const manager = byId.get(player.managerId);
                return manager ? <option key={manager.id} value={manager.id}>{manager.name}</option> : null;
              })}
            </select>
          </label>
          <label>
            <span>Target level</span>
            <select
              aria-label="Upgrade focus target level"
              value={settings.focusTargetLevel ?? 30}
              disabled={!focus}
              onChange={(event) => focus && setFocus(focus.manager.id, Number(event.target.value))}
            >
              {FOCUS_LEVELS.map((level) => <option key={level} value={level}>Level {level}</option>)}
            </select>
          </label>
        </div>
        {focus ? (() => {
          const summary = buildUpgradeFocus(focus.manager, focus.player, settings.focusTargetLevel ?? 30);
          return <div className="upgrade-focus-summary">
            <div className="upgrade-focus-title-row">
              <strong>{focus.manager.name}: Level {summary.currentLevel} → {summary.target}</strong>
              <span>{summary.reached ? "Target reached" : `${summary.levelsRemaining} levels to go`}</span>
            </div>
            <div className="upgrade-focus-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={summary.progressPct} aria-label={`${summary.progressPct}% progress toward level ${summary.target}`}>
              <span style={{ width: `${summary.progressPct}%` }} />
            </div>
            <div className="upgrade-focus-facts">
              <span><b>Milestone</b> P{summary.targetPromotion}</span>
              <span><b>Next passive</b> {summary.nextPassive?.description ?? "Not captured"}</span>
              {summary.targetMilestoneCost != null && <span><b>Catalog cash reference</b> {summary.targetMilestoneCost.toLocaleString()}</span>}
            </div>
            <p className="upgrade-focus-data-note">Blue/red crystal balances and crystal price schedules are not present in the current normalized save/catalog package, so crystal totals remain unverified.</p>
          </div>;
        })() : (
          <p className="upgrade-focus-empty">Choose an unlocked manager to track a personal upgrade milestone. Level 30 is a useful default when you want to unlock a manager’s next major passive.</p>
        )}
      </section>

      {/* Best Next Move - Full Width */}
      <section className="card-container best-next-move-full">
        <h2 className="card-title">Best next move</h2>
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
              This is the strongest immediately actionable upgrade in your imported roster.
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
              No rank-up is ready from the imported roster. Keep collecting fragments or sync
              newer player data.
            </p>
          </div>
        ) : (
          <p className="muted">Import player data to get a roster-specific recommendation.</p>
        )}
      </section>

      {/* Intelligence Hub - 2 Column Grid */}
      <div className="intelligence-hub">
        {/* Roster Snapshot */}
        <section className="card-container">
          <h2 className="card-title">Roster snapshot</h2>
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

      <details className="overview-method-note">
        <summary>How recommendations are calculated</summary>
        <p className="muted">
          Recommendations use your imported manager levels, ranks, fragments, and verified
          catalog values. Unknown values are left out rather than estimated.
        </p>
      </details>
    </div>
  );
}
