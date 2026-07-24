import type { CatalogManager, PlayerManager } from "./db";
import { resolveIds, fetchOverrides, type MappingEvidence } from "./catalog-mapping";
import { catalogClient } from "./catalog-client";
import { managersFromVerifiedPackage } from "./strategy";
import type { CachedCatalogPackage } from "./catalog-cache";

export type KolibriCredentials = { kolibriId: string; authToken: string; saveGameKey: string };
export type KolibriDiagnostics = { statusCode: number; payloadFormat: string; rawBytes: number; decodedBytes: number; managerCount: number; unknownManagerCount: number; fragmentFieldCount?: number; fragmentMissingCount?: number; unresolvedSampleIds?: string[] };

export interface KolibriResult {
  progress: PlayerManager[];
  diagnostics: KolibriDiagnostics;
  /** Resolved mapping evidence for each source manager */
  mappingEvidence: Map<string, MappingEvidence>;
  /** Unresolved source IDs that couldn't be mapped */
  unresolved: MappingEvidence[];
  /** The catalog version used for resolution */
  catalogVersion: string | null;
}

function numericFragmentValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value);
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Math.max(0, Number(value));
  return undefined;
}

/**
 * Kolibri has shipped more than one save shape. Some builds put fragments on
 * each manager row; others keep a sibling dictionary/list under a fragment-
 * named property. Keep this deliberately scoped to the current manager ID so
 * a global fragment total can never be mistaken for a manager's progress.
 */
function findFragmentsInSave(root: unknown, sourceId: string, row?: Record<string, unknown>): number | undefined {
  const direct = row
    ? Object.entries(row).find(([key, value]) => /frag/i.test(key) && numericFragmentValue(value) != null)
    : undefined;
  if (direct) return numericFragmentValue(direct[1]);

  const seen = new Set<object>();
  const visit = (node: unknown, fragmentContext = false): number | undefined => {
    if (!node || typeof node !== "object") return undefined;
    if (seen.has(node as object)) return undefined;
    seen.add(node as object);

    if (Array.isArray(node)) {
      for (const item of node) {
        const found = visit(item, fragmentContext);
        if (found != null) return found;
      }
      return undefined;
    }

    const object = node as Record<string, unknown>;
    const id = String(object.Id ?? object.id ?? object.ManagerId ?? object.managerId ?? "");
    const isTarget = id === sourceId;
    for (const [key, value] of Object.entries(object)) {
      const nextContext = fragmentContext || /frag/i.test(key);
      if (nextContext && (isTarget || key === sourceId)) {
        const directValue = numericFragmentValue(value);
        if (directValue != null) return directValue;
        if (value && typeof value === "object") {
          const nested = visit(value, true);
          if (nested != null) return nested;
        }
      }
      if (value && typeof value === "object") {
        const nested = visit(value, nextContext);
        if (nested != null) return nested;
      }
    }
    return undefined;
  };

  return visit(root);
}

export function extractFragmentsFromSave(root: unknown, sourceId: string, row?: Record<string, unknown>): number {
  // Primary source: SuperManagerResourcesSavegame.Fragments array
  const data = (root as Record<string, unknown>).Data ?? root;
  const resources = (data as Record<string, unknown>).SuperManagerResourcesSavegame as Record<string, unknown> | undefined;
  if (resources) {
    const fragments = resources.Fragments as Array<{SuperManagerId: number; Quantity: number}> | undefined;
    if (fragments) {
      const sid = Number(sourceId);
      const match = fragments.find(f => f.SuperManagerId === sid);
      if (match) return match.Quantity;
    }
  }
  // Fallback: recursive search for old save formats
  return findFragmentsInSave(root, sourceId, row) ?? 0;
}

/** Extract equipment assignments from SuperManagerEquipmentSavegame. */
export function extractEquipmentFromSave(root: unknown, sourceId: string): Array<{equipmentId: number}> {
  const data = (root as Record<string, unknown>).Data ?? root;
  const equipSave = (data as Record<string, unknown>).SuperManagerEquipmentSavegame as Record<string, unknown> | undefined;
  if (!equipSave || !equipSave.EquipmentAssignedToSuperManager) return [];
  const assignments = equipSave.EquipmentAssignedToSuperManager as Array<{SuperManagerId: number; EquipmentId: number}>;
  if (!assignments) return [];
  const sid = Number(sourceId);
  return assignments.filter(a => a.SuperManagerId === sid).map(a => ({equipmentId: a.EquipmentId}));
}

