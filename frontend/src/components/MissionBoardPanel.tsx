import { useEffect, useMemo, useState } from "react";
import type { CatalogManager, PlayerManager } from "../lib/db";
import { bestPlay, effectiveRates, loadMines, minesFromCatalogDomain, rankPlays, saveMines, suggestedMultipliers, type MineProfile } from "../lib/mission-board";
import { diagnoseAhead, type MineRates } from "../lib/ahead-strategy";
import { formatCashValue, parseCashValue } from "../lib/cash-units";
import { catalogClient } from "../lib/catalog-client";

/**
 * Mission Board — home screen (Yancy direction, 2026-10-08):
 * mine switcher -> fast rate + multiplier entry -> "Biggest cash earner"
 * ranked plays, with the player free to choose a different play to run.
 * Mine list comes from the current verified catalog package
 * (mine-economy-domain.json continent identities). Mine profiles persist
 * in localStorage for now; PocketBase sync is future work.
 */
export function MissionBoardPanel({ catalog, progress, onImport }: { catalog: CatalogManager[]; progress: PlayerManager[]; onImport?: () => void }) {
  const [mines, setMines] = useState<MineProfile[]>(() => loadMines(window.localStorage));
  const [activeMineId, setActiveMineId] = useState<string>(() => loadMines(window.localStorage)[0]?.id ?? "everdeep");
  const [mineSource, setMineSource] = useState<"loading" | "catalog" | "fallback">("loading");

  useEffect(() => {
    let cancelled = false;
    void catalogClient.getArtifact("mine-economy-domain.json").then((artifact) => {
      if (cancelled) return;
      if (artifact?.content) {
        setMines((stored) => {
          const next = minesFromCatalogDomain(artifact.content, stored);
          saveMines(window.localStorage, next);
          return next;
        });
        setMineSource("catalog");
      } else {
        setMineSource("fallback");
      }
    }).catch(() => { if (!cancelled) setMineSource("fallback"); });
    return () => { cancelled = true; };
  }, []);

  const mine = mines.find((m) => m.id === activeMineId) ?? mines[0];
  const rates = mine?.rates ?? { mineshaft: null, elevator: null, warehouse: null };
  const multipliers = mine?.multipliers ?? { mineshaft: 1, elevator: 1, warehouse: 1 };
  const burstRates = effectiveRates(rates, multipliers);
  const plays = useMemo(() => rankPlays(catalog, progress, rates, multipliers), [catalog, progress, rates, multipliers]);
  const recommended = bestPlay(plays);
  const selected = plays.find((p) => p.id === mine?.selectedPlayId) ?? recommended;
  const diagnosis = diagnoseAhead(rates);
  const suggestions = useMemo(() => suggestedMultipliers(catalog, progress), [catalog, progress]);
  const playablePlays = plays.filter((play) => play.playable);

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
    const value = raw.trim() === "" ? null : parseCashValue(raw);
    updateMine({ rates: { ...rates, [key]: value }, ratesUpdatedAt: new Date().toISOString() });
  }

  function updateMultiplier(key: keyof MineRates, raw: string) {
    if (!mine) return;
    const value = Number(raw);
    updateMine({ multipliers: { ...multipliers, [key]: Number.isFinite(value) && value > 0 ? value : 1 }, ratesUpdatedAt: new Date().toISOString() });
  }

  function applySuggestions() {
    if (!mine) return;
    const next = { ...multipliers };
    for (const suggestion of suggestions) {
      if (suggestion.area === "Mine Shaft") next.mineshaft = suggestion.multiplier;
      if (suggestion.area === "Elevator") next.elevator = suggestion.multiplier;
      if (suggestion.area === "Warehouse") next.warehouse = suggestion.multiplier;
    }
    updateMine({ multipliers: next, ratesUpdatedAt: new Date().toISOString() });
  }

  function removeCustomMine() {
    if (!mine || mine.kind !== "custom") return;
    const next = mines.filter((m) => m.id !== mine.id);
    persist(next);
    setActiveMineId(next[0]?.id ?? "everdeep");
  }

  function addMine() {
    const id = `mine-${Date.now()}`;
    const next = [...mines, { id, name: `Custom mine ${mines.filter((m) => m.kind === "custom").length + 1}`, kind: "custom" as const, rates: { mineshaft: null, elevator: null, warehouse: null }, multipliers: { mineshaft: 1, elevator: 1, warehouse: 1 } }];
    persist(next);
    setActiveMineId(id);
  }

  if (!mine) return null;

  const hasRoster = progress.some((player) => player.unlocked);

  function useSampleRates() {
    updateMine({ rates: { mineshaft: parseCashValue("6.84 aj"), elevator: parseCashValue("122 aj"), warehouse: parseCashValue("17.7 aj") }, ratesUpdatedAt: new Date().toISOString() });
  }

  const rateFields: Array<{ key: keyof MineRates; label: string; placeholder: string; burst: number | null }> = [
    { key: "mineshaft", label: "Mineshaft", placeholder: "e.g. 6.84", burst: burstRates.mineshaft },
    { key: "elevator", label: "Elevator", placeholder: "e.g. 122", burst: burstRates.elevator },
    { key: "warehouse", label: "Warehouse", placeholder: "e.g. 17.7", burst: burstRates.warehouse },
  ];

  return (
    <section className="card-container mission-board" aria-labelledby="mission-board-title">
      <div className="panel-label">Mission Board · Mine Profile</div>
      <h2 id="mission-board-title">How to play this mine</h2>

      <div className="mine-picker">
        <label>
          <span>Mine</span>
          <select aria-label="Active mine" value={mine.id} onChange={(e) => setActiveMineId(e.target.value)}>
            {mines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </label>
        <button type="button" className="secondary" onClick={addMine}>+ Custom mine</button>
        {mine.kind === "custom" && <button type="button" className="btn-danger" onClick={removeCustomMine}>Remove this custom mine</button>}
      </div>
      <p className="muted mine-source-note">
        {mineSource === "catalog" ? "Mine list pulled from the current verified catalog (mine-economy continents) plus Everdeep and Frontier Mine." : mineSource === "loading" ? "Loading the current mine list from the verified catalog…" : "Saved mine list shown; the current catalog mine list could not be loaded in this view."}
      </p>

      {!hasRoster && (
        <div className="preimport-callout">
          <div><strong>No roster imported yet.</strong><span>Import/sync your player data to unlock lineup-specific plays. You can still preview the math with sample rates.</span></div>
          <div className="preimport-actions">
            {onImport && <button type="button" onClick={onImport}>Import / sync player data</button>}
            <button type="button" className="secondary" onClick={useSampleRates}>Use sample rates</button>
          </div>
        </div>
      )}
      <p className="muted mine-rate-help">Enter rates in game notation (for example <strong>6.84 aj</strong>). Multiplier is the active SM boost you plan to run; “Use lineup multipliers” fills it from your strongest owned manager.</p>
      <div className="mine-rate-entry" aria-label="Current mine rates and multipliers">
        {rateFields.map((field) => (
          <div className="mine-rate-field" key={field.key}>
            <label>
              <span>{field.label} rate</span>
              <input inputMode="decimal" placeholder={field.placeholder} defaultValue={rates[field.key] == null ? "" : formatCashValue(rates[field.key])} key={`${field.key}-${mine.id}-${rates[field.key]}`} onBlur={(e) => updateRate(field.key, e.target.value)} />
            </label>
            <label>
              <span>Multiplier ×</span>
              <input inputMode="decimal" placeholder="1" defaultValue={multipliers[field.key] ?? 1} key={`mult-${field.key}-${mine.id}-${multipliers[field.key]}`} onBlur={(e) => updateMultiplier(field.key, e.target.value)} />
            </label>
            <small>{field.burst != null ? `Burst pace ${formatCashValue(field.burst)}/s` : "Not entered"}</small>
          </div>
        ))}
        <div className="mine-rate-actions">
          <button type="button" className="secondary" onClick={applySuggestions} disabled={suggestions.length === 0}>Use lineup multipliers</button>
          <span className="muted">
            {suggestions.length > 0 ? suggestions.map((s) => `${s.area}: ${s.name} ×${s.multiplier.toLocaleString()}`).join(" · ") : "Sync a roster to suggest active multipliers from your strongest managers."}
          </span>
        </div>
        <p className="muted">
          {mine.ratesUpdatedAt ? `Profile updated ${new Date(mine.ratesUpdatedAt).toLocaleString()}. ` : ""}
          {diagnosis.labelText} — {diagnosis.headline}
        </p>
      </div>

      {recommended && (
        <div className="best-earner" aria-label="Biggest cash earner">
          <div className="panel-label">Biggest cash earner · this lineup</div>
          <h3>{recommended.title}</h3>
          <p>{recommended.why}</p>
          <p className="muted">
            {recommended.bottleneckPace != null ? `Sustainable bottleneck pace: ${formatCashValue(recommended.bottleneckPace)}/s (your weakest leg, before burst multipliers). ` : "Add rates above for a pace read. "}
            Next: {recommended.nextStep}
          </p>
          {recommended.lineup.length > 0 && (
            <p>Lineup: {recommended.lineup.map((l) => `${l.area}: ${l.name}`).join(" · ")}</p>
          )}
          <p><span className="play-badge">{recommended.profitabilityLabel}</span></p>
          <details className="play-details best-details">
            <summary>What this does & how to run it</summary>
            <p>{recommended.whatItDoes}</p>
            <ol>{recommended.howToRun.map((step) => <li key={step}>{step}</li>)}</ol>
            <p><strong>Best when:</strong> {recommended.bestWhen}</p>
            <p><strong>Watch out:</strong> {recommended.watchOut}</p>
          </details>
        </div>
      )}

      <div className="play-list" aria-label="All plays for this mine">
        {playablePlays.map((play) => (
          <div key={play.id} className={`play-row ${selected?.id === play.id ? "selected" : ""} ${play.playable ? "" : "locked"}`}>
            <div>
              <strong>{play.title}</strong>
              <span className="play-badge rank-badge">{play.profitabilityLabel}</span>
              {recommended?.id === play.id && <span className="play-badge"> Biggest earner</span>}
              {!play.playable && <span className="play-badge locked-badge"> Locked</span>}
              <p className="muted">{play.playable ? play.nextStep : `Needs: ${play.missing.join(", ")}`}</p>
              <details className="play-details">
                <summary>How to run this play</summary>
                <p>{play.whatItDoes}</p>
                <ol>{play.howToRun.map((step) => <li key={step}>{step}</li>)}</ol>
                <p><strong>Best when:</strong> {play.bestWhen}</p>
                <p><strong>Watch out:</strong> {play.watchOut}</p>
              </details>
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
      {playablePlays.length === 0 && <p className="muted">No playable lineup strategy yet for this roster. Sync your managers or unlock one of the combo managers to reveal runnable plays here.</p>}
      <p className="muted">Only strategies you can actually run are shown, ordered by researched payout ceiling. Projected pace is today's relative fit from live rates, multipliers, and verified roster strength — not a promised dollar figure.</p>
    </section>
  );
}
