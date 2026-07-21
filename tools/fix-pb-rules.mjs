#!/usr/bin/env node
/**
 * Set PocketBase collection rules to public read
 * via the public mineops-pb.shepswork.com API
 */
const AUTH_URL = "https://mineops-pb.shepswork.com/api/collections/_superusers/auth-with-password";
const BASE = "https://mineops-pb.shepswork.com/api";
const CREDS = { identity: "admin@mineops.yancmo.xyz", password: "mineops-pb-dev-admin-2026" };

const COLLECTIONS = [
  "catalog_overrides",
  "catalog_publication",
  "catalog_releases",
  "catalog_reviews",
  "catalog_publication_events",
];

async function main() {
  // Auth
  const authRes = await fetch(AUTH_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(CREDS) });
  const auth = await authRes.json();
  const token = auth.token;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  console.log("Authenticated\n");

  for (const col of COLLECTIONS) {
    const res = await fetch(`${BASE}/collections/${col}`, { headers });
    const data = await res.json();
    console.log(`${col}: current listRule="${data.listRule}", viewRule="${data.viewRule}"`);

    // Update to public read
    const updateRes = await fetch(`${BASE}/collections/${col}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ listRule: "", viewRule: "" }),
    });
    const updated = await updateRes.json();
    if (updateRes.ok) {
      console.log(`  → listRule="${updated.listRule}", viewRule="${updated.viewRule}"`);
    } else {
      console.log(`  → FAILED: ${updateRes.status} ${JSON.stringify(updated).slice(0, 100)}`);
    }
  }

  // Verify public read works
  console.log("\n=== Verification ===");
  for (const col of COLLECTIONS) {
    const res = await fetch(`${BASE}/collections/${col}/records?perPage=1`);
    if (res.ok) {
      const data = await res.json();
      console.log(`  ✓ ${col}: ${data.totalItems || 0} records (public read OK)`);
    } else {
      console.log(`  ✗ ${col}: ${res.status} (public read FAILED)`);
    }
  }
}

main().catch(console.error);
