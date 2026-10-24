import { useMemo, useState } from "react";
import { formatCashValue } from "../lib/cash-units";
import {
  defaultTargetShaft,
  goalPickerGroups,
  maxKnownShaft,
  topEarners,
  type MineFacts,
  type PlanGoal,
} from "../lib/goal-plan";
import type { MineState } from "../lib/mine-state";

interface HomePageProps {
  mineState: MineState | null;
  lastSyncAt?: string;
  syncError?: string;
  syncStatus: "never" | "current" | "stale" | "offline";
  syncing: boolean;
  onSyncNow: () => void;
  onOpenData: () => void;
  goal: PlanGoal | null;
  onMakePlan: (goal: PlanGoal) => void;
}

/**
 * Home: "What do you want to work on?" One short screen — sync state, his
 * top earners from his own save, and the goal picker (his mine + target
 * mineshaft). Everything else lives in the Toolbox. (2026-10-23 refactor.)
 */
export function HomePage({
  mineState,
  lastSyncAt,
  syncError,
  syncStatus,
  syncing,
  onSyncNow,
  onOpenData,
  goal,
  onMakePlan,
}: HomePageProps) {
  const earners = useMemo(() => topEarners(mineState, 4), [mineState]);
  const groups = useMemo(() => goalPickerGroups(mineState), [mineState]);
  const allFacts = useMemo(() => groups.flatMap((group) => group.mines), [groups]);
  const hasMines = allFacts.length > 0;

  const [selectedMine, setSelectedMine] = useState<number | null>(null);
  const [targetShaft, setTargetShaft] = useState<number | null>(null);

  const currentMine: MineFacts | null =
    allFacts.find((facts) => facts.mineNumber === selectedMine) ??
    allFacts.find((facts) => facts.mineNumber === goal?.mineNumber) ??
    earners[0] ??
    allFacts[0] ??
    null;

  const currentTarget =
    targetShaft ??
    (goal && currentMine && goal.mineNumber === currentMine.mineNumber ? goal.targetShaft : null) ??
    (currentMine ? defaultTargetShaft(currentMine.mine) : 1);

  function pickMine(mineNumber: number) {
    const facts = allFacts.find((entry) => entry.mineNumber === mineNumber);
    setSelectedMine(mineNumber);
    setTargetShaft(facts ? defaultTargetShaft(facts.mine) : null);
  }

  function pickEarner(facts: MineFacts) {
    pickMine(facts.mineNumber);
    document.getElementById("goal-picker")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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
      ? "Sync your game and this page fills in with your mines."
      : syncError
        ? "Your saved data is still here. Try syncing again, or open Settings & data in the Toolbox."
        : syncStatus === "offline"
          ? "Showing your last synced save until you reconnect."
          : syncStatus === "stale"
            ? "Sync before planning if you've played since."
            : "Your mines below come straight from this save.";

  const maxShaft = currentMine ? maxKnownShaft(currentMine.mineNumber) : null;
  const alreadyThere = currentMine != null && currentTarget <= currentMine.shaftCount;

  return (
    <div className="home-page">
      <div className="today-intro">
        <div>
          <h2>What do you want to work on?</h2>
          <p>Pick one of your mines and the mineshaft you want to reach. The plan writes itself from your save and the game&apos;s own tables.</p>
        </div>
        <p className={`overview-data-status ${syncError ? "has-error" : ""}`} role={syncError ? "alert" : "status"}>
          <span className="status-dot" aria-hidden="true" />
          <span><strong>{freshness}</strong><small>{freshnessGuidance}</small></span>
        </p>
      </div>

      <div className="home-sync-row">
        <button type="button" className="sync-button" onClick={onSyncNow} disabled={syncing}>
          {syncing ? "Syncing…" : "Sync now"}
        </button>
        <button type="button" className="secondary" onClick={onOpenData}>Settings &amp; data</button>
      </div>

      {!hasMines ? (
        <section className="card-container home-empty">
          <h2 className="card-title">Sync your game to see your mines</h2>
          <p className="muted">MineOps plans from your real save — your mines, your levels, your prestige. Nothing here is typed in by hand. Sync from the game, or open Settings &amp; data to import a save or fix the connection.</p>
          <div className="home-sync-row">
            <button type="button" className="sync-button" onClick={onSyncNow} disabled={syncing}>{syncing ? "Syncing…" : "Sync now"}</button>
            <button type="button" className="secondary" onClick={onOpenData}>Open Settings &amp; data</button>
          </div>
        </section>
      ) : (
        <>
          <section className="card-container" aria-labelledby="top-earners-title">
            <p className="eyebrow">From your save</p>
            <h2 className="card-title" id="top-earners-title">Your top earners</h2>
            <p className="muted">Tap one to make it your goal mine.</p>
            <div className="earner-list">
              {earners.map((facts) => (
                <button
                  key={facts.mineNumber}
                  type="button"
                  className={`earner-row ${currentMine?.mineNumber === facts.mineNumber ? "active" : ""}`}
                  aria-pressed={currentMine?.mineNumber === facts.mineNumber}
                  onClick={() => pickEarner(facts)}
                >
                  <span className="earner-main">
                    <strong>{facts.label}</strong>
                    <small>{facts.continentName} · Shafts {facts.shaftCount}{facts.prestigeCount > 0 ? ` · P${facts.prestigeCount}` : ""}</small>
                  </span>
                  <span className="earner-pace">
                    {facts.pacePerSecond != null ? <><strong>{formatCashValue(facts.pacePerSecond)}/s</strong><small>{facts.paceSource === "tables" ? "from the game's tables" : "from your save"}</small></> : <small>pace unknown</small>}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="card-container" id="goal-picker" aria-labelledby="goal-picker-title">
            <p className="eyebrow">Set a goal</p>
            <h2 className="card-title" id="goal-picker-title">Pick your mine and target shaft</h2>
            <div className="goal-picker-controls">
              <label className="goal-field">
                <span>Your mine</span>
                <select
                  aria-label="Your mine"
                  value={currentMine?.mineNumber ?? ""}
                  onChange={(event) => pickMine(Number(event.target.value))}
                >
                  {groups.map((group) => (
                    <optgroup key={group.continentType} label={group.continentName}>
                      {group.mines.map((facts) => (
                        <option key={facts.mineNumber} value={facts.mineNumber}>
                          {facts.label} — Shaft {facts.shaftCount}{facts.prestigeCount > 0 ? ` · P${facts.prestigeCount}` : ""}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label className="goal-field goal-field-target">
                <span>Target mineshaft</span>
                <input
                  type="number"
                  aria-label="Target mineshaft number"
                  min={1}
                  max={maxShaft ?? undefined}
                  step={1}
                  value={currentTarget}
                  onChange={(event) => setTargetShaft(Math.max(1, Math.round(Number(event.target.value) || 1)))}
                />
              </label>
            </div>
            {currentMine && (
              <p className="muted goal-picker-note">
                {currentMine.label} is at Mineshaft {currentMine.shaftCount} now
                {currentMine.topShaftLevel != null ? ` (top shaft level ${currentMine.topShaftLevel.toLocaleString("en-US")})` : ""}
                {currentMine.prestigeCount > 0 ? `, prestige P${currentMine.prestigeCount} — counted automatically, never typed in.` : "."}
                {alreadyThere ? " That target is already reached — the plan will focus on earning faster." : ""}
              </p>
            )}
            <button
              type="button"
              className="sync-button goal-submit"
              disabled={!currentMine}
              onClick={() => currentMine && onMakePlan({ mineNumber: currentMine.mineNumber, targetShaft: currentTarget })}
            >
              Make my plan
            </button>
          </section>
        </>
      )}
    </div>
  );
}
