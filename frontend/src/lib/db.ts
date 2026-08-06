import Dexie, { type EntityTable } from "dexie";

export type CatalogPassive = { passiveId?: number; unlockLevel?: number; description?: string; multiplier?: number; type?: string; promoReq?: number };
export type CatalogManager = { id: string; name: string; rarity: string; type: string; gameId?: number; sprite?: string; elements: string[]; variantOf?: string; active?: { description?: string; multiplier?: number; multiplierAt100?: number; duration?: number | string; cooldown?: number | string }; activeLevels?: Array<{ level: number; value: number }>; rankEffects?: Array<{ rank: number; activeIncrease?: number; passiveIncrease?: number }>; abilities?: Array<{ multiplier?: number; multiplierAt100?: number; rankScaling?: Record<string, { activeIncrease: number; passiveIncrease: number }>; effectType?: { effectType?: number; effectDescType?: number; incremental?: number } }>; passives?: CatalogPassive[]; equipment?: Array<{ id?: string; name?: string; description?: string; multiplier?: number }>; progression?: Array<{ level?: number; promotion?: number; cost?: number }>; promotions?: Array<{ level?: number; promotion?: number; cost?: number; unlocksPassive?: boolean; passiveId?: number }>; spriteRefs?: Array<{ name?: string; filename?: string; type?: string }>; fragmentIds?: Array<{ fragmentId?: number }>; elementalMapping?: Array<{ id: number; rankToUnlock: number; isPrimary: boolean }>; elementalRecipe?: Array<{ rank: number; ingredients: Array<{ id: number; amount: number }> }> };
export type PlayerManager = { managerId: string; level: number; rank: number; promoted: number; fragments: number; fragmentSource?: "kolibri" | "manual" | "unavailable"; passiveValues?: Array<number | null>; passiveValueSource?: "kolibri" | "unavailable"; equipmentIds?: number[]; unlocked: boolean; updatedAt: string };
export type PlayerInventoryEntry = { key: string; kind: "essence" | "crystal" | "material" | "equipment" | "unknown"; quantity: number; sourcePath: string; sourceKey: string; itemId?: number };
export type SyncMetadata = { lastSuccessfulSyncAt?: string; lastAttemptAt?: string; source?: string; status: "current" | "stale" | "offline" | "never"; error?: string };
export type AppSettings = {
  autoSync: boolean;
  focusManagerId?: string;
  focusTargetLevel?: number;
};
export type PersistedCredentials = { kolibriId: string; authToken: string; saveGameKey: string };

class MineOpsDb extends Dexie {
  progress!: EntityTable<PlayerManager, "managerId">;
  metadata!: EntityTable<{ id: "sync"; value: SyncMetadata }, "id">;
  settings!: EntityTable<{ id: "app"; value: AppSettings }, "id">;
  credentials!: EntityTable<{ id: "kolibri"; value: PersistedCredentials }, "id">;
  inventory!: EntityTable<PlayerInventoryEntry, "key">;
  constructor() { super("mineops"); this.version(5).stores({ progress: "managerId, updatedAt, unlocked", metadata: "id", settings: "id", credentials: "id", strategy_plans: "++id, kind, createdAt", dismissed_recommendations: "&id, managerId, kind" }); this.version(6).stores({ progress: "managerId, updatedAt, unlocked", metadata: "id", settings: "id", credentials: "id", inventory: "key, kind, sourcePath", strategy_plans: "++id, kind, createdAt", dismissed_recommendations: "&id, managerId, kind" }); }
}
export const db = new MineOpsDb();

