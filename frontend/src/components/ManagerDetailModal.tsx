import {
  CatalogManager,
  PlayerManager,
  effectiveActiveValue,
  isRankUpReady,
  rankThreshold,
} from "../lib/db";
import { spriteURL } from "../lib/sprites";
import { interpolateAbilityDescription, formatTime } from "../lib/textNormalization";

interface ManagerDetailModalProps {
  manager: CatalogManager;
  progress?: PlayerManager;
  equipmentNameMap?: Map<number, string>;
  onClose: () => void;
}

import { equipmentDisplayName } from "../lib/equipment-display-names";

const PASSIVE_LABELS: Record<string, string> = {
  MSB: "Mining Speed Boost",
  CR: "Cash Rate",
  MLSB: "Movement & Loading Speed",
  EBE: "Elevator Beam",
  BUCR: "Building Upgrade Cost Reduction",
  MIF: "Mining Income Factor",
  CIF: "Cash Income Factor",
  WMSB: "Warehouse Mining Speed Boost",
  MSUCR: "Mine Shaft Upgrade Cost Reduction",
};

function passiveLabel(passive: NonNullable<CatalogManager["passives"]>[number]): string {
  const code = passive.type?.trim();
  return (code && PASSIVE_LABELS[code]) || passive.description || code || "Passive ability";
}

function isKnownFragments(progress: PlayerManager): boolean {
  return progress.fragmentSource === "kolibri" || progress.fragmentSource === "manual";
}

export function ManagerDetailModal({ manager, progress, equipmentNameMap, onClose }: ManagerDetailModalProps) {
  const rarity = manager.rarity.toLowerCase();
  const sprite = spriteURL(manager);
  const areaAbbrev =
    manager.type === "Mine Shaft" ? "MIN" : manager.type === "Elevator" ? "ELE" : "WAR";
  const elementData = manager.elements.map((element) => {
    const match = element.match(/(.+?)\s*\((.+?)\)/);
    return match
      ? { name: match[1].trim(), effectiveness: match[2].trim() }
      : { name: element, effectiveness: "" };
  });
  const knownFragments = progress ? isKnownFragments(progress) : false;
  const fragmentGoal = progress ? rankThreshold(progress.rank) : undefined;
  const filledStars = Math.max(0, Math.min(progress?.rank ?? 0, 5));

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <article className="detail-modal" onClick={(event) => event.stopPropagation()}>
        <header className={`detail-hero ${rarity}`}>
          <button className="detail-back-button" onClick={onClose} aria-label="Close manager details">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className="detail-portrait-frame">
            {sprite ? (
              <img src={sprite} alt={manager.name} className="detail-sprite-large" />
            ) : (
              <span className="detail-art-placeholder">Art<br /><small>not captured</small></span>
            )}
          </div>
          <div className="detail-hero-copy">
            <h2 className="detail-name">{manager.name}</h2>
            <div className="detail-badges">
              <span className={`detail-rarity-badge ${rarity}`}>{manager.rarity}</span>
              <span className="detail-area-badge">{areaAbbrev}</span>
            </div>
          </div>
        </header>

        {progress && progress.unlocked && (
          <>
            <div className="detail-stats-row" aria-label="Manager stats">
              <div className="detail-stat"><div className="detail-stat-value">{progress.level}</div><div className="detail-stat-label">Level</div></div>
              <div className="detail-stat"><div className="detail-stat-value">{progress.promoted}</div><div className="detail-stat-label">Promotion</div></div>
              <div className="detail-stat"><div className="detail-stat-value">{progress.rank}</div><div className="detail-stat-label">Rank</div></div>
              <div className="detail-stat"><div className="detail-stat-value">{effectiveActiveValue(manager, progress).toFixed(1)}x</div><div className="detail-stat-label">Active Value</div></div>
            </div>

            <section className="detail-progression" aria-label="Rank and fragment progress">
              <div className="detail-stars" role="img" aria-label={`${filledStars} of 5 stars`}>
                {[0, 1, 2, 3, 4].map((star) => <span key={star} className={`detail-star ${star < filledStars ? "filled" : "empty"}`}>★</span>)}
              </div>
              <div className="detail-fragments-row">
                <span className="detail-fragment-icon" aria-hidden="true">✦</span>
                <strong>{knownFragments ? progress.fragments : "—"}</strong>
                {fragmentGoal != null && knownFragments && <span className="detail-fragment-goal">/ {fragmentGoal}</span>}
                <span className="detail-fragment-label">Fragments</span>
                {!knownFragments && <span className="detail-fragment-note">not in save</span>}
              </div>
              {isRankUpReady(progress) && <div className="detail-ready-badge">★ Ready to rank up</div>}
            </section>
          </>
        )}

        <section className="detail-section">
          <h3 className="detail-section-title">Active Ability</h3>
          <p className="detail-ability-description">
            {interpolateAbilityDescription(manager.active?.description, manager.active?.multiplier, manager.active?.cooldown, manager.active?.duration)}
          </p>
          <div className="detail-ability-stats">
            <div className="detail-ability-stat"><div className="detail-ability-stat-value">{manager.active?.multiplier ? `${manager.active.multiplier}x` : "—"}</div><div className="detail-ability-stat-label">Value</div></div>
            <div className="detail-ability-stat"><div className="detail-ability-stat-value">{formatTime(manager.active?.cooldown)}</div><div className="detail-ability-stat-label">Cooldown</div></div>
            <div className="detail-ability-stat"><div className="detail-ability-stat-value">{formatTime(manager.active?.duration)}</div><div className="detail-ability-stat-label">Duration</div></div>
          </div>
        </section>

        {manager.passives && manager.passives.length > 0 && (
          <section className="detail-section">
            <h3 className="detail-section-title">Passive Abilities <span className="detail-section-chevron">⌃</span></h3>
            {manager.passives.map((passive, index) => (
              <div key={index} className="detail-passive">
                <span className="detail-passive-name">{passiveLabel(passive)}</span>
                <span className="detail-passive-value">
                  {passive.multiplier != null ? `${passive.multiplier.toFixed(2)}x` : "—"}
                  {passive.promoReq !== undefined && <small> (P{passive.promoReq})</small>}
                </span>
              </div>
            ))}
          </section>
        )}

        {elementData.length > 0 && (
          <section className="detail-section">
            <h3 className="detail-section-title">Element Affinities <span className="detail-section-chevron">⌄</span></h3>
            <div className="element-badges">
              {elementData.map((element, index) => <span key={index} className={`element-badge element-${element.name.toLowerCase()}`} title={element.effectiveness}>{element.name}</span>)}
            </div>
          </section>
        )}

        <section className="detail-section">
          <h3 className="detail-section-title">Equipment &amp; Multiplier Effects <span className="detail-section-chevron">⌄</span></h3>
          {progress?.equipmentIds && progress.equipmentIds.length > 0 ? (
            <div>
              {progress.equipmentIds.map((equipId) => {
                const name = equipmentNameMap?.get(equipId)
                  ? equipmentDisplayName(equipId)
                  : `Equipment ${equipId}`;
                return (
                  <div key={equipId} className="detail-passive">
                    <span className="detail-passive-name">{name}</span>
                    <span className="detail-passive-value">ID: {equipId}</span>
                  </div>
                );
              })}
              <p className="detail-empty-note" style={{ marginTop: '0.5rem' }}>Equipment assigned from player save. Multiplier effects from catalog enrichment.</p>
            </div>
          ) : <p className="detail-empty-note">No equipment assigned to this manager.</p>}
        </section>
      </article>
    </div>
  );
}
