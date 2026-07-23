import Dexie, { type EntityTable } from "dexie";

export type CatalogManager = { id: string; name: string; rarity: string; type: string; gameId?: number; sprite?: string; elements: string[]; active?: { description?: string; multiplier?: number; multiplierAt100?: number; duration?: string; cooldown?: string }; abilities?: Array<{ multiplier?: number; multiplierAt100?: number; rankScaling?: Record<string, { activeIncrease: number; passiveIncrease: number }>; effectType?: { effectType?: number; effectDescType?: number; incremental?: number } }>; passives?: Array<{ unlockLevel?: number; description?: string; multiplier?: number; type?: string; promoReq?: number }>; progression?: Array<{ level?: number; promotion?: number; cost?: number }>; spriteRefs?: Array<{ name?: string; filename?: string; type?: string }>; fragmentIds?: Array<{ fragmentId?: number }> };
export type PlayerManager = { managerId: string; level: number; rank: number; promoted: number; fragments: number; unlocked: boolean; updatedAt: string };
export type SyncMetadata = { lastSuccessfulSyncAt?: string; lastAttemptAt?: string; source?: string; status: "current" | "stale" | "offline" | "never"; error?: string };
export type AppSettings = { autoSync: boolean };
export type PersistedCredentials = { kolibriId: string; authToken: string; saveGameKey: string };

class MineOpsDb extends Dexie {
  progress!: EntityTable<PlayerManager, "managerId">;
  metadata!: EntityTable<{ id: "sync"; value: SyncMetadata }, "id">;
  settings!: EntityTable<{ id: "app"; value: AppSettings }, "id">;
  credentials!: EntityTable<{ id: "kolibri"; value: PersistedCredentials }, "id">;
  constructor() { super("mineops"); this.version(4).stores({ progress: "managerId, updatedAt, unlocked", metadata: "id", settings: "id", credentials: "id" }); }
}
export const db = new MineOpsDb();

export async function loadProgress(catalog: CatalogManager[]): Promise<PlayerManager[]> {
  const saved = await db.progress.toArray();
  const byId = new Map(saved.map((p) => [p.managerId, p]));
  return catalog.map((manager) => byId.get(manager.id) ?? { managerId: manager.id, level: 1, rank: 0, promoted: 0, fragments: 0, unlocked: false, updatedAt: new Date(0).toISOString() });
}
export async function saveProgress(progress: PlayerManager[]): Promise<void> { await db.progress.bulkPut(progress); }
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
  const activeL1 = manager.active?.multiplier ?? 1;
  const activeL100 = manager.active?.multiplierAt100;

  if (activeL100 != null && progress.level >= 1) {
    const base = activeL1;
    const maxVal = activeL100;
    const ratio = Math.min(progress.level / 100.0, 1.0);
    return base + (maxVal - base) * ratio;
  }

  // Fallback: use flat activeL1
  return activeL1;
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
