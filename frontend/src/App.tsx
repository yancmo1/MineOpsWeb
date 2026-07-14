import { useEffect, useState } from "react";
import { db, type Manager } from "./lib/db";
import { sync } from "./api/client";

const sample = (key: string): Manager => ({ id:crypto.randomUUID(), managerKey:key, level:1, rank:0, promoted:0, fragments:0, unlocked:true, updatedAt:new Date().toISOString() });
export default function App() {
  const [managers, setManagers] = useState<Manager[]>([]); const [pending, setPending] = useState(0); const [message, setMessage] = useState("Loading local data…");
  const refresh = async () => { setManagers(await db.managers.orderBy("managerKey").toArray()); setPending(await db.queue.count()); };
  const runSync = async () => { try { setMessage(navigator.onLine ? "Synchronizing…" : "Offline — changes remain safely queued."); await sync(); setMessage(navigator.onLine ? "Synchronized" : "Offline"); } catch (error) { setMessage(error instanceof Error ? error.message : "Sync failed"); } finally { await refresh(); } };
  useEffect(() => { refresh().then(runSync); const online=()=>runSync(); window.addEventListener("online",online); return()=>window.removeEventListener("online",online); }, []);
  const addManager = async () => { const manager=sample(`manager-${managers.length+1}`); await db.managers.add(manager); await db.queue.add({id:crypto.randomUUID(), managerId:manager.id, createdAt:new Date().toISOString()}); await refresh(); };
  return <main><header><div><p className="eyebrow">MINEOPS</p><h1>Today</h1></div><button onClick={runSync}>Sync {pending ? `(${pending})` : ""}</button></header><p className="status" role="status">{message}</p><section className="hero"><h2>{managers.filter(m=>m.unlocked).length} unlocked managers</h2><p>Local-first progress is available offline. New edits sync when a connection returns.</p><button className="primary" onClick={addManager}>Add manager progress</button></section><section><div className="section-heading"><h2>Managers</h2><span>{pending} pending</span></div>{managers.length ? <ul>{managers.map(m=><li key={m.id}><strong>{m.managerKey.replaceAll("-"," ")}</strong><span>Level {m.level} · Rank {m.rank} · {m.fragments} fragments</span></li>)}</ul> : <div className="empty">No local progress yet. Add a manager or import your iOS backup.</div>}</section><nav aria-label="Primary"><a aria-current="page">Today</a><a>Managers</a><a>Strategy</a><a>More</a></nav></main>;
}
