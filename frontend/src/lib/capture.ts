/**
 * Capture bridge status — shows ubuntumac ingest status on the More page.
 *
 * The capture bridge uploads APK extraction packages from ubuntumac to the
 * MineOps PocketBase capture-ingest endpoint (/api/capture/ingest).
 */

import { getClient } from "./pocketbase";

export interface CaptureReleaseSummary {
  releaseId: string;
  ingestedAt: string;
  source?: string;
  objectCount?: number;
}

export interface CaptureRawImportPreview {
  receivedAt: string;
  source?: string;
  owner?: string;
  parserVersion?: string;
  status?: string;
  capturedAt?: string;
  versionName?: string;
  versionCode?: number;
  apkCount?: number;
  objectCount?: number;
  /** Total assets discovered during extraction (from objectSummary) */
  totalAssets?: number;
  /** Object type names discovered (from objects array) */
  objectTypes?: string[];
}

export interface CaptureStatus {
  /** Most recent release ID that was successfully ingested */
  lastReleaseId?: string;
  /** ISO timestamp of the last successful ingest */
  lastIngestedAt?: string;
  /** Number of catalog versions stored in PocketBase */
  catalogVersionCount?: number;
  /** Source marker from catalog_versions (for example ubuntumac/1.4.2) */
  lastSource?: string;
  /** Record count captured in the latest catalog_versions row */
  lastObjectCount?: number;
  /** Recent catalog releases, newest first */
  recentReleases?: CaptureReleaseSummary[];
  /** Previous release details for quick comparison against latest */
  previousReleaseId?: string;
  previousIngestedAt?: string;
  previousObjectCount?: number;
  /** Delta between latest and previous object counts (latest - previous) */
  objectCountDelta?: number;
  /** Most recent raw_imports preview when readable by current user */
  latestRawImport?: CaptureRawImportPreview;
  /** Non-blocking notes about access/visibility for diagnostics */
  notes?: string[];
  /** Connection health to the capture ingest endpoint */
  healthy: boolean;
  /** Error message if unhealthy */
  error?: string;
}

/**
 * Fetch capture status from PocketBase.
 */
export async function fetchCaptureStatus(): Promise<CaptureStatus> {
  const notes: string[] = [];

  try {
    const pb = getClient();

    let catalog;
    try {
      // Fetch without sort to avoid 400 on PB setups that reject sort by
      // system fields (e.g. created). We'll sort client-side instead.
      catalog = await pb.collection("catalog_versions").getList(1, 5, {
        fields: "version,source,recordCount,created",
      });
    } catch {
      // Collection may not exist or be inaccessible — return unavailable
      return {
        healthy: false,
        error: "catalog_versions collection is not available",
        notes: [],
        recentReleases: [],
      };
    }

    const recentReleases: CaptureReleaseSummary[] = catalog.items
      .map((item) => ({
        releaseId: String(item.version ?? ""),
        ingestedAt: String(item.created ?? ""),
        source: item.source ? String(item.source) : undefined,
        objectCount: typeof item.recordCount === "number"
          ? item.recordCount
          : (typeof item.recordCount === "string" ? Number(item.recordCount) : undefined),
      }))
      .filter((item) => item.releaseId.length > 0)
      // Sort newest-first by ingestedAt (client-side to avoid 400 from PB sort)
      .sort((a, b) => {
        if (!a.ingestedAt && !b.ingestedAt) return 0;
        if (!a.ingestedAt) return 1;
        if (!b.ingestedAt) return -1;
        return b.ingestedAt.localeCompare(a.ingestedAt);
      });

    const latest = recentReleases[0];
    const previous = recentReleases[1];

    let objectCountDelta: number | undefined;
    if (
      latest &&
      previous &&
      typeof latest.objectCount === "number" &&
      typeof previous.objectCount === "number"
    ) {
      objectCountDelta = latest.objectCount - previous.objectCount;
    }

    let latestRawImport: CaptureRawImportPreview | undefined;
    if (pb.authStore.isValid) {
      try {
        const rawResult = await pb.collection("raw_imports").getList(1, 1, {
          fields: "owner,source,parserVersion,payload,created",
        });

        let rawItems = rawResult.items;
        if (!rawItems?.length) {
          const fallback = await pb.collection("raw_imports").getList(1, 1, {
            fields: "owner,source,parserVersion,payload",
          });
          rawItems = fallback.items;
        }

        const raw = rawItems[0];
        if (raw) {
          let payload: Record<string, unknown> = {};
          if (typeof raw.payload === "string") {
            try {
              payload = JSON.parse(raw.payload) as Record<string, unknown>;
            } catch {
              notes.push("Latest raw import payload is not valid JSON.");
            }
          }

          latestRawImport = {
            receivedAt: String(raw.created ?? ""),
            source: raw.source ? String(raw.source) : undefined,
            owner: raw.owner ? String(raw.owner) : undefined,
            parserVersion: raw.parserVersion ? String(raw.parserVersion) : undefined,
            status: typeof payload.status === "string" ? payload.status : undefined,
            capturedAt: typeof payload.capturedAt === "string" ? payload.capturedAt : undefined,
            versionName: typeof payload.versionName === "string" ? payload.versionName : undefined,
            versionCode: typeof payload.versionCode === "number" ? payload.versionCode : undefined,
            apkCount: payload.apkHashes && typeof payload.apkHashes === "object"
              ? Object.keys(payload.apkHashes as Record<string, unknown>).length
              : undefined,
            objectCount: Array.isArray(payload.objects) ? payload.objects.length : undefined,
            totalAssets: payload.objectSummary && typeof payload.objectSummary === "object"
              ? (payload.objectSummary as Record<string, unknown>).totalAssets as number | undefined
              : undefined,
            objectTypes: Array.isArray(payload.objects)
              ? payload.objects
                  .map((o: unknown) => (o && typeof o === "object" ? (o as Record<string, unknown>).type as string : undefined))
                  .filter((t: string | undefined): t is string => typeof t === "string")
              : undefined,
          };
        } else {
          notes.push("No raw import records were found.");
        }
      } catch {
        notes.push("Raw import details are not visible for the current account.");
      }
    } else {
      notes.push("Sign in to view protected raw import details.");
    }

    return {
      healthy: true,
      catalogVersionCount: catalog.totalItems ?? recentReleases.length,
      lastReleaseId: latest?.releaseId,
      lastIngestedAt: latest?.ingestedAt,
      lastSource: latest?.source,
      lastObjectCount: latest?.objectCount,
      recentReleases,
      previousReleaseId: previous?.releaseId,
      previousIngestedAt: previous?.ingestedAt,
      previousObjectCount: previous?.objectCount,
      objectCountDelta,
      latestRawImport,
      notes,
    };
  } catch (err) {
    return { healthy: false, error: err instanceof Error ? err.message : "Failed to fetch capture status" };
  }
}
