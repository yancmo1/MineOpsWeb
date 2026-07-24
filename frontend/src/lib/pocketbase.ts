/**
 * PocketBase client for MineOps.
 *
 * Supports environment-based switching:
 *   VITE_POCKETBASE_URL  – base URL (defaults to localhost:8090)
 *
 * The client is a singleton that lazily initializes. Call `getClient()` to
 * obtain the instance after first use.
 *
 * Auth flow:
 *   1. On app launch, call `restoreAuth()` which checks for a stored token.
 *   2. If no valid session exists, the app runs in local-only mode.
 *   3. Sign-in/out is managed in More -> PocketBase Account.
 *   4. Future: auto sign-in using stored credentials via pb.authStore.
 */

import PocketBase from "pocketbase";
import type { RecordModel } from "pocketbase";

const PB_URL = import.meta.env.VITE_POCKETBASE_URL ?? "https://mineops-pb.shepswork.com";

let _client: PocketBase | null = null;

export function getClient(): PocketBase {
  if (!_client) {
    _client = new PocketBase(PB_URL);
    // Launch sync and manual sync can overlap. Let both requests complete so
    // PocketBase does not abort one as a duplicate request (the previous
    // behavior produced "request was aborted/autocancelled" in the console).
    _client.autoCancellation(false);
    console.debug("[pocketbase] Auto-cancellation disabled for sync-safe requests");
  }
  return _client;
}

