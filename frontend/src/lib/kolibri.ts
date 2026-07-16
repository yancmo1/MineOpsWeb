import type { CatalogManager, PlayerManager } from "./db";

export type KolibriCredentials = { kolibriId: string; authToken: string; saveGameKey: string };
export type KolibriDiagnostics = { statusCode: number; payloadFormat: string; rawBytes: number; decodedBytes: number; managerCount: number; unknownManagerCount: number };

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

export async function fetchKolibri(credentials: KolibriCredentials, catalog: CatalogManager[]): Promise<{ progress: PlayerManager[]; diagnostics: KolibriDiagnostics }> {
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
  const byGameId = new Map(catalog.map((manager) => [String((manager as CatalogManager & { gameId?: number }).gameId ?? ""), manager]));
  let unknown = 0;
  const progress = catalog.map((manager) => ({ managerId: manager.id, level: 1, rank: 0, promoted: 0, fragments: 0, unlocked: false, updatedAt: new Date().toISOString() }));
  const byManagerId = new Map(progress.map((item) => [item.managerId, item]));
  for (const row of managers) {
    const manager = byGameId.get(String(row.Id));
    if (!manager) { unknown += 1; continue; }
    const item = byManagerId.get(manager.id)!;
    item.unlocked = true;
    item.level = Math.max(1, Number(row.Level ?? 1));
    item.rank = Math.max(0, Number(row.Rank ?? 0));
    item.promoted = Math.max(0, Number(row.Promotion ?? 0));
    item.fragments = Math.max(0, Number(row.Fragments ?? row.fragments ?? row.FragmentCount ?? 0));
    item.updatedAt = new Date().toISOString();
  }
  // Debug: log the first manager's raw keys to identify the fragments field name
  if (managers.length > 0) {
    console.debug("[kolibri] First manager raw keys:", Object.keys(managers[0]).join(", "));
    console.debug("[kolibri] First manager raw values:", JSON.stringify(managers[0]));
  }
  return { progress, diagnostics: { statusCode: response.status, payloadFormat: decoded.format, rawBytes: raw.byteLength, decodedBytes: decoded.json.byteLength, managerCount: managers.length, unknownManagerCount: unknown } };
}
