import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const file = process.argv[2];
if (!file) { console.error("Usage: npm run capture -- <payload.json> [--dry-run]"); process.exit(2); }
const bytes = await readFile(file);
const hash = createHash("sha256").update(bytes).digest("hex");
const metadata = { sourceType: "ubuntumac-adb", payloadHash: hash, payloadSize: bytes.byteLength, capturedAt: new Date().toISOString() };
if (process.argv.includes("--dry-run")) { console.log(JSON.stringify(metadata, null, 2)); process.exit(0); }
const endpoint = process.env.MINEOPS_CAPTURE_URL;
const token = process.env.MINEOPS_CAPTURE_TOKEN;
if (!endpoint || !token) throw new Error("MINEOPS_CAPTURE_URL and MINEOPS_CAPTURE_TOKEN are required");
const response = await fetch(endpoint, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "idempotency-key": hash }, body: JSON.stringify({ ...metadata, payload: JSON.parse(bytes.toString()) }) });
if (!response.ok) throw new Error(`Capture upload failed (${response.status})`);
console.log(JSON.stringify({ ...metadata, uploaded: true }));
