import { useMemo } from "react";
import { formatCashValue } from "../lib/cash-units";
import type { CatalogManager, PlayerManager } from "../lib/db";
import { buildGoalPlan, fmtFactor, formatDuration, type PlanGoal } from "../lib/goal-plan";
import type { MineState } from "../lib/mine-state";

interface PlanPageProps {
  catalog: CatalogManager[];
  progress: PlayerManager[];
  mineState: MineState | null;
  goal: PlanGoal | null;
  onPickGoal: () => void;
}

/**
 * My Plan: the answer page. Header says where he is (auto-detected from
 * the save) and where the goal is; below it, numbered steps in plain
 * words, each computed by the existing verified logic in goal-plan.ts.
 * Steps carry a collapsed "Why?" with the numbers. (2026-10-23 refactor.)
 */
export function PlanPage({ catalog, progress, mineState, goal, onPickGoal }: PlanPageProps) {
  const plan = useMemo(
    () => (goal ? buildGoalPlan(goal, mineState, catalog, progress) : null),
    [goal, mineState, catalog, progress],
  );

  if (!goal) {
    return (
      <div className="plan-page">
        <section className="card-container home-empty">
          <h2 className="card-title">No goal yet</h2>
          <p className="muted">Pick one of your mines and the mineshaft you want to reach, and this page turns it into a short plan.</p>
          <button type="button" className="sync-button" onClick={onPickGoal}>Pick a goal on Home</button>
        </section>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="plan-page">
        <section className="card-container home-empty">
          <h2 className="card-title">That mine isn&apos;t in your latest sync</h2>
          <p className="muted">The goal mine isn&apos;t in the save on this device anymore. Sync your game, or pick a goal from the mines you have now.</p>
          <button type="button" className="sync-button" onClick={onPickGoal}>Pick a goal on Home</button>
        </section>
      </div>
    );
  }

  const { facts } = plan;
  const progressPct = plan.targetShaft > 0 ? Math.min(100, Math.round((facts.shaftCount / plan.targetShaft) * 100)) : 100;

  return (
    <div className="plan-page">
      <section className="card-container plan-header">
        <p className="eyebrow">{facts.continentName}</p>
        <h2 className="card-title plan-title">{facts.label} → Mineshaft {plan.targetShaft}</h2>
        <p className="plan-now">
          You&apos;re at <strong>Mineshaft {facts.shaftCount}</strong>
          {facts.topShaftLevel != null ? <> (top shaft level {facts.topShaftLevel.toLocaleString("en-US")})</> : null}
          <> · Elevator {facts.elevatorLevel?.toLocaleString("en-US") ?? "—"} · Warehouse {facts.warehouseLevel?.toLocaleString("en-US") ?? "—"}</>
          <> · Prestige P{facts.prestigeCount} (×{fmtFactor(facts.prestigeFactor)}, counted in automatically)</>
        </p>
        <div className="upgrade-focus-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPct} aria-label={`${progressPct}% of the way to Mineshaft ${plan.targetShaft} by shaft count`}>
          <span style={{ width: `${progressPct}%` }} />
        </div>
        {plan.estimatedSeconds != null && facts.pacePerSecond != null && (
          <p className="muted plan-estimate">
            At your current pace ({formatCashValue(facts.pacePerSecond)}/s{facts.paceSource === "tables" ? " from the game's tables" : " from your save's idle"}), earning the cash for the new shaft{plan.openCost && plan.openCost.perShaft.length > 1 ? "s" : ""} takes {formatDuration(plan.estimatedSeconds)} of idle earning. Playing actively and boosts make it faster.
          </p>
        )}
        <p className="plan-pill-row">
          <span className="plan-pill">Prestige auto-figured from game data</span>
          <button type="button" className="secondary" onClick={onPickGoal}>Change goal</button>
        </p>
      </section>

      <ol className="plan-steps">
        {plan.steps.map((step, index) => (
          <li key={step.id} className="card-container plan-step">
            <div className="plan-step-head">
              <span className="plan-step-number" aria-hidden="true">{index + 1}</span>
              <h3>{step.title}</h3>
            </div>
            <p className="plan-step-text">{step.text}</p>
            {step.chips.length > 0 && (
              <p className="plan-chips" aria-label="Crew for this step">
                {step.chips.map((chip) => <span key={chip} className="chip">{chip}</span>)}
              </p>
            )}
            {step.why && (
              <details className="plan-why">
                <summary>Why?</summary>
                <p className="muted">{step.why}</p>
              </details>
            )}
          </li>
        ))}
      </ol>

      <p className="muted plan-footnote">Every number here comes from the game&apos;s own tables and your synced save. Where the tables can&apos;t price something, the plan says so instead of guessing.</p>
    </div>
  );
}
