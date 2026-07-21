#!/usr/bin/env node
/**
 * Fix the test fixture mappings.json to include proper kind fields
 * and add kolibri_id mappings for all 118 managers
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE_DIR = resolve(ROOT, "frontend", "public", "catalog", "test-fixture");
const CORE_PATH = resolve(FIXTURE_DIR, "catalog-core.json");
const MAPPINGS_PATH = resolve(FIXTURE_DIR, "mappings.json");

const core = JSON.parse(readFileSync(CORE_PATH, "utf-8"));
const mappings = JSON.parse(readFileSync(MAPPINGS_PATH, "utf-8"));

const managers = core.managers || [];
console.log(`Loaded ${managers.length} managers`);

// Fix existing mappings - set proper kind field
const fixedMappings = (mappings.idMappings || []).map((m) => {
  // Determine the kind from the source field (which has the correct value)
  const src = m.source || "";
  let kind = m.kind || "?";
  
  // Fix unidentified kinds
  if (kind === "?") {
    if (src === "apk_superManagerId") kind = "apk_superManagerId";
    else if (src === "apk_nameKey") kind = "apk_nameKey";
    else kind = src;
  }
  
  return {
    ...m,
    kind,
    // Normalize sourceValue
    sourceValue: m.sourceValue || String(m.sourceId || ""),
  };
});

// Track which superManagerIds already have kolibri_id mappings
const hasKolibriId = new Set(
  fixedMappings
    .filter((m) => m.kind === "kolibri_id")
    .map((m) => m.sourceValue)
);

// Add kolibri_id mappings for managers that don't have one yet
let added = 0;
for (const m of managers) {
  const smId = String(m.extensions?.superManagerId ?? "");
  const cid = m.canonicalId || m.id;
  if (smId && cid && !hasKolibriId.has(smId)) {
    fixedMappings.push({
      canonicalId: cid,
      kind: "kolibri_id",
      sourceValue: smId,
      confidence: "verified",
      extensions: { note: "APK superManagerId maps to Kolibri API Id" },
    });
    added++;
  }
}

// Update the mappings object
mappings.idMappings = fixedMappings;

writeFileSync(MAPPINGS_PATH, JSON.stringify(mappings, null, 2) + "\n", "utf-8");

// Report
const kinds = {};
for (const m of fixedMappings) {
  kinds[m.kind] = (kinds[m.kind] || 0) + 1;
}

console.log(`\nFixed ${fixedMappings.length} mappings:`);
for (const [kind, count] of Object.entries(kinds)) {
  console.log(`  ${kind}: ${count}`);
}
console.log(`\nAdded ${added} new kolibri_id mappings`);
console.log("Done. Test fixture mappings.json updated.");
