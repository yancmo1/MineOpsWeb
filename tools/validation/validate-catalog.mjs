#!/usr/bin/env node

/**
 * MineOps Catalog Validation Tool
 *
 * Validates a catalog bundle directory against the JSON Schemas and runs
 * deterministic integrity checks. Supports both:
 *   - Legacy v1 manifest (monolithic catalog.json, single artifact)
 *   - v2 manifest (multi-artifact package with content-addressed entries)
 *
 * Checks include:
 *   - Schema conformance (per artifact)
 *   - Duplicate canonical IDs
 *   - Duplicate source identifiers
 *   - Missing required fields
 *   - Unresolved object tracking
 *   - Relationship reference integrity
 *   - Artifact hash consistency (all artifacts verified)
 *   - Deterministic serialization (same content → same hash)
 *   - Missing/mismatched artifacts (manifest vs filesystem)
 *   - Suspicious change detection
 *
 * Usage: node tools/validation/validate-catalog.mjs <bundle-dir>
 */

import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, basename } from "node:path";
import { createHash } from "node:crypto";

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

/** Schema files keyed by a unique identifier. */
const SCHEMA_FILES = {
  manifest: "catalog_manifest.schema.json",
  catalog: "normalized_catalog.schema.json",
  catalog_core: "catalog_core.schema.json",
  relationships: "relationships.schema.json",
  mappings: "mappings.schema.json",
  localization: "localization.schema.json",
  assets: "assets.schema.json",
  diff: "catalog_diff.schema.json",
  changelog: "changelog.schema.json",
  validation: "catalog_validation.schema.json",
};

/** Legacy v1 bundle files (monolithic format). */
const LEGACY_BUNDLE_FILES = ["catalog-manifest.json", "catalog.json", "diff.json", "validation-report.json"];

/** v2 artifact filenames mapped to schema keys. */
const V2_ARTIFACT_SCHEMA_MAP = {
  "catalog-core.json": "catalog_core",
  "relationships.json": "relationships",
  "mappings.json": "mappings",
  "localization.json": "localization",
  "assets.json": "assets",
  "validation-report.json": "validation",
  "changelog.json": "changelog",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function loadJson(filePath) {
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
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
  if (typeof value !== "string" || value.length === 0 || value.length > 255) return false;
  // Reject absolute paths and Windows drive letters
  if (value.startsWith("/") || /^[a-zA-Z]:/.test(value)) return false;
  // Reject URL schemes
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) return false;
  // Reject backslashes
  if (value.includes("\\")) return false;
  // Reject URL-encoded traversal sequences (single and double-encoded)
  if (/%(25)?2[ef]/i.test(value) || /%(25)?5c/i.test(value)) return false;
  // Reject encoded dot segments
  if (/%(25)?2e/i.test(value)) return false;
  const parts = value.split("/");
  return parts.every((part) => part.length > 0 && part !== "." && part !== "..");
}

/** Collect all canonicalIds from entity arrays in a catalog or catalog-core artifact. */
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

/** Detect manifest format version: "v1" (monolithic) or "v2" (multi-artifact). */
function detectManifestVersion(manifest) {
  if (manifest.manifestSchemaVersion === "1.0.0" && manifest.artifact) return "v1";
  if (manifest.manifestSchemaVersion === "2.0.0" && manifest.artifacts) return "v2";
  // Heuristic fallback
  if (Array.isArray(manifest.artifacts)) return "v2";
  if (manifest.artifact && manifest.artifact.path) return "v1";
  return null;
}

// ---------------------------------------------------------------------------
// Validation checks
// ---------------------------------------------------------------------------

