import type { CatalogManager, PlayerManager } from "./db";
import { resolveIds, fetchOverrides, type MappingEvidence } from "./catalog-mapping";
import { catalogClient } from "./catalog-client";

export type KolibriCredentials = { kolibriId: string; authToken: string; saveGameKey: string };
export type KolibriDiagnostics = { statusCode: number; payloadFormat: string; rawBytes: number; decodedBytes: number; managerCount: number; unknownManagerCount: number; unresolvedSampleIds?: string[] };

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
  const catalogVersion = pkg?.catalogVersion ?? null;
  const releaseId = pkg?.releaseId ?? "";

  // Gather overrides from PocketBase for the current release

  // Gather overrides from PocketBase for the current release
  const overrides = releaseId ? await fetchOverrides(releaseId) : [];

  // Build source ID list and resolve
  const sourceIds = managers.map((row) => ({ sourceValue: String(row.Id ?? ""), sourceKind: "kolibri_id" as const }));
  const evidenceMap = await resolveIds(sourceIds, overrides);

  // Build player progress from resolved mappings
  const byCanonicalId = new Map(catalog.map((mgr) => [mgr.id, mgr]));
  const progress = catalog.map((manager) => ({ managerId: manager.id, level: 1, rank: 0, promoted: 0, fragments: 0, unlocked: false, updatedAt: new Date().toISOString() }));
  const byManagerId = new Map(progress.map((item) => [item.managerId, item]));

  // Legacy fallback: always keep gameId lookup available for rows that remain unresolved
  // after mapping/override resolution (common when active mappings are incomplete).
  const byGameId = new Map(
    catalog.map((mgr) => [String((mgr as CatalogManager & { gameId?: number }).gameId ?? ""), mgr]),
  );

  let resolved = 0;
  let resolvedByMapping = 0;
  let resolvedByGameIdFallback = 0;
  let unresolvedCount = 0;

  for (const row of managers) {
    const srcValue = String(row.Id ?? "").trim();
    const evidence = evidenceMap.get(srcValue);
    let manager: CatalogManager | undefined;

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
    item.fragments = Math.max(0, Number(row.Fragments ?? row.fragments ?? row.FragmentCount ?? 0));
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
      unresolvedSampleIds: unresolved.length > 0
        ? unresolved.map((u) => u.sourceValue).slice(0, 10)
        : undefined,
    },
    mappingEvidence: evidenceMap,
    unresolved,
    catalogVersion,
  };
}
