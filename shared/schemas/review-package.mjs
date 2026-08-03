/**
 * MineOps Catalog Review Evidence Module
 *
 * Loads a v2 catalog package and produces a structured review summary.
 * Generated evidence (validation-report.json, changelog.json, artifact
 * hashes) is read from the immutable JSON package. The human review
 * decision is stored separately in PocketBase.
 *
 * Usage:
 *   import { reviewPackage } from "./review-package.mjs";
 *   const summary = reviewPackage("catalogs/example");
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, basename } from "node:path";
import { createHash } from "node:crypto";

// ---------------------------------------------------------------------------
// Classification rules
// ---------------------------------------------------------------------------

/** Review engine version — bump when classification rules change. */
const REVIEW_ENGINE_VERSION = "1.0.0";

/**
 * Validation check codes that are always fatal (block publication).
 * Duplicate canonical/source identifiers are fatal because ambiguous identity
 * can corrupt player-to-catalog resolution.
 */
const FATAL_CHECK_CODES = new Set([
  "SCHEMA_VALID",
  "MANIFEST_CATALOG_CONSISTENCY",
  "ARTIFACT_HASH_CONSISTENCY",
  "MANIFEST_ARTIFACTS",
  "DETERMINISTIC_SERIALIZATION",
  "DUPLICATE_CANONICAL_ID",
  "DUPLICATE_SOURCE_IDENTIFIER",
  "ARTIFACT_RELEASE_IDENTITY",
  "DOMAIN_ARTIFACT_IDENTIFIERS",
  "MANAGER_DOMAIN_REQUIRED",
  "UNRESOLVED_EVIDENCE_CONSISTENCY",
]);

/** Validation check codes that are warnings (require review, don't block). */
const WARNING_CHECK_CODES = new Set([
  "MISSING_REQUIRED_FIELDS",
  "UNRESOLVED_OBJECTS",
  "INVALID_REFERENCES",
  "SUSPICIOUS_CHANGE_DETECTION",
]);

/** Supported manifest major version. */
const SUPPORTED_MANIFEST_MAJOR = 2;

/**
 * Changelog review rules — named and versioned so thresholds can evolve
 * without breaking existing review records.
 */
const CHANGELOG_RULES = {
  SUSPICIOUS_CHANGE_COUNT: {
    ruleVersion: 1,
    threshold: 50,
    description: "Manager changes (added + removed + changed) exceeding this count trigger a review warning. Only applies when a previous version exists for comparison.",
  },
};

