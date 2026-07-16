/**
 * MineOps PB Sync Orchestrator
 *
 * Implements V3 PRD §9.3: local-first, PB as cross-device authority.
 *
 * Flow on launch (after auth restore):
 *   1. PB authenticated? Pull latest snapshot from PB.
 *   2. If PB snapshot is newer than local, apply it (cross-device catch-up).
 *   3. If local is newer, push to PB.
 *
 * Flow after Kolibri sync:
 *   1. Push full player snapshot to PB.
 *   2. Mark previous snapshots as inactive (handled in pocketbase.ts).
 *
 * Design principles:
 *   - Never blocks the app. All operations are fire-and-forget or
 *     explicitly triggered.
 *   - PB unreachable? No problem — local-only mode continues.
 *   - LWW (last-write-wins) by capturedAt timestamp for snapshot decisions.
 */

import type { PlayerManager, SyncMetadata } from "./db";
import {
  getAuthStatus,
  pushPlayerSnapshot,
  pullLatestSnapshot,
  recordSyncEvent,
  type PlayerSnapshotPayload,
} from "./pocketbase";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Push current player state to PB as a versioned snapshot.
 * Called after every successful Kolibri sync.
 * Fire-and-forget: errors are logged but never thrown to the UI.
 */
export async function pushStateToPB(
  progress: PlayerManager[],
  metadata: SyncMetadata,
  catalogVersion?: string,
): Promise<void> {
  const auth = getAuthStatus();
  if (!auth.authenticated) return;

  const payload: PlayerSnapshotPayload = {
    capturedAt: new Date().toISOString(),
    progress: JSON.stringify(progress),
    metadata: JSON.stringify(metadata),
    catalogVersion,
  };

  try {
    await pushPlayerSnapshot(payload);
    await recordSyncEvent({
      status: "completed",
      source: "push-snapshot",
      summary: `${progress.filter((p) => p.unlocked).length} unlocked managers`,
    });
    console.debug("[sync] Pushed player snapshot to PB");
  } catch (err) {
    console.warn("[sync] Failed to push snapshot to PB:", err);
    // Never throw — local data remains authoritative
  }
}

/**
 * Pull latest PB snapshot and return it if newer than the given local timestamp.
 * Returns null if PB has no snapshot, PB is unreachable, or local is newer.
 */
export async function pullNewerFromPB(
  localLastSyncAt?: string,
): Promise<{ progress: PlayerManager[]; metadata: SyncMetadata } | null> {
  const auth = getAuthStatus();
  if (!auth.authenticated) return null;

  try {
    const snapshot = await pullLatestSnapshot();
    if (!snapshot) {
      console.debug("[sync] No PB snapshot found");
      return null;
    }

    // LWW: only apply PB snapshot if it's newer than local
    if (localLastSyncAt && snapshot.capturedAt <= localLastSyncAt) {
      console.debug("[sync] Local state is newer than PB, skipping pull");
      return null;
    }

    const progress = JSON.parse(snapshot.progress) as PlayerManager[];
    const metadata = JSON.parse(snapshot.metadata) as SyncMetadata;

    console.debug(
      `[sync] Pulled PB snapshot: ${progress.filter((p) => p.unlocked).length} unlocked managers, captured ${snapshot.capturedAt}`,
    );

    return { progress, metadata };
  } catch (err) {
    console.warn("[sync] Failed to pull snapshot from PB:", err);
    return null;
  }
}