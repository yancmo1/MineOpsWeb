import Dexie, { type EntityTable } from "dexie";

export type CatalogManager = { id: string; name: string; rarity: string; type: string; gameId?: number; elements: string[]; active?: { description?: string; multiplier?: number; duration?: string; cooldown?: string }; passives?: Array<{ unlockLevel?: number; description?: string; multiplier?: number }> };
export type PlayerManager = { managerId: string; level: number; rank: number; promoted: number; fragments: number; unlocked: boolean; updatedAt: string };
export type SyncMetadata = { lastSuccessfulSyncAt?: string; lastAttemptAt?: string; source?: string; status: "current" | "stale" | "offline" | "never"; error?: string };

class MineOpsDb extends Dexie {
  progress!: EntityTable<PlayerManager, "managerId">;
  metadata!: EntityTable<{ id: "sync"; value: SyncMetadata }, "id">;
  constructor() { super("mineops"); this.version(2).stores({ progress: "managerId, updatedAt, unlocked", metadata: "id" }); }
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

export function strengthScore(manager: CatalogManager, progress: PlayerManager): number {
  const rarity = { legendary: 25, epic: 18, rare: 12, common: 6 }[manager.rarity.toLowerCase()] ?? 0;
  const active = Math.max(manager.active?.multiplier ?? 1, 1);
  return Math.log10(active) * 100 + progress.level * 1.5 + progress.rank * 20 + progress.promoted * 10 + rarity;
}
export function rankThreshold(rank: number): number | undefined { return ({ 0: 15, 1: 30, 2: 50, 3: 80 } as Record<number, number>)[rank]; }
