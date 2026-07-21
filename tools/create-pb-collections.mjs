#!/usr/bin/env node
/**
 * Create catalog collections in PocketBase via API
 * Bypasses broken migration system
 */
const BASE_URL = "https://mineops-pb.shepswork.com/api";

async function main() {
  // 1. Auth
  const authRes = await fetch("https://mineops-pb.shepswork.com/api/collections/_superusers/auth-with-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: "admin@mineops.yancmo.xyz", password: "mineops-pb-dev-admin-2026" }),
  });
  const authData = await authRes.json();
  const token = authData.token;
  console.log("Authenticated as superuser");

  const headers = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };

  // 2. Create catalog_publication (singleton)
  const pubColRes = await fetch(`${BASE_URL}/collections`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "catalog_publication",
      type: "base",
      listRule: "",
      viewRule: "",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: null,
      fields: [
        { name: "activeReleaseId", type: "text", required: true, options: { min: 1, max: 255 } },
        { name: "previousReleaseId", type: "text", required: false, options: { max: 255 } },
        { name: "manifestSha256", type: "text", required: true, options: { min: 64, max: 64 } },
        { name: "activatedAt", type: "date", required: true },
        { name: "activatedBy", type: "text", required: false, options: { max: 255 } },
        { name: "notes", type: "text", required: false, options: { max: 1000 } },
      ],
    }),
  });
  const pubCol = await pubColRes.json();
  console.log(`catalog_publication: ${pubColRes.status} ${pubCol?.name || JSON.stringify(pubCol).slice(0,100)}`);

  // 3. Create catalog_reviews
  const revColRes = await fetch(`${BASE_URL}/collections`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "catalog_reviews",
      type: "base",
      listRule: "",
      viewRule: "",
      createRule: "@request.auth.id != ''",
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: "releaseId", type: "text", required: true, options: { min: 1, max: 255 } },
        { name: "decision", type: "text", required: true, options: { min: 1, max: 50 } },
        { name: "manifestHash", type: "text", required: true, options: { min: 64, max: 64 } },
        { name: "validationReportHash", type: "text", required: false, options: { min: 64, max: 64 } },
        { name: "reviewEngineVersion", type: "text", required: false, options: { max: 50 } },
        { name: "reviewedBy", type: "text", required: true, options: { max: 255 } },
        { name: "isLatest", type: "bool", required: false },
        { name: "notes", type: "text", required: false, options: { max: 2000 } },
      ],
    }),
  });
  const revCol = await revColRes.json();
  console.log(`catalog_reviews: ${revColRes.status} ${revCol?.name || JSON.stringify(revCol).slice(0,100)}`);

  // 4. Create catalog_publication_events (append-only audit)
  const evtColRes = await fetch(`${BASE_URL}/collections`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "catalog_publication_events",
      type: "base",
      listRule: "",
      viewRule: "",
      createRule: null, // Only server-side hooks write
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: "action", type: "text", required: true, options: { min: 1, max: 50 } },
        { name: "fromReleaseId", type: "text", required: false, options: { max: 255 } },
        { name: "toReleaseId", type: "text", required: true, options: { min: 1, max: 255 } },
        { name: "manifestSha256", type: "text", required: true, options: { min: 64, max: 64 } },
        { name: "performedBy", type: "text", required: true, options: { max: 255 } },
        { name: "notes", type: "text", required: false, options: { max: 2000 } },
      ],
    }),
  });
  const evtCol = await evtColRes.json();
  console.log(`catalog_publication_events: ${evtColRes.status} ${evtCol?.name || JSON.stringify(evtCol).slice(0,100)}`);

  // 5. Create catalog_overrides
  const ovrColRes = await fetch(`${BASE_URL}/collections`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "catalog_overrides",
      type: "base",
      listRule: "",
      viewRule: "",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: "releaseId", type: "text", required: true, options: { max: 255 } },
        { name: "sourceKind", type: "text", required: true, options: { min: 1, max: 50 } },
        { name: "sourceValue", type: "text", required: true, options: { min: 1, max: 255 } },
        { name: "canonicalId", type: "text", required: true, options: { min: 1, max: 255 } },
        { name: "confidence", type: "text", required: false, options: { max: 50 } },
        { name: "reason", type: "text", required: false, options: { max: 500 } },
        { name: "createdBy", type: "text", required: true, options: { max: 255 } },
        { name: "isActive", type: "bool", required: false },
      ],
    }),
  });
  const ovrCol = await ovrColRes.json();
  console.log(`catalog_overrides: ${ovrColRes.status} ${ovrCol?.name || JSON.stringify(ovrCol).slice(0,100)}`);

  console.log("\nDone. All catalog collections created.");
}

main().catch(console.error);
