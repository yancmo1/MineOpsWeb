import { useMemo, useState } from "react";
import type { CatalogManager, PlayerManager } from "../lib/db";
import { AREA_LABELS, buildEverdeepTeam, type AreaId } from "../lib/everdeep-team";
import { ELEMENTS } from "../lib/master-data";

const AREAS: AreaId[] = ["mineshaft", "elevator", "warehouse"];

export function EverdeepTeamPanel({ catalog, progress }: { catalog: CatalogManager[]; progress: PlayerManager[] }) {
  const [slotElements, setSlotElements] = useState<Record<AreaId, string | null>>({ mineshaft: null, elevator: null, warehouse: null });
  const team = useMemo(() => buildEverdeepTeam(catalog, progress, slotElements), [catalog, progress, slotElements]);
  const ownedCount = progress.filter((p) => p.unlocked).length;

  return (
    <section className="card-container">
      <p className="eyebrow">Everdeep</p>
      <h3>Everdeep team builder</h3>
      <p className="muted">
        Pick the element of each slot in your Everdeep mine. We pick your best owned manager for each spot,
        using exact manager numbers and the game's element math (Super Effective ×1.5 · Partly ×0.6 · Weak ×0.2).
      </p>
      <div className="mine-rate-entry">
        {AREAS.map((area) => (
          <label key={area}>
            {AREA_LABELS[area]} element
            <select value={slotElements[area] ?? ""} onChange={(e) => setSlotElements((prev) => ({ ...prev, [area]: e.target.value || null }))}>
              <option value="">Any element</option>
              {ELEMENTS.map((el) => <option key={el} value={el}>{el[0].toUpperCase() + el.slice(1)}</option>)}
            </select>
          </label>
        ))}
      </div>
      {ownedCount === 0 ? (
        <p className="muted">No roster imported yet — sync first and your crew shows up here.</p>
      ) : team.picks.length === 0 ? (
        <p className="muted">None of your owned managers fit these slots yet.</p>
      ) : (
        <div className="play-list">
          {team.picks.map((pick) => (
            <div key={pick.area} className="play-row">
              <div>
                <strong>{AREA_LABELS[pick.area]}: {pick.manager.name}</strong>
                <div className="muted">
                  Level {pick.progress.level} · Rank {pick.progress.rank} · Promoted {pick.progress.promoted}
                  {" · Active ×"}{pick.adjustedActive.toFixed(2)}
                  {pick.effectiveness && !pick.elementLocked && <> · {pick.effectiveness === "SE" ? "Super effective" : pick.effectiveness === "PE" ? "Partly effective" : "Weak"} on this element</>}
                  {pick.elementLocked && <> · Element match locked until a higher rank</>}
                  {!pick.exactFromMaster && <> · Active from catalog (master table has no row)</>}
                </div>
                {team.runnersUp[pick.area] && (
                  <div className="muted">Next best: {team.runnersUp[pick.area]!.manager.name} (×{team.runnersUp[pick.area]!.adjustedActive.toFixed(2)})</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {team.passiveTotals.length > 0 && (
        <>
          <h4>Team passives (unlocked only)</h4>
          <ul>
            {team.passiveTotals.map((p) => (
              <li key={p.type}>{p.name}: {p.multiplierLike ? `×${p.total.toFixed(2)}` : `${p.total.toFixed(1)}%`}</li>
            ))}
          </ul>
        </>
      )}
      <p className="muted">Exact numbers from the master reference table. When the game's Boost Overview disagrees, the game wins — tell Goober and we fix the table.</p>
    </section>
  );
}
