/**
 * Catalog Mapping Resolver
 *
 * Resolves player IDs against the active catalog's mappings.json and
 * PocketBase manual overrides. Preserves unmatched IDs and separates
 * generated facts (in mappings.json) from human decisions (PocketBase).
 *
 * Resolution order (first match wins):
 *   1. Manual override (PocketBase catalog_overrides collection)
 *   2. mappings.json identity mapping (generated candidate)
 *   3. mappings.json alias lookup (alternative names)
 *   4. No match — returned as unresolved
 *
 * Source-of-truth boundary:
 *   - mappings.json contains auto-generated candidates, confidence, evidence
 *   - PocketBase catalog_overrides contains human-audited corrections
 *   - Snapshots retain original source IDs + catalog release for re-interpretation
 */

import { catalogClient } from "./catalog-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MappingOverride {
  id: string;
  sourceKind: string;
  sourceValue: string;
  canonicalId: string;
  confidence: "verified" | "inferred" | "manual";
  reason: string;
  createdBy: string;
  createdAt: string;
}

export interface MappingEvidence {
  /** The source identifier value */
  sourceValue: string;
  /** The source identifier kind (e.g. "kolibri_id", "unity_guid") */
  sourceKind: string;
  /** The resolved canonical ID, or null if unresolved */
  canonicalId: string | null;
  /** How the resolution was made */
  resolution: "override" | "mapping" | "alias" | "unresolved";
  /** Confidence from the mapping source */
  confidence: "verified" | "inferred" | "manual" | null;
  /** The catalog release version that produced this resolution */
  catalogVersion: string;
  /** The catalog release ID */
  releaseId: string;
  /** Human-readable display name from the catalog, if resolved */
  displayName: string | null;
}

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

/**
 * Resolve a single source ID against the active catalog's mappings + overrides.
 */
export async function resolveId(
  sourceValue: string,
  sourceKind: string = "kolibri_id",
  overrides: MappingOverride[] = [],
): Promise<MappingEvidence> {
  const pkg = await catalogClient.getActivePackage();
  if (!pkg) {
    return unresolvedEvidence(sourceValue, sourceKind, "", "");
  }

  const releaseId = pkg.releaseId;
  const catalogVersion = pkg.catalogVersion;
  const mappings = pkg.artifacts["mappings.json"]?.content as Record<string, unknown> | undefined;
  const catalogCore = pkg.artifacts["catalog-core.json"]?.content as Record<string, unknown> | undefined;

  // 1. Check manual overrides (highest priority)
  const override = overrides.find(
    (o) => o.sourceValue === sourceValue && o.sourceKind === sourceKind,
  );
  if (override) {
    return resolvedEvidence(sourceValue, sourceKind, override.canonicalId, "override", override.confidence, releaseId, catalogVersion, catalogCore);
  }

  // 2. Check mappings.json idMappings
  if (mappings) {
    const idMappings = (mappings as Record<string, unknown>).idMappings as Array<Record<string, unknown>> | undefined;
    if (idMappings) {
      // Debug: log first few mappings for inspection
      const firstKolibri = idMappings.find((m: Record<string, unknown>) => m.kind === sourceKind);
      if (firstKolibri) {
        console.debug("[catalog-mapping] First kolibri_id mapping:", JSON.stringify(firstKolibri), "sourceKind:", sourceKind, "type:", typeof sourceKind);
        console.debug("[catalog-mapping] Searching for:", JSON.stringify({ sourceValue, sourceKind }));
        const candidate = idMappings.find((m: Record<string, unknown>) => m.sourceValue === sourceValue && m.kind === sourceKind);
        if (candidate) {
          console.debug("[catalog-mapping] MATCH FOUND:", JSON.stringify(candidate));
        } else {
          console.debug("[catalog-mapping] No match — checking types: sourceValue type=", typeof sourceValue, "mapping sourceValue type=", typeof (idMappings.find((m: Record<string, unknown>) => m.kind === sourceKind) as Record<string, unknown>)?.sourceValue);
        }
      }
      const match = idMappings.find(
        (m) => m.sourceValue === sourceValue && m.kind === sourceKind,
      );
      if (match) {
        return resolvedEvidence(sourceValue, sourceKind, match.canonicalId as string, "mapping", (match.confidence as "verified" | "inferred" | "manual") || "inferred", releaseId, catalogVersion, catalogCore);
      }
    }

    // 3. Check aliases
    const aliases = (mappings as Record<string, unknown>).aliases as Array<Record<string, unknown>> | undefined;
    if (aliases) {
      const aliasMatch = aliases.find((a) => a.alias === sourceValue);
      if (aliasMatch) {
        return resolvedEvidence(sourceValue, sourceKind, aliasMatch.canonicalId as string, "alias", "inferred", releaseId, catalogVersion, catalogCore);
      }
    }
  }

  // 4. No match
  return unresolvedEvidence(sourceValue, sourceKind, releaseId, catalogVersion);
}

