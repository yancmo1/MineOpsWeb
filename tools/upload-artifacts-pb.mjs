#!/usr/bin/env node
/**
 * Upload catalog artifacts to PocketBase as file attachments.
 * Uses the built-in file serving API: /api/files/{collection}/{record}/{filename}
 */
import { readFileSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ARTIFACTS_DIR = resolve(ROOT, "catalogs/production/5.59.0_96449_20260716T143539Z.candidate");
const AUTH_URL = "https://mineops-pb.shepswork.com/api/collections/_superusers/auth-with-password";
const BASE = "https://mineops-pb.shepswork.com/api";
const CREDS = { identity: "admin@mineops.yancmo.xyz", password: "mineops-pb-dev-admin-2026" };

async function main() {
  // 1. Auth
  const authRes = await fetch(AUTH_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(CREDS) });
  const auth = await authRes.json();
  const token = auth.token;
  const headers = { "Authorization": `Bearer ${token}` };
  console.log("Authenticated\n");

  // 2. Create catalog_artifacts collection if it doesn't exist
  console.log("Creating catalog_artifacts collection...");
  const colRes = await fetch(`${BASE}/collections`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "catalog_artifacts",
      type: "base",
      listRule: "",
      viewRule: "",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: null,
      fields: [
        { name: "releaseId", type: "text", required: true, options: { max: 255 } },
        { name: "artifactName", type: "text", required: true, options: { max: 100 } },
        { name: "file", type: "file", required: true, options: { maxSize: 10485760, mimeTypes: ["application/json"] } },
        { name: "sha256", type: "text", required: true, options: { max: 64 } },
      ],
    }),
  });
  const col = await colRes.json();
  if (colRes.status === 200) {
    console.log(`  Collection: ${col.name || col.id}`);
  } else if (colRes.status === 400 && col.message?.includes("unique")) {
    console.log("  Collection already exists");
  } else {
    console.log(`  ${colRes.status}: ${JSON.stringify(col).slice(0,100)}`);
  }
  console.log();

  // 3. Upload each artifact file
  const files = readdirSync(ARTIFACTS_DIR).filter(f => f.endsWith(".json") && f !== "README.md");
  
  console.log(`Uploading ${files.length} artifacts...`);
  for (const filename of files) {
    const filePath = resolve(ARTIFACTS_DIR, filename);
    const content = readFileSync(filePath, "utf-8");
    
    // Create a FormData-like body
    const boundary = "----" + Math.random().toString(36).slice(2);
    const body = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="releaseId"`,
      ``,
      `5.59.0_96449_20260716T143539Z`,
      `--${boundary}`,
      `Content-Disposition: form-data; name="artifactName"`,
      ``,
      filename,
      `--${boundary}`,
      `Content-Disposition: form-data; name="sha256"`,
      ``,
      ``,
      `--${boundary}`,
      `Content-Disposition: form-data; name="file"; filename="${filename}"`,
      `Content-Type: application/json`,
      ``,
      content,
      `--${boundary}--`,
    ].join("\r\n");

    const uploadRes = await fetch(`${BASE}/collections/catalog_artifacts/records`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });
    const result = await uploadRes.json();
    if (uploadRes.status === 200) {
      console.log(`  ✓ ${filename} (${result.id})`);
    } else {
      console.log(`  ✗ ${filename}: ${uploadRes.status} ${JSON.stringify(result).slice(0,100)}`);
    }
  }

  console.log("\nDone. All artifacts uploaded.");

  // 4. Show the storage URL
  console.log("\n=== Storage URLs ===");
  const listRes = await fetch(`${BASE}/collections/catalog_artifacts/records?perPage=1`, { headers });
  const list = await listRes.json();
  const firstRecord = list?.items?.[0];
  if (firstRecord) {
    const collectionId = firstRecord.collectionId;
    const recordId = firstRecord.id;
    const storageBaseUrl = `${BASE}/files/${collectionId || "catalog_artifacts"}/${recordId}`;
    console.log(`storageBaseUrl: ${storageBaseUrl}/`);
    console.log(`manifest.json:  ${storageBaseUrl}/manifest.json`);
    console.log(`catalog-core:   ${storageBaseUrl}/catalog-core.json`);
  }
}

main().catch(console.error);
