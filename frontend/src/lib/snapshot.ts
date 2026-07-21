/**
 * Snapshot storage and diff engine.
 *
 * Implements V3 PRD §9.2:
 *   - Save raw import as versioned snapshot
 *   - Compare with current active snapshot
 *   - Create human-readable change summary
 *   - Preserve previous snapshots
 *   - Support rollback
 */

import Dexie, { type EntityTable } from "dexie";
import type { PlayerManager, SyncMetadata } from "./db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Snapshot {
  id?: number;
  capturedAt: string;
  /** JSON-serialized PlayerManager[] */
  progress: string;
  /** JSON-serialized SyncMetadata */
  metadata: string;
  source: string;
  active: boolean;
  /** Human-readable summary of changes from previous snapshot */
  summary: string;
  /** Catalog release version used to interpret this snapshot's source IDs */
  catalogVersion: string | null;
  /** JSON-serialized array of unresolved source IDs from the import */
  unresolvedSourceIds: string | null;
}

export interface SnapshotDiff {
  newlyUnlocked: string[];
  levelChanges: Array<{ managerId: string; from: number; to: number }>;
  rankChanges: Array<{ managerId: string; from: number; to: number }>;
  promotionChanges: Array<{ managerId: string; from: number; to: number }>;
  fragmentChanges: Array<{ managerId: string; from: number; to: number }>;
  /** Total managers with any change */
  changedCount: number;
  /** Human-readable one-line summary */
  summary: string;
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

class SnapshotDb extends Dexie {
  snapshots!: EntityTable<Snapshot, "id">;

