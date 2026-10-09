import { useMemo, useState } from "react";
import type { CatalogManager, PlayerManager } from "../lib/db";
import { buildComboCards, buildNextTasks, diagnoseAhead, type MineRates } from "../lib/ahead-strategy";

const STORAGE_KEY = "mineops.aheadRates.v1";

function loadRates(): MineRates {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<MineRates>;
      return { mineshaft: parsed.mineshaft ?? null, elevator: parsed.elevator ?? null, warehouse: parsed.warehouse ?? null };
    }
  } catch { /* stored rates are a convenience only */ }
  return { mineshaft: null, elevator: null, warehouse: null };
}

export function AheadStrategyPanel({ catalog, progress }: { catalog: CatalogManager[]; progress: PlayerManager[] }) {
  const [rates, setRates] = useState<MineRates>(loadRates);
  const diagnosis = useMemo(() => diagnoseAhead(rates), [rates]);
  const combos = useMemo(() => buildComboCards(catalog, progress), [catalog, progress]);
  const tasks = useMemo(() => buildNextTasks(catalog, progress, diagnosis, rates), [catalog, progress, diagnosis, rates]);

  function update(key: keyof MineRates, value: string) {
    const next = { ...rates, [key]: value.trim() === "" ? null : Math.max(0, Number(value) || 0) };
    setRates(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }

  const playable = combos.filter((c) => c.playable);
  const locked = combos.filter((c) => !c.playable);

  return (
    <section className="card-container" aria-labelledby="ahead-title">
      <p className="eyebrow">Ahead / Stockpiling · Oct 2026 verified</p>
      <h2 id="ahead-title" className="card-title">What is my mine doing right now?</h2>
      <p className="muted" style={{ fontSize: "0.8rem", marginTop: "-0.4rem" }}>
        Enter the three $/s numbers from Mine Overview <strong>as they are right now</strong> — rates change constantly, and multipliers from SMs already active are already in those numbers. No canonical ratio exists; this is comparative only. Re-enter after big level-ups or activations.
      </p>
      <div className="frontier-planner-controls">
        <label>Mineshaft extraction ($/s)<input type="number" min="0" inputMode="decimal" placeholder="e.g. 6.84" value={rates.mineshaft ?? ""} onChange={(e) => update("mineshaft", e.target.value)} /></label>
        <label>Elevator transportation ($/s)<input type="number" min="0" inputMode="decimal" placeholder="e.g. 122" value={rates.elevator ?? ""} onChange={(e) => update("elevator", e.target.value)} /></label>
        <label>Warehouse transportation ($/s)<input type="number" min="0" inputMode="decimal" placeholder="e.g. 17.7" value={rates.warehouse ?? ""} onChange={(e) => update("warehouse", e.target.value)} /></label>
      </div>

      <div style={{ padding: "0.75rem", marginTop: "0.75rem", borderRadius: "0.5rem", border: "1px solid var(--accent-cyan)", background: "rgba(0,160,185,0.06)" }}>
        <strong>{diagnosis.labelText}</strong>
        <p className="muted" style={{ fontSize: "0.8rem", margin: "0.25rem 0 0 0" }}>{diagnosis.headline}</p>
        <p style={{ fontSize: "0.85rem", margin: "0.4rem 0 0 0" }}><strong>Next:</strong> {diagnosis.nextAction}</p>
        {diagnosis.ratios.elevatorVsWarehouse != null && (
          <p className="muted" style={{ fontSize: "0.72rem", margin: "0.35rem 0 0 0" }}>
            Comparative only: Elevator {diagnosis.ratios.elevatorVsWarehouse.toFixed(1)}× Warehouse · Elevator {diagnosis.ratios.elevatorVsMineshaft?.toFixed(1)}× Shafts · Warehouse {diagnosis.ratios.warehouseVsMineshaft?.toFixed(1)}× Shafts. These describe your mine now; they are not targets.
          </p>
        )}
      </div>

      <h3 style={{ fontSize: "1rem", marginTop: "1.25rem" }}>Combos you can run now</h3>
      {playable.length === 0
        ? <p className="muted" style={{ fontSize: "0.8rem" }}>No full combo is playable with the synced roster yet — see unlock targets below.</p>
        : playable.map((combo) => (
          <div key={combo.id} style={{ padding: "0.75rem", marginTop: "0.5rem", borderRadius: "0.5rem", border: "1px solid var(--border-color)", background: "var(--bg-secondary)" }}>
            <strong>{combo.title}</strong>
            <ul style={{ fontSize: "0.8rem", margin: "0.4rem 0 0 1rem" }}>
              {combo.setup.map((s) => <li key={s}>Setup: {s}</li>)}
              {combo.steps.map((step, i) => <li key={step.managerId}>{i + 1}. <strong>{step.name}</strong> ({step.station}) — {step.action}</li>)}
            </ul>
            <p className="muted" style={{ fontSize: "0.75rem", margin: "0.4rem 0 0 0" }}>{combo.why}</p>
            <p className="muted" style={{ fontSize: "0.68rem", margin: "0.2rem 0 0 0" }}>{combo.sourceNote}</p>
          </div>
        ))}

      {locked.length > 0 && <details style={{ marginTop: "1.25rem" }}>
        <summary style={{ cursor: "pointer", fontWeight: 800 }}>Unlock targets ({locked.length} not playable yet)</summary>
        {locked.map((combo) => (
          <div key={combo.id} style={{ padding: "0.75rem", marginTop: "0.5rem", borderRadius: "0.5rem", border: "1px solid var(--border-color)", opacity: 0.85 }}>
            <strong>{combo.title}</strong>
            <p style={{ fontSize: "0.8rem", margin: "0.25rem 0 0 0" }}>Missing: {combo.missing.join(", ")}</p>
            <p className="muted" style={{ fontSize: "0.75rem", margin: "0.25rem 0 0 0" }}>{combo.why}</p>
          </div>
        ))}
      </details>}

      <h3 style={{ fontSize: "1rem", marginTop: "1.25rem" }}>Learn / Do next</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        {tasks.map((task) => (
          <div key={task.id} style={{ padding: "0.6rem 0.75rem", borderRadius: "0.5rem", border: "1px solid var(--border-color)", background: "var(--bg-secondary)", fontSize: "0.85rem" }}>
            <strong>{task.title}</strong>
            <p className="muted" style={{ fontSize: "0.75rem", margin: "0.2rem 0 0 0" }}>{task.detail}</p>
            {task.progress != null && (
              <div style={{ height: "0.4rem", borderRadius: "0.2rem", background: "var(--bg-primary, #ddd)", overflow: "hidden", marginTop: "0.35rem" }}>
                <div style={{ height: "100%", width: `${Math.round(task.progress * 100)}%`, background: "var(--accent-cyan)" }} />
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="muted" style={{ fontSize: "0.68rem", marginTop: "0.75rem" }}>
        Basis: Fandom Mining Strategies/Super Managers + Kolibri Help Center (Oct 2026 check). Help Center redacts multipliers — read yours in-game. Prestige max is officially worded as six (older text: five) — treated as disputed here.
      </p>
    </section>
  );
}
