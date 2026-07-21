#!/usr/bin/env node
/**
 * Enable CORS on PocketBase - properly
 */
const AUTH_URL = "https://mineops-pb.shepswork.com/api/collections/_superusers/auth-with-password";
const BASE = "https://mineops-pb.shepswork.com/api";
const CREDS = { identity: "admin@mineops.yancmo.xyz", password: "mineops-pb-dev-admin-2026" };

async function main() {
  const authRes = await fetch(AUTH_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(CREDS) });
  const auth = await authRes.json();
  const token = auth.token;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  console.log("Authenticated\n");

  // 1. Read current full settings
  const getRes = await fetch(`${BASE}/settings`, { headers });
  const settings = await getRes.json();
  
  // Check what keys exist
  console.log("Settings keys:", Object.keys(settings));
  
  // 2. Set CORS with full object
  const corsSettings = {
    cors: {
      enabled: true,
      origins: ["*"],
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      headers: ["*"],
      maxAge: 86400,
    }
  };
  
  // Merge with existing settings
  const updated = { ...settings, ...corsSettings };
  
  const patchRes = await fetch(`${BASE}/settings`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(updated),
  });
  const result = await patchRes.json();
  
  console.log(`PATCH result: ${patchRes.status}`);
  console.log("Has 'cors' in result:", "cors" in result);
  if (result.cors) {
    console.log("CORS enabled:", result.cors.enabled);
    console.log("CORS origins:", result.cors.origins);
  }

  // 3. Verify by testing a request
  console.log("\nTesting CORS headers on artifact response:");
  const testRes = await fetch("https://mineops-pb.shepswork.com/api/catalog/artifacts?file=manifest.json");
  console.log("Status:", testRes.status);
  console.log("ACAO:", testRes.headers.get("access-control-allow-origin"));
  
  // 4. If still not working, try the settings object format that PB v0.39 uses
  if (!testRes.headers.get("access-control-allow-origin")) {
    console.log("\nTrying alternative CORS config format...");
    const altCors = {
      cors: {
        enabled: true,
        origins: ["*"],
      }
    };
    const altRes = await fetch(`${BASE}/settings`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(altCors),
    });
    const altResult = await altRes.json();
    console.log("Alt PATCH result:", altRes.status);
    console.log("CORS enabled:", altResult?.cors?.enabled);
    
    // Check again
    const checkRes = await fetch("https://mineops-pb.shepswork.com/api/catalog/artifacts?file=manifest.json");
    console.log("ACAO after alt:", checkRes.headers.get("access-control-allow-origin"));
  }
}

main().catch(console.error);