/** Schema conformance checks for v1 (legacy) bundles. */
function checkSchemasV1(ajv, bundle, bundleDir) {
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

/** Schema conformance checks for v2 (multi-artifact) bundles. */
function checkSchemasV2(ajv, manifest, artifacts, bundleDir) {
  const checks = [];

  // Validate the manifest itself against v2 schema
  const manifestValidate = ajv.getSchema(SCHEMA_FILES["manifest"]);
  if (!manifestValidate) {
    checks.push({
      code: "SCHEMA_VALID",
      severity: "error",
      passed: false,
      message: "Manifest v2 schema not compiled.",
      path: "manifest.json",
    });
  } else {
    const valid = manifestValidate(manifest);
    checks.push({
      code: "SCHEMA_VALID",
      severity: "error",
      passed: valid,
      message: valid
        ? "Manifest conforms to catalog_manifest.schema.json (v2)."
        : `Manifest FAILED schema validation: ${ajv.errorsText(manifestValidate.errors)}`,
      path: "manifest.json",
      details: valid ? undefined : { errors: manifestValidate.errors },
    });
  }

  // Validate each artifact against its schema
  for (const entry of manifest.artifacts || []) {
    const filename = entry.filename;
    const schemaKey = V2_ARTIFACT_SCHEMA_MAP[filename];
    const data = artifacts[filename];

    if (!schemaKey) {
      checks.push({
        code: "SCHEMA_VALID",
        severity: "warning",
        passed: true,
        message: `No schema mapping for artifact: ${filename} (skipping schema check).`,
        path: filename,
      });
      continue;
    }

    const schemaFile = SCHEMA_FILES[schemaKey];
    if (!schemaFile) {
      checks.push({
        code: "SCHEMA_VALID",
        severity: "error",
        passed: false,
        message: `Schema not found for ${schemaKey}.`,
        path: filename,
      });
      continue;
    }

    const validate = ajv.getSchema(schemaFile);
    if (!validate) {
      checks.push({
        code: "SCHEMA_VALID",
        severity: "error",
        passed: false,
        message: `Schema not compiled for ${filename} (${schemaFile}).`,
        path: filename,
      });
      continue;
    }

    if (data === undefined) {
      checks.push({
        code: "SCHEMA_VALID",
        severity: "error",
        passed: false,
        message: `Artifact not loaded for schema check: ${filename}.`,
        path: filename,
      });
      continue;
    }

    const valid = validate(data);
    checks.push({
      code: "SCHEMA_VALID",
      severity: "error",
      passed: valid,
      message: valid
        ? `${filename} conforms to ${schemaFile}.`
        : `${filename} FAILED schema validation: ${ajv.errorsText(validate.errors)}`,
      path: filename,
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
function checkDuplicateSourceIds(mappings) {
  const seen = new Map();
  const duplicates = [];
  for (const mapping of mappings.idMappings || []) {
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

/** Manifest consistency for v1 format. */
function checkManifestConsistencyV1(manifest, catalog) {
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

/** Manifest consistency for v2 format: cross-checks against catalog-core and relationships. */
function checkManifestConsistencyV2(manifest, catalogCore, relationships) {
  const issues = [];
  if (manifest.catalogVersion !== catalogCore.catalogVersion) issues.push("catalogVersion mismatch (manifest vs catalog-core)");
  if (manifest.releaseId !== catalogCore.releaseId) issues.push("releaseId mismatch (manifest vs catalog-core)");

  const actual = {
    managers: catalogCore.managers?.length || 0,
    mines: catalogCore.mines?.length || 0,
    equipment: catalogCore.equipment?.length || 0,
    research: catalogCore.research?.length || 0,
    collectibles: catalogCore.collectibles?.length || 0,
    artifacts: catalogCore.artifacts?.length || 0,
    relationships: relationships?.relationships?.length || 0,
    unresolvedObjects: 0,
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
    message: issues.length === 0 ? "Manifest identity and counts match catalog artifacts." : issues.join("; "),
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
    passed: true,
    message:
      unresolvedCount === 0
        ? "No unresolved objects to review."
        : `${unresolvedCount} unresolved object(s) require review.`,
    details: unresolvedCount > 0 ? { count: unresolvedCount } : undefined,
  };
}

/** Check relationship reference integrity (v1: single catalog; v2: catalogCore + relationships). */
function checkReferences(catalog, relationshipsArtifact) {
  const validIds = collectCanonicalIds(catalog);
  const broken = [];

  const rels = relationshipsArtifact?.relationships || catalog.relationships || [];
  for (const rel of rels) {
    if (rel.sourceId && !validIds.has(rel.sourceId)) {
      broken.push({ kind: rel.kind, field: "sourceId", id: rel.sourceId });
    }
    if (rel.targetId && !validIds.has(rel.targetId)) {
      broken.push({ kind: rel.kind, field: "targetId", id: rel.targetId });
    }
    // Also support legacy field names
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

/** Check artifact hash consistency for v1 format. */
function checkArtifactHashV1(manifest, bundleDir) {
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

/** Check all artifact hashes for v2 format. */
function checkArtifactHashesV2(manifest, bundleDir) {
  const issues = [];
  const passed = [];

  for (const entry of manifest.artifacts || []) {
    const filePath = resolve(bundleDir, entry.filename);
    if (!existsSync(filePath)) {
      issues.push(`${entry.filename}: file not found`);
      continue;
    }

    const raw = readFileSync(filePath, "utf-8");
    const actualHash = sha256(raw);
    const actualBytes = Buffer.byteLength(raw, "utf-8");
    const hashMatch = actualHash === entry.sha256;
    const bytesMatch = actualBytes === entry.bytes;

    if (!hashMatch) {
      issues.push(`${entry.filename}: hash mismatch (manifest=${entry.sha256}, actual=${actualHash})`);
    }
    if (!bytesMatch) {
      issues.push(`${entry.filename}: byte size mismatch (manifest=${entry.bytes}, actual=${actualBytes})`);
    }

    if (hashMatch && bytesMatch) {
      passed.push(entry.filename);
    }
  }

  return {
    code: "ARTIFACT_HASH_CONSISTENCY",
    severity: "error",
    passed: issues.length === 0,
    message:
      issues.length === 0
        ? `All ${passed.length} artifact hash(es) verified.`
        : `${issues.length} artifact hash/byte issue(s): ${issues.join("; ")}`,
    details: issues.length > 0 ? { issues, verified: passed } : { verified: passed },
  };
}

/** Check manifest artifact paths for v1. */
function checkManifestArtifactsV1(manifest, bundleDir) {
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

/** Check that all manifest artifacts exist on disk for v2. */
function checkManifestArtifactsV2(manifest, bundleDir) {
  const issues = [];
  const found = [];

  for (const entry of manifest.artifacts || []) {
    if (!isSafeRelativePath(entry.path)) {
      issues.push(`${entry.filename}: unsafe path "${entry.path}"`);
      continue;
    }
    const filePath = resolve(bundleDir, entry.path);
    if (!existsSync(filePath)) {
      issues.push(`${entry.filename}: file not found at "${entry.path}"`);
    } else {
      const actualBytes = statSync(filePath).size;
      if (entry.bytes !== actualBytes) {
        issues.push(`${entry.filename}: byte mismatch (manifest=${entry.bytes}, actual=${actualBytes})`);
      }
      found.push(entry.filename);
    }
  }

  return {
    code: "MANIFEST_ARTIFACTS",
    severity: "error",
    passed: issues.length === 0,
    message:
      issues.length === 0
        ? `All ${found.length} manifest artifact(s) present and valid.`
        : issues.join("; "),
    details: issues.length > 0 ? { issues, found } : { found },
  };
}

/** Check deterministic serialization for multiple files. */
function checkDeterministicSerializationV2(bundleDir, manifest) {
  const results = [];
  const artifactsToCheck = manifest.artifacts || [];

  for (const entry of artifactsToCheck) {
    const filePath = resolve(bundleDir, entry.filename);
    if (!existsSync(filePath)) {
      results.push({ file: entry.filename, stable: false, reason: "file not found" });
      continue;
    }

    const raw = readFileSync(filePath, "utf-8");
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      results.push({ file: entry.filename, stable: false, reason: `not valid JSON: ${error.message}` });
      continue;
    }

    const canonical = canonicalJson(parsed);
    const roundtrip = canonicalJson(JSON.parse(canonical));
    const hash1 = sha256(canonical);
    const hash2 = sha256(roundtrip);
    const isCanonical = raw === canonical;
    const stable = hash1 === hash2 && isCanonical;

    results.push({
      file: entry.filename,
      stable,
      isCanonical,
      reason: !stable
        ? (hash1 !== hash2 ? "serialization not stable" : "not canonically formatted")
        : null,
    });
  }

  const unstable = results.filter((r) => !r.stable);
  return {
    code: "DETERMINISTIC_SERIALIZATION",
    severity: "error",
    passed: unstable.length === 0,
    message:
      unstable.length === 0
        ? `All ${results.length} artifact(s) are deterministically serialized.`
        : `${unstable.length} artifact(s) not deterministic: ${unstable.map((r) => r.file).join(", ")}`,
    details: { results },
  };
}

/** Check deterministic serialization for v1 format. */
function checkDeterministicSerializationV1(bundleDir) {
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

/** Check for suspiciously large changes. */
function checkSuspiciousChanges(changelog) {
  const summary = changelog.summary || {};
  const totalChanges =
    (summary.managersAdded || 0) +
    (summary.managersRemoved || 0) +
    (summary.managersChanged || 0);

  const passed = totalChanges <= 50 || !changelog.previousCatalogVersion;

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

  // Detect format: try manifest.json (v2) first, then catalog-manifest.json (v1)
  const manifestPathV2 = resolve(bundleDir, "manifest.json");
  const manifestPathV1 = resolve(bundleDir, "catalog-manifest.json");

  let format = null;
  let manifest = null;

  if (existsSync(manifestPathV2)) {
    manifest = loadJson(manifestPathV2);
    format = detectManifestVersion(manifest);
  }

  if (!format && existsSync(manifestPathV1)) {
    manifest = loadJson(manifestPathV1);
    format = detectManifestVersion(manifest);
  }

  if (!format) {
    console.error("ERROR: No valid manifest found. Expected manifest.json (v2) or catalog-manifest.json (v1).");
    process.exit(1);
  }

  // Compile all schemas with AJV (deduplicate by schema file path)
  const ajv = new Ajv({ allErrors: true, strict: false });
  ajv.addFormat("date-time", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/);

  const loaded = new Set();
  for (const [, schemaFile] of Object.entries(SCHEMA_FILES)) {
    if (loaded.has(schemaFile)) continue;
    loaded.add(schemaFile);
    const schemaPath = resolve(SCHEMAS_DIR, schemaFile);
    if (!existsSync(schemaPath)) continue;
    const schema = loadJson(schemaPath);
    try {
      ajv.addSchema(schema, schemaFile);
    } catch (err) {
      console.error(`ERROR: Failed to compile schema ${schemaFile}: ${err.message}`);
      process.exit(1);
    }
  }

  let checks = [];
  let overallStatus = "passed";

  if (format === "v2") {
    // ── V2 multi-artifact validation ──
    console.log(`\n📋 Catalog Validation (v2 multi-artifact): ${basename(bundleDir)}`);

    // Load all artifacts listed in manifest
    const artifacts = {};
    const missing = [];
    for (const entry of manifest.artifacts) {
      const filePath = resolve(bundleDir, entry.filename);
      if (!existsSync(filePath)) {
        missing.push(entry.filename);
        continue;
      }
      artifacts[entry.filename] = loadJson(filePath);
    }

    if (missing.length > 0) {
      console.error(`ERROR: Missing artifact(s): ${missing.join(", ")}`);
      process.exit(1);
    }

    const catalogCore = artifacts["catalog-core.json"];
    const relationshipsArt = artifacts["relationships.json"];
    const mappingsArt = artifacts["mappings.json"];
    const changelogArt = artifacts["changelog.json"];

    // Run checks
    checks = [
      ...checkSchemasV2(ajv, manifest, artifacts, bundleDir),
      checkManifestConsistencyV2(manifest, catalogCore, relationshipsArt),
      checkDuplicateCanonicalIds(catalogCore),
      checkDuplicateSourceIds(mappingsArt),
      checkMissingRequiredFields(catalogCore),
      checkUnresolvedObjects(catalogCore),
      checkReferences(catalogCore, relationshipsArt),
      checkArtifactHashesV2(manifest, bundleDir),
      checkManifestArtifactsV2(manifest, bundleDir),
      checkDeterministicSerializationV2(bundleDir, manifest),
      checkSuspiciousChanges(changelogArt),
    ];

    // Determine overall status
    const errors = checks.filter((c) => c.severity === "error" && !c.passed);
    const warnings = checks.filter((c) => c.severity === "warning" && !c.passed);
    const unresolvedCount = catalogCore.unresolvedObjects?.length || 0;

    if (errors.length > 0) overallStatus = "failed";
    else if (warnings.length > 0 || unresolvedCount > 0) overallStatus = "review_required";

  } else {
    // ── V1 legacy monolithic validation ──
    console.log(`\n📋 Catalog Validation (v1 legacy): ${basename(bundleDir)}`);

    // Load legacy bundle files
    const bundle = {};
    for (const file of LEGACY_BUNDLE_FILES) {
      const filePath = resolve(bundleDir, file);
      if (!existsSync(filePath)) {
        console.error(`ERROR: Missing bundle file: ${file}`);
        process.exit(1);
      }
      let key = file.replace(".json", "");
      if (key === "catalog-manifest") key = "manifest";
      else if (key === "validation-report") key = "validation";
      bundle[key] = loadJson(filePath);
    }

    checks = [
      ...checkSchemasV1(ajv, bundle, bundleDir),
      checkManifestConsistencyV1(bundle.manifest, bundle.catalog),
      checkDuplicateCanonicalIds(bundle.catalog),
      checkDuplicateSourceIds(bundle.catalog),
      checkMissingRequiredFields(bundle.catalog),
      checkUnresolvedObjects(bundle.catalog),
      checkReferences(bundle.catalog),
      checkArtifactHashV1(bundle.manifest, bundleDir),
      checkManifestArtifactsV1(bundle.manifest, bundleDir),
      checkDeterministicSerializationV1(bundleDir),
      checkSuspiciousChanges(bundle.diff),
    ];

    const errors = checks.filter((c) => c.severity === "error" && !c.passed);
    const warnings = checks.filter((c) => c.severity === "warning" && !c.passed);
    const unresolvedCount = (bundle.catalog.unresolvedObjects || []).length;

    if (errors.length > 0) overallStatus = "failed";
    else if (warnings.length > 0 || unresolvedCount > 0) overallStatus = "review_required";
  }

  // Print results
  console.log(`   Status: ${overallStatus.toUpperCase()}`);
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

  if (overallStatus === "failed") {
    console.log("❌ Validation FAILED — blocking issues found.\n");
    process.exit(1);
  } else if (overallStatus === "review_required") {
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
