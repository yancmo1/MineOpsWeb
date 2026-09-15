import { CatalogManager, PlayerManager, isRankUpReady, rankThreshold } from "../lib/db";
import { spriteURL } from "../lib/sprites";
import { activePassives, passiveLabel } from "../lib/passives";

interface ManagerCardProps {
  manager: PlayerManager & { catalog: CatalogManager };
  onClick: () => void;
}

export function ManagerCard({ manager, onClick }: ManagerCardProps) {
  const rarity = manager.catalog.rarity.toLowerCase();
  const isLocked = !manager.unlocked;
  const sprite = spriteURL(manager.catalog);
  const unlockedPassives = activePassives(manager.catalog.passives, manager);
  const ready = isRankUpReady({
    managerId: manager.managerId,
    level: manager.level,
    rank: manager.rank,
    promoted: manager.promoted,
    fragments: manager.fragments,
    unlocked: manager.unlocked,
    updatedAt: manager.updatedAt,
  });

  // Determine area abbreviation
  const areaAbbrev =
    manager.catalog.type === "Mine Shaft" ? "MIN" : manager.catalog.type === "Elevator" ? "ELE" : "WAR";

  // Fragment display
  const knownFragments = manager.fragmentSource === "kolibri" || manager.fragmentSource === "manual";
  const fragmentGoal = rankThreshold(manager.rank);
  const fragmentProgress = fragmentGoal != null && knownFragments ? Math.min(100, (manager.fragments / fragmentGoal) * 100) : 0;

  return (
    <button
      className={`manager-card ${rarity} ${isLocked ? "locked" : "unlocked"}`}
      onClick={onClick}
      aria-label={`${manager.catalog.name} details`}
    >
      <div className="manager-card-header">
        <div className="manager-card-avatar">
          {isLocked ? (
            <svg
              className="lock-icon"
              fill="currentColor"
              viewBox="0 0 16 16"
              aria-hidden="true"
            >
              <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
            </svg>
          ) : sprite ? (
            <img src={sprite} alt="" loading="lazy" />
          ) : (
            <span className="manager-card-avatar-fallback" aria-hidden="true" />
          )}
        </div>
        <div className="manager-card-info">
          <h3 className="manager-card-name">{manager.catalog.name}</h3>
          <div className="manager-card-badges">
            <span className={`manager-card-rarity ${rarity}`}>{manager.catalog.rarity}</span>
            <span className="manager-card-area" title={manager.catalog.type}>{areaAbbrev}</span>
          </div>
        </div>
        <svg className="manager-card-chevron" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 12h13m-6-6 6 6-6 6" />
        </svg>
      </div>

      <div className="manager-card-stats">
        <div className="manager-card-stat">
          <div className="manager-card-stat-value">{manager.level}</div>
          <div className="manager-card-stat-label">Level</div>
        </div>
        <div className="manager-card-stat">
          <div className="manager-card-stat-value">P{manager.promoted}</div>
          <div className="manager-card-stat-label">Promo</div>
        </div>
        <div className="manager-card-stat">
          <div className="manager-card-stat-value">R{manager.rank}</div>
          <div className="manager-card-stat-label">Rank</div>
        </div>
        <div className="manager-card-stat manager-card-active">
          <div className="manager-card-stat-value">{knownFragments ? manager.fragments : "—"}</div>
          <div className="manager-card-stat-label">Fragments</div>
        </div>
      </div>

      {manager.unlocked && knownFragments && fragmentGoal != null && (
        <div className="manager-card-progress">
          <div className="manager-card-progress-bar" role="progressbar" aria-valuenow={manager.fragments} aria-valuemin={0} aria-valuemax={fragmentGoal} aria-label={`Fragments toward rank ${manager.rank + 1}`}>
            <div className="manager-card-progress-fill" style={{ width: `${fragmentProgress}%` }} />
          </div>
          <span className="manager-card-progress-text"><span className="fragment-mark" aria-hidden="true" />{manager.fragments}/{fragmentGoal}</span>
        </div>
      )}

      {ready && <span className="detail-ready-badge">Ready to rank up</span>}

      {unlockedPassives.length > 0 && (
        <div className="manager-passive-chips" aria-label="Unlocked passive abilities">
          {unlockedPassives.slice(0, 2).map((passive, index) => (
            <span key={`${passive.passiveId ?? passive.type ?? index}`} title={passiveLabel(passive)}>
              {passive.type ?? passiveLabel(passive)}
              {passive.multiplier != null ? ` ${passive.multiplier.toFixed(2)}x` : ""}
            </span>
          ))}
        </div>
      )}

      {!manager.unlocked && manager.fragments > 0 && (
        <p className="manager-card-locked-note">{manager.fragments} fragments collected</p>
      )}
      {!manager.unlocked && manager.fragments === 0 && (
        <p className="manager-card-locked-note">Locked</p>
      )}
      <div className="manager-card-footer">
        <span>{manager.unlocked ? "Open manager record" : "View catalog record"}</span>
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 17 17 7m-8 0h8v8" /></svg>
      </div>
    </button>
  );
}
