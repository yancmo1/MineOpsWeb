import { useMemo, useState } from "react";
import type { CatalogManager, PlayerManager } from "../lib/db";
import { bestPlay, loadMines, rankPlays, saveMines, type MineProfile } from "../lib/mission-board";
import { diagnoseAhead, type MineRates } from "../lib/ahead-strategy";

/**
 * Mission Board — home screen (Yancy direction, 2026-10-08):
 * mine switcher -> fast rate entry -> "Biggest cash earner" ranked plays,
 * with the player free to choose a different play to run. v1 persists
 * mine profiles in localStorage; PocketBase sync is future work.
 * Light theme is the app default; this panel adds no theme assumptions.
 */
export function MissionBoardPanel({ catalog, progress }: { catalog: CatalogManager[]; progress: PlayerManager[] }) {
  const [mines, setMines] = useState<MineProfile[]>(() => loadMines(window.localStorage));
  const [activeMineId, setActiveMineId] = useState<string>(() => loadMines(window.localStorage)[0]?.id ?? "everdeep");

  const mine = mines.find((m) => m.id === activeMineId) ?? mines[0];
  const plays = useMemo(() => rankPlays(catalog, progress, mine?.rates ?? { mineshaft: null, elevator: null, warehouse: null }), [catalog, progress, mine]);
  const recommended = bestPlay(plays);
  const selected = plays.find((p) => p.id === mine?.selectedPlayId) ?? recommended;
  const diagnosis = diagnoseAhead(mine?.rates ?? { mineshaft: null, elevator: null, warehouse: null });

  function persist(next: MineProfile[]) {
    setMines(next);
    saveMines(window.localStorage, next);
  }

  function updateMine(patch: Partial<MineProfile>) {
    if (!mine) return;
    persist(mines.map((m) => (m.id === mine.id ? { ...m, ...patch } : m)));
  }

  function updateRate(key: keyof MineRates, raw: string) {
    if (!mine) return;
    const value = raw.trim() === "" ? null : Number(raw);
    updateMine({ rates: { ...mine.rates, [key]: Number.isFinite(value) ? value : null }, ratesUpdatedAt: new Date().toISOString() });
  }

  function addMine() {
    const id = `mine-${Date.now()}`;
    const next = [...mines, { id, name: `Mine ${mines.length + 1}`, kind: "custom" as const, rates: { mineshaft: null, elevator: null, warehouse: null } }];
    persist(next);
    setActiveMineId(id);
  }

  if (!mine) return null;

  return (
    <section className="card-container mission-board" aria-labelledby="mission-board-title">
      <div className="panel-label">Mission Board</div>
      <h2 id="mission-board-title">How to play this mine</h2>

      <div className="mine-switcher" role="group" aria-label="Active mine">
        {mines.map((m) => (
          <button key={m.id} type="button" className={m.id === mine.id ? "mine-chip active" : "mine-chip"} onClick={() => setActiveMineId(m.id)}>
            {m.name}
          </button>
        ))}
        <button type="button" className="mine-chip add" onClick={addMine}>+ Add mine</button>
      </div>

      <div className="mine-rate-entry" aria-label="Current mine rates">
        <label>
          <span>Mineshaft $/s</span>
          <input inputMode="decimal" placeholder="e.g. 6.84" defaultValue={mine.rates.mineshaft ?? ""} key={`ms-${mine.id}-${mine.rates.mineshaft}`} onBlur={(e) => updateRate("mineshaft", e.target.value)} />
        </label>
        <label>
          <span>Elevator $/s</span>
          <input inputMode="decimal" placeholder="e.g. 122" defaultValue={mine.rates.elevator ?? ""} key={`e-${mine.id}-${mine.rates.elevator}`} onBlur={(e) => updateRate("elevator", e.target.value)} />
        </label>
        <label>
          <span>Warehouse $/s</span>
          <input inputMode="decimal" placeholder="e.g. 17.7" defaultValue={mine.rates.warehouse ?? ""} key={`w-${mine.id}-${mine.rates.warehouse}`} onBlur={(e) => updateRate("warehouse", e.target.value)} />
        </label>
        <p className="muted">
          {mine.ratesUpdatedAt ? `Rates updated ${new Date(mine.ratesUpdatedAt).toLocaleString()}. ` : "Enter the three Mine Overview totals. "}
          {diagnosis.labelText} — {diagnosis.headline}
        </p>
      </div>

      {recommended && (
        <div className="best-earner" aria-label="Biggest cash earner">
          <div className="panel-label">Biggest cash earner · this lineup</div>
          <h3>{recommended.title}</h3>
          <p>{recommended.why}</p>
          <p className="muted">
            {recommended.bottleneckPace != null ? `Sustainable bottleneck pace: ${recommended.bottleneckPace}/s (your weakest leg). ` : "Add rates above for a pace read. "}
            Next: {recommended.nextStep}
          </p>
          {recommended.lineup.length > 0 && (
            <p>Lineup: {recommended.lineup.map((l) => `${l.area}: ${l.name}`).join(" · ")}</p>
          )}
        </div>
      )}

      <div className="play-list" aria-label="All plays for this mine">
        {plays.map((play) => (
          <div key={play.id} className={`play-row ${selected?.id === play.id ? "selected" : ""} ${play.playable ? "" : "locked"}`}>
            <div>
              <strong>{play.title}</strong>
              {recommended?.id === play.id && <span className="play-badge"> Biggest earner</span>}
              {!play.playable && <span className="play-badge locked-badge"> Locked</span>}
              <p className="muted">{play.playable ? play.nextStep : `Needs: ${play.missing.join(", ")}`}</p>
            </div>
            <div className="play-actions">
              {play.paceScore != null && <span className="muted">Projected pace {play.paceScore}/100</span>}
              <button type="button" disabled={!play.playable} onClick={() => updateMine({ selectedPlayId: play.id })}>
                {selected?.id === play.id ? "Running this" : "Run this"}
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="muted">Projected pace is a relative score from live rates + verified roster strength — not a promised dollar figure. Exact multipliers are level-dependent and partly undocumented.</p>
    </section>
  );
}
