// CDP smoke driver for MineOpsWeb — reproduces the reported crash on /strategy and /more
// Usage: node tools/cdp-smoke.mjs [url]
const url = process.argv[2] || "http://localhost:8080/";

const CHROME = process.env.CHROME_BIN || process.env.HOME + "/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const { spawn } = await import("node:child_process");
const fs = await import("node:fs");
const os = await import("node:os");
const path = await import("node:path");

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "mineops-cdp-"));
const port = 9333 + Math.floor(Math.random() * 500);

const chrome = spawn(CHROME, [
  "--headless=new",
  "--no-sandbox",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  "--disable-software-rasterizer",
  "--no-first-run",
  "--no-default-browser-check",
  `--remote-debugging-port=${port}`,
  "--remote-allow-origins=*",
  `--user-data-dir=${userDataDir}`,
  "--window-size=420,900",
  "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });
chrome.stderr.on("data", () => { /* drain */ });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(pathname) {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}${pathname}`);
      if (res.ok) return await res.json();
    } catch { /* not up yet */ }
    await sleep(200);
  }
  throw new Error("CDP endpoint never came up");
}

async function main() {
  const list = await getJson("/json/list");
  const pageTarget = list.find((t) => t.type === "page");
  if (!pageTarget) throw new Error("no page target");
  const wsUrl = pageTarget.webSocketDebuggerUrl;

  let nextId = 1;
  const pending = new Map();
  const ws = new WebSocket(wsUrl);
  const events = [];
  const consoleLogs = [];
  const pageErrors = [];

  function send(method, params = {}) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
      return;
    }
    if (msg.method === "Runtime.consoleAPICalled") {
      const text = msg.params.args.map((a) => a.value ?? a.description ?? "").join(" ");
      consoleLogs.push(`[console:${msg.params.type}] ${text}`);
    }
    if (msg.method === "Runtime.exceptionThrown") {
      const d = msg.params.exceptionDetails;
      pageErrors.push(`[pageerror] ${d.text} ${d.exception?.description ?? ""}`);
    }
    if (msg.method === "Log.entryAdded") {
      events.push(`[log:${msg.params.entry.level}] ${msg.params.entry.text}`);
    }
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Network.enable");

  const tabTitles = ["Overview", "Strategy", "More"];

  async function navigate(target) {
    consoleLogs.length = 0;
    pageErrors.length = 0;
    await send("Page.navigate", { url: target });
    // wait for load + a bit of catalog settling
    await sleep(4000);
    const doc = await send("Runtime.evaluate", {
      expression: "document.body ? document.body.innerText.slice(0, 1500) : ''",
      returnByValue: true,
    });
    const title = await send("Runtime.evaluate", {
      expression: "document.title",
      returnByValue: true,
    });
    return { title: title.result.value, body: doc.result.value };
  }

  async function clickNav(label) {
    await send("Runtime.evaluate", {
      expression: `
        (() => {
          const btns = [...document.querySelectorAll('nav button')];
          const btn = btns.find(b => (b.innerText || '').includes(${JSON.stringify(label)}));
          if (!btn) return false;
          btn.click();
          return true;
        })()
      `,
      returnByValue: true,
    });
    await sleep(3000);
  }

  console.log("=== navigating to", url, "===");
  const initial = await navigate(url);
  console.log("TITLE:", initial.title);
  console.log("BODY(first 800):", initial.body.slice(0, 800).replace(/\n+/g, " | "));
  console.log("--- console logs (first load) ---");
  consoleLogs.slice(0, 60).forEach((l) => console.log(l));
  console.log("--- page errors (first load) ---");
  pageErrors.forEach((l) => console.log(l));

  console.log("\n=== clicking Strategy tab ===");
  await clickNav("Strategy");
  await sleep(2500);
  const docS = await send("Runtime.evaluate", { expression: "document.body.innerText.slice(0, 1200)", returnByValue: true });
  console.log("BODY:", docS.result.value.replace(/\n+/g, " | "));
  console.log("--- console logs (strategy) ---");
  consoleLogs.slice(0, 30).forEach((l) => console.log(l));
  console.log("--- page errors (strategy) ---");
  pageErrors.forEach((l) => console.log(l));
  console.log("STRATEGY RENDER OK:", (docS.result.value || "").length > 50);

  console.log("\n=== clicking More tab ===");
  await clickNav("More");
  await sleep(2500);
  const docM = await send("Runtime.evaluate", { expression: "document.body.innerText.slice(0, 1200)", returnByValue: true });
  console.log("BODY:", docM.result.value.replace(/\n+/g, " | "));
  console.log("--- console logs (more) ---");
  consoleLogs.slice(0, 30).forEach((l) => console.log(l));
  console.log("--- page errors (more) ---");
  pageErrors.forEach((l) => console.log(l));
  console.log("MORE RENDER OK:", (docM.result.value || "").length > 50);

  ws.close();
  chrome.kill();
}

main().catch((e) => { console.error("SMOKE FAILED:", e); chrome.kill(); process.exit(1); });
