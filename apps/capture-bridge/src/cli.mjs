#!/usr/bin/env node

/**
 * MineOps Capture Bridge CLI
 *
 * Uploads APK extraction payloads (release.json + manifest + objects) from
 * ubuntumac to the MineOps PocketBase capture-ingest endpoint.
 *
 * Usage:
 *   node src/cli.mjs <payload.json>              # single file upload
 *   node src/cli.mjs <payload.json> --dry-run    # validate without sending
 *   node src/cli.mjs --inbox <dir>               # process inbox directory
 *   node src/cli.mjs --inbox <dir> --dry-run     # validate inbox files
 *   node src/cli.mjs --status                    # verify API wiring
 *   node src/cli.mjs --help                      # show help
 *
 * Environment:
 *   MINEOPS_CAPTURE_URL   – PocketBase capture ingest endpoint
 *   MINEOPS_CAPTURE_TOKEN – bearer token for capture client auth
 *
 * Exit codes:
 *   0  Success
 *   1  Runtime error
 *   2  Usage error
 *   14 No change / duplicate release (server returned 409)
 */

import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";

// ─── Help text ─────────────────────────────────────────────────────────────

const HELP = `
MineOps Capture Bridge — upload extraction payloads to MineOps PocketBase

Usage:
  node src/cli.mjs <payload.json>              Upload a single payload file
  node src/cli.mjs <payload.json> --dry-run    Validate only (no upload)
  node src/cli.mjs --inbox <directory>         Upload all payloads in a dir
  node src/cli.mjs --inbox <directory> --dry-run
  node src/cli.mjs --status                    Validate endpoint + show latest ingests
  node src/cli.mjs --help                      Show this help

Environment:
  MINEOPS_CAPTURE_URL    Required. PocketBase ingest endpoint.
  MINEOPS_CAPTURE_TOKEN  Required. Bearer token for capture client auth.

Payload format:
  A JSON file conforming to release.schema.json with optional:
    - manifest  (extraction manifest per extraction_manifest.schema.json)
    - objects   (array of canonical objects per canonical_object.schema.json)
    - summary   (human-readable summary)

Exit codes:
  0   Success
  1   Runtime error
  2   Usage error
  14  Duplicate / no-change release (server returned 409)
`;

// ─── Args ──────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(HELP);
    process.exit(0);
  }

  const dryRun = args.includes("--dry-run");
  const status = args.includes("--status");
  const inboxIndex = args.indexOf("--inbox");

  if (status) {
    return { mode: "status" };
  }

  if (inboxIndex !== -1) {
    const dir = args[inboxIndex + 1];
    if (!dir) {
      console.error("Usage: node src/cli.mjs --inbox <directory> [--dry-run]");
      process.exit(2);
    }
    return { mode: "inbox", dir: resolve(dir), dryRun };
  }

  const file = args.find((a) => !a.startsWith("--"));
  if (!file) {
    console.error("Usage: node src/cli.mjs <payload.json> [--dry-run]");
    console.error("   or: node src/cli.mjs --inbox <directory> [--dry-run]");
    process.exit(2);
  }
  return { mode: "file", file: resolve(file), dryRun };
}

