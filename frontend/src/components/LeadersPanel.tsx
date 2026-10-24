import { strengthScore, type AppSettings, type CatalogManager, type PlayerManager } from "../lib/db";
import { spriteURL } from "../lib/sprites";
import { buildUpgradeFocus, clampFocusLevel, FOCUS_LEVELS } from "../lib/upgrade-focus";

/**
 * Department leaders + Upgrade focus, moved out of the old Today page in
 * the 2026-10-23 Home/My Plan/Toolbox refactor. Content and behavior are
 * unchanged; it now lives in the Toolbox ("Leaders & upgrade focus").
 */
export function LeadersPanel({
  catalog,
  progress,
  settings,
  onSettingsChange,
}: {
  catalog: CatalogManager[];
  progress: PlayerManager[];
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}) {
  const byId = new Map(catalog.map((m) => [m.id, m]));
  const unlocked = progress.filter((p) => p.unlocked);

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

      {unlocked.length > 0 && (
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
      )}
    </div>
  );
}
