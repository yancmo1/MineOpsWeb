import { CatalogManager, PlayerManager, isRankUpReady, rankThreshold } from "../lib/db";
import { spriteURL } from "../lib/sprites";

interface ManagerCardProps {
  manager: PlayerManager & { catalog: CatalogManager };
  onClick: () => void;
}

export function ManagerCard({ manager, onClick }: ManagerCardProps) {
  const rarity = manager.catalog.rarity.toLowerCase();
  const isLocked = !manager.unlocked;
  const sprite = spriteURL(manager.catalog);
  const ready = isRankUpReady({
    managerId: manager.managerId,
    level: manager.level,
    rank: manager.rank,
    promoted: manager.promoted,
    fragments: manager.fragments,
    unlocked: manager.unlocked,
    updatedAt: manager.updatedAt,
  });

  return (
    <button
      className={`manager-card ${rarity}`}
      onClick={onClick}
      aria-label={`${manager.catalog.name} details`}
    >
      {/* Sprite Area */}
      <div className={`manager-sprite-area ${rarity} ${isLocked ? "locked" : ""}`}>
        {isLocked && (
          <svg
            className="lock-icon"
            fill="currentColor"
            viewBox="0 0 16 16"
            aria-hidden="true"
          >
            <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
          </svg>
        )}
        {sprite && !isLocked ? (
          <img className="manager-sprite" src={sprite} alt="" loading="lazy" />
        ) : (
          <div style={{ fontSize: "2rem", opacity: 0.3 }}>👤</div>
        )}
      </div>

      {/* Info Area */}
      <div className="manager-card-info">
        <h2>{manager.catalog.name}</h2>
        <div className="manager-card-meta">
          <span className={`rarity ${rarity}`}>{manager.catalog.rarity}</span>
          <span className="area-badge">
            {manager.catalog.type === "Mine Shaft"
              ? "MIN"
              : manager.catalog.type === "Elevator"
                ? "ELE"
                : "WAR"}
          </span>
        </div>
        {manager.unlocked ? (
          <>
            <div className="manager-card-stats">
              <span>↑ Lv{manager.level}</span>
              <span>★ P{manager.promoted}</span>
              <span>⚡ R{manager.rank}</span>
            </div>
            {manager.fragments > 0 && (() => {
              const nextThreshold = rankThreshold(manager.rank);
              return nextThreshold != null ? (
                <div className="fragment-progress" aria-label={`${manager.fragments}/${nextThreshold} fragments toward rank ${manager.rank + 1}`}>
                  <div className="fragment-progress-bar">
                    <div
                      className="fragment-progress-fill"
                      style={{
                        width: `${Math.min(100, (manager.fragments / nextThreshold) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="fragment-progress-label">
                    ⬥ {manager.fragments}/{nextThreshold}
                  </span>
                </div>
              ) : (
                <div className="fragment-progress">
                  <span className="fragment-progress-label">
                    ⬥ {manager.fragments}
                  </span>
                </div>
              );
            })()}
            {ready && <div className="ready-badge">Ready to Rank Up</div>}
          </>
        ) : manager.fragments > 0 ? (
          <p style={{ color: "var(--accent-orange)", margin: "0.25rem 0 0" }}>
            {manager.fragments} fragments
          </p>
        ) : (
          <p style={{ margin: "0.25rem 0 0" }}>Locked</p>
        )}
      </div>
    </button>
  );
}
