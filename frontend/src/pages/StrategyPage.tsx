import { useEffect, useMemo, useState } from "react";
import type { PlayerManager } from "../lib/db";
import { catalogClient, type CatalogClientState, type LoadState } from "../lib/catalog-client";
import { evaluateVerifiedLineup, managersFromVerifiedPackage, type StrategyEvaluation } from "../lib/strategy";
import { buildFrontierRoster, planFrontierCheckpoints, type FrontierPass, type FrontierRosterEntry, FRONTIER_BARRIERS } from "../lib/frontier-guide";

interface StrategyPageProps {
  progress: PlayerManager[];
}

type StrategyPlanId = "frontier" | "lineup" | "upgrades";

/** Check whether a load state represents an active package (any source). */
function isActive(ls: LoadState): boolean {
  return ls.phase === "active" || ls.phase === "active_current" || ls.phase === "active_stale" || ls.phase === "offline_cached" || ls.phase === "bootstrap_fallback";
}

/** Check whether the active package is a test fixture. */
function isTestFixture(ls: LoadState): boolean {
  return ls.phase === "active" && "releaseId" in ls && typeof ls.releaseId === "string" && ls.releaseId.startsWith("test-fixture");
}

export function StrategyPage({ progress }: StrategyPageProps) {
  const [evaluation, setEvaluation] = useState<StrategyEvaluation | null>(null);
  const [frontierRoster, setFrontierRoster] = useState<FrontierRosterEntry[]>([]);
  const [loadState, setLoadState] = useState<LoadState>(catalogClient.loadState);
  const [isFixture, setIsFixture] = useState(false);
  const [frontierBarrierId, setFrontierBarrierId] = useState("FM I 5");
  const [frontierCredits, setFrontierCredits] = useState("705");
  const [frontierPass, setFrontierPass] = useState<FrontierPass>("free");
  const [selectedPlan, setSelectedPlan] = useState<StrategyPlanId>("frontier");

  // Subscribe to catalog client state changes for reactive rendering
  useEffect(() => {
    const unsub = catalogClient.subscribe((state: CatalogClientState) => {
      setLoadState(state.loadState);
      setIsFixture(isTestFixture(state.loadState));
    });
    return unsub;
  }, []);

  // Re-evaluate when progress or catalog state changes
  useEffect(() => {
    let current = true;
    void (async () => {
      const pkg = await catalogClient.getActivePackage();
      if (current) {
        setEvaluation(pkg ? evaluateVerifiedLineup(pkg, progress) : null);
        setFrontierRoster(pkg ? buildFrontierRoster(managersFromVerifiedPackage(pkg), progress) : []);
      }
    })();
    return () => { current = false; };
  }, [progress, loadState]);

  const frontierPlan = useMemo(() => planFrontierCheckpoints(
    frontierBarrierId,
    Number(frontierCredits) || 0,
    frontierPass,
  ), [frontierBarrierId, frontierCredits, frontierPass]);

  // Determine the right empty state based on loading phase
  const isLoading = loadState.phase !== "idle" && !isActive(loadState) && loadState.phase !== "error";

  if (isLoading) {
    return <section className="card-container"><h2 className="card-title">Manager Lineup</h2><div className="empty-state"><h3>Loading catalog…</h3><p>Checking for active catalog package.</p></div></section>;
  }

  if (!evaluation) {
    return <section className="card-container"><h2 className="card-title">Manager Lineup</h2><div className="empty-state"><h3>Verified catalog unavailable</h3><p>Strategy only uses an active, verified catalog package. Open More to refresh the catalog or review recovery guidance.</p></div></section>;
  }

  return (
    <>
      <StrategyPlanMenu
        selectedPlan={selectedPlan}
        onSelect={setSelectedPlan}
        hasFrontierRoster={frontierRoster.length > 0}
        lineupCount={evaluation.totalManagersConsidered}
        upgradeCount={evaluation.upgradePriorities.length}
      />
      {selectedPlan === "frontier" && <FrontierPlaybook
        roster={frontierRoster}
        barrierId={frontierBarrierId}
        credits={frontierCredits}
        pass={frontierPass}
        plan={frontierPlan}
        onBarrierChange={setFrontierBarrierId}
        onCreditsChange={setFrontierCredits}
        onPassChange={setFrontierPass}
      />}
      {selectedPlan === "lineup" && <section className="card-container">
      <h2 className="card-title">General lineup</h2>
      {isFixture && (
        <div style={{ background: "rgba(255, 159, 10, 0.15)", border: "1px solid var(--accent-orange)", borderRadius: "0.5rem", padding: "0.5rem 0.75rem", marginBottom: "0.75rem", fontSize: "0.8rem", fontWeight: 600, color: "var(--accent-orange)" }}>
          ⚠️ TEST FIXTURE — Not production data
        </div>
      )}
      <p className="muted" style={{ fontSize: "0.8rem", marginTop: "-0.5rem" }}>
        Release {evaluation.catalogReleaseId} · catalog {evaluation.catalogVersion} · manifest {evaluation.manifestHash?.slice(0, 12)}…
      </p>
      {evaluation.totalManagersConsidered > 0 ? <>
        {Object.entries(evaluation.areaRecommendations).map(([area, recs]) => (
          <div key={area} style={{ marginTop: "1.25rem" }}>
            <h3 style={{ fontSize: "1rem" }}>{area}</h3>
            {recs.slice(0, 1).map((rec) => <div key={rec.managerId} style={{ padding: "0.75rem", marginTop: "0.5rem", borderRadius: "0.5rem", border: "1px solid var(--border-color)", background: rec.limitedData ? "rgba(255, 159, 10, 0.08)" : "var(--bg-secondary)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}><strong>#{rec.areaRank} {rec.name}</strong><strong>{rec.score.toFixed(1)}</strong></div>
              <div className="muted" style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>{rec.rationale}</div>
              {rec.limitedData && <div style={{ color: "var(--accent-orange)", fontSize: "0.75rem", marginTop: "0.25rem" }}>Limited data: {rec.missingData.join(", ")}. No unknown effect has been estimated.</div>}
            </div>)}
          </div>
        ))}
      </> : <div className="empty-state"><h3>No assignable managers</h3><p>Sync unlocked managers to see recommendations from this release.</p></div>}
      {evaluation.unevaluated.length > 0 && <p style={{ color: "var(--accent-orange)", fontSize: "0.8rem", marginTop: "1rem" }}>{evaluation.unevaluated.length} unlocked manager(s) were excluded because their IDs are unresolved in this catalog release.</p>}
      </section>}
      {selectedPlan === "upgrades" && <UpgradePlan recommendations={evaluation.upgradePriorities} />}
    </>
  );
}

function StrategyPlanMenu({ selectedPlan, onSelect, hasFrontierRoster, lineupCount, upgradeCount }: {
  selectedPlan: StrategyPlanId;
  onSelect: (plan: StrategyPlanId) => void;
  hasFrontierRoster: boolean;
  lineupCount: number;
  upgradeCount: number;
}) {
  const plans: Array<{ id: StrategyPlanId; title: string; detail: string; badge: string }> = [
    { id: "frontier", title: "Frontier Mine start", detail: "Set your FC checkpoint, prepare the right roles, and run the opening burst.", badge: hasFrontierRoster ? "Roster ready" : "Sync roster" },
    { id: "lineup", title: "General lineup", detail: "One best owned manager for each operating area.", badge: `${lineupCount} managers` },
    { id: "upgrades", title: "Upgrade focus", detail: "Prioritize your most useful available rank and level gains.", badge: `${upgradeCount} targets` },
  ];
  return <section className="card-container strategy-plan-menu">
    <p className="eyebrow">Strategy library</p>
    <h2 className="card-title">Choose a plan</h2>
    <p className="muted strategy-plan-menu-intro">Strategies are short, actionable playbooks. They use your synced roster when the required data is available.</p>
    <div className="strategy-plan-grid">
      {plans.map((plan) => <button key={plan.id} className={`strategy-plan-card ${selectedPlan === plan.id ? "active" : ""}`} onClick={() => onSelect(plan.id)} aria-pressed={selectedPlan === plan.id}>
        <span className="strategy-plan-card-top"><strong>{plan.title}</strong><em>{plan.badge}</em></span>
        <span>{plan.detail}</span>
        <b>{selectedPlan === plan.id ? "Open plan" : "View plan"} →</b>
      </button>)}
    </div>
  </section>;
}

function UpgradePlan({ recommendations }: { recommendations: StrategyEvaluation["upgradePriorities"] }) {
  return <section className="card-container">
    <h2 className="card-title">Upgrade focus</h2>
    {recommendations.length > 0 ? <div className="strategy-upgrade-list">{recommendations.map((rec, index) => <div key={rec.managerId}><strong>#{index + 1} {rec.name}</strong><p className="muted">{rec.rationale}</p></div>)}</div> : <div className="empty-state"><h3>No upgrade targets yet</h3><p>Sync manager fragments and progress to identify the next useful investment.</p></div>}
  </section>;
}

interface FrontierPlaybookProps {
  roster: FrontierRosterEntry[];
  barrierId: string;
  credits: string;
  pass: FrontierPass;
  plan: ReturnType<typeof planFrontierCheckpoints>;
  onBarrierChange: (value: string) => void;
  onCreditsChange: (value: string) => void;
  onPassChange: (value: FrontierPass) => void;
}

function FrontierPlaybook({ roster, barrierId, credits, pass, plan, onBarrierChange, onCreditsChange, onPassChange }: FrontierPlaybookProps) {
  const passiveCount = roster.filter((entry) => entry.tags.includes("Income passive")).length;
  const reducerCount = roster.filter((entry) => entry.tags.includes("Upgrade-cost reduction")).length;
  const burstCount = roster.filter((entry) => entry.tags.includes("Shaft burst") || entry.tags.includes("Elevator/warehouse burst")).length;

  return <section className="card-container frontier-playbook">
    <div className="frontier-heading-row">
      <div>
        <p className="eyebrow">Frontier Mine</p>
        <h2 className="card-title">Run the event like a campaign</h2>
      </div>
      <span className="frontier-source-badge">Research-backed · patch-sensitive</span>
    </div>
    <p className="muted frontier-intro">Frontier is a Super Manager economy. Build passive income, protect Sparks, then spend a short burst window when a barrier reward or Frontier multiplier makes the next push worth it.</p>

    <div className="frontier-rule-grid">
      <div><strong>Only SMs matter</strong><span>Normal boosts, research, artifacts, collectibles, Super Cash, and Friend Boosts do not carry into the event.</span></div>
      <div><strong>FC is your routing currency</strong><span>Frontier Credits buy event items, recharge Sparks, and skip barriers. They carry between tiers during the event.</span></div>
      <div><strong>Sparks are burst fuel</strong><span>Activation costs can rise with repeated use, so passive assignments and timing beat constant button-pressing.</span></div>
      <div><strong>Rewards change the route</strong><span>Open a checkpoint, collect its FC or multiplier, and recalculate before spending the next large burst.</span></div>
    </div>

    <div className="frontier-section">
      <h3>Account-aware roster</h3>
      {roster.length === 0 ? <p className="detail-empty-note">Sync your managers to turn the general playbook into a roster-specific plan.</p> : <>
        <div className="metrics frontier-metrics">
          <div className="metric-card"><strong>{passiveCount}</strong><span>income passives</span></div>
          <div className="metric-card"><strong>{reducerCount}</strong><span>cost reducers</span></div>
          <div className="metric-card"><strong>{burstCount}</strong><span>burst options</span></div>
        </div>
        <div className="frontier-roster-list">
          {roster.slice(0, 8).map((entry) => <div className="frontier-roster-row" key={entry.managerId}>
            <div><strong>{entry.name}</strong><span>{entry.area} · Lv {entry.level} · R{entry.rank}</span></div>
            <div className="frontier-roster-tags">{entry.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
            <p>{entry.why}</p>
          </div>)}
        </div>
      </>}
    </div>

    <div className="frontier-section">
      <h3>FC checkpoint planner</h3>
      <p className="detail-empty-note">This is a transparent sequential planner using the published “cost after waiting” reference values. It does not model wait time, ad skips, Time Jumps, or live event changes.</p>
      <div className="frontier-planner-controls">
        <label>Current barrier<select value={barrierId} onChange={(event) => onBarrierChange(event.target.value)}>{FRONTIER_BARRIERS.map((barrier) => <option key={barrier.id} value={barrier.id}>{barrier.id}</option>)}</select></label>
        <label>FC balance<input type="number" min="0" inputMode="numeric" value={credits} onChange={(event) => onCreditsChange(event.target.value)} /></label>
        <label>Reward path<select value={pass} onChange={(event) => onPassChange(event.target.value as FrontierPass)}><option value="free">Free</option><option value="premium">Premium Pass</option><option value="elite">Elite Pass</option></select></label>
      </div>
      <div className="frontier-plan-summary"><strong>{plan.furthest ?? "No checkpoint"}</strong><span>{plan.next ? `Next shortfall: ${Math.max(0, plan.next.costAfter - plan.remainingFc)} FC` : "All reference checkpoints cleared"}</span><span>{plan.remainingFc.toLocaleString()} FC projected after rewards</span></div>
      <div className="frontier-table-wrap"><table className="frontier-table"><thead><tr><th>Checkpoint</th><th>Cost</th><th>Reward</th><th>Balance</th></tr></thead><tbody>{plan.rows.slice(0, 8).map((row) => <tr key={row.barrier.id} className={row.cleared ? "" : "frontier-row-blocked"}><td>{row.barrier.id}</td><td>{row.cost.toLocaleString()}</td><td>{row.reward ? `+${row.reward.toLocaleString()}` : "—"}</td><td>{row.cleared ? row.balanceAfter.toLocaleString() : "Need more FC"}</td></tr>)}</tbody></table></div>
    </div>

    <div className="frontier-section frontier-sequence">
      <h3>Recommended run sequence</h3>
      <ol><li><strong>Prepare:</strong> assign income passives in the active mine and identify one cost reducer for major upgrades.</li><li><strong>Build:</strong> push the cheapest available shafts and save Sparks while barriers are counting down.</li><li><strong>Open a reward checkpoint:</strong> claim the FC or multiplier before committing to the next deep shaft.</li><li><strong>Burst:</strong> pair your strongest shaft run with the best elevator/warehouse converter you own; use cost reduction around the upgrade spend.</li><li><strong>Recalculate:</strong> stop when the next checkpoint costs more than the expected reward-adjusted balance. Waiting for FC is a strategy, not a failure.</li></ol>
    </div>
    <p className="frontier-footnote">Reference basis: Idle Master's Hub Frontier Calculator, official Kolibri Frontier help, and community Frontier Mine guidance. See the full research notes in <code>docs/frontier-mine-guide.md</code>.</p>
  </section>;
}
