import Dexie, { type EntityTable } from "dexie";

export type Manager = { id: string; managerKey: string; level: number; rank: number; promoted: number; fragments: number; unlocked: boolean; revision?: number; updatedAt: string };
export type QueueItem = { id: string; managerId: string; createdAt: string };

class MineOpsDb extends Dexie {
  managers!: EntityTable<Manager, "id">;
  queue!: EntityTable<QueueItem, "id">;
  constructor() { super("mineops"); this.version(1).stores({ managers: "id, managerKey, updatedAt", queue: "id, managerId, createdAt" }); }
}
export const db = new MineOpsDb();
export const deviceId = (() => { const key="mineops-device-id"; const existing=localStorage.getItem(key); if(existing) return existing; const next=crypto.randomUUID(); localStorage.setItem(key,next); return next; })();
