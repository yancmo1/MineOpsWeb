import { useEffect, useState } from "react";
import type { PlayerManager } from "../lib/db";
import { catalogClient, type CatalogClientState, type LoadState } from "../lib/catalog-client";
import { evaluateVerifiedLineup, type StrategyEvaluation } from "../lib/strategy";

interface StrategyPageProps {
  progress: PlayerManager[];
}

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
  const [loadState, setLoadState] = useState<LoadState>(catalogClient.loadState);
  const [isFixture, setIsFixture] = useState(false);

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
      }
    })();
    return () => { current = false; };
  }, [progress, loadState]);

  // Determine the right empty state based on loading phase
  const isLoading = loadState.phase !== "idle" && !isActive(loadState) && loadState.phase !== "error";

  if (isLoading) {
    return <section className="card-container"><h2 className="card-title">Manager Lineup</h2><div className="empty-state"><h3>Loading catalog…</h3><p>Checking for active catalog package.</p></div></section>;
  }

  if (!evaluation) {
    return <section className="card-container"><h2 className="card-title">Manager Lineup</h2><div className="empty-state"><h3>Verified catalog unavailable</h3><p>Strategy only uses an active, verified catalog package. Open More to refresh the catalog or review recovery guidance.</p></div></section>;
  }

  return (
    <section className="card-container">
      <h2 className="card-title">Manager Lineup</h2>
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
            {recs.map((rec) => <div key={rec.managerId} style={{ padding: "0.75rem", marginTop: "0.5rem", borderRadius: "0.5rem", border: "1px solid var(--border-color)", background: rec.limitedData ? "rgba(255, 159, 10, 0.08)" : "var(--bg-secondary)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}><strong>#{rec.areaRank} {rec.name}</strong><strong>{rec.score.toFixed(1)}</strong></div>
              <div className="muted" style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>{rec.rationale}</div>
              {rec.limitedData && <div style={{ color: "var(--accent-orange)", fontSize: "0.75rem", marginTop: "0.25rem" }}>Limited data: {rec.missingData.join(", ")}. No unknown effect has been estimated.</div>}
            </div>)}
          </div>
        ))}
        {evaluation.upgradePriorities.length > 0 && <div style={{ marginTop: "1.25rem" }}><h3 style={{ fontSize: "1rem" }}>Upgrade priorities</h3>{evaluation.upgradePriorities.map((rec) => <p key={rec.managerId} className="muted" style={{ fontSize: "0.8rem" }}><strong>{rec.name}:</strong> {rec.rationale}</p>)}</div>}
      </> : <div className="empty-state"><h3>No assignable managers</h3><p>Sync unlocked managers to see recommendations from this release.</p></div>}
      {evaluation.unevaluated.length > 0 && <p style={{ color: "var(--accent-orange)", fontSize: "0.8rem", marginTop: "1rem" }}>{evaluation.unevaluated.length} unlocked manager(s) were excluded because their IDs are unresolved in this catalog release.</p>}
    </section>
  );
}
