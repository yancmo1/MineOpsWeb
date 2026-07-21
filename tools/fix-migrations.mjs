#!/usr/bin/env node
/**
 * Fix migration 1700000003_catalog_releases.js for PB v0.39.6 compatibility
 * and copy to /tmp/pb_fixed_migrations/
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_MIGRATIONS = resolve(ROOT, "pocketbase", "pb_migrations");
const TEMP_DIR = "/tmp/pb_fixed_migrations";

// Read migration 0003
const mig3 = readFileSync(resolve(LOCAL_MIGRATIONS, "1700000003_catalog_releases.js"), "utf-8");

// Fix: remove addIndex calls and pattern options
let fixed = mig3
  .replace(/^\s+collection\.addIndex\(.*\);$/gm, "")
  .replace(/pattern: "[^"]*",?\n\s*/g, "")
  .trim();

// Clean up trailing comma issues from removed options
fixed = fixed.replace(/,\s*\n\s*},?\s*\n\s*},/g, "\n    },\n  },");

// Remove empty lines left by replacement
fixed = fixed.replace(/\n{3,}/g, "\n\n");

mkdirSync(TEMP_DIR, { recursive: true });

const files = readdirSync(LOCAL_MIGRATIONS);
for (const f of files) {
  if (f === "1700000003_catalog_releases.js") {
    writeFileSync(resolve(TEMP_DIR, f), fixed);
    console.log(`  Fixed: ${f}`);
  } else {
    const content = readFileSync(resolve(LOCAL_MIGRATIONS, f), "utf-8");
    writeFileSync(resolve(TEMP_DIR, f), content);
    console.log(`  Copied: ${f}`);
  }
}

console.log(`\nDone. Files in ${TEMP_DIR}`);
