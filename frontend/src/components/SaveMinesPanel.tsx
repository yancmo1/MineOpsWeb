import type { CatalogManager } from "../lib/db";
import { decodeMineNumber, type MineState } from "../lib/mine-state";
import { formatCashValue } from "../lib/cash-units";

/**
 * "Your mines, from your save" — plain list built from save data the app
 * used to throw away: per-mine Elevator/Warehouse/Shaft levels, the game's
 * own idle cash/sec, stored cash, prestige, and who is assigned where.
 * Shows only what the save proved; missing pieces are left blank.
 */
export function SaveMinesPanel({ mineState, catalog }: { mineState: MineState | null; catalog: CatalogManager[] }) {
  if (!mineState || mineState.mines.length === 0) return null;

  const nameOf = (gameId: number | null) => {
    if (gameId == null) return null;
    return catalog.find((m) => m.gameId === gameId)?.name ?? null;
  };

  const idleOf = (m: MineState["mines"][number]) => m.idleCashPerSecond ?? m.cashPerSecondWhenClosed ?? 0;
  const withCash = mineState.mines.filter((m) => idleOf(m) > 0);
  const rows = [...(withCash.length > 0 ? withCash : mineState.mines)].sort((a, b) => idleOf(b) - idleOf(a)).slice(0, 12);

  return (
    <section className="card-container save-mines" aria-labelledby="save-mines-title">
      <div className="panel-label">From your save · synced</div>
      <h2 id="save-mines-title">Your mines</h2>
      <p className="muted">Straight from your game save. No typing. Cash uses the game's own idle numbers.</p>
      <div className="save-mine-list">
        {rows.map((mine, i) => {
          const assigned = mineState.assignments.filter((a) => a.mineNumber === mine.mineNumber);
          const idle = mine.idleCashPerSecond ?? mine.cashPerSecondWhenClosed;
          return (
            <div key={`${mine.mineNumber ?? "?" }-${i}`} className="save-mine-row">
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
      {mineState.unlockedContinentTypes.length > 0 && (
        <p className="muted">Continents unlocked in save: {mineState.unlockedContinentTypes.length}. Mine names get matched to continents in the next pass.</p>
      )}
    </section>
  );
}
