/**
 * Snapshot History page — import review, diff, and rollback.
 *
 * V3 PRD §9.2, §12.6
 */

import { useEffect, useState } from "react";
import type { CatalogManager, PlayerManager } from "../lib/db";
import type { Snapshot } from "../lib/snapshot";
import {
  listSnapshots,
  getActiveSnapshot,
  rollbackToSnapshot,
  type SnapshotDiff,
  computeDiff,
} from "../lib/snapshot";

interface SnapshotHistoryProps {
  catalog: CatalogManager[];
  activeProgress: PlayerManager[];
  onRollback: (progress: PlayerManager[]) => void;
  onClose: () => void;
}

export function SnapshotHistory({
  catalog,
  activeProgress,
  onRollback,
  onClose,
}: SnapshotHistoryProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [diff, setDiff] = useState<SnapshotDiff | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const list = await listSnapshots();
      setSnapshots(list);
      const active = await getActiveSnapshot();
      if (active?.id) setActiveId(active.id);
    })();
  }, []);

  const nameMap = new Map(catalog.map((m) => [m.id, m.name]));

  async function selectSnapshot(snap: Snapshot) {
    setSelectedId(snap.id ?? null);
    if (snap.id === activeId) {
      setDiff(null);
      return;
    }
    const snapProgress = JSON.parse(snap.progress) as PlayerManager[];
    // Compare snapshot against current active progress
    const result = computeDiff(snapProgress, activeProgress, { nameMap });
    setDiff(result);
  }

  async function handleRollback(snap: Snapshot) {
    if (!snap.id) return;
    setBusy(true);
    try {
      const restored = await rollbackToSnapshot(snap.id);
      if (restored) {
        onRollback(restored.progress);
        setActiveId(snap.id);
        setDiff(null);
        // Refresh list
        setSnapshots(await listSnapshots());
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="snapshot-history">
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
        }}
      >
        <h2 style={{ margin: 0 }}>Snapshot History</h2>
        <button onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>

      {snapshots.length === 0 ? (
        <div className="empty-state">
          <h3>No snapshots yet</h3>
          <p>
            Snapshots are created automatically after each Kolibri sync.
            Sync your game data to get started.
          </p>
        </div>
      ) : (
        <div className="snapshot-list">
          {snapshots.map((snap) => {
            const isActive = snap.id === activeId;
            const isSelected = snap.id === selectedId;
            return (
              <div
                key={snap.id}
                className={`snapshot-item ${isActive ? "active" : ""} ${isSelected ? "selected" : ""}`}
                style={{
                  padding: "0.75rem 1rem",
                  marginBottom: "0.5rem",
                  borderRadius: "0.5rem",
                  border: isActive
                    ? "1px solid var(--accent-blue)"
                    : isSelected
                      ? "1px solid var(--accent-green)"
                      : "1px solid var(--border-color)",
                  backgroundColor: isSelected
                    ? "rgba(52, 199, 89, 0.08)"
                    : "var(--bg-secondary)",
                  cursor: "pointer",
                }}
                onClick={() => selectSnapshot(snap)}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                      {new Date(snap.capturedAt).toLocaleString()}
                      {isActive && (
                        <span
                          style={{
                            marginLeft: "0.5rem",
                            color: "var(--accent-blue)",
                            fontSize: "0.75rem",
                          }}
                        >
                          ● Active
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--text-secondary)",
                        marginTop: "0.25rem",
                      }}
                    >
                      {snap.source} — {snap.summary}
                    </div>
                  </div>
                  {!isActive && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRollback(snap);
                      }}
                      disabled={busy}
                      style={{
                        padding: "0.25rem 0.75rem",
                        fontSize: "0.75rem",
                        flexShrink: 0,
                        marginLeft: "0.75rem",
                      }}
                    >
                      {busy && snap.id === selectedId ? "…" : "Restore"}
                    </button>
                  )}
                </div>

                {/* Diff display */}
                {isSelected && diff && (
                  <div
                    style={{
                      marginTop: "0.75rem",
                      padding: "0.75rem",
                      backgroundColor: "var(--bg-primary)",
                      borderRadius: "0.375rem",
                      fontSize: "0.8rem",
                    }}
                  >
                    <DiffSummary diff={diff} nameMap={nameMap} />
                  </div>
                )}
                {isSelected && !diff && (
                  <div
                    style={{
                      marginTop: "0.5rem",
                      padding: "0.5rem",
                      fontSize: "0.8rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    This is the active snapshot — no diff to show.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DiffSummary({
  diff,
  nameMap,
}: {
  diff: SnapshotDiff;
  nameMap: Map<string, string>;
}) {
  if (diff.changedCount === 0) {
    return <div style={{ color: "var(--text-secondary)" }}>No changes from current state.</div>;
  }

  const name = (id: string) => nameMap.get(id) ?? id;

  return (
    <div>
      {diff.newlyUnlocked.length > 0 && (
        <div style={{ marginBottom: "0.5rem" }}>
          <strong style={{ color: "var(--accent-green)" }}>🆕 Newly Unlocked</strong>
          <div>{diff.newlyUnlocked.join(", ")}</div>
        </div>
      )}
      {diff.rankChanges.length > 0 && (
        <div style={{ marginBottom: "0.5rem" }}>
          <strong>⭐ Rank Changes ({diff.rankChanges.length})</strong>
          {diff.rankChanges.slice(0, 5).map((c) => (
            <div key={c.managerId}>
              {name(c.managerId)}: {c.from} → {c.to}
            </div>
          ))}
          {diff.rankChanges.length > 5 && (
            <div style={{ color: "var(--text-secondary)" }}>
              …and {diff.rankChanges.length - 5} more
            </div>
          )}
        </div>
      )}
      {diff.promotionChanges.length > 0 && (
        <div style={{ marginBottom: "0.5rem" }}>
          <strong>🏆 Promotion Changes ({diff.promotionChanges.length})</strong>
          {diff.promotionChanges.slice(0, 5).map((c) => (
            <div key={c.managerId}>
              {name(c.managerId)}: {c.from} → {c.to}
            </div>
          ))}
          {diff.promotionChanges.length > 5 && (
            <div style={{ color: "var(--text-secondary)" }}>
              …and {diff.promotionChanges.length - 5} more
            </div>
          )}
        </div>
      )}
      {diff.levelChanges.length > 0 && (
        <div style={{ marginBottom: "0.5rem" }}>
          <strong>📈 Level Changes ({diff.levelChanges.length})</strong>
          {diff.levelChanges.slice(0, 5).map((c) => (
            <div key={c.managerId}>
              {name(c.managerId)}: {c.from} → {c.to}
            </div>
          ))}
          {diff.levelChanges.length > 5 && (
            <div style={{ color: "var(--text-secondary)" }}>
              …and {diff.levelChanges.length - 5} more
            </div>
          )}
        </div>
      )}
      {diff.fragmentChanges.length > 0 && (
        <div>
          <strong>🧩 Fragment Changes ({diff.fragmentChanges.length})</strong>
          {diff.fragmentChanges.slice(0, 5).map((c) => (
            <div key={c.managerId}>
              {name(c.managerId)}: {c.from} → {c.to}
            </div>
          ))}
          {diff.fragmentChanges.length > 5 && (
            <div style={{ color: "var(--text-secondary)" }}>
              …and {diff.fragmentChanges.length - 5} more
            </div>
          )}
        </div>
      )}
    </div>
  );
}