import { db, deviceId, type Manager } from "../lib/db";
const API = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";
const toApi = (m: Manager) => ({ id:m.id, revision:m.revision, device_id:deviceId, manager_key:m.managerKey, level:m.level, rank:m.rank, promoted:m.promoted, fragments:m.fragments, unlocked:m.unlocked });
const fromApi = (m: any): Manager => ({ id:m.id, revision:m.revision, managerKey:m.manager_key, level:m.level, rank:m.rank, promoted:m.promoted, fragments:m.fragments, unlocked:m.unlocked, updatedAt:m.updated_at });

export async function sync(): Promise<void> {
  if (!navigator.onLine) return;
  const queue = await db.queue.toArray();
  if (queue.length) {
    const managers = (await Promise.all(queue.map(q => db.managers.get(q.managerId)))).filter((m): m is Manager => Boolean(m));
    const response = await fetch(`${API}/sync/managers`, { method:"POST", headers:{"Content-Type":"application/json","Idempotency-Key":crypto.randomUUID()}, body:JSON.stringify({device_id:deviceId,mutations:managers.map(toApi)}) });
    if (response.status === 409) throw new Error("A manager changed on another device. Review the conflict before continuing.");
    if (!response.ok) throw new Error("Sync failed");
    const saved = (await response.json()).map(fromApi);
    await db.transaction("rw", db.managers, db.queue, async () => { await db.managers.bulkPut(saved); await db.queue.clear(); });
  }
  const response = await fetch(`${API}/sync/managers`);
  if (!response.ok) throw new Error("Could not refresh server data");
  await db.managers.bulkPut((await response.json()).map(fromApi));
}
