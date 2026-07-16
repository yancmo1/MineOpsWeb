import { CatalogManager, PlayerManager, effectiveActiveValue, isRankUpReady } from "../lib/db";
import { spriteURL } from "../lib/sprites";
import { interpolateAbilityDescription, formatTime } from "../lib/textNormalization";

interface ManagerDetailModalProps {
  manager: CatalogManager;
  progress?: PlayerManager;
  onClose: () => void;
}

export function ManagerDetailModal({
  manager,
  progress,
  onClose,
}: ManagerDetailModalProps) {
  const rarity = manager.rarity.toLowerCase();
  const sprite = spriteURL(manager);
  const areaAbbrev =
    manager.type === "Mine Shaft" ? "MIN" : manager.type === "Elevator" ? "ELE" : "WAR";

  // Parse elements into badges
  const elementData = manager.elements.map((el) => {
    const match = el.match(/(.+?)\s*\((.+?)\)/);
    if (match) {
      return { name: match[1].trim(), effectiveness: match[2].trim() };
    }
    return { name: el, effectiveness: "" };
  });

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <article className="detail-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header with Back Button */}
        <button className="detail-back-button" onClick={onClose} aria-label="Close">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        {/* Large Sprite */}
        <div className={`detail-sprite-container ${rarity}`}>
          {sprite ? (
            <img src={sprite} alt={manager.name} className="detail-sprite-large" />
          ) : (
            <div style={{ fontSize: "4rem", opacity: 0.3 }}>👤</div>
          )}
        </div>

        {/* Name and Badges */}
        <h2 className="detail-name">{manager.name}</h2>
        <div className="detail-badges">
          <span className={`detail-rarity-badge ${rarity}`}>{manager.rarity}</span>
          <span className="detail-area-badge">{areaAbbrev}</span>
        </div>

        {/* Stats */}
        {progress && progress.unlocked && (
          <div className="detail-stats-row">
            <div className="detail-stat">
              <div className="detail-stat-value">{progress.level}</div>
              <div className="detail-stat-label">Level</div>
            </div>
            <div className="detail-stat">
              <div className="detail-stat-value">{progress.promoted}</div>
              <div className="detail-stat-label">Promotion</div>
            </div>
            <div className="detail-stat">
              <div className="detail-stat-value">{progress.rank}</div>
              <div className="detail-stat-label">Rank</div>
            </div>
            <div className="detail-stat">
              <div className="detail-stat-value">{effectiveActiveValue(manager, progress).toFixed(1)}x</div>
              <div className="detail-stat-label">Active Value</div>
            </div>
            {isRankUpReady(progress) && (
              <div className="detail-stat" style={{ gridColumn: "1 / -1", paddingTop: "0.25rem" }}>
                <div className="detail-stat-value" style={{ color: "var(--accent-orange)", fontSize: "0.85rem" }}>★ Ready to rank up!</div>
              </div>
            )}
          </div>
        )}

        {/* Active Ability */}
        <section className="detail-section">
          <h3 className="detail-section-title">Active Ability</h3>
          <p className="detail-ability-description">
            {interpolateAbilityDescription(
              manager.active?.description,
              manager.active?.multiplier,
              manager.active?.cooldown,
              manager.active?.duration
            )}
          </p>
          <div className="detail-ability-stats">
            <div className="detail-ability-stat">
              <div className="detail-ability-stat-value">
                {manager.active?.multiplier ? `${manager.active.multiplier}x` : "—"}
              </div>
              <div className="detail-ability-stat-label">Value</div>
            </div>
            <div className="detail-ability-stat">
              <div className="detail-ability-stat-value">
                {formatTime(manager.active?.cooldown)}
              </div>
              <div className="detail-ability-stat-label">Cooldown</div>
            </div>
            <div className="detail-ability-stat">
              <div className="detail-ability-stat-value">
                {formatTime(manager.active?.duration)}
              </div>
              <div className="detail-ability-stat-label">Duration</div>
            </div>
          </div>
        </section>

        {/* Passive Abilities */}
        {manager.passives && manager.passives.length > 0 && (
          <section className="detail-section">
            <h3 className="detail-section-title">Passive Abilities</h3>
            {manager.passives.map((passive, i) => (
              <div key={i} className="detail-passive">
                <p className="detail-passive-text">
                  {passive.description || passive.type}{" "}
                  {passive.multiplier && (
                    <strong style={{ color: "var(--accent-cyan)" }}>
                      {passive.multiplier}x
                    </strong>
                  )}
                  {passive.promoReq !== undefined && (
                    <span className="muted"> P{passive.promoReq}</span>
                  )}
                </p>
              </div>
            ))}
          </section>
        )}

        {/* Element Affinities */}
        {elementData.length > 0 && (
          <section className="detail-section">
            <h3 className="detail-section-title">Element Affinities</h3>
            <div className="element-badges">
              {elementData.map((el, i) => (
                <span
                  key={i}
                  className={`element-badge element-${el.name.toLowerCase()}`}
                >
                  {el.name}
                </span>
              ))}
            </div>
          </section>
        )}
      </article>
    </div>
  );
}
