#!/usr/bin/env node
/**
 * Fix the manifest SHA256 in PocketBase publication record
 */
const AUTH_URL = "https://mineops-pb.shepswork.com/api/collections/_superusers/auth-with-password";
const BASE = "https://mineops-pb.shepswork.com/api";
const CREDS = { identity: "admin@mineops.yancmo.xyz", password: "mineops-pb-dev-admin-2026" };
const CORRECT_HASH = "407f039fa4cb93014c5e7e7a6bb46d294a0e607dbedc3668d73a77ab0a1d9aa7";

async function main() {
  const authRes = await fetch(AUTH_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(CREDS) });
  const auth = await authRes.json();
  const token = auth.token;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  console.log("Authenticated");

  // Fix catalog_publication
  const pubRes = await fetch(`${BASE}/collections/catalog_publication/records?perPage=1`, { headers });
  const pubData = await pubRes.json();
  const pub = pubData?.items?.[0];
  if (pub) {
    console.log(`Publication: manifestSha256=${pub.manifestSha256}`);
    const fixRes = await fetch(`${BASE}/collections/catalog_publication/records/${pub.id}`, {
      method: "PATCH", headers,
      body: JSON.stringify({ manifestSha256: CORRECT_HASH }),
    });
    const fixed = await fixRes.json();
    console.log(`Fixed: manifestSha256=${fixed.manifestSha256}`);
  }

  // Fix catalog_releases too
  const relRes = await fetch(`${BASE}/collections/catalog_releases/records?filter=releaseId%3D%225.59.0_96449_20260716T143539Z%22`, { headers });
  const relData = await relRes.json();
  const rel = relData?.items?.[0];
  if (rel) {
    console.log(`\nRelease: manifestSha256=${rel.manifestSha256}`);
    const fixRes = await fetch(`${BASE}/collections/catalog_releases/records/${rel.id}`, {
      method: "PATCH", headers,
      body: JSON.stringify({ manifestSha256: CORRECT_HASH }),
    });
    const fixed = await fixRes.json();
    console.log(`Fixed: manifestSha256=${fixed.manifestSha256}`);
  }

  // Verify
  console.log("\n=== Verification ===");
  const checkManifest = await fetch("https://mineops-pb.shepswork.com/api/catalog/artifacts?file=manifest.json");
  const manifestContent = await checkManifest.text();
  const { createHash } = await import("crypto");
  const actualHash = createHash("sha256").update(manifestContent, "utf-8").digest("hex");
  console.log(`Manifest SHA256: ${actualHash}`);
  console.log(`Stored in PB:    ${CORRECT_HASH}`);
  console.log(`Match: ${actualHash === CORRECT_HASH}`);
}

main().catch(console.error);
