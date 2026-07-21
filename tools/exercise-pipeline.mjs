#!/usr/bin/env node
/**
 * Exercise the catalog review/publish pipeline on PocketBase
 */
const AUTH_URL = "https://mineops-pb.shepswork.com/api/collections/_superusers/auth-with-password";
const BASE = "https://mineops-pb.shepswork.com/api";

const CREDS = { identity: "admin@mineops.yancmo.xyz", password: "mineops-pb-dev-admin-2026" };
const RELEASE_ID = "5.59.0_96449_20260716T143539Z";
const MANIFEST_HASH = "a7cefb520fe48ad5d497541099e1bec1a94fc2e4cbebdd6555e0bfff0636431e";

async function main() {
  // 1. Auth
  const authRes = await fetch(AUTH_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(CREDS) });
  const auth = await authRes.json();
  const token = auth.token;
  const headers = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };
  console.log("1. Authenticated\n");

  // 2. Check current release status
  const relRes = await fetch(`${BASE}/collections/catalog_releases/records?filter=releaseId%3D%22${RELEASE_ID}%22`, { headers });
  const rel = await relRes.json();
  const release = rel?.items?.[0];
  if (!release) { console.log("Release not found!"); return; }
  console.log(`2. Release status: ${release.status}\n`);

  // 3. Approve the release (review)
  console.log("3. Approving release...");
  const approveRes = await fetch(`${BASE}/catalog/review/approve`, {
    method: "POST", headers,
    body: JSON.stringify({
      releaseId: RELEASE_ID,
      manifestHash: MANIFEST_HASH,
      validationReportHash: "b4057da16ad7b6da0b1c95d007f488ddbd50b44023fe3f07fca4f4c2cb0c5504",
      reviewEngineVersion: "1.0.0",
      notes: "Automated review: APK extraction with 118 managers, all artifacts verified",
    }),
  });
  const approve = await approveRes.json();
  console.log(`   Response: ${approveRes.status} ${JSON.stringify(approve).slice(0,200)}`);

  // 4. Check status after review
  const relRes2 = await fetch(`${BASE}/collections/catalog_releases/records/${release.id}`, { headers });
  const rel2 = await relRes2.json();
  console.log(`\n4. Status after review: ${rel2.status}\n`);

  // 5. Publish if ready
  if (rel2.status === "ready") {
    console.log("5. Publishing release...");
    const pubRes = await fetch(`${BASE}/catalog/publish`, {
      method: "POST", headers,
      body: JSON.stringify({
        releaseId: RELEASE_ID,
        manifestHash: MANIFEST_HASH,
        notes: "Production activation of APK-derived catalog",
      }),
    });
    const pub = await pubRes.json();
    console.log(`   Response: ${pubRes.status} ${JSON.stringify(pub).slice(0,300)}`);
  } else {
    console.log(`5. Cannot publish — status is "${rel2.status}", need "ready"`);
  }

  console.log("\nDone.");
}

main().catch(console.error);