/**
 * Resolve multiple source IDs at once (more efficient for batch operations).
 * Returns a Map of sourceValue → MappingEvidence.
 */
export async function resolveIds(
  sources: Array<{ sourceValue: string; sourceKind?: string }>,
  overrides: MappingOverride[] = [],
): Promise<Map<string, MappingEvidence>> {
  const results = new Map<string, MappingEvidence>();
  for (const src of sources) {
    const evidence = await resolveId(src.sourceValue, src.sourceKind || "kolibri_id", overrides);
    results.set(src.sourceValue, evidence);
  }
  return results;
}

/**
 * Get unresolved IDs from a set of source values.
 */
export async function getUnresolved(
  sourceValues: string[],
  sourceKind: string = "kolibri_id",
  overrides: MappingOverride[] = [],
): Promise<MappingEvidence[]> {
  const results: MappingEvidence[] = [];
  for (const sv of sourceValues) {
    const evidence = await resolveId(sv, sourceKind, overrides);
    if (evidence.resolution === "unresolved") {
      results.push(evidence);
    }
  }
  return results;
}

/**
 * Fetch active overrides from PocketBase for the current release.
 */
export async function fetchOverrides(releaseId: string): Promise<MappingOverride[]> {
  try {
    const { getClient } = await import("./pocketbase");
    const pb = getClient();
    const result = await pb.collection("catalog_overrides").getList(1, 100, {
      filter: `releaseId = "${releaseId}" && isActive = true`,
      sort: "-createdAt",
    });
    return result.items.map((item: Record<string, unknown>) => ({
      id: item.id as string,
      sourceKind: (item as Record<string, unknown>).sourceKind as string,
      sourceValue: (item as Record<string, unknown>).sourceValue as string,
      canonicalId: (item as Record<string, unknown>).canonicalId as string,
      confidence: (item as Record<string, unknown>).confidence as "verified" | "inferred" | "manual",
      reason: (item as Record<string, unknown>).reason as string || "",
      createdBy: (item as Record<string, unknown>).createdBy as string,
      createdAt: (item as Record<string, unknown>).createdAt as string,
    }));
  } catch {
    return [];
  }
}

/**
 * Check whether a new catalog can reinterpret old source IDs.
 * Returns true if a different catalog version is now active.
 */
export async function needsReinterpretation(snapshotCatalogVersion: string | null): Promise<boolean> {
  if (!snapshotCatalogVersion) return true;
  const pkg = await catalogClient.getActivePackage();
  if (!pkg) return false;
  return pkg.catalogVersion !== snapshotCatalogVersion;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolvedEvidence(
  sourceValue: string,
  sourceKind: string,
  canonicalId: string,
  resolution: "override" | "mapping" | "alias",
  confidence: "verified" | "inferred" | "manual",
  releaseId: string,
  catalogVersion: string,
  catalogCore?: Record<string, unknown>,
): MappingEvidence {
  const displayName = resolveDisplayName(canonicalId, catalogCore);
  return {
    sourceValue,
    sourceKind,
    canonicalId,
    resolution,
    confidence,
    catalogVersion,
    releaseId,
    displayName,
  };
}

function unresolvedEvidence(
  sourceValue: string,
  sourceKind: string,
  releaseId: string,
  catalogVersion: string,
): MappingEvidence {
  return {
    sourceValue,
    sourceKind,
    canonicalId: null,
    resolution: "unresolved",
    confidence: null,
    catalogVersion,
    releaseId,
    displayName: null,
  };
}

function resolveDisplayName(canonicalId: string, catalogCore?: Record<string, unknown>): string | null {
  if (!catalogCore) return null;
  for (const key of ["managers", "mines", "equipment", "research", "collectibles", "artifacts"]) {
    const entities = (catalogCore as Record<string, unknown>)[key] as Array<Record<string, unknown>> | undefined;
    if (!entities) continue;
    const entity = entities.find((e) => e.canonicalId === canonicalId);
    if (entity) return (entity.name as string) || null;
  }
  return null;
}
