import { CatalogManager, PlayerManager, rankThreshold, strengthScore, type AppSettings } from "../lib/db";
import { buildUpgradeFocus, clampFocusLevel, FOCUS_LEVELS } from "../lib/upgrade-focus";
import { spriteURL } from "../lib/sprites";

interface OverviewPageProps {
  catalog: CatalogManager[];
  progress: PlayerManager[];
  lastSyncAt?: string;
  syncError?: string;
  syncStatus: "never" | "current" | "stale" | "offline";
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  onNavigate?: (tab: "managers" | "more") => void;
}

export function TodayPage({
  catalog,
  progress,
  lastSyncAt,
  syncError,
  syncStatus,
  settings,
  onSettingsChange,
  onNavigate,
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

  const recommendationDestination = unlocked.length > 0 ? "managers" : "more";
  const recommendationAction = unlocked.length > 0 ? "Review roster" : "Open data settings";
  const recommendationManager = opportunities.length > 0
    ? opportunities[0].manager
    : unlocked.length > 0
      ? managers[0]?.catalog
      : undefined;

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
      <div className="today-intro">
        <div>
          <h2>Command deck</h2>
          <p>Your quick read on the roster, the next breakpoint, and where to spend your next upgrade.</p>
        </div>
        <p className={`overview-data-status ${syncError ? "has-error" : ""}`} role={syncError ? "alert" : "status"}>
          <span className="status-dot" aria-hidden="true" />
          <span><strong>{freshness}</strong><small>{freshnessGuidance}</small></span>
        </p>
      </div>

      <div className="today-lead-grid">
        <section className="card-container best-next-move-full recommendation-panel" aria-labelledby="best-next-move-title">
          <div className="panel-label">Recommendation</div>
          <div className="recommendation-emblem" aria-hidden="true">
            {recommendationManager && spriteURL(recommendationManager) ? (
              <img src={spriteURL(recommendationManager)} alt="" />
            ) : (
              <svg viewBox="0 0 48 48" fill="none"><path d="m24 4 7 13-7 27-7-27 7-13Z" /><path d="m4 24 13-7 27 7-27 7L4 24Z" /></svg>
            )}
          </div>
          <h2 id="best-next-move-title">{opportunities.length > 0 ? `Rank up ${opportunities[0].manager.name}` : unlocked.length > 0 ? `Keep ${managers[0]?.catalog.name} moving` : "Import your player data"}</h2>
          {opportunities.length > 0 ? (
            <>
              <p>{opportunities[0].manager.type} · Rank {opportunities[0].player.rank} · {opportunities[0].player.fragments} fragments available.</p>
              <span className="recommendation-reason">This is the strongest immediately actionable upgrade in your imported roster.</span>
            </>
          ) : unlocked.length > 0 ? (
            <>
              <p>{managers[0]?.catalog.type} · Level {managers[0]?.level} · Rank {managers[0]?.rank}</p>
              <span className="recommendation-reason">No rank-up is ready yet. Keep collecting fragments or sync newer player data.</span>
          </>
          ) : <p>Sync in More to get a recommendation built from your roster.</p>}
          <button className="recommendation-action" type="button" onClick={() => onNavigate?.(recommendationDestination)}>
            {recommendationAction}
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h13m-6-6 6 6-6 6" /></svg>
          </button>
        </section>

        <section className="card-container roster-snapshot-card" aria-labelledby="roster-snapshot-title">
          <div className="panel-label">Roster at a glance</div>
          <h2 id="roster-snapshot-title">{unlocked.length} <span>owned managers</span></h2>
          {strongest.length > 0 && (
            <div className="snapshot-areas" aria-label="Covered areas">
              {strongest.map((item) => item ? (
                <span key={item.managerId} className={`snapshot-area ${item.catalog.type.toLowerCase().replace(" ", "-")}`}>
                  <i aria-hidden="true" />{item.catalog.type}
                </span>
              ) : null)}
            </div>
          )}
          <div className="snapshot-facts">
            <span><strong>{areasCount}</strong><small>areas covered</small></span>
            <span><strong className={opportunities.length > 0 ? "attention" : ""}>{opportunities.length}</strong><small>rank-ups ready</small></span>
          </div>
        </section>
      </div>

      <div className="today-work-grid">
        {hasCoverage && (
          <section className="card-container leaders-panel" aria-labelledby="leaders-title">
            <div className="section-heading-row"><div><h2 id="leaders-title">Department leaders</h2><p>Strongest owned manager in each area.</p></div><span className="section-count">{areasCount}/3 covered</span></div>
            <div className="leader-list">
              {strongest.map((item) => item ? (
                <div key={item.managerId} className="leader-row">
                  <span className="leader-avatar">
                    {spriteURL(item.catalog) ? <img src={spriteURL(item.catalog)} alt="" loading="lazy" /> : <span aria-hidden="true" />}
                  </span>
                  <span className={`leader-area ${item.catalog.type.toLowerCase().replace(" ", "-")}`}>{item.catalog.type}</span>
                  <span className="leader-name">{item.catalog.name}</span>
                  <span className="leader-level">Lv {item.level} · R{item.rank}</span>
                  <svg className="leader-arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h13m-6-6 6 6-6 6" /></svg>
                </div>
              ) : null)}
            </div>
          </section>
        )}

        <section className="upgrade-focus-card" aria-labelledby="upgrade-focus-title">
          <div className="section-heading-row">
            <div><h2 id="upgrade-focus-title">Upgrade focus</h2><p>Keep one personal milestone in view.</p></div>
            {focus && <span className="upgrade-focus-status">{focus.manager.name}</span>}
          </div>
          <div className="upgrade-focus-controls">
            <label><span>Super Manager</span><select aria-label="Super Manager upgrade focus" value={settings.focusManagerId ?? ""} onChange={(event) => setFocus(event.target.value, settings.focusTargetLevel ?? 30)}><option value="">Choose a manager</option>{progress.filter((player) => player.unlocked).map((player) => { const manager = byId.get(player.managerId); return manager ? <option key={manager.id} value={manager.id}>{manager.name}</option> : null; })}</select></label>
            <label><span>Target level</span><select aria-label="Upgrade focus target level" value={settings.focusTargetLevel ?? 30} disabled={!focus} onChange={(event) => focus && setFocus(focus.manager.id, Number(event.target.value))}>{FOCUS_LEVELS.map((level) => <option key={level} value={level}>Level {level}</option>)}</select></label>
          </div>
          {focus ? (() => { const summary = buildUpgradeFocus(focus.manager, focus.player, settings.focusTargetLevel ?? 30); return <div className="upgrade-focus-summary"><div className="upgrade-focus-title-row"><strong>{focus.manager.name}: Level {summary.currentLevel} → {summary.target}</strong><span>{summary.reached ? "Target reached" : `${summary.levelsRemaining} levels to go`}</span></div><div className="upgrade-focus-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={summary.progressPct} aria-label={`${summary.progressPct}% progress toward level ${summary.target}`}><span style={{ width: `${summary.progressPct}%` }} /></div><div className="upgrade-focus-facts"><span><b>Milestone</b> P{summary.targetPromotion}</span><span><b>Next passive</b> {summary.nextPassive?.description ?? "Not captured"}</span>{summary.targetMilestoneCost != null && <span><b>Catalog cash reference</b> {summary.targetMilestoneCost.toLocaleString()}</span>}</div><p className="upgrade-focus-data-note">Crystal balances and price schedules are not present in the current normalized package, so crystal totals remain unverified.</p></div>; })() : <p className="upgrade-focus-empty">Choose an unlocked manager to track a milestone. Level 30 is a useful default for a manager’s next major passive.</p>}
        </section>
      </div>

      <details className="overview-method-note"><summary>How recommendations are calculated</summary><p className="muted">Recommendations use your imported manager levels, ranks, fragments, and verified catalog values. Unknown values are left out rather than estimated.</p></details>
    </div>
  );
}