export async function loadProgress(catalog: CatalogManager[]): Promise<PlayerManager[]> {
  const saved = await db.progress.toArray();
  const byId = new Map(saved.map((p) => [p.managerId, p]));
  return catalog.map((manager) => byId.get(manager.id) ?? { managerId: manager.id, level: 1, rank: 0, promoted: 0, fragments: 0, unlocked: false, updatedAt: new Date(0).toISOString() });
}
export async function saveProgress(progress: PlayerManager[]): Promise<void> { await db.progress.bulkPut(progress); }
export async function loadInventory(): Promise<PlayerInventoryEntry[]> { return db.inventory.toArray(); }
export async function saveInventory(entries: PlayerInventoryEntry[]): Promise<void> { await db.transaction("rw", db.inventory, async () => { await db.inventory.clear(); if (entries.length) await db.inventory.bulkPut(entries); }); }
export async function getSyncMetadata(): Promise<SyncMetadata> { return (await db.metadata.get("sync"))?.value ?? { status: "never" }; }
export async function setSyncMetadata(value: SyncMetadata): Promise<void> { await db.metadata.put({ id: "sync", value }); }
export async function getSettings(): Promise<AppSettings> { return (await db.settings.get("app"))?.value ?? { autoSync: false }; }
export async function saveSettings(value: AppSettings): Promise<void> { await db.settings.put({ id: "app", value }); }
export async function saveCredentials(value: PersistedCredentials): Promise<void> { await db.credentials.put({ id: "kolibri", value }); }
export async function getCredentials(): Promise<PersistedCredentials | undefined> { return (await db.credentials.get("kolibri"))?.value; }

// ---------------------------------------------------------------------------
// Effective Active Value (linear interpolation fallback)
// iOS equivalent: SMProgress.effectiveActiveValue(using:)
// Web doesn't have the scaling table API yet, so uses linear interpolation
// between activeL1 (level 1) and activeL100 (level 100).
// ---------------------------------------------------------------------------

export function effectiveActiveValue(manager: CatalogManager, progress: PlayerManager): number {
  // Exact active-level rows only — NEVER linear interpolation. The lossless
  // package carries the full 1-100 table per manager, so the exact row exists
  // for every in-game level. When it does not (legacy/partial package shape),
  // the documented level-1 base is returned instead of fabricating a curve;
  // callers flag `limitedData` when they need to show provenance.
  const exactLevel = manager.activeLevels?.find((row) => row.level === progress.level);
  const baseValue = exactLevel?.value != null && Number.isFinite(exactLevel.value)
    ? exactLevel.value
    : manager.active?.multiplier ?? 1;

  const rankEffect = manager.rankEffects?.find((row) => row.rank === progress.rank)?.activeIncrease;
  if (rankEffect == null || !Number.isFinite(rankEffect)) return baseValue;
  // APK rank rows are normally stored as an additive percentage (0.46 = 46%),
  // but accept an already-expanded factor as well for older package shapes.
  const rankFactor = rankEffect >= 1 ? rankEffect : 1 + rankEffect;
  return baseValue * rankFactor;
}

/** True when the manager has an exact active-value row for the player's level. */
export function hasExactActiveLevelRow(manager: CatalogManager, level: number): boolean {
  const row = manager.activeLevels?.find((candidate) => candidate.level === level);
  return row?.value != null && Number.isFinite(row.value);
}

// ---------------------------------------------------------------------------
// Strength Score (deterministic)
// iOS equivalent: SMProgressService.strengthScore(for:)
// ---------------------------------------------------------------------------

export function strengthScore(manager: CatalogManager, progress: PlayerManager): number {
  const activeValue = Math.max(effectiveActiveValue(manager, progress), 1);
  return Math.log10(activeValue) * 100
    + progress.level * 1.5
    + progress.rank * 20
    + progress.promoted * 10
    + rarityWeight(manager.rarity);
}

// ---------------------------------------------------------------------------
// Rarity helpers (iOS: SMProgressService.rarityWeight / raritySortWeight)
// ---------------------------------------------------------------------------

export function rarityWeight(rarity: string): number {
  switch (rarity.toLowerCase()) {
    case "legendary": return 25;
    case "epic": return 18;
    case "rare": return 12;
    case "common": return 6;
    default: return 0;
  }
}

export function raritySortWeight(rarity: string): number {
  switch (rarity.toLowerCase()) {
    case "legendary": return 4;
    case "epic": return 3;
    case "rare": return 2;
    case "common": return 1;
    default: return 0;
  }
}

// ---------------------------------------------------------------------------
// Fragment thresholds (iOS: SMProgressService.knownFragmentThreshold)
// ---------------------------------------------------------------------------

export function rankThreshold(rank: number): number | undefined {
  return ({ 0: 15, 1: 30, 2: 50, 3: 80 } as Record<number, number>)[rank];
}

export function isRankUpReady(progress: PlayerManager): boolean {
  if (!progress.unlocked) return false;
  const threshold = rankThreshold(progress.rank);
  if (threshold == null) return false;
  return progress.fragments >= threshold;
}
