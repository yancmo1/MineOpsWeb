import { useEffect, useMemo, useState } from "react";
import type { PlayerManager } from "../lib/db";
import { catalogClient, type CatalogClientState, type LoadState } from "../lib/catalog-client";
import { evaluateVerifiedLineup, managersFromVerifiedPackage, type StrategyEvaluation } from "../lib/strategy";
import { buildFrontierRoster, planFrontierCheckpoints, recommendFrontierAction, type FrontierActionRecommendation, type FrontierPass, type FrontierRosterEntry, FRONTIER_BARRIERS } from "../lib/frontier-guide";
import { buildBalancedLineup, type BalancedLineup } from "../lib/lineup";
import { buildUpgradeRoi, nextUsefulInvestment, type UpgradeRoiItem } from "../lib/upgrade-roi";
import { bottleneckArea, researchNodesFromDomain, researchPriorities, type Bottleneck, type ResearchPriority } from "../lib/research";
import { prestigeTiming, verifiedBarrierTableFromDomain } from "../lib/barrier-tables";
import { saveStrategyPlan, dismissRecommendation, undismissRecommendation, listStrategyPlans, listDismissedRecommendations, deleteStrategyPlan, type SavedStrategyPlan, type DismissedRecommendation } from "../lib/planner-storage";
import { buildTierlist, compareManagersSideBySide, type TierlistEntry, type ManagerComparisonRow } from "../lib/sm-comparison";
import { evaluateProgressStages, progressSummary, type ProgressStageResult } from "../lib/progress-tracker";
import { computeBombDecision, assessRunState, type StellaMechanics, type StellaDecision } from "../lib/stella-elevator";
import { planCrystalSpend, minPromoForLevel, type CrystalPlanResult, type CrystalCostTable } from "../lib/crystal-planner";

interface StrategyPageProps {
  progress: PlayerManager[];
}

type StrategyPlanId = "frontier" | "lineup" | "upgrades" | "tierlist" | "progress" | "stella" | "crystal";

/** Check whether a load state represents an active package (any source). */
function isActive(ls: LoadState): boolean {
  return ls.phase === "active" || ls.phase === "active_current" || ls.phase === "active_stale" || ls.phase === "offline_cached" || ls.phase === "bootstrap_fallback";
}

/** Check whether the active package is a test fixture. */
function isTestFixture(ls: LoadState): boolean {
  return ls.phase === "active" && "releaseId" in ls && typeof ls.releaseId === "string" && ls.releaseId.startsWith("test-fixture");
}

function parseOptionalNonNegative(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
}

function parseNonNegative(value: string): number {
  return parseOptionalNonNegative(value) ?? 0;
}

