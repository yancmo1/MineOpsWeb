import { getSyncMetadata, setSyncMetadata } from "../lib/db";

/** PocketBase synchronization boundary. External imports are activated server-side; this
 * client only records local freshness until the authenticated SDK is configured. */
export async function sync(): Promise<void> {
  const now = new Date().toISOString();
  const existing = await getSyncMetadata();
  await setSyncMetadata({ ...existing, lastAttemptAt: now, lastSuccessfulSyncAt: navigator.onLine ? now : existing.lastSuccessfulSyncAt, status: navigator.onLine ? "current" : "offline" });
}
