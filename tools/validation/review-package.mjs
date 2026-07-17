#!/usr/bin/env node

/**
 * MineOps Catalog Review CLI
 *
 * Loads a v2 catalog package and produces a structured review summary.
 * The review evidence (validation-report.json, changelog.json, artifact
 * hashes) is read from the immutable JSON package. Human review decisions
 * are stored separately in PocketBase via the catalog-review hook.
 *
 * Usage:
 *   node tools/validation/review-package.mjs <bundle-dir>
 *   node tools/validation/review-package.mjs catalogs/example
 *   node tools/validation/review-package.mjs catalogs/example --json
 */

import { resolve, basename } from "node:path";
import { reviewPackage, formatReviewSummary } from "../../shared/schemas/review-package.mjs";

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes("--json");
  const bundleArg = args.find((a) => !a.startsWith("--"));

  if (!bundleArg || bundleArg === "--help" || bundleArg === "-h") {
    console.log("Usage: node tools/validation/review-package.mjs <bundle-dir> [--json]");
    console.log("");
    console.log("  <bundle-dir>  Path to a v2 catalog package directory containing manifest.json.");
    console.log("  --json        Output the review summary as JSON instead of formatted text.");
    console.log("");
    console.log("Examples:");
    console.log("  node tools/validation/review-package.mjs catalogs/example");
    console.log("  node tools/validation/review-package.mjs catalogs/example --json");
    process.exit(0);
  }

  const bundleDir = resolve(bundleArg);

  try {
    const summary = reviewPackage(bundleDir);

    if (jsonOutput) {
      console.log(JSON.stringify(summary, null, 2));
    } else {
      console.log(formatReviewSummary(summary));
    }

    // Exit code based on recommendation
    if (!summary.reviewable) {
      process.exit(2);
    } else if (summary.recommendedDecision === "quarantined") {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error(`FATAL: ${err.message}`);
    process.exit(2);
  }
}

main();
