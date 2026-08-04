// Precise repro: does clicking Strategy cause a reload? What is the #426 loop?
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const URL = "http://localhost:8080/";
const CHROME = process.env.HOME + "/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "mineops-cdp2-"));
const port = 9900 + Math.floor(Math.random() * 90);

const chrome = spawn(CHROME, [
  "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
  "--no-first-run", "--remote-debugging-port=" + port, "--remote-allow-origins=*",
  "--user-data-dir=" + userDataDir, "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });
chrome.stderr.on("data", () => {});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(p) {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://127.0.0.1:${port}${p}`); if (r.ok) return r.json(); } catch {}
    await sleep(200);
  }
  throw new Error("CDP down");
}

const list = await getJson("/json/list");
const wsUrl = list.find((t) => t.type === "page").webSocketDebuggerUrl;
const ws = new WebSocket(wsUrl);
let id = 1;
const pending = new Map();
const events = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); return; }
  events.push(m);
};
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
const send = (method, params = {}) => new Promise((res, rej) => { const i = id++; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });

await send("Page.enable");
await send("Runtime.enable");
await send("Network.enable");
await send("Page.navigate", { url: URL });
await sleep(4500);

const evalJs = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true })).result.value;

console.log("URL now:", await evalJs("location.href"));
console.log("has SW:", await evalJs("navigator.serviceWorker.controller ? 'yes' : 'no'"));

// Override React's error handling to force a throw with component stack in dev-like detail:
// Also instrument: count React renders via a monkeypatch is hard in prod; instead track if page reloads.
let sawReload = false;
const netLog = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); return; }
  if (m.method === "Page.frameNavigated" && m.params.frame.parentId === undefined) {
    sawReload = true;
    netLog.push("FRAME NAVIGATED -> " + m.params.frame.url);
  }
  if (m.method === "Network.requestWillBeSent") netLog.push("REQ " + m.params.request.method + " " + m.params.request.url);
  events.push(m);
};

// Click the Strategy nav button
const clicked = await evalJs(`(() => {
  const btns = [...document.querySelectorAll('nav button')];
  const b = btns.find(x => (x.innerText||'').includes('Strategy'));
  if (!b) return 'no strategy button';
  b.click();
  return 'clicked ' + b.innerText;
})()`);
console.log("click:", clicked);
await sleep(3500);
console.log("URL after click:", await evalJs("location.href"));
console.log("saw reload:", sawReload);
console.log("body len:", (await evalJs("document.body ? document.body.innerText.length : -1")));
console.log("netLog tail:");
netLog.slice(-25).forEach((l) => console.log("  " + l));
ws.close();
chrome.kill();