/**
 * The UI can start a sync while React is still holding an empty/bootstrap
 * catalog. The verified package is the authority for ID resolution, so use
 * its adapted managers whenever they are available.
 */
export function catalogForKolibriSync(
  activePackage: CachedCatalogPackage | undefined,
  suppliedCatalog: CatalogManager[],
): CatalogManager[] {
  const verifiedCatalog = activePackage ? managersFromVerifiedPackage(activePackage) : [];
  const selected = verifiedCatalog.length > 0 ? verifiedCatalog : suppliedCatalog;
  console.debug("[kolibri] Catalog selected for sync", {
    suppliedCount: suppliedCatalog.length,
    verifiedCount: verifiedCatalog.length,
    selectedCount: selected.length,
    source: verifiedCatalog.length > 0 ? "active-package" : "supplied-catalog",
    samples: selected.filter((manager) => ["sm-10001", "sm-10066"].includes(manager.id)).map((manager) => ({ id: manager.id, name: manager.name, gameId: manager.gameId })),
  });
  return selected;
}

function lastUUID(value: string): string {
  const matches = value.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi);
  return matches?.at(-1)?.toLowerCase() ?? value.trim();
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  if (!("DecompressionStream" in globalThis)) throw new Error("This browser does not support gzip save decoding.");
  const stream = new Blob([bytes.buffer as ArrayBuffer]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function decodePayload(bytes: Uint8Array): Promise<{ json: Uint8Array; format: string }> {
  if (bytes[0] === 0x7b) return { json: bytes, format: "json" };
  const text = new TextDecoder().decode(bytes);
  const encoded = text.startsWith("U58U") ? text.slice(4) : text;
  const decoded = decodeBase64(encoded);
  const gzipStart = decoded.findIndex((byte, index) => byte === 0x1f && decoded[index + 1] === 0x8b);
  if (gzipStart < 0) throw new Error("Kolibri response did not contain a gzip payload.");
  return { json: await gunzip(decoded.slice(gzipStart)), format: text.startsWith("U58U") ? "u58u-base64-gzip" : "base64-prefixed-gzip" };
}

export async function fetchKolibri(credentials: KolibriCredentials, catalog: CatalogManager[]): Promise<KolibriResult> {
  const id = lastUUID(credentials.kolibriId);
  if (!id) throw new Error("Kolibri ID is required.");
  if (!credentials.authToken.trim()) throw new Error("Kolibri auth token is required.");
  const key = credentials.saveGameKey.trim() || "0";
  const response = await fetch(`/kolibri/games/com.fluffyfairygames.idleminertycoon/players/${encodeURIComponent(id)}/savegame?saveGameKey=${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${credentials.authToken.trim()}`, Accept: "*/*" } });
  const raw = new Uint8Array(await response.arrayBuffer());
  if (!response.ok) throw new Error(`Kolibri returned HTTP ${response.status}. Check the player ID, token, and save-game key.`);
  const decoded = await decodePayload(raw);
  const root = JSON.parse(new TextDecoder().decode(decoded.json)) as Record<string, unknown>;
  const data = (root.Data ?? root) as Record<string, unknown>;
  const managers = (((data.SuperManagers ?? {}) as Record<string, unknown>).Managers ?? []) as Array<Record<string, unknown>>;

  // Direct fragment/equipment extraction from save fields
  const fragmentMap = new Map<number, number>();
  const resources = (data as Record<string, unknown>).SuperManagerResourcesSavegame as Record<string, unknown> | undefined;
  if (resources) {
    (resources.Fragments as Array<{SuperManagerId: number; Quantity: number}> | undefined)?.forEach(f => {
      fragmentMap.set(f.SuperManagerId, f.Quantity);
    });
    console.log("[kolibri] Fragments loaded:", fragmentMap.size, "managers");
  }
  const equipAssignments = new Map<number, number[]>();
  const equipSave = (data as Record<string, unknown>).SuperManagerEquipmentSavegame as Record<string, unknown> | undefined;
  if (equipSave) {
    (equipSave.EquipmentAssignedToSuperManager as Array<{SuperManagerId: number; EquipmentId: number}> | undefined)?.forEach(e => {
      const list = equipAssignments.get(e.SuperManagerId) ?? [];
      list.push(e.EquipmentId);
      equipAssignments.set(e.SuperManagerId, list);
    });
    console.log("[kolibri] Equipment assignments loaded:", equipAssignments.size, "managers");
  }

  // Resolve all manager IDs through the mapping resolver
  // Wait for catalog client to have an active package (sync may fire before load finishes)
  let pkg = await catalogClient.getActivePackage();
  if (!pkg) {
    console.log("[kolibri] Waiting for catalog activation...");
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 200));
      pkg = await catalogClient.getActivePackage();
      if (pkg) {
        console.log("[kolibri] Catalog activated after", (i + 1) * 200, "ms:", pkg.releaseId);
        break;
      }
    }
  }
  if (!pkg) {
    return {
      progress: [],
      diagnostics: { statusCode: 0, payloadFormat: "no-catalog", rawBytes: 0, decodedBytes: 0, managerCount: managers.length, unknownManagerCount: managers.length, unresolvedSampleIds: managers.map((r) => String(r.Id ?? "")).slice(0, 10) },
      mappingEvidence: new Map(),
      unresolved: managers.map((r) => ({ sourceValue: String(r.Id ?? ""), sourceKind: "kolibri_id", canonicalId: null, resolution: "unresolved" as const, confidence: null, catalogVersion: "", releaseId: "", displayName: null })),
      catalogVersion: null,
    };
  }
  let catalogVersion = pkg?.catalogVersion ?? null;
  let releaseId = pkg?.releaseId ?? "";
  const sourceIds = managers.map((row) => String(row.Id ?? "").trim());
  let syncCatalog = catalogForKolibriSync(pkg, catalog);

  // A bootstrap package can be active briefly while the published package is
  // still downloading. Do not interpret a real save against an empty or
  // unrelated bootstrap catalog; wait for a package that can resolve at least
  // one source manager ID.
  const catalogMatchesSave = (candidate: CatalogManager[]) => sourceIds.length === 0 || sourceIds.some((sourceId) =>
    candidate.some((manager) => manager.id === `sm-${sourceId}` || String(manager.gameId ?? "") === sourceId),
  );
  if (!catalogMatchesSave(syncCatalog)) {
    console.debug("[kolibri] Active catalog does not match save IDs; waiting for published package", {
      catalogReleaseId: pkg.releaseId,
      catalogVersion: pkg.catalogVersion,
      catalogCount: syncCatalog.length,
      firstSaveIds: sourceIds.slice(0, 5),
    });
    for (let i = 0; i < 50 && !catalogMatchesSave(syncCatalog); i++) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      const candidatePackage = await catalogClient.getActivePackage();
      const candidateCatalog = catalogForKolibriSync(candidatePackage, catalog);
      if (candidatePackage && catalogMatchesSave(candidateCatalog)) {
        pkg = candidatePackage;
        syncCatalog = candidateCatalog;
        catalogVersion = pkg.catalogVersion;
        releaseId = pkg.releaseId;
        console.debug("[kolibri] Published catalog became usable after", (i + 1) * 200, "ms", pkg.releaseId);
        break;
      }
    }
  }

  // Gather overrides from PocketBase for the current release

  // Gather overrides from PocketBase for the current release
  const overrides = releaseId ? await fetchOverrides(releaseId) : [];

  // Build source ID list and resolve
  const sourceIdInputs = sourceIds.map((sourceValue) => ({ sourceValue, sourceKind: "kolibri_id" as const }));
  const evidenceMap = await resolveIds(sourceIdInputs, overrides);

  // Build player progress from resolved mappings
  const byCanonicalId = new Map(syncCatalog.map((mgr) => [mgr.id, mgr]));
  const progress: PlayerManager[] = syncCatalog.map((manager) => ({ managerId: manager.id, level: 1, rank: 0, promoted: 0, fragments: 0, fragmentSource: "unavailable", unlocked: false, updatedAt: new Date().toISOString() }));
  const byManagerId = new Map(progress.map((item) => [item.managerId, item]));

  // Legacy fallback: always keep gameId lookup available for rows that remain unresolved
  // after mapping/override resolution (common when active mappings are incomplete).
  const byGameId = new Map(
    syncCatalog.map((mgr) => [String((mgr as CatalogManager & { gameId?: number }).gameId ?? ""), mgr]),
  );

  let resolved = 0;
  let resolvedByMapping = 0;
  let resolvedByGameIdFallback = 0;
  let unresolvedCount = 0;
  let fragmentFieldCount = 0;

  for (const row of managers) {
    const srcValue = String(row.Id ?? "").trim();
    const evidence = evidenceMap.get(srcValue);
    let manager: CatalogManager | undefined;

    // Debug: log raw fields from first manager row
    if (managers.indexOf(row) === 0) {
      console.log("[kolibri] First manager raw keys:", Object.keys(row).join(", "));
      console.log("[kolibri] First manager raw values:", JSON.stringify(row, null, 2).slice(0, 500));
    }

    if (evidence?.canonicalId) {
      // Primary path: mapping resolver
      manager = byCanonicalId.get(evidence.canonicalId);
      if (manager) resolvedByMapping += 1;
    }

    // Fallback: legacy gameId lookup from catalog when unresolved
    if (!manager) {
      // Fallback: legacy gameId lookup from catalog
      manager = byGameId.get(srcValue);
      if (manager) resolvedByGameIdFallback += 1;
    }

    if (!manager) {
      unresolvedCount += 1;
      continue;
    }
    resolved += 1;
    const item = byManagerId.get(manager.id)!;
    item.unlocked = true;
    item.level = Math.max(1, Number(row.Level ?? 1));
    item.rank = Math.max(0, Number(row.Rank ?? 0));
    item.promoted = Math.max(0, Number(row.Promotion ?? 0));
    // Use direct fragmentMap from SuperManagerResourcesSavegame
    const fragQty = fragmentMap.get(Number(srcValue));
    item.fragments = fragQty ?? 0;
    item.fragmentSource = fragQty != null ? "kolibri" : "unavailable";
    if (fragQty != null) fragmentFieldCount += 1;
    // Equipment assignments from SuperManagerEquipmentSavegame
    item.equipmentIds = equipAssignments.get(Number(srcValue)) ?? [];
    item.updatedAt = new Date().toISOString();
  }

  // Collect unresolved evidence for diagnostics
  const unresolved = managers
    .map((r) => String(r.Id ?? "").trim())
    .filter((sourceValue) => {
      const evidence = evidenceMap.get(sourceValue);
      if (evidence?.canonicalId) return false;
      return !byGameId.has(sourceValue);
    })
    .map((sourceValue) => ({
      sourceValue,
      sourceKind: "kolibri_id",
      canonicalId: null,
      resolution: "unresolved" as const,
      confidence: null,
      catalogVersion: pkg?.catalogVersion ?? "",
      releaseId: pkg?.releaseId ?? "",
      displayName: null,
    }));

  // Debug: log unresolved IDs
  if (unresolved.length > 0) {
    console.debug("[kolibri] Unresolved manager IDs:", unresolved.map((u) => u.sourceValue).join(", "));
  }
  console.debug(
    "[kolibri] Resolution summary:",
    `total=${managers.length}`,
    `resolved=${resolved}`,
    `mapping=${resolvedByMapping}`,
    `fallback_gameId=${resolvedByGameIdFallback}`,
    `unresolved=${unresolved.length}`,
  );

  return {
    progress,
    diagnostics: {
      statusCode: response.status,
      payloadFormat: decoded.format,
      rawBytes: raw.byteLength,
      decodedBytes: decoded.json.byteLength,
      managerCount: managers.length,
      unknownManagerCount: unresolvedCount,
      fragmentFieldCount,
      fragmentMissingCount: Math.max(0, resolved - fragmentFieldCount),
      unresolvedSampleIds: unresolved.length > 0
        ? unresolved.map((u) => u.sourceValue).slice(0, 10)
        : undefined,
    },
    mappingEvidence: evidenceMap,
    unresolved,
    catalogVersion,
  };
}
