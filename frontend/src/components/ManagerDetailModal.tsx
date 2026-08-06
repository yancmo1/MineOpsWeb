import {
  CatalogManager,
  PlayerManager,
  effectiveActiveValue,
  isRankUpReady,
  rankThreshold,
} from "../lib/db";
import { spriteURL } from "../lib/sprites";
import { interpolateAbilityDescription, formatTime } from "../lib/textNormalization";
import { isPassiveUnlocked, passiveLabel, passiveRequirement } from "../lib/passives";
import { clampFocusLevel, FOCUS_LEVELS } from "../lib/upgrade-focus";

interface ManagerDetailModalProps {
  manager: CatalogManager;
  progress?: PlayerManager;
  equipmentEffectMap?: ReadonlyMap<number, import("../lib/equipment-effects").EquipmentEffectInfo>;
  equipmentNameMap?: Map<number, string>;
  focusTargetLevel?: number;
  isUpgradeFocus?: boolean;
  onSetUpgradeFocus?: (targetLevel: number) => void;
  onClose: () => void;
}

import { equipmentDisplayName } from "../lib/equipment-display-names";

function isKnownFragments(progress: PlayerManager): boolean {
  return progress.fragmentSource === "kolibri" || progress.fragmentSource === "manual";
}

export function ManagerDetailModal({ manager, progress, equipmentNameMap, equipmentEffectMap, focusTargetLevel = 30, isUpgradeFocus = false, onSetUpgradeFocus, onClose }: ManagerDetailModalProps) {
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
  const activeValue = progress?.unlocked ? effectiveActiveValue(manager, progress) : manager.active?.multiplier;

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <article
        className="detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manager-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
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
            <h2 id="manager-detail-title" className="detail-name">{manager.name}</h2>
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

        {progress?.unlocked && onSetUpgradeFocus && (
          <section className="detail-focus-control" aria-label="Upgrade focus">
            <div>
              <strong>{isUpgradeFocus ? "Upgrade focus" : "Set upgrade focus"}</strong>
              <p>{isUpgradeFocus ? `Tracking this manager to level ${focusTargetLevel}.` : "Track this manager’s progress from Today."}</p>
            </div>
            <label>
              <span>Target</span>
              <select value={clampFocusLevel(focusTargetLevel, progress.level)} onChange={(event) => onSetUpgradeFocus(Number(event.target.value))}>
                {FOCUS_LEVELS.map((level) => <option key={level} value={level}>Level {level}</option>)}
              </select>
            </label>
            {!isUpgradeFocus && <button type="button" onClick={() => onSetUpgradeFocus(focusTargetLevel)}>Track {manager.name}</button>}
          </section>
        )}

        <section className="detail-section">
          <h3 className="detail-section-title">Active Ability</h3>
          <p className="detail-ability-description">
            {interpolateAbilityDescription(manager.active?.description, activeValue, manager.active?.cooldown, manager.active?.duration)}
          </p>
          <div className="detail-ability-stats">
            <div className="detail-ability-stat"><div className="detail-ability-stat-value">{activeValue ? `${activeValue.toFixed(2)}x` : "—"}</div><div className="detail-ability-stat-label">Value</div></div>
            <div className="detail-ability-stat"><div className="detail-ability-stat-value">{formatTime(manager.active?.cooldown)}</div><div className="detail-ability-stat-label">Cooldown</div></div>
            <div className="detail-ability-stat"><div className="detail-ability-stat-value">{formatTime(manager.active?.duration)}</div><div className="detail-ability-stat-label">Duration</div></div>
          </div>
        </section>

        {manager.passives && manager.passives.length > 0 && (
          <details className="detail-section detail-disclosure">
            <summary className="detail-section-title">Passive Abilities <span className="detail-section-chevron" aria-hidden="true">⌄</span></summary>
            {manager.passives.map((passive, index) => {
              const unlocked = isPassiveUnlocked(passive, progress);
              const requirement = passiveRequirement(passive);
              return (
              <div key={`${passive.passiveId ?? passive.type ?? index}`} className={`detail-passive ${unlocked ? "unlocked" : "locked"}`}>
                <span className="detail-passive-copy">
                  <span className="detail-passive-name">{passiveLabel(passive)}</span>
                  <small>{unlocked ? "Unlocked" : requirement ? `Unlocks at ${requirement}` : "Not unlocked"}</small>
                </span>
                <span className="detail-passive-value">
                  {unlocked && progress?.passiveValues?.[index] != null
                    ? `${progress.passiveValues[index]!.toFixed(2)}x`
                    : unlocked
                      ? <span className="detail-missing-value" title="This value was not found in the Kolibri manager row" aria-label="Value not found in save">✕</span>
                      : "Locked"}
                </span>
              </div>
              );
            })}
          </details>
        )}

        {elementData.length > 0 && (
          <details className="detail-section detail-disclosure">
            <summary className="detail-section-title">Element Affinities <span className="detail-section-chevron" aria-hidden="true">⌄</span></summary>
            <div className="element-badges">
              {elementData.map((element, index) => <span key={index} className={`element-badge element-${element.name.toLowerCase()}`} title={element.effectiveness}>{element.name}</span>)}
            </div>
          </details>
        )}

        <details className="detail-section detail-disclosure">
          <summary className="detail-section-title">Equipment &amp; Multiplier Effects <span className="detail-section-chevron" aria-hidden="true">⌄</span></summary>
          {progress?.equipmentIds && progress.equipmentIds.length > 0 ? (
            <div>
              {progress.equipmentIds.map((equipId) => {
                const displayName = equipmentDisplayName(equipId);
                const name = displayName !== `Equipment ${equipId}` ? displayName : equipmentNameMap?.get(equipId) ?? `Equipment ${equipId}`;
                const effect = equipmentEffectMap?.get(equipId);
                return (
                  <div key={equipId} className="detail-passive">
                    <span className="detail-passive-copy">
                      <span className="detail-passive-name">{name}</span>
                      <small>Assigned in Kolibri save · ID {equipId}</small>
                    </span>
                    <span className="detail-passive-value">
                      {effect?.description ?? (effect?.multiplier != null ? `${(effect.multiplier * 100).toFixed(0)}%` : <span className="detail-missing-value" title="No effect definition was found in the verified catalog" aria-label="Effect not found in catalog">✕</span>)}
                    </span>
                  </div>
                );
              })}
              <p className="detail-empty-note" style={{ marginTop: '0.5rem' }}>Assignment is from Kolibri. Effects appear only when the verified APK catalog exposes them.</p>
            </div>
          ) : <p className="detail-empty-note">No equipment assigned to this manager.</p>}
        </details>
      </article>
    </div>
  );
}