function inferPocketBaseBaseUrl(ingestUrl) {
  if (!ingestUrl) return null;
  try {
    const parsed = new URL(ingestUrl);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

async function checkStatus() {
  const endpoint = process.env.MINEOPS_CAPTURE_URL;
  const token = process.env.MINEOPS_CAPTURE_TOKEN;

  if (!endpoint) {
    console.error("[capture-bridge] ERROR: MINEOPS_CAPTURE_URL is not set");
    process.exit(2);
  }
  if (!token) {
    console.error("[capture-bridge] ERROR: MINEOPS_CAPTURE_TOKEN is not set");
    process.exit(2);
  }

  const base = inferPocketBaseBaseUrl(endpoint);
  if (!base) {
    console.error("[capture-bridge] ERROR: MINEOPS_CAPTURE_URL is not a valid URL");
    process.exit(2);
  }

  const output = {
    endpoint,
    pocketBaseBaseUrl: base,
    checks: {
      health: { ok: false },
      ingestAuth: { ok: false },
      catalogRead: { ok: false },
    },
  };

  try {
    const healthResp = await fetch(`${base}/api/health`);
    output.checks.health = {
      ok: healthResp.ok,
      status: healthResp.status,
    };
  } catch (err) {
    output.checks.health = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  try {
    const ingestProbe = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ releaseId: "status_probe" }),
    });

    // For a probe payload missing required fields, auth success should return 400,
    // while bad auth should return 401.
    output.checks.ingestAuth = {
      ok: ingestProbe.status !== 401,
      status: ingestProbe.status,
    };
  } catch (err) {
    output.checks.ingestAuth = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  try {
    const catalogResp = await fetch(`${base}/api/collections/catalog_versions/records?perPage=5`);
    if (catalogResp.ok) {
      const data = await catalogResp.json();
      output.checks.catalogRead = {
        ok: true,
        status: catalogResp.status,
        totalItems: data.totalItems ?? null,
        latest: Array.isArray(data.items)
          ? data.items.slice(0, 3).map((item) => ({
              version: item.version,
              source: item.source,
              recordCount: item.recordCount,
            }))
          : [],
      };
    } else {
      output.checks.catalogRead = {
        ok: false,
        status: catalogResp.status,
      };
    }
  } catch (err) {
    output.checks.catalogRead = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  console.log(JSON.stringify(output, null, 2));

  if (!output.checks.health.ok || !output.checks.ingestAuth.ok) {
    process.exit(1);
  }
}

// ─── Validation ────────────────────────────────────────────────────────────

const REQUIRED_FIELDS = [
  "releaseId", "versionName", "versionCode", "capturedAt",
  "engineVersion", "schemaVersion", "apkHashes", "status",
];

function validatePayload(obj) {
  const missing = REQUIRED_FIELDS.filter(
    (f) => obj[f] === undefined || obj[f] === null,
  );
  if (missing.length > 0) return `Missing required fields: ${missing.join(", ")}`;
  if (typeof obj.releaseId !== "string" || obj.releaseId.length < 1)
    return "releaseId must be a non-empty string";
  if (typeof obj.versionCode !== "number" || obj.versionCode < 1)
    return "versionCode must be a positive integer";
  if (typeof obj.apkHashes !== "object" || Object.keys(obj.apkHashes).length === 0)
    return "apkHashes must be a non-empty object";
  const validStatuses = ["acquired", "processed", "published", "failed"];
  if (!validStatuses.includes(obj.status))
    return `status must be one of: ${validStatuses.join(", ")}`;
  return null;
}

// ─── Upload ────────────────────────────────────────────────────────────────

async function uploadPayload(filePath, dryRun) {
  const bytes = await readFile(filePath);
  const hash = createHash("sha256").update(bytes).digest("hex");

  let payload;
  try { payload = JSON.parse(bytes.toString()); } catch (err) {
    return { ok: false, error: `Invalid JSON: ${err.message}`, file: filePath };
  }

  const validationError = validatePayload(payload);
  if (validationError) {
    return { ok: false, error: validationError, file: filePath };
  }

  const sizeKb = (bytes.byteLength / 1024).toFixed(1);

  if (dryRun) {
    console.log(JSON.stringify({
      mode: "dry-run", file: filePath, sizeKb: `${sizeKb} KB`,
      sha256: hash, releaseId: payload.releaseId,
      versionName: payload.versionName, versionCode: payload.versionCode,
      objectCount: Array.isArray(payload.objects) ? payload.objects.length : 0,
      hasManifest: payload.manifest ? "yes" : "no",
      apkCount: Object.keys(payload.apkHashes).length,
    }, null, 2));
    return { ok: true, dryRun: true, file: filePath };
  }

  const endpoint = process.env.MINEOPS_CAPTURE_URL;
  const token = process.env.MINEOPS_CAPTURE_TOKEN;

  if (!endpoint) return { ok: false, error: "MINEOPS_CAPTURE_URL is not set", file: filePath };
  if (!token) return { ok: false, error: "MINEOPS_CAPTURE_TOKEN is not set", file: filePath };

  console.error(`[capture-bridge] Uploading ${filePath} (${sizeKb} KB) to ${endpoint} …`);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": hash,
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => null);

  if (response.status === 409) {
    console.error(`[capture-bridge] Duplicate release: ${body?.existingId ?? "unknown"}`);
    return { ok: true, duplicate: true, file: filePath, existingId: body?.existingId };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: `Server returned ${response.status}: ${body?.error ?? response.statusText}`,
      file: filePath,
    };
  }

  console.log(JSON.stringify({
    mode: "upload", file: filePath,
    releaseId: body.releaseId,
    rawImportId: body.rawImportId,
    catalogVersionId: body.catalogVersionId,
    status: "accepted",
  }, null, 2));

  return { ok: true, file: filePath };
}

// ─── Inbox mode ────────────────────────────────────────────────────────────

async function processInbox(dir, dryRun) {
  if (!existsSync(dir)) {
    console.error(`[capture-bridge] Inbox directory does not exist: ${dir}`);
    process.exit(1);
  }

  const files = (await readdir(dir))
    .filter((f) => f.endsWith(".json"))
    .map((f) => join(dir, f))
    .sort();

  if (files.length === 0) {
    console.error(`[capture-bridge] No JSON files found in ${dir}`);
    process.exit(0);
  }

  console.error(`[capture-bridge] Found ${files.length} payload file(s) in ${dir}\n`);

  let success = 0, failed = 0, duplicates = 0;

  for (const file of files) {
    const result = await uploadPayload(file, dryRun);
    if (result.ok) {
      if (result.duplicate) duplicates++;
      else success++;
    } else {
      failed++;
      console.error(`[capture-bridge] FAILED: ${result.file} — ${result.error}`);
    }
  }

  const mode = dryRun ? "DRY RUN" : "UPLOAD";
  console.error(`\n[capture-bridge] ${mode} complete: ${success} ok, ${duplicates} dupes, ${failed} failed`);
}

// ─── Entry ─────────────────────────────────────────────────────────────────

async function main() {
  const config = parseArgs();

  if (config.mode === "status") {
    await checkStatus();
    return;
  }

  if (config.mode === "inbox") {
    await processInbox(config.dir, config.dryRun);
  } else {
    const result = await uploadPayload(config.file, config.dryRun);
    if (!result.ok) {
      console.error(`[capture-bridge] ERROR: ${result.error}`);
      process.exit(result.status ?? 1);
    }
    if (result.duplicate) process.exit(14);
  }
}

main().catch((err) => {
  console.error("[capture-bridge] Fatal:", err.message);
  process.exit(1);
});
