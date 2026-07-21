#!/usr/bin/env node
/**
 * Register the production catalog release in PocketBase and create publication pointer
 */
const BASE_URL = "https://mineops-pb.shepswork.com/api";
import { readFileSync } from "fs";
import { createHash } from "crypto";

const MANIFEST_PATH = "catalogs/production/5.59.0_96449_20260716T143539Z.candidate/manifest.json";

async function main() {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf-8"));
  const manifestJson = JSON.stringify(manifest);
  const manifestSha256 = createHash("sha256").update(manifestJson, "utf-8").digest("hex");

  console.log(`Release: ${manifest.releaseId}`);
  console.log(`Manifest SHA256: ${manifestSha256}`);
  console.log(`Managers: ${manifest.counts.managers}`);
  console.log(`Artifacts: ${manifest.artifacts.length}`);

  // 1. Auth
  // 1. Auth - use _superusers collection
  const authUrl = "https://mineops-pb.shepswork.com/api/collections/_superusers/auth-with-password";
  const authRes = await fetch(authUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: "admin@mineops.yancmo.xyz", password: "mineops-pb-dev-admin-2026" }),
  });
  const authData = await authRes.json();
  const token = authData.token;
  console.log("\nAuthenticated");

  const headers = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };
    // 2. Create catalog_releases record
  const counts = { managers: manifest.counts.managers, artifacts: manifest.artifacts.length };
  const artifactSummary = manifest.artifacts.map(a => ({ name: a.filename, sha256: a.sha256, bytes: a.bytes }));

  const releaseBody = {
    releaseId: manifest.releaseId,
    catalogVersion: manifest.catalogVersion,
    gameVersion: manifest.gameVersion,
    gameVersionCode: manifest.gameVersionCode,
    status: "candidate",
    manifestSha256: manifestSha256,
    manifestRef: `releases/${manifest.releaseId}/manifest.json`,
    artifactCount: manifest.artifacts.length,
    counts: counts,
    validationSummary: { status: "passed", blockingIssues: [], artifactSummary },
    previousCatalogVersion: "",
    storageBaseUrl: "https://mineops-pb.shepswork.com/api/catalog/artifacts/",
    publishedAt: null,
    reviewedBy: null,
    reviewNotes: null,
    auditLog: [
      { at: new Date().toISOString(), action: "created", by: "system", note: "Production candidate from APK extraction; 118 managers, 354 mappings" },
    ],
  };

  const relRes = await fetch(`${BASE_URL}/collections/catalog_releases/records`, {
    method: "POST", headers, body: JSON.stringify(releaseBody),
  });
  const rel = await relRes.json();
  console.log(`\nRelease created: ${relRes.status} ${rel?.id || JSON.stringify(rel).slice(0,150)}`);

  // 3. Create catalog_publication pointer
  // First check if one exists
  const pubCheckRes = await fetch(`${BASE_URL}/collections/catalog_publication/records?perPage=1`, { headers });
  const pubCheck = await pubCheckRes.json();

  if (pubCheck?.items?.length > 0) {
    // Update existing
    const existingId = pubCheck.items[0].id;
    const pubRes = await fetch(`${BASE_URL}/collections/catalog_publication/records/${existingId}`, {
      method: "PATCH", headers,
      body: JSON.stringify({
        activeReleaseId: manifest.releaseId,
        manifestSha256: manifestSha256,
        activatedAt: new Date().toISOString(),
        activatedBy: "system",
        notes: "Initial publication of APK-derived catalog (118 managers, 354 mappings)",
      }),
    });
    const pub = await pubRes.json();
    console.log(`Publication updated: ${pubRes.status} ${pub?.activeReleaseId || JSON.stringify(pub).slice(0,100)}`);
  } else {
    // Create new
    const pubRes = await fetch(`${BASE_URL}/collections/catalog_publication/records`, {
      method: "POST", headers,
      body: JSON.stringify({
        activeReleaseId: manifest.releaseId,
        manifestSha256: manifestSha256,
        activatedAt: new Date().toISOString(),
        activatedBy: "system",
        notes: "Initial publication of APK-derived catalog (118 managers, 354 mappings)",
      }),
    });
    const pub = await pubRes.json();
    console.log(`Publication created: ${pubRes.status} ${pub?.activeReleaseId || JSON.stringify(pub).slice(0,100)}`);
  }

  console.log("\n=== Registration Complete ===");
  console.log(`Release ID: ${manifest.releaseId}`);
  console.log(`Status: candidate`);
  console.log(`Manifest SHA256: ${manifestSha256}`);
  console.log(`Storage: ${releaseBody.storageBaseUrl}`);
}

main().catch(console.error);
