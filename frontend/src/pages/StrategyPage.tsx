import { CatalogManager, PlayerManager, strengthScore } from "../lib/db";

interface StrategyPageProps {
  catalog: CatalogManager[];
  progress: PlayerManager[];
}

export function StrategyPage({ catalog, progress }: StrategyPageProps) {
  const byId = new Map(catalog.map((m) => [m.id, m]));
  const managers = progress
    .map((p) => ({ ...p, catalog: byId.get(p.managerId) }))
    .filter(
      (p): p is PlayerManager & { catalog: CatalogManager } =>
        Boolean(p.catalog) && p.unlocked,
    )
    .sort(
      (a, b) =>
        strengthScore(b.catalog, b) - strengthScore(a.catalog, a) ||
        a.catalog.name.localeCompare(b.catalog.name),
    );

  const areas = ["Mine Shaft", "Elevator", "Warehouse"];
  const strongest = areas
    .map((area) => managers.find((m) => m.catalog.type === area))
    .filter(Boolean);

  return (
    <section className="card-container">
      <h2 className="card-title">Manager Lineup</h2>
      {strongest.length > 0 ? (
        <>
          <p style={{ marginBottom: "1rem", fontSize: "0.875rem" }}>
            Strongest owned manager for each operating area:
          </p>
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {strongest.map((item, index) =>
              item ? (
                <div key={item.managerId}>
                  <p style={{ margin: 0, fontSize: "0.875rem" }}>
                    <strong style={{ color: "var(--accent-cyan)" }}>
                      {item.catalog.type}
                    </strong>
                    {" · "}
                    {item.catalog.name}
                    <span className="muted">
                      {" · "}
                      Level {item.level}
                      {" · "}
                      Rank {item.rank}
                    </span>
                  </p>
                </div>
              ) : null,
            )}
          </div>
          <p className="muted" style={{ marginTop: "1rem", marginBottom: 0, fontSize: "0.85rem" }}>
            This page currently ranks imported managers only. Mine-specific sequencing will
            replace this summary after mine-state calculations are connected.
          </p>
        </>
      ) : (
        <p className="muted">
          Import player data and unlock at least one manager to see the manager lineup.
        </p>
      )}
    </section>
  );
}
