#!/usr/bin/env node
/**
 * Update manifest SHA256 in PB to match what the server actually serves
 */
const AUTH_URL = "https://mineops-pb.shepswork.com/api/collections/_superusers/auth-with-password";
const BASE = "https://mineops-pb.shepswork.com/api";
const CREDS = { identity: "admin@mineops.yancmo.xyz", password: "mineops-pb-dev-admin-2026" };
const CORRECT_HASH = "82be6a0889d430283af711834f3c0e1a4a00eb81af571adac9ace5231c5cd093";

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
    await fetch(`${BASE}/collections/catalog_publication/records/${pub.id}`, {
      method: "PATCH", headers,
      body: JSON.stringify({ manifestSha256: CORRECT_HASH }),
    });
    console.log("Publication updated");
  }

  // Fix catalog_releases
  const relRes = await fetch(`${BASE}/collections/catalog_releases/records?filter=releaseId%3D%225.59.0_96449_20260716T143539Z%22`, { headers });
  const relData = await relRes.json();
  const rel = relData?.items?.[0];
  if (rel) {
    await fetch(`${BASE}/collections/catalog_releases/records/${rel.id}`, {
      method: "PATCH", headers,
      body: JSON.stringify({ manifestSha256: CORRECT_HASH }),
    });
    console.log("Release updated");
  }

  // Verify
  const check = await fetch("https://mineops-pb.shepswork.com/api/catalog/artifacts?file=manifest.json");
  const content = await check.text();
  const { createHash } = await import("crypto");
  const hash = createHash("sha256").update(content, "utf-8").digest("hex");
  console.log(`\nManifest SHA256: ${hash}`);
  console.log(`PB stored:       ${CORRECT_HASH}`);
  console.log(`Match: ${hash === CORRECT_HASH}`);
}

main().catch(console.error);
