import { useState } from "react";
import type { CatalogManager } from "../lib/db";
import { decodeMineNumber, gameIdlePerSecond, groupMinesByContinent, type MineState } from "../lib/mine-state";
import { formatCashValue } from "../lib/cash-units";

/**
 * "Your mines, from your save" — grouped by continent, accordion style:
 * tap a continent to see its mines. Shows only what the save proved:
 * per-mine Elevator/Warehouse/Shaft levels, the game's own idle cash/sec,
 * stored cash, prestige, and who is assigned where.
 */
export function SaveMinesPanel({ mineState, catalog }: { mineState: MineState | null; catalog: CatalogManager[] }) {
  const [openGroups, setOpenGroups] = useState<Set<number> | null>(null);
  if (!mineState || mineState.mines.length === 0) return null;

  const nameOf = (gameId: number | null) => {
    if (gameId == null) return null;
    return catalog.find((m) => m.gameId === gameId)?.name ?? null;
  };

  const groups = groupMinesByContinent(mineState.mines);
  // First render: open the continent holding the biggest single earner.
  const defaultOpen = groups.reduce((best, g) => ((g.mines[0]?.idleCashPerSecond ?? 0) > (best?.mines[0]?.idleCashPerSecond ?? -1) ? g : best), groups[0])?.continentType;
  const isOpen = (type: number) => (openGroups ?? new Set([defaultOpen])).has(type);
  const toggle = (type: number) => setOpenGroups((prev) => {
    const next = new Set(prev ?? [defaultOpen]);
    if (next.has(type)) next.delete(type); else next.add(type);
    return next;
  });

  return (
    <section className="card-container save-mines" aria-labelledby="save-mines-title">
      <div className="panel-label">From your save · synced</div>
      <h2 id="save-mines-title">Your mines</h2>
      <p className="muted">Straight from your game save. No typing. Tap a continent to open its mines.</p>
      <div className="save-mine-groups">
        {groups.map((group) => (
          <div key={group.continentType} className="save-mine-group">
            <button type="button" className="save-mine-group-head" aria-expanded={isOpen(group.continentType)} onClick={() => toggle(group.continentType)}>
              <span><strong>{group.name}</strong><span className="muted"> · {group.mines.length} mine{group.mines.length === 1 ? "" : "s"}</span></span>
              <span className="save-mine-group-total">{group.totalIdlePerSecond > 0 && <>{formatCashValue(group.totalIdlePerSecond)}/s total</>}<span aria-hidden="true"> {isOpen(group.continentType) ? "▾" : "▸"}</span></span>
            </button>
            {isOpen(group.continentType) && (
              <div className="save-mine-list">
                {group.mines.map((mine, i) => {
                  const assigned = mineState.assignments.filter((a) => a.mineNumber === mine.mineNumber);
                  const idle = gameIdlePerSecond(mine);
                  return (
                    <div key={`${mine.mineNumber ?? "?"}-${i}`} className="save-mine-row">
                      <div>
                        <strong>{decodeMineNumber(mine.mineNumber)?.label ?? `Mine ${mine.mineNumber ?? "?"}`}</strong>
                        {mine.selected && <span className="play-badge"> Open now</span>}
                        {mine.prestigeCount != null && mine.prestigeCount > 0 && <span className="muted"> · Prestige {mine.prestigeCount}</span>}
                        <div className="muted save-mine-levels">
                          Elevator {mine.elevatorLevel ?? "—"} · Warehouse {mine.warehouseLevel ?? "—"}
                          {mine.corridorLevels.length > 0 && <> · Shafts {mine.corridorLevels.length} (top {Math.max(...mine.corridorLevels)})</>}
                        </div>
                        {assigned.length > 0 && (
                          <div className="muted save-mine-assigned">
                            Working here: {assigned.map((a) => nameOf(a.managerId) ?? `Manager ${a.managerId ?? "?"}`).join(", ")}
                          </div>
                        )}
                      </div>
                      <div className="save-mine-cash">
                        {idle != null && idle > 0 && <span><strong>{formatCashValue(idle)}/s</strong> idle</span>}
                        {mine.storedCash != null && mine.storedCash > 0 && <span className="muted">{formatCashValue(mine.storedCash)} stored</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
      {mineState.unlockedContinentTypes.length > 0 && (
        <p className="muted">Continents unlocked in save: {mineState.unlockedContinentTypes.length}.</p>
      )}
    </section>
  );
}