/** Recognized artifact filenames and their expected schema major versions. */
const EXPECTED_SCHEMA_MAJORS = {
  "catalog-core.json": 1,
  "relationships.json": 1,
  "mappings.json": 1,
  "localization.json": 1,
  "assets.json": 1,
  "validation-report.json": 1,
  "changelog.json": 1,
  "manager-domain.json": 1,
  "equipment-domain.json": 1,
  "strategy-configs.json": 1,
  "unresolved-evidence.json": 1,
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

function checkSerializedEvidence(value, linkField, label, unresolvedIds, findings, allowLink = true) {
  const byteFields = ["rawEncoding", "rawBytes", "rawSha256", "rawByteLength"];
  const presentByteFields = byteFields.filter((field) => Object.hasOwn(value || {}, field));
  if (presentByteFields.length === byteFields.length) {
    if (value.rawEncoding !== "base64" || typeof value.rawBytes !== "string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.rawBytes) || !/^[a-f0-9]{64}$/.test(value.rawSha256) || !Number.isInteger(value.rawByteLength) || value.rawByteLength < 0) {
      findings.push({ code: "SERIALIZED_EVIDENCE_INVALID", severity: "error", message: `${label} has malformed serialized-byte metadata.` });
      return;
    }
    const bytes = Buffer.from(value.rawBytes, "base64");
    const actualHash = createHash("sha256").update(bytes).digest("hex");
    if (bytes.length !== value.rawByteLength || actualHash !== value.rawSha256) {
      findings.push({ code: "SERIALIZED_EVIDENCE_INVALID", severity: "error", message: `${label} serialized bytes do not match their claimed hash/length.` });
    }
    if (Object.hasOwn(value, linkField)) {
      findings.push({ code: "SERIALIZED_EVIDENCE_INVALID", severity: "error", message: `${label} claims both serialized bytes and unresolved evidence.` });
    }
    return;
  }

  if (presentByteFields.length > 0) {
    findings.push({ code: "SERIALIZED_EVIDENCE_INVALID", severity: "error", message: `${label} has incomplete serialized-byte metadata.` });
    return;
  }

  const evidenceId = value?.[linkField];
  if (!allowLink || typeof evidenceId !== "string" || evidenceId.length === 0) {
    findings.push({ code: "SERIALIZED_EVIDENCE_MISSING", severity: "error", message: `${label} has neither serialized bytes nor a linked unresolved-evidence entry.` });
  } else if (!unresolvedIds.has(evidenceId)) {
    findings.push({ code: "UNRESOLVED_EVIDENCE_LINK", severity: "error", message: `${label} references missing unresolved evidence: ${evidenceId}.` });
  }
}

/** Review the new immutable domain artifacts without assigning semantics to raw source data. */
function checkDomainArtifacts(manifest, bundleDir) {
  const findings = [];
  const listed = new Map((manifest.artifacts || []).map((entry) => [entry.filename, entry]));
  const unresolvedIds = new Set();
  const unresolvedPath = resolve(bundleDir, "unresolved-evidence.json");
  if (listed.has("unresolved-evidence.json") && existsSync(unresolvedPath)) {
    try {
      for (const entry of loadJson(unresolvedPath).entries || []) {
        if (typeof entry?.evidenceId === "string") unresolvedIds.add(entry.evidenceId);
      }
    } catch {
      // The normal artifact parsing path below reports invalid JSON.
    }
  }
  const managerDomain = listed.get("manager-domain.json");
  if (managerDomain && !managerDomain.required) {
    findings.push({
      code: "MANAGER_DOMAIN_REQUIRED",
      severity: "error",
      message: "manager-domain.json must be required when it is included in a package.",
    });
  }

  const specs = [
    { filename: "manager-domain.json", arrays: [{ key: "managers", id: "canonicalId" }] },
    { filename: "equipment-domain.json", arrays: ["equipment", "materials", "balancing", "localization"].map((key) => ({ key, id: "recordId" })) },
    { filename: "strategy-configs.json", arrays: [{ key: "records", id: "recordId" }] },
    { filename: "unresolved-evidence.json", arrays: [{ key: "entries", id: "evidenceId" }] },
  ];

  let unresolvedEntries = 0;
  let unresolvedArtifactPresent = false;
  for (const spec of specs) {
    if (!listed.has(spec.filename)) continue;
    const path = resolve(bundleDir, spec.filename);
    if (!existsSync(path)) continue; // Presence/hash diagnostics are handled separately.
    let artifact;
    try {
      artifact = loadJson(path);
    } catch {
      findings.push({ code: "SCHEMA_VALID", severity: "error", message: `${spec.filename} is not valid JSON.` });
      continue;
    }
    if (artifact.catalogVersion !== manifest.catalogVersion || artifact.releaseId !== manifest.releaseId) {
      findings.push({
        code: "ARTIFACT_RELEASE_IDENTITY",
        severity: "error",
        message: `${spec.filename} release identity does not match manifest.`,
      });
    }
    if (spec.filename === "manager-domain.json") {
      for (const manager of artifact.managers || []) {
        for (const [index, asset] of (manager.raw?.assets || []).entries()) {
          checkSerializedEvidence(asset, "rawBytesUnresolvedEvidenceId", `manager-domain.json:${manager.canonicalId}:assets[${index}]`, unresolvedIds, findings);
        }
      }
    } else if (spec.filename === "equipment-domain.json") {
      const rawRecords = artifact.source?.rawRecords;
      if (!Array.isArray(rawRecords)) {
        findings.push({ code: "SERIALIZED_EVIDENCE_MISSING", severity: "error", message: "equipment-domain.json source.rawRecords is missing or malformed." });
      } else {
        for (const [index, record] of rawRecords.entries()) {
          checkSerializedEvidence(record, "unresolvedEvidenceId", `equipment-domain.json:source.rawRecords[${index}]`, unresolvedIds, findings, false);
        }
      }
    } else if (spec.filename === "strategy-configs.json") {
      for (const record of artifact.records || []) {
        if (record.raw?.serialized && typeof record.raw.serialized === "object") {
          checkSerializedEvidence(record.raw.serialized, "unresolvedEvidenceId", `strategy-configs.json:${record.recordId}`, unresolvedIds, findings);
        } else if (!(Object.hasOwn(record.raw || {}, "value") && typeof record.raw?.rawSha256 === "string" && /^[a-f0-9]{64}$/.test(record.raw.rawSha256))) {
          findings.push({ code: "SERIALIZED_EVIDENCE_MISSING", severity: "error", message: `strategy-configs.json:${record.recordId} has neither serialized Unity evidence nor a hashed external value.` });
        }
      }
    }
    for (const arraySpec of spec.arrays) {
      const ids = new Set();
      for (const [index, record] of (artifact[arraySpec.key] || []).entries()) {
        const id = record?.[arraySpec.id];
        if (id === undefined || id === null || id === "" || ids.has(String(id))) {
          findings.push({
            code: "DOMAIN_ARTIFACT_IDENTIFIERS",
            severity: "error",
            message: `${spec.filename}:${arraySpec.key}[${index}] has a missing or duplicate ${arraySpec.id}.`,
          });
        } else {
          ids.add(String(id));
        }
      }
    }
    if (spec.filename === "unresolved-evidence.json") {
      unresolvedArtifactPresent = true;
      unresolvedEntries = (artifact.entries || []).length;
    }
  }

  if (manifest.counts?.unresolvedObjects !== unresolvedEntries || (unresolvedEntries > 0 && !unresolvedArtifactPresent)) {
    findings.push({
      code: "UNRESOLVED_EVIDENCE_CONSISTENCY",
      severity: "error",
      message: `Manifest unresolvedObjects=${manifest.counts?.unresolvedObjects} does not match unresolved evidence entries=${unresolvedEntries}.`,
    });
  }
  if (unresolvedEntries > 0) {
    findings.push({
      code: "UNRESOLVED_OBJECTS",
      severity: "warning",
      message: `${unresolvedEntries} unresolved evidence entr${unresolvedEntries === 1 ? "y requires" : "ies require"} human review.`,
    });
  }

  const fatalFindings = findings.filter((finding) => finding.severity === "error");
  return { findings, fatalFindings, hasFatal: fatalFindings.length > 0, unresolvedEntries };
}

// ---------------------------------------------------------------------------
// Review checks
// ---------------------------------------------------------------------------

function checkArtifactIntegrity(manifest, bundleDir) {
  const results = [];
  let allPassed = true;

  for (const entry of manifest.artifacts || []) {
    const filePath = resolve(bundleDir, entry.filename);
    const fileResult = {
      filename: entry.filename,
      required: entry.required,
      exists: false,
      hashMatch: false,
      bytesMatch: false,
      schemaCompatible: false,
      recordCount: entry.recordCount,
      issues: [],
    };

    if (!existsSync(filePath)) {
      fileResult.issues.push("file not found");
      allPassed = false;
      results.push(fileResult);
      continue;
    }

    fileResult.exists = true;
    const raw = readFileSync(filePath, "utf-8");
    const actualHash = sha256(raw);
    const actualBytes = Buffer.byteLength(raw, "utf-8");

    fileResult.hashMatch = actualHash === entry.sha256;
    fileResult.bytesMatch = actualBytes === entry.bytes;

    if (!fileResult.hashMatch) {
      fileResult.issues.push(`hash mismatch: expected=${entry.sha256.slice(0, 12)}... actual=${actualHash.slice(0, 12)}...`);
      allPassed = false;
    }
    if (!fileResult.bytesMatch) {
      fileResult.issues.push(`byte size mismatch: expected=${entry.bytes} actual=${actualBytes}`);
      allPassed = false;
    }

    // Schema compatibility check
    const expectedMajor = EXPECTED_SCHEMA_MAJORS[entry.filename];
    if (expectedMajor !== undefined) {
      const artifactMajor = parseInt(String(entry.schemaVersion).split(".")[0], 10);
      fileResult.schemaCompatible = artifactMajor <= expectedMajor;
      if (!fileResult.schemaCompatible) {
        fileResult.issues.push(`unsupported schema version: ${entry.schemaVersion} (expected major <= ${expectedMajor})`);
        allPassed = false;
      }
    } else {
      fileResult.schemaCompatible = true; // Unknown artifact, assume compatible
    }

    results.push(fileResult);
  }

  return {
    passed: allPassed,
    artifacts: results,
    summary: {
      total: results.length,
      passed: results.filter((r) => r.issues.length === 0).length,
      failed: results.filter((r) => r.issues.length > 0).length,
      missing: results.filter((r) => !r.exists).length,
      hashFailures: results.filter((r) => r.exists && !r.hashMatch).length,
    },
  };
}

function checkValidationFindings(validationReport) {
  const fatalFindings = [];
  const warningFindings = [];
  const infoFindings = [];

  for (const check of validationReport.checks || []) {
    if (check.passed) continue;

    const finding = {
      code: check.code,
      severity: check.severity,
      message: check.message,
      path: check.path,
    };

    if (FATAL_CHECK_CODES.has(check.code) && !check.passed) {
      fatalFindings.push(finding);
    } else if (WARNING_CHECK_CODES.has(check.code) && !check.passed) {
      warningFindings.push(finding);
    } else {
      infoFindings.push(finding);
    }
  }

  // Blocking issues from the report are always fatal
  for (const issue of validationReport.blockingIssues || []) {
    fatalFindings.push({
      code: issue.code,
      severity: "error",
      message: issue.message,
      path: issue.path,
    });
  }

  // Warnings from the report
  for (const warning of validationReport.warnings || []) {
    warningFindings.push({
      code: warning.code,
      severity: "warning",
      message: warning.message,
      path: warning.path,
    });
  }

  return {
    fatalCount: fatalFindings.length,
    warningCount: warningFindings.length,
    infoCount: infoFindings.length,
    fatalFindings,
    warningFindings,
    infoFindings,
    reportStatus: validationReport.status,
    canPublish: fatalFindings.length === 0 && validationReport.status !== "failed",
  };
}

function checkChangelog(changelog, manifest) {
  const summary = changelog.summary || {};
  const findings = [];
  const rule = CHANGELOG_RULES.SUSPICIOUS_CHANGE_COUNT;

  const totalManagerChanges =
    (summary.managersAdded || 0) +
    (summary.managersRemoved || 0) +
    (summary.managersChanged || 0);

  if (totalManagerChanges > rule.threshold && changelog.previousCatalogVersion) {
    findings.push({
      code: "SUSPICIOUS_CHANGE_DETECTION",
      severity: "warning",
      message: `${totalManagerChanges} manager changes detected (threshold: ${rule.threshold}, rule: SUSPICIOUS_CHANGE_COUNT v${rule.ruleVersion}). Review recommended.`,
    });
  }

  if (summary.unresolvedObjects > 0) {
    findings.push({
      code: "UNRESOLVED_OBJECTS",
      severity: "warning",
      message: `${summary.unresolvedObjects} unresolved object(s) require review.`,
    });
  }

  // Check for removed entities (potentially breaking)
  const removedCount = (changelog.changes?.removed || []).length;
  if (removedCount > 0) {
    const errors = (changelog.changes.removed || []).filter((e) => e.severity === "error");
    if (errors.length > 0) {
      findings.push({
        code: "BREAKING_REMOVALS",
        severity: "error",
        message: `${errors.length} entity removal(s) marked as error severity.`,
      });
    }
  }

  return {
    findings,
    summary: {
      added: summary.managersAdded || 0,
      removed: summary.managersRemoved || 0,
      changed: summary.managersChanged || 0,
      unresolved: summary.unresolvedObjects || 0,
      isFirstRelease: !changelog.previousCatalogVersion,
    },
  };
}

function checkMappingsAndConflicts(mappings, catalogCore) {
  const fatalFindings = [];
  const warningFindings = [];

  // Check for duplicate source identifiers (FATAL — ambiguous identity corrupts resolution)
  const seenSources = new Map();
  for (const mapping of mappings.idMappings || []) {
    const key = `${mapping.kind}:${mapping.sourceValue}`;
    if (seenSources.has(key)) {
      fatalFindings.push({
        code: "DUPLICATE_SOURCE_IDENTIFIER",
        severity: "error",
        message: `Duplicate mapping: ${key} maps to both ${seenSources.get(key)} and ${mapping.canonicalId}`,
      });
    } else {
      seenSources.set(key, mapping.canonicalId);
    }
  }

  // Check for duplicate canonical IDs (FATAL)
  const seenCanonical = new Map();
  for (const mapping of mappings.idMappings || []) {
    const key = `${mapping.kind}:${mapping.canonicalId}`;
    if (seenCanonical.has(key) && seenCanonical.get(key) !== mapping.sourceValue) {
      fatalFindings.push({
        code: "DUPLICATE_CANONICAL_ID",
        severity: "error",
        message: `Canonical ID ${mapping.canonicalId} has conflicting source values in kind ${mapping.kind}`,
      });
    } else {
      seenCanonical.set(key, mapping.sourceValue);
    }
  }

  // Check for mappings to non-existent entities (warning)
  const validIds = new Set();
  for (const arr of ["managers", "mines", "equipment", "research", "collectibles", "artifacts"]) {
    for (const entity of catalogCore[arr] || []) {
      if (entity.canonicalId) validIds.add(entity.canonicalId);
    }
  }

  for (const mapping of mappings.idMappings || []) {
    if (mapping.canonicalId && !validIds.has(mapping.canonicalId)) {
      warningFindings.push({
        code: "ORPHANED_MAPPING",
        severity: "warning",
        message: `Mapping references non-existent canonicalId: ${mapping.canonicalId} (source: ${mapping.kind}:${mapping.sourceValue})`,
      });
    }
  }

  // Check for unresolvable aliases (warning)
  for (const alias of mappings.aliases || []) {
    if (alias.canonicalId && !validIds.has(alias.canonicalId)) {
      warningFindings.push({
        code: "ORPHANED_ALIAS",
        severity: "warning",
        message: `Alias "${alias.alias}" references non-existent canonicalId: ${alias.canonicalId}`,
      });
    }
  }

  const allFindings = [...fatalFindings, ...warningFindings];

  return {
    findings: allFindings,
    fatalFindings,
    warningFindings,
    mappingCount: (mappings.idMappings || []).length,
    aliasCount: (mappings.aliases || []).length,
    hasFatalConflicts: fatalFindings.length > 0,
    hasConflicts: fatalFindings.length > 0,
  };
}

function checkSchemaCompatibility(manifest) {
  const issues = [];
  let manifestSupported = true;
  const unsupportedArtifacts = [];

  // Check manifest major version
  const manifestMajor = parseInt(String(manifest.manifestSchemaVersion).split(".")[0], 10);
  if (manifestMajor > SUPPORTED_MANIFEST_MAJOR) {
    manifestSupported = false;
    issues.push(`Manifest schema v${manifest.manifestSchemaVersion} not supported (max: v${SUPPORTED_MANIFEST_MAJOR}.x)`);
  }

  // Check each required artifact's schema version
  for (const entry of manifest.artifacts || []) {
    if (!entry.required) continue;
    const expectedMajor = EXPECTED_SCHEMA_MAJORS[entry.filename];
    if (expectedMajor === undefined) continue;
    const artifactMajor = parseInt(String(entry.schemaVersion).split(".")[0], 10);
    if (artifactMajor > expectedMajor) {
      unsupportedArtifacts.push({
        filename: entry.filename,
        schemaVersion: entry.schemaVersion,
        expectedMajor,
      });
    }
  }

  if (unsupportedArtifacts.length > 0) {
    issues.push(`${unsupportedArtifacts.length} required artifact(s) have unsupported schema versions`);
  }

  return {
    compatible: manifestSupported && unsupportedArtifacts.length === 0,
    manifestSupported,
    requiredArtifactsSupported: unsupportedArtifacts.length === 0,
    unsupportedArtifacts,
    issues,
  };
}

// ---------------------------------------------------------------------------
// Main review function
// ---------------------------------------------------------------------------

/**
 * Review a v2 catalog package bundle.
 *
 * @param {string} bundleDir - Path to the bundle directory
 * @returns {object} Structured review summary
 */
export function reviewPackage(bundleDir) {
  const manifestPath = resolve(bundleDir, "manifest.json");

  if (!existsSync(manifestPath)) {
    return {
      reviewable: false,
      error: `No manifest found at ${manifestPath}`,
    };
  }

  const manifest = loadJson(manifestPath);

  // Verify this is a v2 manifest
  if (manifest.manifestSchemaVersion !== "2.0.0" || !Array.isArray(manifest.artifacts)) {
    return {
      reviewable: false,
      error: `Manifest is not v2 format (version: ${manifest.manifestSchemaVersion})`,
    };
  }

  // Load required artifacts
  const validationReportPath = resolve(bundleDir, "validation-report.json");
  const changelogPath = resolve(bundleDir, "changelog.json");
  const catalogCorePath = resolve(bundleDir, "catalog-core.json");
  const mappingsPath = resolve(bundleDir, "mappings.json");

  if (!existsSync(validationReportPath)) {
    return {
      reviewable: false,
      error: "validation-report.json not found (required artifact)",
    };
  }
  if (!existsSync(catalogCorePath)) {
    return {
      reviewable: false,
      error: "catalog-core.json not found (required artifact)",
    };
  }

  const validationReport = loadJson(validationReportPath);
  const catalogCore = loadJson(catalogCorePath);

  // Load optional artifacts (may not exist)
  const changelog = existsSync(changelogPath) ? loadJson(changelogPath) : null;
  const mappings = existsSync(mappingsPath) ? loadJson(mappingsPath) : { idMappings: [], aliases: [] };

  // Run all review checks
  const artifactIntegrity = checkArtifactIntegrity(manifest, bundleDir);
  const validationFindings = checkValidationFindings(validationReport);
  const changelogReview = changelog ? checkChangelog(changelog, manifest) : { findings: [], summary: { isFirstRelease: true } };
  const mappingReview = checkMappingsAndConflicts(mappings, catalogCore);
  const schemaReview = checkSchemaCompatibility(manifest);
  const domainArtifactReview = checkDomainArtifacts(manifest, bundleDir);

  // Compute package-binding hashes for review traceability
  const manifestRaw = readFileSync(manifestPath, "utf-8");
  const manifestHash = sha256(manifestRaw);
  const validationReportRaw = readFileSync(validationReportPath, "utf-8");
  const validationReportHash = sha256(validationReportRaw);

  // Determine overall review status — mapping conflicts with fatal severity now block
  const hasFatal = !artifactIntegrity.passed || !validationFindings.canPublish || !schemaReview.compatible || mappingReview.hasFatalConflicts || domainArtifactReview.hasFatal;
  const hasWarnings = validationFindings.warningCount > 0 || changelogReview.findings.length > 0 || mappingReview.warningFindings.length > 0 || domainArtifactReview.findings.some((finding) => finding.severity === "warning");

  let recommendedDecision = "approved";
  if (hasFatal) {
    recommendedDecision = "quarantined";
  } else if (hasWarnings) {
    recommendedDecision = "review_required";
  }

  return {
    reviewable: true,
    bundleDir,
    catalogVersion: manifest.catalogVersion,
    releaseId: manifest.releaseId,
    gameVersion: manifest.gameVersion,
    generatedAt: manifest.generatedAt,
    recommendedDecision,

    /** Package-binding hashes — tie this review to the exact immutable package. */
    manifestHash,
    validationReportHash,
    reviewEngineVersion: REVIEW_ENGINE_VERSION,

    artifactIntegrity: {
      passed: artifactIntegrity.passed,
      summary: artifactIntegrity.summary,
      artifacts: artifactIntegrity.artifacts.filter((a) => a.issues.length > 0),
    },

    validationFindings: {
      fatalCount: validationFindings.fatalCount,
      warningCount: validationFindings.warningCount,
      canPublish: validationFindings.canPublish,
      fatalFindings: validationFindings.fatalFindings,
      warningFindings: validationFindings.warningFindings,
    },

    changelogReview: {
      findings: changelogReview.findings,
      changeSummary: changelogReview.summary,
    },

    mappingReview: {
      findings: mappingReview.findings,
      fatalFindings: mappingReview.fatalFindings,
      warningFindings: mappingReview.warningFindings,
      mappingCount: mappingReview.mappingCount,
      aliasCount: mappingReview.aliasCount,
      hasFatalConflicts: mappingReview.hasFatalConflicts,
      hasConflicts: mappingReview.hasConflicts,
    },

    domainArtifactReview,

    schemaCompatibility: schemaReview,

    objectCounts: manifest.counts || {},

    manifestArtifactCount: manifest.artifacts?.length || 0,
    artifactSchemaVersions: (manifest.artifacts || []).map((a) => ({
      filename: a.filename,
      schemaVersion: a.schemaVersion,
      required: a.required,
    })),
  };
}

/**
 * Format the review summary for human-readable output.
 * @param {object} summary - Result from reviewPackage()
 * @returns {string} Formatted summary string
 */
export function formatReviewSummary(summary) {
  if (!summary.reviewable) {
    return `❌ Cannot review: ${summary.error}\n`;
  }

  const lines = [];
  lines.push("");
  lines.push(`🔍 Catalog Review: ${summary.catalogVersion}`);
  lines.push(`   Release: ${summary.releaseId}`);
  lines.push(`   Game: ${summary.gameVersion}`);
  lines.push(`   Generated: ${summary.generatedAt}`);
  lines.push(`   Recommendation: ${summary.recommendedDecision.toUpperCase()}`);
  lines.push("");

  // Artifact integrity
  lines.push("── Artifact Integrity ──");
  const ai = summary.artifactIntegrity;
  if (ai.passed) {
    lines.push("   ✅ All artifacts verified (hashes, bytes, paths).");
  } else {
    lines.push(`   ❌ ${ai.summary.failed} artifact(s) have issues:`);
    for (const art of ai.artifacts) {
      const icon = art.required ? "❌" : "⚠️";
      lines.push(`      ${icon} ${art.filename}: ${art.issues.join("; ")}`);
    }
  }
  lines.push("");

  // Validation findings
  lines.push("── Validation Findings ──");
  const vf = summary.validationFindings;
  if (vf.canPublish) {
    lines.push("   ✅ No fatal validation findings.");
  } else {
    lines.push(`   ❌ ${vf.fatalCount} fatal finding(s):`);
    for (const f of vf.fatalFindings) {
      lines.push(`      ❌ [${f.code}] ${f.message}`);
    }
  }
  if (vf.warningCount > 0) {
    lines.push(`   ⚠️  ${vf.warningCount} warning(s):`);
    for (const f of vf.warningFindings) {
      lines.push(`      ⚠️  [${f.code}] ${f.message}`);
    }
  }
  lines.push("");

  // Changelog
  if (summary.changelogReview.findings.length > 0) {
    lines.push("── Changelog Review ──");
    for (const f of summary.changelogReview.findings) {
      const icon = f.severity === "error" ? "❌" : "⚠️";
      lines.push(`   ${icon} [${f.code}] ${f.message}`);
    }
    const cs = summary.changelogReview.changeSummary;
    if (!cs.isFirstRelease) {
      lines.push(`   Changes: +${cs.added} -${cs.removed} ~${cs.changed}, ${cs.unresolved} unresolved`);
    }
    lines.push("");
  }

  // Mapping conflicts
  if (summary.mappingReview.findings.length > 0) {
    lines.push("── Mapping Conflicts ──");
    for (const f of summary.mappingReview.findings) {
      const icon = f.severity === "error" ? "❌" : "⚠️";
      lines.push(`   ${icon} [${f.code}] ${f.message}`);
    }
    lines.push("");
  }

  // Schema compatibility
  lines.push("── Schema Compatibility ──");
  const sc = summary.schemaCompatibility;
  if (sc.compatible) {
    lines.push("   ✅ All schema versions compatible.");
  } else {
    for (const issue of sc.issues) {
      lines.push(`   ❌ ${issue}`);
    }
  }
  lines.push("");

  if (summary.domainArtifactReview.findings.length > 0) {
    lines.push("── Domain Artifact Evidence ──");
    for (const finding of summary.domainArtifactReview.findings) {
      const icon = finding.severity === "error" ? "❌" : "⚠️";
      lines.push(`   ${icon} [${finding.code}] ${finding.message}`);
    }
    lines.push("");
  }

  // Object counts
  lines.push("── Object Counts ──");
  const counts = summary.objectCounts;
  lines.push(`   Managers: ${counts.managers || 0}  Mines: ${counts.mines || 0}  Equipment: ${counts.equipment || 0}`);
  lines.push(`   Research: ${counts.research || 0}  Collectibles: ${counts.collectibles || 0}  Artifacts: ${counts.artifacts || 0}`);
  lines.push(`   Relationships: ${counts.relationships || 0}  Unresolved: ${counts.unresolvedObjects || 0}`);
  lines.push("");

  // Decision guidance
  lines.push("── Decision Guidance ──");
  if (summary.recommendedDecision === "approved") {
    lines.push("   ✅ No blocking issues. Package is ready for approval.");
  } else if (summary.recommendedDecision === "quarantined") {
    lines.push("   🚫 Fatal issues found. Package cannot be published until resolved.");
  } else {
    lines.push("   ⚠️  Warnings present. Human review required before approval.");
  }
  lines.push("");

  return lines.join("\n");
}