export function getBaseUrl(): string {
  return PB_URL;
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

export type AuthStatus =
  | { authenticated: false }
  | { authenticated: true; email: string; id: string };

export function getAuthStatus(): AuthStatus {
  const pb = getClient();
  const store = pb.authStore;
  if (store.isValid && store.record) {
    return {
      authenticated: true,
      email: (store.record as RecordModel).email as string,
      id: store.record.id,
    };
  }
  return { authenticated: false };
}

export async function signIn(email: string, password: string): Promise<void> {
  const pb = getClient();
  await pb.collection("users").authWithPassword(email, password);
}

export function signOut(): void {
  getClient().authStore.clear();
}

export function restoreAuth(): void {
  const pb = getClient();
  if (pb.authStore.isValid) {
    pb.collection("users").authRefresh().catch(() => {
      pb.authStore.clear();
    });
  }
}

/** Subscribe to auth store changes. Returns unsubscribe function. */
export function onAuthChange(cb: (status: AuthStatus) => void): () => void {
  const pb = getClient();
  const handler = () => {
    cb(getAuthStatus());
  };
  const unsubscribe = pb.authStore.onChange(handler);
  // Fire once immediately
  handler();
  return unsubscribe;
}

// ---------------------------------------------------------------------------
// Player Snapshot: full-state versioned snapshot after each Kolibri sync
// ---------------------------------------------------------------------------

export interface PlayerSnapshotPayload {
  /** ISO timestamp of when this snapshot was captured locally */
  capturedAt: string;
  /** JSON-serialized PlayerManager[] */
  progress: string;
  /** SyncMetadata at time of capture */
  metadata: string;
  /** Catalog version hash or identifier */
  catalogVersion?: string;
  /** SHA-256 of the manifest used for interpretation */
  manifestHash?: string;
  /** Client-generated UUID for idempotent retry */
  idempotencyKey?: string;
  /** Source IDs that couldn't be resolved */
  unresolvedSourceIds?: string[];
  /** Import source (e.g. "kolibri", "manual") */
  source?: string;
}

export interface PlayerSnapshotRecord extends RecordModel {
  owner: string;
  capturedAt: string;
  progress: string;
  metadata: string;
  catalogVersion: string;
  manifestHash: string;
  active: boolean;
  revision: number;
  idempotencyKey: string;
  unresolvedSourceIds: string;
  source: string;
}

/**
 * Push a new player snapshot to PocketBase.
 * Marks previous active snapshots as inactive.
 * Uses idempotency key to prevent duplicate pushes on retry.
 */
export async function pushPlayerSnapshot(
  payload: PlayerSnapshotPayload,
): Promise<PlayerSnapshotRecord> {
  const pb = getClient();
  if (!pb.authStore.isValid || !pb.authStore.record) {
    throw new Error("Not authenticated");
  }
  const ownerId = pb.authStore.record.id;

  // Generate idempotency key if not provided
  const idempotencyKey =
    payload.idempotencyKey ?? crypto.randomUUID();

  // Compatibility mode: avoid server-side filters for older remote schemas.
  const existingSnapshots = await listOwnSnapshots(ownerId, 200);

  // Check for existing snapshot with this idempotency key
  const existing = existingSnapshots.find((snap) => snap.idempotencyKey === idempotencyKey);
  if (existing) {
    console.debug("[pocketbase] Snapshot already pushed (idempotent):", idempotencyKey);
    return existing;
  }

  // Get current revision count for conflict detection
  const latestRevision = existingSnapshots.reduce((maxRev, snap) => {
    const rev = Number(snap.revision ?? 0);
    return Number.isFinite(rev) ? Math.max(maxRev, rev) : maxRev;
  }, 0);
  const revision = latestRevision + 1;

  // Mark all previous snapshots as inactive (best effort)
  try {
    for (const snap of existingSnapshots) {
      if (snap.active === true) {
        await pb.collection("player_snapshots").update(snap.id, { active: false });
      }
    }
  } catch {
    // Best-effort — new snapshot will still be created
  }

  const record = await pb
    .collection("player_snapshots")
    .create<PlayerSnapshotRecord>({
      owner: ownerId,
      capturedAt: payload.capturedAt,
      progress: payload.progress,
      metadata: payload.metadata,
      catalogVersion: payload.catalogVersion ?? "",
      manifestHash: payload.manifestHash ?? "",
      revision,
      idempotencyKey,
      unresolvedSourceIds: payload.unresolvedSourceIds
        ? JSON.stringify(payload.unresolvedSourceIds)
        : "",
      source: payload.source ?? "",
      active: true,
    });

  return record;
}

/**
 * Pull the latest active player snapshot from PocketBase.
 * Returns null if no snapshot exists or the collection is missing.
 */
export async function pullLatestSnapshot(): Promise<PlayerSnapshotRecord | null> {
  const pb = getClient();
  if (!pb.authStore.isValid || !pb.authStore.record) {
    throw new Error("Not authenticated");
  }

  try {
    const snapshots = await listOwnSnapshots(pb.authStore.record.id, 200);
    const active = snapshots.filter((snap) => snap.active === true);
    const pool = active.length > 0 ? active : snapshots;
    return pool[0] ?? null;
  } catch (err) {
    // Distinguish missing collection from other errors
    const msg = String(err);
    if (msg.includes("404") || msg.includes("not found") || msg.includes("Collection")) {
      console.warn("[pocketbase] player_snapshots collection not found. Run migration 1700000008.");
    } else {
      console.warn("[pocketbase] Failed to pull latest snapshot:", err);
    }
    return null;
  }
}

async function listOwnSnapshots(ownerId: string, perPage: number): Promise<PlayerSnapshotRecord[]> {
  const pb = getClient();
  let page;
  try {
    // Fetch without sort to avoid 400 on PB setups that reject sort by
    // system fields (e.g. created). We sort client-side by revision.
    page = await pb
      .collection("player_snapshots")
      .getList<PlayerSnapshotRecord>(1, perPage);
  } catch {
    return [];
  }
  return page.items
    .filter((item) => item.owner === ownerId)
    .sort((a, b) => (b.revision ?? 0) - (a.revision ?? 0));
}

// ---------------------------------------------------------------------------
// Workspace Records: per-manager progress records for granular sync
// ---------------------------------------------------------------------------

export interface WorkspaceRecordPayload {
  recordType: string;
  recordKey: string;
  payload: string;
  revision: number;
  updatedAt: string;
}

export interface WorkspaceRecord extends RecordModel {
  owner: string;
  recordType: string;
  recordKey: string;
  payload: string;
  revision: number;
}

/**
 * Upsert a single workspace record (per-manager progress).
 * Uses recordKey as unique identifier; updates if exists, creates if not.
 */
export async function upsertWorkspaceRecord(
  data: WorkspaceRecordPayload,
): Promise<WorkspaceRecord> {
  const pb = getClient();
  if (!pb.authStore.isValid || !pb.authStore.record) {
    throw new Error("Not authenticated");
  }

  // Check if record already exists
  const existing = await pb
    .collection("workspace_records")
    .getList<WorkspaceRecord>(1, 1, {
      filter: `owner = "${pb.authStore.record.id}" && recordType = "${data.recordType}" && recordKey = "${data.recordKey}"`,
    });

  if (existing.items.length > 0) {
    const record = existing.items[0];
    // Only update if incoming revision is newer
    if (data.revision <= record.revision) return record;
    return await pb
      .collection("workspace_records")
      .update<WorkspaceRecord>(record.id, {
        payload: data.payload,
        revision: data.revision,
      });
  }

  return await pb
    .collection("workspace_records")
    .create<WorkspaceRecord>({
      owner: pb.authStore.record.id,
      recordType: data.recordType,
      recordKey: data.recordKey,
      payload: data.payload,
      revision: data.revision,
    });
}

/**
 * Pull all workspace records of a given type for the current user.
 */
export async function pullWorkspaceRecords(
  recordType: string,
): Promise<WorkspaceRecord[]> {
  const pb = getClient();
  if (!pb.authStore.isValid || !pb.authStore.record) {
    throw new Error("Not authenticated");
  }

  return await pb
    .collection("workspace_records")
    .getFullList<WorkspaceRecord>({
      filter: `owner = "${pb.authStore.record.id}" && recordType = "${recordType}"`,
    });
}

// ---------------------------------------------------------------------------
// Sync helpers
// ---------------------------------------------------------------------------

export interface PendingSyncEvent {
  status: "pending" | "syncing" | "completed" | "failed";
  source: string;
  summary?: string;
  error?: string;
}

export async function recordSyncEvent(event: PendingSyncEvent): Promise<void> {
  const pb = getClient();
  if (!pb.authStore.isValid) return;
  try {
    await pb.collection("sync_events").create({
      owner: pb.authStore.record!.id,
      status: event.status,
      source: event.source,
      summary: event.summary,
    });
  } catch {
    // Silently fail if PB is unreachable - local data remains usable
  }
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

export async function checkHealth(): Promise<{
  ok: boolean;
  message: string;
}> {
  try {
    const pb = getClient();
    const health = await pb.health.check();
    return { ok: true, message: JSON.stringify(health) };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
