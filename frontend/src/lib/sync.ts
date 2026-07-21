/**
 * MineOps PB Sync Orchestrator
 *
 * Implements V3 PRD §9.3: local-first, PB as cross-device authority.
 *
 * Flow on launch (after auth restore):
 *   1. PB authenticated? Pull latest snapshot from PB.
 *   2. If PB snapshot has a higher revision than local, apply it.
 *   3. If local has unsynced changes (revision <= PB), push to PB.
 *
 * Flow after Kolibri sync:
 *   1. Push full player snapshot to PB with idempotency key.
 *   2. Mark previous snapshots as inactive.
 *
 * Conflict resolution:
 *   - Revision counter is monotonic. Higher revision = more recent.
 *   - Idempotency key prevents duplicate pushes on retry.
 *   - Server errors leave local data authoritative (never discarded).
 *   - Missing collection is logged distinctly from server failures.
 *
 * Design principles:
 *   - Never blocks the app. All operations are fire-and-forget or
 *     explicitly triggered.
 *   - PB unreachable? No problem — local-only mode continues.
 *   - LWW by revision, not timestamp, for conflict decisions.
 *   - A newer JSON catalog does NOT mutate historical player data.
 *     Snapshots retain the catalogVersion they were captured with.
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
 * Includes catalog interpretation metadata for traceability.
 * Fire-and-forget: errors are logged but never thrown to the UI.
 */
export async function pushStateToPB(
  progress: PlayerManager[],
  metadata: SyncMetadata,
  catalogVersion?: string,
  manifestHash?: string,
  unresolvedSourceIds?: string[],
  source?: string,
): Promise<void> {
  const auth = getAuthStatus();
  if (!auth.authenticated) return;

  const idempotencyKey = crypto.randomUUID();

  const payload: PlayerSnapshotPayload = {
    capturedAt: new Date().toISOString(),
    progress: JSON.stringify(progress),
    metadata: JSON.stringify(metadata),
    catalogVersion,
    manifestHash,
    idempotencyKey,
    unresolvedSourceIds,
    source: source ?? "manual",
  };

  try {
    const result = await pushPlayerSnapshot(payload);
    await recordSyncEvent({
      status: "completed",
      source: "push-snapshot",
      summary: `${progress.filter((p) => p.unlocked).length} unlocked managers (rev ${result.revision ?? "?"})`,
    });
    console.debug("[sync] Pushed player snapshot to PB (rev", result.revision ?? "?", ")");
  } catch (err) {
    const msg = String(err);
    if (msg.includes("404") || msg.includes("not found")) {
      console.warn("[sync] player_snapshots collection missing. Deploy migration 1700000008.");
    } else {
      console.warn("[sync] Failed to push snapshot to PB:", err);
    }
    // Never throw — local data remains authoritative
  }
}

/**
 * Pull latest PB snapshot and return it if newer than local.
 * Uses revision number (not timestamp) for conflict decisions.
 *
 * Returns null if:
 *   - PB has no snapshot
 *   - PB is unreachable (missing collection, network error, server error)
 *   - Local revision is equal or higher (no conflict)
 */
export async function pullNewerFromPB(
  localRevision?: number,
): Promise<{ progress: PlayerManager[]; metadata: SyncMetadata; revision: number } | null> {
  const auth = getAuthStatus();
  if (!auth.authenticated) return null;

  try {
    const snapshot = await pullLatestSnapshot();
    if (!snapshot) {
      console.debug("[sync] No PB snapshot found");
      return null;
    }

    const pbRevision = snapshot.revision ?? 0;

    // Revision-based conflict: only apply if PB has a strictly higher revision
    if (localRevision !== undefined && pbRevision <= localRevision) {
      console.debug(
        `[sync] Local revision (${localRevision}) >= PB revision (${pbRevision}), skipping pull`,
      );
      return null;
    }

    const progress = JSON.parse(snapshot.progress) as PlayerManager[];
    const metadata = JSON.parse(snapshot.metadata) as SyncMetadata;

    console.debug(
      `[sync] Pulled PB snapshot: ${progress.filter((p) => p.unlocked).length} unlocked managers, rev ${pbRevision}`,
    );

    return { progress, metadata, revision: pbRevision };
  } catch (err) {
    const msg = String(err);
    if (msg.includes("404") || msg.includes("not found") || msg.includes("Collection")) {
      console.warn("[sync] player_snapshots collection not found. Run migration 1700000008.");
    } else {
      console.warn("[sync] Failed to pull PB snapshot:", err);
    }
    return null;
  }
}

/**
 * Get the current snapshot revision from local metadata.
 * Used to determine whether a PB snapshot is newer.
 */
export function getLocalRevision(metadata: SyncMetadata): number {
  if (metadata.source?.startsWith("rev-")) {
    return parseInt(metadata.source.slice(4), 10) || 0;
  }
  return 0;
}

/**
 * Update local sync metadata after a successful push or pull.
 */
export function updateSyncMetadata(
  metadata: SyncMetadata,
  revision: number,
): SyncMetadata {
  return {
    ...metadata,
    lastSuccessfulSyncAt: new Date().toISOString(),
    source: `rev-${revision}`,
    status: "current",
    error: undefined,
  };
}