export function StrategyPage({ progress }: StrategyPageProps) {
  const [evaluation, setEvaluation] = useState<StrategyEvaluation | null>(null);
  const [frontierRoster, setFrontierRoster] = useState<FrontierRosterEntry[]>([]);
  const [balancedLineups, setBalancedLineups] = useState<BalancedLineup[]>([]);
  const [roiItems, setRoiItems] = useState<UpgradeRoiItem[]>([]);
  const [bottleneck, setBottleneck] = useState<Bottleneck | null>(null);
  const [research, setResearch] = useState<ResearchPriority[]>([]);
  const [barrierDataSource, setBarrierDataSource] = useState("Reference barrier table (Idle Master's Hub, observed 2026-08-01).");
  const [prestigeNote, setPrestigeNote] = useState<string | null>(null);
  const [savedPlans, setSavedPlans] = useState<SavedStrategyPlan[]>([]);
  const [dismissed, setDismissed] = useState<DismissedRecommendation[]>([]);
  const [tierlist, setTierlist] = useState<TierlistEntry[]>([]);
  const [comparisonRows, setComparisonRows] = useState<ManagerComparisonRow[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [progressResults, setProgressResults] = useState<ProgressStageResult[]>([]);
  const [stellaMechanics, setStellaMechanics] = useState<StellaMechanics>({
    totalFloors: 60,
    safeFloors: [1, 10, 20, 30, 40, 50, 60],
    bombChancePerRiskFloor: 0.15,
    continueCostsTickets: [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6],
    expressStartFloor: 30,
  });
  const [stellaInput, setStellaInput] = useState({ currentFloor: 1, target: 30, revivesUsed: 0, elevatorTickets: 20, expressTickets: 1, justBombed: false });
  const [crystalInput, setCrystalInput] = useState({ fromLevel: 1, toLevel: 20, fromPromo: 0, toPromo: 1, blueBudget: 500, redBudgetEnabled: false, redBudget: 500, discountPct: 0 });
  const [crystalCosts, setCrystalCosts] = useState<CrystalCostTable>({
    bluePerLevel: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140],
    redPerPromo: [0, 50, 100, 200, 400, 800],
  });

  // Load persisted planner state on mount.
  useEffect(() => {
    void (async () => {
      setSavedPlans(await listStrategyPlans());
      setDismissed(await listDismissedRecommendations());
    })();
  }, []);

  const dismissedIds = new Set(dismissed.map((entry) => entry.id));

  async function handleSavePlan(kind: "lineup" | "upgrade" | "frontier", title: string, snapshot: unknown) {
    const id = await saveStrategyPlan({
      kind,
      title,
      catalogReleaseId: evaluation?.catalogReleaseId ?? null,
      catalogVersion: evaluation?.catalogVersion ?? null,
      snapshot,
    });
    setSavedPlans([{ id, kind, title, createdAt: new Date().toISOString(), catalogReleaseId: evaluation?.catalogReleaseId ?? null, catalogVersion: evaluation?.catalogVersion ?? null, snapshot }, ...savedPlans]);
  }

  async function handleDeletePlan(id: number) {
    await deleteStrategyPlan(id);
    setSavedPlans(savedPlans.filter((plan) => plan.id !== id));
  }

  async function handleDismiss(managerId: string, kind: "lineup" | "upgrade") {
    await dismissRecommendation(managerId, kind);
    setDismissed([...dismissed, { id: `${kind}:${managerId}`, managerId, kind, dismissedAt: new Date().toISOString() }]);
  }

  async function handleUndismiss(managerId: string, kind: "lineup" | "upgrade") {
    await undismissRecommendation(managerId, kind);
    setDismissed(dismissed.filter((entry) => entry.id !== `${kind}:${managerId}`));
  }
  const [loadState, setLoadState] = useState<LoadState>(catalogClient.loadState);
  const [isFixture, setIsFixture] = useState(false);
  const [frontierBarrierId, setFrontierBarrierId] = useState("FM I 5");
  const [frontierCredits, setFrontierCredits] = useState("705");
  const [frontierLiveCost, setFrontierLiveCost] = useState("");
  const [frontierWaitMinutes, setFrontierWaitMinutes] = useState("");
  const [frontierFreeSkips, setFrontierFreeSkips] = useState("0");
  const [frontierTimeJumps, setFrontierTimeJumps] = useState("0");
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
        const nextEvaluation = pkg ? evaluateVerifiedLineup(pkg, progress) : null;
        const managers = pkg ? managersFromVerifiedPackage(pkg) : [];
        const nextRoster = pkg ? buildFrontierRoster(managers, progress) : [];
        setEvaluation(nextEvaluation);
        setFrontierRoster(nextRoster);
        setBalancedLineups(nextEvaluation ? buildBalancedLineup(managers, nextEvaluation, nextRoster) : []);
        setRoiItems(buildUpgradeRoi(managers, progress));
        const nextBottleneck = nextEvaluation ? bottleneckArea(nextEvaluation) : null;
        setBottleneck(nextBottleneck);
        const researchDomain = pkg?.artifacts["research-domain.json"]?.content;
        setResearch(researchDomain ? researchPriorities(researchNodesFromDomain(researchDomain), nextBottleneck) : []);
        const barrierStatus = verifiedBarrierTableFromDomain(pkg?.artifacts["frontier-domain.json"]?.content);
        setBarrierDataSource(barrierStatus.available ? barrierStatus.reason : barrierStatus.reason.split(".")[0] + ".");
        setPrestigeNote(nextEvaluation ? prestigeTiming(managers, progress, nextEvaluation).note : null);
        setTierlist(buildTierlist(managers, progress));
        setComparisonRows(compareManagersSideBySide(managers, progress));
        setProgressResults(evaluateProgressStages(managers, progress));
      }
    })();
    return () => { current = false; };
  }, [progress, loadState]);

  const frontierPlan = useMemo(() => planFrontierCheckpoints(
    frontierBarrierId,
    Number(frontierCredits) || 0,
    frontierPass,
    parseOptionalNonNegative(frontierLiveCost) ?? undefined,
  ), [frontierBarrierId, frontierCredits, frontierLiveCost, frontierPass]);

  const frontierRecommendation = useMemo<FrontierActionRecommendation>(() => recommendFrontierAction({
    currentCost: parseOptionalNonNegative(frontierLiveCost),
    remainingWaitMinutes: parseOptionalNonNegative(frontierWaitMinutes),
    frontierCredits: parseNonNegative(frontierCredits),
    freeSkips: parseNonNegative(frontierFreeSkips),
    timeJumps: parseNonNegative(frontierTimeJumps),
  }), [frontierCredits, frontierFreeSkips, frontierLiveCost, frontierTimeJumps, frontierWaitMinutes]);

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
        upgradeCount={roiItems.length}
        tierlistCount={tierlist.length}
        progressCount={progressSummary(progressResults).complete}
      />
      {selectedPlan === "frontier" && <FrontierPlaybook
        roster={frontierRoster}
        barrierId={frontierBarrierId}
        credits={frontierCredits}
        pass={frontierPass}
        plan={frontierPlan}
        liveCost={frontierLiveCost}
        waitMinutes={frontierWaitMinutes}
        freeSkips={frontierFreeSkips}
        timeJumps={frontierTimeJumps}
        recommendation={frontierRecommendation}
        barrierDataSource={barrierDataSource}
        prestigeNote={prestigeNote}
        onBarrierChange={setFrontierBarrierId}
        onCreditsChange={setFrontierCredits}
        onLiveCostChange={setFrontierLiveCost}
        onWaitMinutesChange={setFrontierWaitMinutes}
        onFreeSkipsChange={setFrontierFreeSkips}
        onTimeJumpsChange={setFrontierTimeJumps}
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
      {balancedLineups.length > 0 ? <>
        {balancedLineups.map((lineup) => (
          <div key={lineup.area} style={{ marginTop: "1.25rem" }}>
            <h3 style={{ fontSize: "1rem" }}>{lineup.area}</h3>
            <p className="muted" style={{ fontSize: "0.8rem", margin: "0.25rem 0 0.5rem 0" }}>{lineup.note}</p>
            {lineup.picks.filter((pick) => !dismissedIds.has(`lineup:${pick.managerId}`)).map((pick) => <div key={pick.managerId} style={{ padding: "0.75rem", marginTop: "0.5rem", borderRadius: "0.5rem", border: "1px solid var(--border-color)", background: pick.limitedData ? "rgba(255, 159, 10, 0.08)" : "var(--bg-secondary)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}><strong>#{pick.rank} {pick.name}</strong><strong>{pick.score.toFixed(1)}</strong></div>
              <div className="muted" style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>{pick.why}</div>
              {pick.coverageTags.length > 0 && <div style={{ fontSize: "0.75rem", marginTop: "0.25rem", color: "var(--accent-cyan)" }}>{pick.coverageTags.join(" · ")}</div>}
              {pick.elementNotes.map((note) => <div key={note} style={{ color: "var(--text-tertiary)", fontSize: "0.7rem", marginTop: "0.2rem" }}>{note}</div>)}
              {pick.limitedData && <div style={{ color: "var(--accent-orange)", fontSize: "0.75rem", marginTop: "0.25rem" }}>Limited data: {pick.missingData.join(", ")}. No unknown effect has been estimated.</div>}
              <button type="button" onClick={() => handleDismiss(pick.managerId, "lineup")} style={{ marginTop: "0.5rem", fontSize: "0.7rem", padding: "0.2rem 0.5rem", borderRadius: "0.4rem", border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-tertiary)", cursor: "pointer" }}>Dismiss</button>
            </div>)}
          </div>
        ))}
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem", flexWrap: "wrap" }}>
          <button type="button" onClick={() => handleSavePlan("lineup", "General lineup", balancedLineups)} style={{ padding: "0.5rem 0.875rem", borderRadius: "0.5rem", border: "1px solid var(--accent-cyan)", background: "rgba(0,160,185,0.1)", color: "var(--accent-cyan)", cursor: "pointer", fontWeight: 600 }}>💾 Save lineup</button>
          {dismissed.some((entry) => entry.kind === "lineup") && <button type="button" onClick={() => dismissed.filter((entry) => entry.kind === "lineup").forEach((entry) => handleUndismiss(entry.managerId, "lineup"))} style={{ padding: "0.5rem 0.875rem", borderRadius: "0.5rem", border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer" }}>Restore dismissed</button>}
        </div>
      </> : evaluation.totalManagersConsidered > 0 ? <div className="empty-state"><h3>No lineup built</h3><p>No assignable managers produced recommendations for this release.</p></div>
      : <div className="empty-state"><h3>No assignable managers</h3><p>Sync unlocked managers to see recommendations from this release.</p></div>}
      {evaluation.unevaluated.length > 0 && <p style={{ color: "var(--accent-orange)", fontSize: "0.8rem", marginTop: "1rem" }}>{evaluation.unevaluated.length} unlocked manager(s) were excluded because their IDs are unresolved in this catalog release.</p>}
      <SavedPlans plans={savedPlans} onDelete={handleDeletePlan} />
      </section>}
      {selectedPlan === "upgrades" && <UpgradePlan items={roiItems} bottleneck={bottleneck} research={research} onSave={(snapshot) => handleSavePlan("upgrade", "Upgrade focus", snapshot)} onDelete={handleDeletePlan} savedPlans={savedPlans} />}
      {selectedPlan === "progress" && <section className="card-container">
        <h2 className="card-title">Progress tracker</h2>
        {(() => {
          const summary = progressSummary(progressResults);
          return <div style={{ marginBottom: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "0.25rem" }}><strong>{summary.complete} of {summary.total} stages complete</strong><strong>{summary.pct}%</strong></div>
            <div style={{ height: "0.5rem", borderRadius: "0.25rem", background: "var(--bg-secondary)", overflow: "hidden" }}><div style={{ height: "100%", width: `${summary.pct}%`, background: "var(--accent-cyan)" }} /></div>
            <p className="muted" style={{ fontSize: "0.75rem", margin: "0.4rem 0 0 0" }}>The roster roadmap, computed from the verified catalog: each stage filters owned managers by rarity, area, and passive kind (MIF / CIF / MSUCR), then checks the promotion target. Nothing is estimated.</p>
          </div>;
        })()}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {progressResults.map((result) => <div key={result.stage.id} style={{ padding: "0.75rem", borderRadius: "0.5rem", border: `1px solid ${result.complete ? "var(--accent-cyan)" : "var(--border-color)"}`, background: result.complete ? "rgba(0,160,185,0.06)" : "var(--bg-secondary)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}><strong>{result.complete ? "✅" : "⬜"} Stage {result.stage.id}: {result.stage.title}</strong><strong className="muted" style={{ fontSize: "0.8rem" }}>{result.satisfied}/{result.qualifying.length}</strong></div>
            <p className="muted" style={{ fontSize: "0.75rem", margin: "0.25rem 0 0 0" }}>{result.stage.subtitle}</p>
            {result.qualifying.length > 0 && <div style={{ fontSize: "0.75rem", marginTop: "0.35rem", color: "var(--text-secondary)" }}>
              {result.qualifying.map((entry) => `${entry.manager.name} P${entry.promo}/${entry.target}`).join(" · ")}
            </div>}
          </div>)}
        </div>
      </section>}
      {selectedPlan === "stella" && <StellaElevatorPanel mechanics={stellaMechanics} onMechanicsChange={setStellaMechanics} input={stellaInput} onInputChange={setStellaInput} />}
      {selectedPlan === "crystal" && <CrystalPlannerPanel input={crystalInput} onInputChange={setCrystalInput} costTable={crystalCosts} onCostTableChange={setCrystalCosts} />}
      {selectedPlan === "tierlist" && <section className="card-container">
        <h2 className="card-title">Tier list & compare</h2>
        <p className="muted" style={{ fontSize: "0.8rem", marginTop: "-0.5rem" }}>Ranked by the documented heuristic score (verified exact tables + equipment). Game-parity power score is not yet available, so this is labeled heuristic, never game power.</p>
        {tierlist.length > 0 ? <>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            {(["S", "A", "B", "C"] as const).map((band) => {
              const entries = tierlist.filter((entry) => entry.tier === band);
              if (entries.length === 0) return null;
              return <div key={band} style={{ padding: "0.5rem 0.75rem", borderRadius: "0.5rem", border: "1px solid var(--border-color)", background: "var(--bg-secondary)" }}>
                <strong style={{ color: band === "S" ? "var(--accent-orange)" : band === "A" ? "var(--accent-cyan)" : "inherit" }}>Tier {band}</strong> <span className="muted" style={{ fontSize: "0.75rem" }}>{entries[0].tierNote}</span>
                <div style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>{entries.map((entry) => `${entry.name} (${entry.area}, ${entry.heuristicScore.toFixed(0)})`).join(" · ")}</div>
              </div>;
            })}
          </div>
          <h3 style={{ fontSize: "1rem", marginTop: "1.5rem" }}>Side-by-side compare</h3>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
            {comparisonRows.slice(0, 10).map((row) => <button key={row.managerId} type="button" onClick={() => setCompareIds((ids) => ids.includes(row.managerId) ? ids.filter((id) => id !== row.managerId) : [...ids.slice(-1), row.managerId])} style={{ padding: "0.4rem 0.7rem", borderRadius: "0.4rem", border: "1px solid var(--border-color)", background: compareIds.includes(row.managerId) ? "rgba(0,160,185,0.2)" : "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: "0.8rem" }}>{row.name}</button>)}
          </div>
          {compareIds.length > 0 && <div style={{ display: "grid", gridTemplateColumns: `repeat(${compareIds.length}, 1fr)`, gap: "0.5rem" }}>
            {compareIds.map((id) => {
              const row = comparisonRows.find((candidate) => candidate.managerId === id);
              if (!row) return null;
              return <div key={id} style={{ padding: "0.75rem", borderRadius: "0.5rem", border: "1px solid var(--border-color)", background: "var(--bg-secondary)" }}>
                <strong>{row.name}</strong><span className="muted" style={{ fontSize: "0.7rem", marginLeft: "0.4rem" }}>{row.rarity}</span>
                <div style={{ fontSize: "0.8rem", marginTop: "0.4rem" }}>
                  <div>Area: {row.area}</div>
                  <div>Level {row.level} · Rank {row.rank} · P{row.promotion}</div>
                  <div>Active: {row.activeValue.toFixed(1)}x</div>
                  <div>Rank boost: +{row.rankActiveIncreasePct.toFixed(0)}%</div>
                  <div>Passives: {row.passiveCount}</div>
                  {row.equipmentBoost > 0 && <div>Equipment: +{(row.equipmentBoost * 100).toFixed(0)}%</div>}
                  <div style={{ marginTop: "0.3rem" }}><strong>Score {row.heuristicScore.toFixed(1)}</strong></div>
                </div>
              </div>;
            })}
          </div>}
        </> : <div className="empty-state"><h3>No ranked roster</h3><p>Sync unlocked managers to build a tier list.</p></div>}
      </section>}
    </>
  );
}

function StrategyPlanMenu({ selectedPlan, onSelect, hasFrontierRoster, lineupCount, upgradeCount, tierlistCount, progressCount }: {
  selectedPlan: StrategyPlanId;
  onSelect: (plan: StrategyPlanId) => void;
  hasFrontierRoster: boolean;
  lineupCount: number;
  upgradeCount: number;
  tierlistCount: number;
  progressCount: number;
}) {
  const plans: Array<{ id: StrategyPlanId; title: string; detail: string; badge: string }> = [
    { id: "frontier", title: "Frontier Mine start", detail: "Set your FC checkpoint, prepare the right roles, and run the opening burst.", badge: hasFrontierRoster ? "Roster ready" : "Sync roster" },
    { id: "lineup", title: "General lineup", detail: "One best owned manager for each operating area.", badge: `${lineupCount} managers` },
    { id: "upgrades", title: "Upgrade focus", detail: "Prioritize your most useful available rank and level gains.", badge: `${upgradeCount} targets` },
    { id: "tierlist", title: "Tier list & compare", detail: "Rank your roster by verified score and compare managers side by side.", badge: `${tierlistCount} ranked` },
    { id: "progress", title: "Progress tracker", detail: "The roadmap: which promotion milestones are done across your roster.", badge: `${progressCount} done` },
    { id: "stella", title: "Stella's Elevator", detail: "Mid-run bomb-decision calculator for Stella's Lucky Elevator events.", badge: "run stats" },
    { id: "crystal", title: "Crystal planner", detail: "Level/promo crystal budget calculator with discount and structural gates.", badge: "budget" },
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

function SavedPlans({ plans, onDelete }: { plans: SavedStrategyPlan[]; onDelete: (id: number) => void }) {
  if (plans.length === 0) return null;
  return <div style={{ marginTop: "1.5rem" }}>
    <h3 style={{ fontSize: "1rem" }}>Saved plans</h3>
    {plans.map((plan) => <div key={plan.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.75rem", marginTop: "0.35rem", borderRadius: "0.5rem", border: "1px solid var(--border-color)", fontSize: "0.85rem" }}>
      <div><strong>{plan.title}</strong><span className="muted" style={{ fontSize: "0.7rem", marginLeft: "0.5rem" }}>{plan.kind} · {plan.createdAt?.slice(0, 10)} · {plan.catalogReleaseId ?? "no release"}</span></div>
      <button type="button" onClick={() => plan.id != null && onDelete(plan.id)} style={{ fontSize: "0.7rem", padding: "0.2rem 0.5rem", borderRadius: "0.4rem", border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-tertiary)", cursor: "pointer" }}>Delete</button>
    </div>)}
  </div>;
}

function UpgradePlan({ items, bottleneck, research, onSave, onDelete, savedPlans }: { items: UpgradeRoiItem[]; bottleneck: Bottleneck | null; research: ResearchPriority[]; onSave: (snapshot: unknown) => void; onDelete: (id: number) => void; savedPlans: SavedStrategyPlan[] }) {
  const next = nextUsefulInvestment(items);
  return <section className="card-container">
    <h2 className="card-title">Upgrade focus</h2>
    <button type="button" onClick={() => onSave(items)} style={{ marginBottom: "0.75rem", padding: "0.5rem 0.875rem", borderRadius: "0.5rem", border: "1px solid var(--accent-cyan)", background: "rgba(0,160,185,0.1)", color: "var(--accent-cyan)", cursor: "pointer", fontWeight: 600 }}>💾 Save upgrade plan</button>
    {items.length > 0 ? <>
      {next && <div style={{ padding: "0.75rem", marginBottom: "0.75rem", borderRadius: "0.5rem", border: "1px solid var(--accent-cyan)", background: "rgba(0, 160, 185, 0.08)" }}>
        <strong>Next useful investment: {next.name}</strong>
        <p className="muted" style={{ fontSize: "0.8rem", margin: "0.25rem 0 0 0" }}>{next.rationale}</p>
      </div>}
      <div className="strategy-upgrade-list">{items.slice(0, 12).map((item, index) => <div key={`${item.managerId}-${item.kind}-${item.to}`}>
        <strong>#{index + 1} {item.name} · {item.kind === "level" ? `Level ${item.from}→${item.to}` : item.kind === "promotion" ? `Promotion ${item.to}` : `Rank ${item.to}`}</strong>
        <p className="muted">{item.rationale}</p>
        {item.roi != null && <p style={{ color: "var(--accent-cyan)", fontSize: "0.75rem", margin: "0" }}>ROI {item.roi.toFixed(4)} per {item.costUnit.split(" ")[0]}</p>}
      </div>)}</div>
    </> : <div className="empty-state"><h3>No upgrade targets yet</h3><p>Sync manager fragments and progress to identify the next useful investment.</p></div>}
    {bottleneck && <div style={{ marginTop: "1.5rem", padding: "0.75rem", borderRadius: "0.5rem", border: "1px solid var(--border-color)", background: "var(--bg-secondary)" }}>
      <h3 style={{ fontSize: "1rem", margin: "0 0 0.25rem 0" }}>Bottleneck: {bottleneck.area}</h3>
      <p className="muted" style={{ fontSize: "0.8rem", margin: 0 }}>{bottleneck.note}</p>
    </div>}
    {research.length > 0 && <div style={{ marginTop: "1.25rem" }}>
      <h3 style={{ fontSize: "1rem" }}>Research priorities</h3>
      <p className="muted" style={{ fontSize: "0.75rem", margin: "0.25rem 0 0.5rem 0" }}>Identity-level skill-node tags from the APK catalog. Effect magnitudes are not yet decoded, so these rank which skills to unlock, not by how much.</p>
      {research.slice(0, 8).map((item) => <div key={item.node.name} style={{ padding: "0.5rem", marginTop: "0.35rem", borderRadius: "0.5rem", border: "1px solid var(--border-color)", fontSize: "0.85rem" }}>
        <strong>{item.node.region ?? item.node.continent ?? "Generic"}: {item.node.name.replace(/\.asset$/, "")}</strong>
        <p className="muted" style={{ fontSize: "0.75rem", margin: "0.15rem 0 0 0" }}>{item.reason}</p>
      </div>)}
    </div>}
    <SavedPlans plans={savedPlans} onDelete={onDelete} />
  </section>;
}

interface FrontierPlaybookProps {
  roster: FrontierRosterEntry[];
  barrierId: string;
  credits: string;
  pass: FrontierPass;
  plan: ReturnType<typeof planFrontierCheckpoints>;
  liveCost: string;
  waitMinutes: string;
  freeSkips: string;
  timeJumps: string;
  recommendation: FrontierActionRecommendation;
  barrierDataSource: string;
  prestigeNote: string | null;
  onBarrierChange: (value: string) => void;
  onCreditsChange: (value: string) => void;
  onLiveCostChange: (value: string) => void;
  onWaitMinutesChange: (value: string) => void;
  onFreeSkipsChange: (value: string) => void;
  onTimeJumpsChange: (value: string) => void;
  onPassChange: (value: FrontierPass) => void;
}

function FrontierPlaybook({ roster, barrierId, credits, pass, plan, liveCost, waitMinutes, freeSkips, timeJumps, recommendation, barrierDataSource, prestigeNote, onBarrierChange, onCreditsChange, onLiveCostChange, onWaitMinutesChange, onFreeSkipsChange, onTimeJumpsChange, onPassChange }: FrontierPlaybookProps) {
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

    {(barrierDataSource || prestigeNote) && <div style={{ padding: "0.5rem 0.75rem", marginBottom: "0.75rem", borderRadius: "0.5rem", border: "1px solid var(--border-color)", background: "var(--bg-secondary)", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
      {barrierDataSource && <p style={{ margin: 0 }}>📊 {barrierDataSource}</p>}
      {prestigeNote && <p style={{ margin: "0.25rem 0 0 0" }}>⏳ {prestigeNote}</p>}
    </div>}

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
      <p className="detail-empty-note">The table is a transparent sequential projection. The live barrier cost below overrides the first row; leave it blank to see the patch-sensitive reference value only. The next-action card uses the live values you enter.</p>
      <div className="frontier-planner-controls">
        <label>Current barrier<select value={barrierId} onChange={(event) => onBarrierChange(event.target.value)}>{FRONTIER_BARRIERS.map((barrier) => <option key={barrier.id} value={barrier.id}>{barrier.id}</option>)}</select></label>
        <label>FC balance<input type="number" min="0" inputMode="numeric" value={credits} onChange={(event) => onCreditsChange(event.target.value)} /></label>
        <label>Reward path<select value={pass} onChange={(event) => onPassChange(event.target.value as FrontierPass)}><option value="free">Free</option><option value="premium">Premium Pass</option><option value="elite">Elite Pass</option></select></label>
        <label>Live barrier cost (FC)<input type="number" min="0" step="1" inputMode="numeric" placeholder="Enter live cost" value={liveCost} onChange={(event) => onLiveCostChange(event.target.value)} /></label>
        <label>Wait remaining (minutes)<input type="number" min="0" step="0.1" inputMode="decimal" placeholder="Enter live wait" value={waitMinutes} onChange={(event) => onWaitMinutesChange(event.target.value)} /></label>
        <label>Barrier skips<input type="number" min="0" step="1" inputMode="numeric" value={freeSkips} onChange={(event) => onFreeSkipsChange(event.target.value)} /></label>
        <label>Time Jumps<input type="number" min="0" step="1" inputMode="numeric" value={timeJumps} onChange={(event) => onTimeJumpsChange(event.target.value)} /></label>
      </div>
      <div className="frontier-plan-summary"><strong>{plan.furthest ?? "No checkpoint"}</strong><span>{plan.next ? `Next shortfall: ${Math.max(0, (plan.nextCost ?? 0) - plan.remainingFc)} FC` : "All reference checkpoints cleared"}</span><span>{plan.remainingFc.toLocaleString()} FC projected after rewards</span></div>
      <div className="frontier-table-wrap"><table className="frontier-table"><thead><tr><th>Checkpoint</th><th>Cost</th><th>Reward</th><th>Balance</th></tr></thead><tbody>{plan.rows.slice(0, 8).map((row) => <tr key={row.barrier.id} className={row.cleared ? "" : "frontier-row-blocked"}><td>{row.barrier.id}</td><td>{row.cost.toLocaleString()}</td><td>{row.reward ? `+${row.reward.toLocaleString()}` : "—"}</td><td>{row.cleared ? row.balanceAfter.toLocaleString() : "Need more FC"}</td></tr>)}</tbody></table></div>
      <div className={`frontier-recommendation frontier-recommendation-${recommendation.action}`} aria-live="polite">
        <div className="frontier-recommendation-heading"><div><p className="eyebrow">Next action</p><h4>{recommendation.title}</h4></div><span>{recommendation.resource === "frontier-credits" ? "FC" : recommendation.resource === "free-skip" ? "Skip" : recommendation.resource === "time-jump" ? "Time Jump" : "No spend"}</span></div>
        <p>{recommendation.reason}</p>
        <details open><summary>Assumptions used</summary><ul>{recommendation.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul></details>
      </div>
    </div>

    <div className="frontier-section frontier-sequence">
      <h3>Recommended run sequence</h3>
      <ol><li><strong>Prepare:</strong> assign income passives in the active mine and identify one cost reducer for major upgrades.</li><li><strong>Build:</strong> push the cheapest available shafts and save Sparks while barriers are counting down.</li><li><strong>Open a reward checkpoint:</strong> claim the FC or multiplier before committing to the next deep shaft.</li><li><strong>Burst:</strong> pair your strongest shaft run with the best elevator/warehouse converter you own; use cost reduction around the upgrade spend.</li><li><strong>Recalculate:</strong> stop when the next checkpoint costs more than the expected reward-adjusted balance. Waiting for FC is a strategy, not a failure.</li></ol>
    </div>
    <p className="frontier-footnote">Reference basis: Idle Master's Hub Frontier Calculator, official Kolibri Frontier help, and community Frontier Mine guidance. See the full research notes in <code>docs/frontier-mine-guide.md</code>.</p>
  </section>;
}

function StellaElevatorPanel({ mechanics, onMechanicsChange, input, onInputChange }: {
  mechanics: StellaMechanics;
  onMechanicsChange: (mechanics: StellaMechanics) => void;
  input: { currentFloor: number; target: number; revivesUsed: number; elevatorTickets: number; expressTickets: number; justBombed: boolean };
  onInputChange: (input: { currentFloor: number; target: number; revivesUsed: number; elevatorTickets: number; expressTickets: number; justBombed: boolean }) => void;
}) {
  const decision: StellaDecision = computeBombDecision(input, mechanics);
  const runState = decision.runState ?? assessRunState(input.currentFloor, input.revivesUsed + (input.justBombed ? 1 : 0), mechanics, decision.currentRiskPending);
  const num = (value: string, fallback: number): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const list = (value: string): number[] => value.split(/[\s,]+/).map((part) => Number(part)).filter((part) => Number.isFinite(part));
  return <section className="card-container">
    <h2 className="card-title">Stella's Lucky Elevator — bomb decision</h2>
    <p className="muted" style={{ fontSize: "0.8rem", marginTop: 0 }}>
      Mid-run calculator: which option maximizes your chance to reach the target floor with your ticket budget.
      Event mechanics (safe floors, bomb chance, revive costs, Express start) are <strong>manual inputs</strong> — the APK does not publish them, so enter this event&apos;s values. Math is a faithful port of Idle Master&apos;s Hub.
    </p>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem", margin: "1rem 0" }}>
      <details>
        <summary>Mechanics (per event)</summary>
        <label>Total floors<input type="number" min="1" value={mechanics.totalFloors} onChange={(event) => onMechanicsChange({ ...mechanics, totalFloors: num(event.target.value, mechanics.totalFloors) })} /></label>
        <label>Safe floors (comma-separated)<input type="text" value={mechanics.safeFloors.join(", ")} onChange={(event) => onMechanicsChange({ ...mechanics, safeFloors: list(event.target.value) })} /></label>
        <label>Bomb chance per risk floor (0–1)<input type="number" min="0" max="1" step="0.01" value={mechanics.bombChancePerRiskFloor} onChange={(event) => onMechanicsChange({ ...mechanics, bombChancePerRiskFloor: num(event.target.value, mechanics.bombChancePerRiskFloor) })} /></label>
        <label>Revive ticket costs (comma-separated)<input type="text" value={mechanics.continueCostsTickets.join(", ")} onChange={(event) => onMechanicsChange({ ...mechanics, continueCostsTickets: list(event.target.value) })} /></label>
        <label>Express start floor<input type="number" min="1" value={mechanics.expressStartFloor} onChange={(event) => onMechanicsChange({ ...mechanics, expressStartFloor: num(event.target.value, mechanics.expressStartFloor) })} /></label>
      </details>
      <details open>
        <summary>Your run</summary>
        <label>Current floor<input type="number" min="1" value={input.currentFloor} onChange={(event) => onInputChange({ ...input, currentFloor: num(event.target.value, input.currentFloor) })} /></label>
        <label>Target floor<input type="number" min="1" value={input.target} onChange={(event) => onInputChange({ ...input, target: num(event.target.value, input.target) })} /></label>
        <label>Revives used<input type="number" min="0" value={input.revivesUsed} onChange={(event) => onInputChange({ ...input, revivesUsed: num(event.target.value, input.revivesUsed) })} /></label>
        <label>Elevator Tickets<input type="number" min="0" value={input.elevatorTickets} onChange={(event) => onInputChange({ ...input, elevatorTickets: num(event.target.value, input.elevatorTickets) })} /></label>
        <label>Express Tickets<input type="number" min="0" value={input.expressTickets} onChange={(event) => onInputChange({ ...input, expressTickets: num(event.target.value, input.expressTickets) })} /></label>
        <label><input type="checkbox" checked={input.justBombed} onChange={(event) => onInputChange({ ...input, justBombed: event.target.checked })} /> Just bombed (need to clear)</label>
      </details>
    </div>
    {runState && <div style={{ padding: "0.6rem 0.75rem", borderRadius: "0.5rem", marginBottom: "0.75rem", background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
      <strong>Run state: {runState.label}</strong> <span className="muted" style={{ fontSize: "0.8rem" }}>— {runState.risksCleared} risk floors resolved, expected {runState.expectedBombs.toFixed(1)} bombs, you took {runState.actualBombs}.</span>
    </div>}
    {decision.best && <div style={{ padding: "0.6rem 0.75rem", borderRadius: "0.5rem", marginBottom: "0.75rem", background: "rgba(0,160,185,0.08)", border: "1px solid var(--accent-cyan)" }}>
      <strong>Recommended: {decision.best.label}</strong> <span className="muted" style={{ fontSize: "0.8rem" }}>— p(reach target) ≈ {(decision.best.data.viable ? Math.round(decision.best.data.pReach * 100) : 0)}%</span>
    </div>}
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {decision.options.map((option) => <div key={option.id} style={{ padding: "0.6rem 0.75rem", borderRadius: "0.5rem", border: `1px solid ${option.id === decision.best?.id ? "var(--accent-cyan)" : "var(--border-color)"}`, background: option.id === decision.best?.id ? "rgba(0,160,185,0.06)" : "var(--bg-secondary)" }}>
        <strong>{option.id}. {option.label}</strong>
        {option.data.viable
          ? <div className="muted" style={{ fontSize: "0.78rem" }}>p(reach) ≈ {Math.round(option.data.pReach * 100)}% · floor p50 {option.data.p50} · p95 {option.data.p95} · tickets after {option.data.afterTix} · revives {option.data.futureRevives}</div>
          : <div className="muted" style={{ fontSize: "0.78rem" }}>✗ {option.data.reason}</div>}
      </div>)}
    </div>
  </section>;
}

function CrystalPlannerPanel({ input, onInputChange, costTable, onCostTableChange }: {
  input: { fromLevel: number; toLevel: number; fromPromo: number; toPromo: number; blueBudget: number; redBudgetEnabled: boolean; redBudget: number; discountPct: number };
  onInputChange: (input: { fromLevel: number; toLevel: number; fromPromo: number; toPromo: number; blueBudget: number; redBudgetEnabled: boolean; redBudget: number; discountPct: number }) => void;
  costTable: CrystalCostTable;
  onCostTableChange: (table: CrystalCostTable) => void;
}) {
  const num = (value: string, fallback: number): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const list = (value: string, length: number): number[] => {
    const parsed = value.split(/[\s,]+/).map((part) => Number(part)).filter((part) => Number.isFinite(part));
    const padded = parsed.concat(Array(Math.max(0, length - parsed.length)).fill(0));
    return padded.slice(0, length);
  };
  const plan: CrystalPlanResult = planCrystalSpend({
    fromLevel: input.fromLevel,
    toLevel: input.toLevel,
    fromPromo: input.fromPromo,
    toPromo: input.toPromo,
    costTable,
    blueBudget: input.blueBudget,
    redBudget: input.redBudgetEnabled ? input.redBudget : null,
    discountPct: input.discountPct,
  });
  return <section className="card-container">
    <h2 className="card-title">Crystal planner</h2>
    <p className="muted" style={{ fontSize: "0.8rem", marginTop: 0 }}>
      Level/promo crystal budget calculator. The rank/promo/level gates are game mechanics (ported from Idle Master&apos;s Hub);
      the crystal <em>costs</em> are event-shop data the APK does not publish, so enter the schedule you see in-game below.
    </p>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem", margin: "1rem 0" }}>
      <details open>
        <summary>Level &amp; promo target</summary>
        <label>From level<input type="number" min="1" max="50" value={input.fromLevel} onChange={(event) => onInputChange({ ...input, fromLevel: num(event.target.value, input.fromLevel) })} /></label>
        <label>To level<input type="number" min="1" max="50" value={input.toLevel} onChange={(event) => onInputChange({ ...input, toLevel: num(event.target.value, input.toLevel) })} /></label>
        <label>From promo P<input type="number" min="0" max="5" value={input.fromPromo} onChange={(event) => onInputChange({ ...input, fromPromo: num(event.target.value, input.fromPromo) })} /></label>
        <label>To promo P<input type="number" min="0" max="5" value={input.toPromo} onChange={(event) => onInputChange({ ...input, toPromo: num(event.target.value, input.toPromo) })} /></label>
        <div className="muted" style={{ fontSize: "0.75rem" }}>Target level {input.toLevel} needs promo ≥ P{minPromoForLevel(input.toLevel)}.</div>
      </details>
      <details>
        <summary>Costs (per event, manual)</summary>
        <label>Blue crystals per level (CSV, L1→2 first)<input type="text" value={costTable.bluePerLevel.join(", ")} onChange={(event) => onCostTableChange({ ...costTable, bluePerLevel: list(event.target.value, 50) })} /></label>
        <label>Red crystals per promo (CSV, P0→1 first)<input type="text" value={costTable.redPerPromo.join(", ")} onChange={(event) => onCostTableChange({ ...costTable, redPerPromo: list(event.target.value, 6) })} /></label>
      </details>
      <details>
        <summary>Budget</summary>
        <label>Blue budget<input type="number" min="0" value={input.blueBudget} onChange={(event) => onInputChange({ ...input, blueBudget: num(event.target.value, input.blueBudget) })} /></label>
        <label><input type="checkbox" checked={input.redBudgetEnabled} onChange={(event) => onInputChange({ ...input, redBudgetEnabled: event.target.checked })} /> Cap red budget</label>
        {input.redBudgetEnabled && <label>Red budget<input type="number" min="0" value={input.redBudget} onChange={(event) => onInputChange({ ...input, redBudget: num(event.target.value, input.redBudget) })} /></label>}
        <label>Discount %<input type="number" min="0" max="100" value={input.discountPct} onChange={(event) => onInputChange({ ...input, discountPct: num(event.target.value, input.discountPct) })} /></label>
      </details>
    </div>
    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", margin: "0.5rem 0" }}>
      <span style={{ padding: "0.35rem 0.6rem", borderRadius: "0.4rem", background: input.blueBudget === 0 || plan.blueBudgetOk ? "rgba(0,160,185,0.08)" : "rgba(255,120,80,0.1)", border: "1px solid var(--border-color)", fontSize: "0.85rem" }}>🔵 {plan.blueLevels} level steps → <strong>{plan.blueCost.toLocaleString()} blue</strong> {input.blueBudget > 0 && `/ budget ${input.blueBudget.toLocaleString()}`} {plan.blueBudgetOk ? "✅" : "❌"}</span>
      <span style={{ padding: "0.35rem 0.6rem", borderRadius: "0.4rem", background: plan.redBudgetOk ? "rgba(0,160,185,0.08)" : "rgba(255,120,80,0.1)", border: "1px solid var(--border-color)", fontSize: "0.85rem" }}>🔴 {plan.redPromos} promo steps → <strong>{plan.redCost.toLocaleString()} red</strong> {input.redBudgetEnabled && `/ budget ${input.redBudget.toLocaleString()}`} {plan.redBudgetOk ? "✅" : "❌"}</span>
    </div>
    {plan.gates.some((gate) => !gate.ok) && <div style={{ padding: "0.5rem 0.75rem", borderRadius: "0.5rem", margin: "0.5rem 0", background: "rgba(255,120,80,0.1)", border: "1px solid var(--border-color)", fontSize: "0.8rem" }}>
      {plan.gates.filter((gate) => !gate.ok).map((gate) => <div key={gate.message}>⚠️ {gate.message}</div>)}
    </div>}
    {plan.steps.length > 0 && <details><summary>Step breakdown ({plan.steps.length})</summary><table style={{ width: "100%", fontSize: "0.8rem" }}><thead><tr><th>Step</th><th>From</th><th>To</th><th>Cost</th></tr></thead><tbody>{plan.steps.map((step) => <tr key={`${step.kind}-${step.to}`}><td>{step.kind === "level" ? "Level" : "Promo"}</td><td>{step.kind === "level" ? `L${step.from}` : `P${step.from}`}</td><td>{step.kind === "level" ? `L${step.to}` : `P${step.to}`}</td><td>{step.cost.toLocaleString()}</td></tr>)}</tbody></table></details>}
  </section>;
}
