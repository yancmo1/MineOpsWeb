#!/usr/bin/env node

/**
 * MineOps Catalog Publication CLI
 *
 * Commands for publishing and rolling back catalog releases.
 * Targets a PocketBase instance; requires auth token.
 *
 * Usage:
 *   node tools/validation/publish-release.mjs publish <releaseId> <manifestHash> [--url <pb-url>] [--token <auth-token>]
 *   node tools/validation/publish-release.mjs rollback [targetReleaseId] [--url <pb-url>] [--token <auth-token>]
 *   node tools/validation/publish-release.mjs status [--url <pb-url>]
 */

import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const PB_URL = process.env.MINEOPS_PB_URL || "http://127.0.0.1:8090";
const AUTH_TOKEN = process.env.MINEOPS_AUTH_TOKEN || "";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function parseArgs(args) {
  const result = { command: null, positional: [], url: PB_URL, token: AUTH_TOKEN, json: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--url" && i + 1 < args.length) {
      result.url = args[++i];
    } else if (arg === "--token" && i + 1 < args.length) {
      result.token = args[++i];
    } else if (arg === "--json") {
      result.json = true;
    } else if (!result.command) {
      result.command = arg;
    } else {
      result.positional.push(arg);
    }
  }
  return result;
}

async function apiCall(method, path, body = null, opts = {}) {
  const headers = { "Content-Type": "application/json" };
  if (opts.token) {
    headers["Authorization"] = "Bearer " + opts.token;
  }
  // If using PB cookie auth instead, set Cookie header
  if (opts.cookie) {
    headers["Cookie"] = opts.cookie;
  }

  const fetchOpts = { method, headers };
  if (body) {
    fetchOpts.body = JSON.stringify(body);
  }

  const url = (opts.url || PB_URL).replace(/\/$/, "") + path;
  const response = await fetch(url, fetchOpts);
  const data = await response.json();

  return { status: response.status, data };
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------
async function cmdPublish(opts) {
  const releaseId = opts.positional[0];
  const manifestHash = opts.positional[1];

  if (!releaseId || !manifestHash) {
    console.error("Usage: publish-release.mjs publish <releaseId> <manifestHash> [--url <url>] [--token <token>]");
    console.error("");
    console.error("  releaseId     — The release to publish (must be in 'ready' status)");
    console.error("  manifestHash  — SHA-256 of the release's manifest.json");
    process.exit(1);
  }

  if (!/^[a-f0-9]{64}$/.test(manifestHash)) {
    console.error("ERROR: manifestHash must be a 64-char SHA-256 hex string.");
    process.exit(1);
  }

  console.error(`Publishing ${releaseId} ...`);
  const { status, data } = await apiCall("POST", "/api/catalog/publish", {
    releaseId,
    manifestHash,
    notes: "Published via CLI.",
  }, opts);

  if (opts.json) {
    console.log(JSON.stringify({ status, ...data }, null, 2));
  } else if (data.success) {
    console.log(`✅ Published: ${data.releaseId}`);
    console.log(`   Previous active: ${data.previousActiveReleaseId || "none"}`);
    console.log(`   Published by: ${data.publishedBy}`);
    console.log(`   Published at: ${data.publishedAt}`);
  } else {
    console.error(`❌ Publish failed (${status}): ${data.error}`);
    console.error(`   Code: ${data.code}`);
  }

  process.exit(data.success ? 0 : 1);
}

async function cmdRollback(opts) {
  const targetReleaseId = opts.positional[0] || null;

  console.error(targetReleaseId ? `Rolling back to ${targetReleaseId} ...` : "Rolling back to previous release ...");
  const body = { notes: "Rolled back via CLI." };
  if (targetReleaseId) {
    body.targetReleaseId = targetReleaseId;
  }

  const { status, data } = await apiCall("POST", "/api/catalog/rollback", body, opts);

  if (opts.json) {
    console.log(JSON.stringify({ status, ...data }, null, 2));
  } else if (data.success) {
    console.log(`✅ Rolled back:`);
    console.log(`   From: ${data.rolledBackFrom || "none"}`);
    console.log(`   To: ${data.rolledBackTo}`);
    console.log(`   By: ${data.rolledBackBy}`);
    console.log(`   At: ${data.rolledBackAt}`);
  } else {
    console.error(`❌ Rollback failed (${status}): ${data.error}`);
    console.error(`   Code: ${data.code}`);
  }

  process.exit(data.success ? 0 : 1);
}

async function cmdStatus(opts) {
  console.error("Fetching publication status ...");
  const { status, data } = await apiCall("GET", "/api/collections/catalog_publication/records?perPage=1", null, opts);

  if (opts.json) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  if (data.items && data.items.length > 0) {
    const pub = data.items[0];
    console.log("📋 Publication Status");
    console.log(`   Active release: ${pub.activeReleaseId || "(none)"}`);
    console.log(`   Previous release: ${pub.previousReleaseId || "(none)"}`);
    console.log(`   Manifest hash: ${pub.manifestSha256 || "(none)"}`);
    console.log(`   Activated by: ${pub.activatedBy || "(none)"}`);
    console.log(`   Activated at: ${pub.activatedAt || "(never)"}`);
    if (pub.notes) {
      console.log(`   Notes: ${pub.notes}`);
    }
  } else {
    console.log("📋 No publication record exists yet.");
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (!opts.command || opts.command === "help" || opts.command === "--help") {
    console.log("MineOps Catalog Publication CLI");
    console.log("");
    console.log("Usage:");
    console.log("  node tools/validation/publish-release.mjs <command> [options]");
    console.log("");
    console.log("Commands:");
    console.log("  publish <releaseId> <manifestHash>  Activate a reviewed release");
    console.log("  rollback [targetReleaseId]         Roll back to previous (or specified) release");
    console.log("  status                             Show current publication state");
    console.log("");
    console.log("Options:");
    console.log("  --url   <url>    PocketBase URL (default: $MINEOPS_PB_URL or http://127.0.0.1:8090)");
    console.log("  --token <token>  Auth token (default: $MINEOPS_AUTH_TOKEN)");
    console.log("  --json           Output raw JSON");
    console.log("");
    console.log("Environment:");
    console.log("  MINEOPS_PB_URL      PocketBase base URL");
    console.log("  MINEOPS_AUTH_TOKEN  Bearer token for authenticated requests");
    process.exit(0);
  }

  try {
    switch (opts.command) {
      case "publish":
        await cmdPublish(opts);
        break;
      case "rollback":
        await cmdRollback(opts);
        break;
      case "status":
        await cmdStatus(opts);
        break;
      default:
        console.error(`Unknown command: ${opts.command}`);
        process.exit(1);
    }
  } catch (err) {
    console.error(`FATAL: ${err.message}`);
    process.exit(2);
  }
}

main();
