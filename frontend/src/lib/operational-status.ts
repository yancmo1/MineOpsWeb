import type { CachedCatalogPackage, CatalogCacheStatus } from "./catalog-cache";
import type { LoadState } from "./catalog-client";

export type CatalogOperationalStatus = {
  label: string;
  detail: string;
  recovery: string;
  tone: "good" | "warning" | "danger" | "neutral";
};

/** Prevent server-provided diagnostics from exposing credentials or local paths. */
export function redactDiagnostic(value: string | undefined | null): string | null {
  if (!value) return null;
  return value
    .replace(/(token|authorization|save[ _-]?key|password)\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]")
    .replace(/(?:file:\/\/|\/Users\/|\/home\/)[^\s,;]+/g, "[private path redacted]");
}

export function describeCatalogStatus(state: LoadState): CatalogOperationalStatus {
  switch (state.phase) {
    case "active": return { label: "Verified active package", detail: "The active catalog package is available from the local verified cache.", recovery: "No action needed.", tone: "good" };
    case "active_current": return { label: "Verified and current", detail: "The published package passed manifest and required-artifact verification.", recovery: "No action needed.", tone: "good" };
    case "active_stale": return { label: "Verified cache needs refresh", detail: state.reason, recovery: "Refresh the catalog when online; the cached package remains safe to use.", tone: "warning" };
    case "offline_cached": return { label: "Offline cached package", detail: "Using the last active verified package without checking publication metadata.", recovery: "Reconnect and refresh when convenient.", tone: "warning" };
    case "bootstrap_fallback": return { label: "Bundled fallback package", detail: state.reason ?? "No published or cached package was available.", recovery: "Reconnect and refresh before relying on catalog-specific advice.", tone: "warning" };
    case "verification_failed_using_previous": return { label: "Verification failed; previous package retained", detail: redactDiagnostic(state.error) ?? "Verification failed.", recovery: "Refresh after resolving connectivity or package validation issues. Player data has not changed.", tone: "danger" };
    case "error": return { label: "Catalog unavailable", detail: redactDiagnostic(state.error) ?? "Catalog load failed.", recovery: "Check connectivity, sign in if required, then refresh. Existing player data is preserved.", tone: "danger" };
    case "fetching_artifacts": return { label: "Downloading package", detail: `${state.loaded} of ${state.total} required artifacts verified so far.`, recovery: "Keep this page open until verification completes.", tone: "neutral" };
    case "checking_publication": case "fetching_manifest": case "verifying_manifest": case "verifying_artifacts": case "caching": case "activating": return { label: "Checking catalog", detail: "Loading a package without changing player data.", recovery: "Wait for verification to finish.", tone: "neutral" };
    default: return { label: "Catalog not checked", detail: "No package status is available yet.", recovery: "Refresh to check the active catalog package.", tone: "neutral" };
  }
}

export function describeCache(cache: CatalogCacheStatus, packages: CachedCatalogPackage[]): { size: string; lastKnownGood: string } {
  const bytes = cache.totalCacheBytes;
  const size = bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  const lastKnownGood = packages.find((pkg) => !pkg.isActive && pkg.verificationState === "verified")?.releaseId ?? "None retained";
  return { size, lastKnownGood };
}
