/**
 * Capture bridge status — shows ubuntumac ingest status on the More page.
 *
 * The capture bridge uploads APK extraction packages from ubuntumac to the
 * MineOps PocketBase capture-ingest endpoint (/api/capture/ingest).
 */

export interface CaptureStatus {
  /** Most recent release ID that was successfully ingested */
  lastReleaseId?: string;
  /** ISO timestamp of the last successful ingest */
  lastIngestedAt?: string;
  /** Number of catalog versions stored in PocketBase */
  catalogVersionCount?: number;
  /** Connection health to the capture ingest endpoint */
  healthy: boolean;
  /** Error message if unhealthy */
  error?: string;
}

const PB_URL = import.meta.env.VITE_POCKETBASE_URL ?? "http://localhost:8090";

/**
 * Fetch capture status from PocketBase (superuser-only endpoint).
 * Returns null if the user is not authenticated or the fetch fails.
 */
export async function fetchCaptureStatus(): Promise<CaptureStatus> {
  try {
    // Try to read the catalog_versions list as a proxy for ingest health.
    // A 401 here just means the user isn't signed in to PB — not an error.
    const resp = await fetch(`${PB_URL}/api/collections/catalog_versions/records?perPage=1&sort=-created`, {
      credentials: "include",
    });

    if (!resp.ok) {
      return { healthy: false, error: `PB returned ${resp.status}` };
    }

    const data = await resp.json() as { totalItems?: number; items?: Array<{ version?: string; created?: string }> };

    const latest = data.items?.[0];
    return {
      healthy: true,
      catalogVersionCount: data.totalItems ?? 0,
      lastReleaseId: latest?.version,
      lastIngestedAt: latest?.created,
    };
  } catch (err) {
    return { healthy: false, error: err instanceof Error ? err.message : "Failed to fetch capture status" };
  }
}
