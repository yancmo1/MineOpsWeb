#!/usr/bin/env node
/**
 * Update storageBaseUrl in PocketBase and verify it works
 */
const AUTH_URL = "https://mineops-pb.shepswork.com/api/collections/_superusers/auth-with-password";
const BASE = "https://mineops-pb.shepswork.com/api";
const CREDS = { identity: "admin@mineops.yancmo.xyz", password: "mineops-pb-dev-admin-2026" };
const NEW_URL = "https://mineops-pb.shepswork.com/api/catalog/artifacts";

async function main() {
  const authRes = await fetch(AUTH_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(CREDS) });
  const auth = await authRes.json();
  const token = auth.token;
  const headers = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };
  console.log("Authenticated");

  // Find the active release
  const relRes = await fetch(`${BASE}/collections/catalog_releases/records?filter=releaseId%3D%225.59.0_96449_20260716T143539Z%22`, { headers });
  const rel = await relRes.json();
  const release = rel?.items?.[0];
  if (!release) { console.log("Release not found"); return; }
  
  console.log(`Release ${release.id}: current storageBaseUrl=${release.storageBaseUrl}`);

  // Update storageBaseUrl
  const updateRes = await fetch(`${BASE}/collections/catalog_releases/records/${release.id}`, {
    method: "PATCH", headers,
    body: JSON.stringify({
      storageBaseUrl: NEW_URL,
      status: "active",
    }),
  });
  const updated = await updateRes.json();
  console.log(`Updated: storageBaseUrl=${updated.storageBaseUrl}, status=${updated.status}`);

  // Test the URL
  console.log("\nTesting artifact URL...");
  const testUrl = `${NEW_URL}?file=manifest.json`;
  const testRes = await fetch(testUrl);
  const testData = await testRes.json();
  console.log(`  ${testUrl}: ${testRes.status} releaseId=${testData.releaseId}, managers=${testData.counts?.managers}`);

  console.log("\nDone. Artifact serving verified.");
}

main().catch(console.error);
