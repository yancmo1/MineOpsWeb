#!/usr/bin/env node

/**
 * MineOps Catalog Validation Tool
 *
 * Validates a catalog bundle directory against the four JSON Schemas and runs
 * deterministic integrity checks:
 *   - Schema conformance
 *   - Duplicate canonical IDs
 *   - Duplicate source identifiers
 *   - Missing required fields
 *   - Unresolved object tracking
 *   - Relationship reference integrity
 *   - Artifact hash consistency
 *   - Deterministic serialization (same content → same hash)
 *   - Suspicious change detection
 *
 * Usage: node tools/validation/validate-catalog.mjs <bundle-dir>
 */

import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, basename } from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

// ---------------------------------------------------------------------------
// Dynamic AJV import — works with both CJS and ESM ajv installs
// ---------------------------------------------------------------------------
let Ajv;
try {
  const mod = await import("ajv/dist/2020.js");
  Ajv = mod.default || mod;
} catch {
  try {
    const mod = await import("ajv");
    Ajv = mod.default || mod;
  } catch {
    console.error("ERROR: ajv is not installed. Run: npm install --save-dev ajv");
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const ROOT = resolve(import.meta.dirname, "..", "..");
const SCHEMAS_DIR = resolve(ROOT, "shared", "schemas");

const SCHEMA_FILES = {
  manifest: "catalog_manifest.schema.json",
  catalog: "normalized_catalog.schema.json",
  diff: "catalog_diff.schema.json",
  validation: "catalog_validation.schema.json",
};

const BUNDLE_FILES = ["catalog-manifest.json", "catalog.json", "diff.json", "validation-report.json"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function loadJson(filePath) {
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

function loadSchema(name) {
  const schemaPath = resolve(SCHEMAS_DIR, SCHEMA_FILES[name]);
  if (!existsSync(schemaPath)) {
    throw new Error(`Schema not found: ${schemaPath}`);
  }
  return loadJson(schemaPath);
}

function sha256(content) {
  return createHash("sha256").update(content, "utf-8").digest("hex");
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

function canonicalJson(value) {
  return `${JSON.stringify(stableValue(value), null, 2)}\n`;
}

function isSafeRelativePath(value) {
  if (typeof value !== "string" || value.length === 0 || value.startsWith("/") || value.includes("\\")) return false;
  const parts = value.split("/");
  return parts.every((part) => part.length > 0 && part !== "." && part !== "..");
}

/** Collect all canonicalIds from entity arrays in the catalog. */
function collectCanonicalIds(catalog) {
  const ids = new Map(); // canonicalId → entityType
  const arrays = ["managers", "mines", "equipment", "research", "collectibles", "artifacts"];
  for (const arr of arrays) {
    for (const entity of catalog[arr] || []) {
      if (entity.canonicalId) {
        ids.set(entity.canonicalId, arr);
      }
    }
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Validation checks
// ---------------------------------------------------------------------------

/** Schema conformance checks */
function checkSchemas(ajv, bundle, bundleDir) {
  const checks = [];
  const map = {
    manifest: { schema: "manifest", file: "catalog-manifest.json", label: "Catalog manifest" },
    catalog: { schema: "catalog", file: "catalog.json", label: "Normalized catalog" },
    diff: { schema: "diff", file: "diff.json", label: "Catalog diff" },
    validation: { schema: "validation", file: "validation-report.json", label: "Validation report" },
  };

  for (const [key, cfg] of Object.entries(map)) {
    const validate = ajv.getSchema(SCHEMA_FILES[cfg.schema]);
    if (!validate) {
      checks.push({
        code: "SCHEMA_VALID",
        severity: "error",
        passed: false,
        message: `${cfg.label}: schema not compiled (${SCHEMA_FILES[cfg.schema]}).`,
        path: cfg.file,
      });
      continue;
    }
    const data = bundle[key];
    const valid = validate(data);
    checks.push({
      code: "SCHEMA_VALID",
      severity: "error",
      passed: valid,
      message: valid
        ? `${cfg.label} conforms to ${SCHEMA_FILES[cfg.schema]}.`
        : `${cfg.label} FAILED schema validation: ${ajv.errorsText(validate.errors)}`,
      path: cfg.file,
      details: valid ? undefined : { errors: validate.errors },
    });
  }

  return checks;
}

/** Check for duplicate canonical IDs */
function checkDuplicateCanonicalIds(catalog) {
  const seen = new Map();
  const duplicates = [];
  const arrays = ["managers", "mines", "equipment", "research", "collectibles", "artifacts"];
  for (const arr of arrays) {
    for (const entity of catalog[arr] || []) {
      if (!entity.canonicalId) continue;
      if (seen.has(entity.canonicalId)) {
        duplicates.push({ canonicalId: entity.canonicalId, first: seen.get(entity.canonicalId), second: arr });
      } else {
        seen.set(entity.canonicalId, arr);
      }
    }
  }

  return {
    code: "DUPLICATE_CANONICAL_ID",
    severity: "error",
    passed: duplicates.length === 0,
    message:
      duplicates.length === 0
        ? "No duplicate canonical IDs found."
        : `Found ${duplicates.length} duplicate canonical ID(s): ${duplicates.map((d) => d.canonicalId).join(", ")}`,
    details: duplicates.length > 0 ? { duplicates } : undefined,
  };
}

/** Check for duplicate source identifiers */
function checkDuplicateSourceIds(catalog) {
  const seen = new Map();
  const duplicates = [];
  for (const mapping of catalog.idMappings || []) {
    const key = `${mapping.kind}:${mapping.sourceValue}`;
    if (seen.has(key)) {
      duplicates.push({ kind: mapping.kind, sourceValue: mapping.sourceValue });
    } else {
      seen.set(key, mapping.canonicalId);
    }
  }

  return {
    code: "DUPLICATE_SOURCE_IDENTIFIER",
    severity: "error",
    passed: duplicates.length === 0,
    message:
      duplicates.length === 0
        ? "No duplicate source identifiers found."
        : `Found ${duplicates.length} duplicate source identifier(s).`,
    details: duplicates.length > 0 ? { duplicates } : undefined,
  };
}

function checkManifestConsistency(manifest, catalog) {
  const issues = [];
  if (manifest.catalogVersion !== catalog.catalogVersion) issues.push("catalogVersion mismatch");
  if (manifest.releaseId !== catalog.releaseId) issues.push("releaseId mismatch");
  if (manifest.catalogSchemaVersion !== catalog.catalogSchemaVersion) issues.push("catalogSchemaVersion mismatch");
  const actual = {
    managers: catalog.managers?.length || 0,
    mines: catalog.mines?.length || 0,
    equipment: catalog.equipment?.length || 0,
    research: catalog.research?.length || 0,
    collectibles: catalog.collectibles?.length || 0,
    artifacts: catalog.artifacts?.length || 0,
    relationships: catalog.relationships?.length || 0,
    unresolvedObjects: catalog.unresolvedObjects?.length || 0,
  };
  for (const key of Object.keys(actual)) {
    if (manifest.counts?.[key] !== actual[key]) {
      issues.push(`counts.${key}: manifest=${manifest.counts?.[key]} actual=${actual[key]}`);
    }
  }
  return {
    code: "MANIFEST_CATALOG_CONSISTENCY",
    severity: "error",
    passed: issues.length === 0,
    message: issues.length === 0 ? "Manifest identity and counts match catalog.json." : issues.join("; "),
    details: issues.length > 0 ? { issues } : undefined,
  };
}

/** Check for missing required fields on entities */
function checkMissingRequiredFields(catalog) {
  const issues = [];
  const arrays = ["managers", "mines", "equipment", "research", "collectibles", "artifacts"];
  for (const arr of arrays) {
    for (let i = 0; i < (catalog[arr] || []).length; i++) {
      const entity = catalog[arr][i];
      if (!entity.canonicalId) {
        issues.push({ array: arr, index: i, field: "canonicalId" });
      }
    }
  }

  return {
    code: "MISSING_REQUIRED_FIELDS",
    severity: "error",
    passed: issues.length === 0,
    message:
      issues.length === 0
        ? "All entities have required fields."
        : `Found ${issues.length} entity/entities missing required fields.`,
    details: issues.length > 0 ? { issues } : undefined,
  };
}

/** Check unresolved objects — always a warning if present */
function checkUnresolvedObjects(catalog) {
  const unresolvedCount = (catalog.unresolvedObjects || []).length;

  return {
    code: "UNRESOLVED_OBJECTS",
    severity: "warning",
    passed: true, // presence of unresolved objects is not a failure, just a note
    message:
      unresolvedCount === 0
        ? "No unresolved objects to review."
        : `${unresolvedCount} unresolved object(s) require review.`,
    details: unresolvedCount > 0 ? { count: unresolvedCount } : undefined,
  };
}

/** Check relationship reference integrity */
function checkReferences(catalog) {
  const validIds = collectCanonicalIds(catalog);
  const broken = [];

  for (const rel of catalog.relationships || []) {
    if (rel.sourceCanonicalId && !validIds.has(rel.sourceCanonicalId)) {
      broken.push({ kind: rel.kind, field: "sourceCanonicalId", id: rel.sourceCanonicalId });
    }
    if (rel.targetCanonicalId && !validIds.has(rel.targetCanonicalId)) {
      broken.push({ kind: rel.kind, field: "targetCanonicalId", id: rel.targetCanonicalId });
    }
  }

  return {
    code: "INVALID_REFERENCES",
    severity: "error",
    passed: broken.length === 0,
    message:
      broken.length === 0
        ? "All relationship references resolve correctly."
        : `Found ${broken.length} broken relationship reference(s).`,
    details: broken.length > 0 ? { broken } : undefined,
  };
}

/** Check artifact hash consistency */
function checkArtifactHash(manifest, bundleDir) {
  const catalogPath = resolve(bundleDir, "catalog.json");
  if (!existsSync(catalogPath)) {
    return {
      code: "ARTIFACT_HASH_CONSISTENCY",
      severity: "error",
      passed: false,
      message: "catalog.json not found — cannot verify hash.",
    };
  }

  const raw = readFileSync(catalogPath, "utf-8");
  const actualHash = sha256(raw);
  const expectedHash = manifest.artifact?.sha256;

  const match = actualHash === expectedHash;
  return {
    code: "ARTIFACT_HASH_CONSISTENCY",
    severity: "error",
    passed: match,
    message: match
      ? "Manifest artifact hash matches catalog.json content."
      : `Hash mismatch: manifest=${expectedHash} actual=${actualHash}`,
    details: match ? undefined : { expected: expectedHash, actual: actualHash },
  };
}

function checkManifestArtifacts(manifest, bundleDir) {
  const issues = [];
  for (const [label, relativePath] of [
    ["artifact.path", manifest.artifact?.path],
    ["diffPath", manifest.diffPath],
    ["validationReportPath", manifest.validationReportPath],
  ]) {
    if (!isSafeRelativePath(relativePath)) {
      issues.push(`${label} must be a safe relative path`);
    } else if (!existsSync(resolve(bundleDir, relativePath))) {
      issues.push(`${label} does not exist: ${relativePath}`);
    }
  }
  const artifactPath = resolve(bundleDir, manifest.artifact?.path || "");
  if (existsSync(artifactPath)) {
    const actualBytes = statSync(artifactPath).size;
    if (manifest.artifact?.bytes !== actualBytes) {
      issues.push(`artifact.bytes mismatch: manifest=${manifest.artifact?.bytes} actual=${actualBytes}`);
    }
  }
  return {
    code: "MANIFEST_ARTIFACTS",
    severity: "error",
    passed: issues.length === 0,
    message: issues.length === 0 ? "Manifest paths and artifact byte count are valid." : issues.join("; "),
    details: issues.length > 0 ? { issues } : undefined,
  };
}

/** Check deterministic serialization: same file twice → same hash */
function checkDeterministicSerialization(bundleDir) {
  const catalogPath = resolve(bundleDir, "catalog.json");
  if (!existsSync(catalogPath)) {
    return {
      code: "DETERMINISTIC_SERIALIZATION",
      severity: "error",
      passed: false,
      message: "catalog.json not found.",
    };
  }

  const raw1 = readFileSync(catalogPath, "utf-8");
  let parsed;
  try {
    parsed = JSON.parse(raw1);
  } catch (error) {
    return { code: "DETERMINISTIC_SERIALIZATION", severity: "error", passed: false, message: `catalog.json is not valid JSON: ${error.message}` };
  }
  const canonical1 = canonicalJson(parsed);
  const canonical2 = canonicalJson(JSON.parse(canonical1));
  const hash1 = sha256(canonical1);
  const hash2 = sha256(canonical2);
  const isCanonical = raw1 === canonical1;

  return {
    code: "DETERMINISTIC_SERIALIZATION",
    severity: "warning",
    passed: hash1 === hash2 && isCanonical,
    message:
      hash1 !== hash2
        ? "Catalog canonical serialization is not stable."
        : isCanonical
          ? "Catalog serialization is deterministic with canonical key ordering."
          : "Catalog content is valid but not canonically serialized (stable key ordering/newline required).",
  };
}

/** Check for suspiciously large changes (deferred for first catalog, always passes) */
function checkSuspiciousChanges(diff) {
  const summary = diff.summary || {};
  const totalChanges =
    (summary.managersAdded || 0) +
    (summary.managersRemoved || 0) +
    (summary.managersChanged || 0);

  const passed = totalChanges <= 50 || !diff.previousCatalogVersion; // first catalog always passes

  return {
    code: "SUSPICIOUS_CHANGE_DETECTION",
    severity: "warning",
    passed,
    message: passed
      ? "No suspiciously large additions or removals detected."
      : `Large change detected: ${totalChanges} manager changes. Review recommended.`,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const bundleDir = resolve(process.argv[2] || "catalogs/example");

  if (!existsSync(bundleDir)) {
    console.error(`ERROR: Bundle directory not found: ${bundleDir}`);
    process.exit(1);
  }

  // Load bundle files
  const bundle = {};
  for (const file of BUNDLE_FILES) {
    const filePath = resolve(bundleDir, file);
    if (!existsSync(filePath)) {
      console.error(`ERROR: Missing bundle file: ${file}`);
      process.exit(1);
    }
    let key = file.replace(".json", "");
    // Normalize: catalog-manifest → manifest, catalog → catalog, diff → diff, validation-report → validation
    if (key === "catalog-manifest") key = "manifest";
    else if (key === "validation-report") key = "validation";
    bundle[key] = loadJson(filePath);
  }

  // Compile schemas with AJV
  const ajv = new Ajv({ allErrors: true, strict: false });
  // Register date-time format to suppress "unknown format" warnings
  ajv.addFormat("date-time", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/);
  for (const [key, schemaFile] of Object.entries(SCHEMA_FILES)) {
    const schema = loadSchema(key);
    try {
      ajv.addSchema(schema, schemaFile);
    } catch (err) {
      console.error(`ERROR: Failed to compile schema ${schemaFile}: ${err.message}`);
      process.exit(1);
    }
  }

  // Run checks
  const checks = [
    ...checkSchemas(ajv, bundle, bundleDir),
    checkManifestConsistency(bundle.manifest, bundle.catalog),
    checkDuplicateCanonicalIds(bundle.catalog),
    checkDuplicateSourceIds(bundle.catalog),
    checkMissingRequiredFields(bundle.catalog),
    checkUnresolvedObjects(bundle.catalog),
    checkReferences(bundle.catalog),
    checkArtifactHash(bundle.manifest, bundleDir),
    checkManifestArtifacts(bundle.manifest, bundleDir),
    checkDeterministicSerialization(bundleDir),
    checkSuspiciousChanges(bundle.diff),
  ];

  // Determine overall status
  const errors = checks.filter((c) => c.severity === "error" && !c.passed);
  const warnings = checks.filter((c) => c.severity === "warning" && !c.passed);
  const unresolvedCount = (bundle.catalog.unresolvedObjects || []).length;

  let status = "passed";
  if (errors.length > 0) status = "failed";
  else if (warnings.length > 0 || unresolvedCount > 0) status = "review_required";

  // Print results
  console.log(`\n📋 Catalog Validation: ${basename(bundleDir)}`);
  console.log(`   Status: ${status.toUpperCase()}`);
  console.log(`   Checks: ${checks.length} run, ${checks.filter((c) => c.passed).length} passed, ${checks.filter((c) => !c.passed).length} failed`);
  console.log("");

  for (const check of checks) {
    const icon = check.passed ? "✅" : check.severity === "error" ? "❌" : "⚠️";
    console.log(`   ${icon} [${check.code}] ${check.message}`);
    if (check.details) {
      console.log(`      Details: ${JSON.stringify(check.details)}`);
    }
  }

  console.log("");

  // Exit code: 0 = passed or review_required, 1 = failed
  if (status === "failed") {
    console.log("❌ Validation FAILED — blocking issues found.\n");
    process.exit(1);
  } else if (status === "review_required") {
    console.log("⚠️  Validation PASSED with warnings — review required before activation.\n");
    process.exit(0);
  } else {
    console.log("✅ Validation PASSED.\n");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(`FATAL: ${err.message}`);
  process.exit(1);
});