  constructor() {
    super("mineops_snapshots");
    this.version(1).stores({
      snapshots: "++id, capturedAt, active, source",
    });
  }
}

const snapshotDb = new SnapshotDb();

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listSnapshots(): Promise<Snapshot[]> {
  return snapshotDb.snapshots.orderBy("capturedAt").reverse().toArray();
}

export async function getActiveSnapshot(): Promise<Snapshot | undefined> {
  return snapshotDb.snapshots.where("active").equals(1).first();
}

export async function getSnapshot(id: number): Promise<Snapshot | undefined> {
  return snapshotDb.snapshots.get(id);
}

export async function saveSnapshot(
  progress: PlayerManager[],
  metadata: SyncMetadata,
  source: string,
  catalog?: { nameMap: Map<string, string> },
  catalogVersion?: string | null,
  unresolvedSourceIds?: string[] | null,
): Promise<Snapshot> {
  // Get previous active for diff
  const previous = await getActiveSnapshot();

  // Deactivate previous
  await snapshotDb.snapshots
    .where("active")
    .equals(1)
    .modify({ active: false });

  // Compute diff summary
  let summary = "Initial snapshot";
  if (previous) {
    const prevProgress = JSON.parse(previous.progress) as PlayerManager[];
    const diff = computeDiff(prevProgress, progress, catalog);
    summary = diff.summary;
  }

  const snapshot: Snapshot = {
    capturedAt: new Date().toISOString(),
    progress: JSON.stringify(progress),
    metadata: JSON.stringify(metadata),
    source,
    active: true,
    summary,
    catalogVersion: catalogVersion ?? null,
    unresolvedSourceIds: unresolvedSourceIds ? JSON.stringify(unresolvedSourceIds) : null,
  };

  const id = await snapshotDb.snapshots.add(snapshot);
  return { ...snapshot, id };
}

/**
 * Roll back to a previous snapshot by its ID.
 * Returns the restored progress and metadata, or null if not found.
 */
export async function rollbackToSnapshot(
  id: number,
): Promise<{ progress: PlayerManager[]; metadata: SyncMetadata } | null> {
  const snapshot = await snapshotDb.snapshots.get(id);
  if (!snapshot) return null;

  // Deactivate current active
  await snapshotDb.snapshots
    .where("active")
    .equals(1)
    .modify({ active: false });

  // Activate this one
  await snapshotDb.snapshots.update(id, { active: true });

  return {
    progress: JSON.parse(snapshot.progress) as PlayerManager[],
    metadata: JSON.parse(snapshot.metadata) as SyncMetadata,
  };
}

// ---------------------------------------------------------------------------
// Diff engine
// ---------------------------------------------------------------------------

function managerName(
  managerId: string,
  catalog?: { nameMap: Map<string, string> },
): string {
  if (catalog?.nameMap.has(managerId)) {
    return catalog.nameMap.get(managerId)!;
  }
  // Fallback: prettify the ID
  return managerId
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function computeDiff(
  previous: PlayerManager[],
  current: PlayerManager[],
  catalog?: { nameMap: Map<string, string> },
): SnapshotDiff {
  const prevMap = new Map(previous.map((p) => [p.managerId, p]));
  const currMap = new Map(current.map((p) => [p.managerId, p]));

  const newlyUnlocked: string[] = [];
  const levelChanges: SnapshotDiff["levelChanges"] = [];
  const rankChanges: SnapshotDiff["rankChanges"] = [];
  const promotionChanges: SnapshotDiff["promotionChanges"] = [];
  const fragmentChanges: SnapshotDiff["fragmentChanges"] = [];

  for (const [id, curr] of currMap) {
    const prev = prevMap.get(id);
    if (!prev) continue;

    if (!prev.unlocked && curr.unlocked) {
      newlyUnlocked.push(managerName(id, catalog));
    }
    if (prev.level !== curr.level) {
      levelChanges.push({ managerId: id, from: prev.level, to: curr.level });
    }
    if (prev.rank !== curr.rank) {
      rankChanges.push({ managerId: id, from: prev.rank, to: curr.rank });
    }
    if (prev.promoted !== curr.promoted) {
      promotionChanges.push({
        managerId: id,
        from: prev.promoted,
        to: curr.promoted,
      });
    }
    if (prev.fragments !== curr.fragments) {
      fragmentChanges.push({
        managerId: id,
        from: prev.fragments,
        to: curr.fragments,
      });
    }
  }

  const changedCount =
    newlyUnlocked.length +
    levelChanges.length +
    rankChanges.length +
    promotionChanges.length +
    fragmentChanges.length;

  // Build human-readable summary
  const parts: string[] = [];
  if (newlyUnlocked.length > 0) {
    if (newlyUnlocked.length <= 3) {
      parts.push(`Unlocked: ${newlyUnlocked.join(", ")}`);
    } else {
      parts.push(`${newlyUnlocked.length} newly unlocked`);
    }
  }
  if (levelChanges.length > 0) {
    parts.push(`${levelChanges.length} level changes`);
  }
  if (rankChanges.length > 0) {
    parts.push(`${rankChanges.length} rank changes`);
  }
  if (promotionChanges.length > 0) {
    parts.push(`${promotionChanges.length} promotion changes`);
  }
  if (fragmentChanges.length > 0) {
    parts.push(`${fragmentChanges.length} fragment changes`);
  }

  const summary =
    changedCount === 0
      ? "No changes"
      : parts.join(" · ") +
        ` (${currMap.size} managers, ${current.filter((p) => p.unlocked).length} unlocked)`;

  return {
    newlyUnlocked,
    levelChanges,
    rankChanges,
    promotionChanges,
    fragmentChanges,
    changedCount,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Catalog reinterpretation
// ---------------------------------------------------------------------------

/**
 * Re-interpret old snapshot source IDs against a new catalog version.
 * Returns the re-mapped progress with the new catalog's canonical IDs.
 * Original source IDs in the snapshot are preserved — this creates a new
 * interpretation, not a destructive migration.
 *
 * Unresolved IDs in the new catalog retain their last-known-good values
 * from the previous interpretation. This prevents player data loss if
 * a mapping was dropped between catalog versions.
 */
export async function reinterpretSnapshot(
  snapshot: Snapshot,
  previousProgress: PlayerManager[],
): Promise<{ progress: PlayerManager[]; newlyResolved: string[]; stillUnresolved: string[] }> {
  const { resolveIds, fetchOverrides, needsReinterpretation } = await import("./catalog-mapping");
  const { catalogClient } = await import("./catalog-client");

  if (!snapshot.catalogVersion) {
    return { progress: JSON.parse(snapshot.progress) as PlayerManager[], newlyResolved: [], stillUnresolved: [] };
  }

  const pkg = await catalogClient.getActivePackage();
  if (!pkg) {
    return { progress: JSON.parse(snapshot.progress) as PlayerManager[], newlyResolved: [], stillUnresolved: [] };
  }

  const needsReinterpret = await needsReinterpretation(snapshot.catalogVersion);
  if (!needsReinterpret) {
    return { progress: JSON.parse(snapshot.progress) as PlayerManager[], newlyResolved: [], stillUnresolved: [] };
  }

  const unresolvedSourceIds: string[] = snapshot.unresolvedSourceIds
    ? JSON.parse(snapshot.unresolvedSourceIds)
    : [];

  if (unresolvedSourceIds.length === 0) {
    return { progress: JSON.parse(snapshot.progress) as PlayerManager[], newlyResolved: [], stillUnresolved: [] };
  }

  const overrides = pkg.releaseId ? await fetchOverrides(pkg.releaseId) : [];
  const evidenceMap = await resolveIds(
    unresolvedSourceIds.map((id) => ({ sourceValue: id, sourceKind: "kolibri_id" })),
    overrides,
  );

  const currentProgress = JSON.parse(snapshot.progress) as PlayerManager[];
  const currentByManagerId = new Map(currentProgress.map((p) => [p.managerId, p]));
  const newlyResolved: string[] = [];
  const stillUnresolved: string[] = [];

  for (const id of unresolvedSourceIds) {
    const evidence = evidenceMap.get(id);
    if (evidence?.canonicalId) {
      if (!currentByManagerId.has(evidence.canonicalId)) {
        newlyResolved.push(id);
        currentProgress.push({
          managerId: evidence.canonicalId,
          level: 1,
          rank: 0,
          promoted: 0,
          fragments: 0,
          unlocked: false,
          updatedAt: new Date().toISOString(),
        });
      }
    } else {
      stillUnresolved.push(id);
    }
  }

  return { progress: currentProgress, newlyResolved, stillUnresolved };
}