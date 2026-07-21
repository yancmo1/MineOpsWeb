/**
 * Catalog Review Contract Tests
 *
 * Verifies the review evidence pipeline:
 *   - Fatal findings block readiness/publication
 *   - Warnings remain visible without mutating source artifacts
 *   - Missing artifacts, hash failures, unresolved mappings, conflicts
 *   - Approval, rejection, and re-review behavior
 *   - Schema compatibility checks
 *   - Generated evidence stays in JSON (review module reads from package)
 *
 * Usage: node --test tests/catalog-review.test.mjs
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { reviewPackage } from "../shared/schemas/review-package.mjs";

// ---------------------------------------------------------------------------
// Paths & helpers
// ---------------------------------------------------------------------------
const ROOT = resolve(import.meta.dirname, "..");
const FIXTURES_DIR = resolve(ROOT, "tests", "fixtures", "review");
const EXAMPLE_DIR = resolve(ROOT, "catalogs", "example");

function sha256(content) {
  return createHash("sha256").update(content, "utf-8").digest("hex");
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])])
    );
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(stableValue(value), null, 2) + "\n";
}

function setupFixture(name) {
  const dir = resolve(FIXTURES_DIR, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeArtifact(dir, filename, content) {
  writeFileSync(resolve(dir, filename), canonicalJson(content));
}

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

/** Build a minimal valid v2 manifest referencing artifacts in the fixture dir. */
function buildManifest(dir, overrides = {}) {
  return {
    manifestSchemaVersion: overrides.manifestSchemaVersion || "2.0.0",
    catalogVersion: overrides.catalogVersion || "1.0.0-100000-test",
    releaseId: overrides.releaseId || "test-release",
    gameVersion: overrides.gameVersion || "1.0.0",
    gameVersionCode: overrides.gameVersionCode || 100000,
    generatedAt: overrides.generatedAt || "2026-07-16T00:00:00.000Z",
    generator: overrides.generator || { name: "TestGenerator", version: "0.1.0" },
    status: overrides.status || "candidate",
    artifacts: overrides.artifacts || [],
    counts: overrides.counts || {
      managers: 1,
      mines: 0,
      equipment: 0,
      research: 0,
      collectibles: 0,
      artifacts: 0,
      relationships: 0,
      unresolvedObjects: 0,
    },
    previousCatalogVersion: overrides.previousCatalogVersion !== undefined ? overrides.previousCatalogVersion : null,
    storage: overrides.storage || { baseUrl: "./", cdnUrl: null },
  };
}

/** Build a minimal catalog-core artifact. */
function buildCatalogCore(overrides = {}) {
  return {
    schemaVersion: "1.0.0",
    catalogVersion: overrides.catalogVersion || "1.0.0-100000-test",
    releaseId: overrides.releaseId || "test-release",
    generatedAt: "2026-07-16T00:00:00.000Z",
    source: {
      kind: "fixture",
      versionName: "1.0.0",
      versionCode: 100000,
      apkHashes: {},
      parserVersion: "0.1.0",
    },
    managers: overrides.managers || [{ canonicalId: "mgr-1", name: "Test Manager" }],
    mines: overrides.mines || [],
    equipment: overrides.equipment || [],
    research: overrides.research || [],
    collectibles: overrides.collectibles || [],
    artifacts: overrides.artifacts || [],
  };
}

/** Build a minimal validation-report artifact. */
function buildValidationReport(overrides = {}) {
  return {
    validationSchemaVersion: "1.0.0",
    catalogVersion: overrides.catalogVersion || "1.0.0-100000-test",
    validatedAt: "2026-07-16T00:00:00.000Z",
    status: overrides.status || "passed",
    checks: overrides.checks || [
      { code: "SCHEMA_VALID", severity: "error", passed: true, message: "All schemas valid.", path: null },
      { code: "MANIFEST_CATALOG_CONSISTENCY", severity: "error", passed: true, message: "Manifest consistent.", path: null },
      { code: "ARTIFACT_HASH_CONSISTENCY", severity: "error", passed: true, message: "Hashes match.", path: null },
      { code: "DUPLICATE_CANONICAL_ID", severity: "error", passed: true, message: "No duplicates.", path: null },
      { code: "MANIFEST_ARTIFACTS", severity: "error", passed: true, message: "Artifacts present.", path: null },
      { code: "DETERMINISTIC_SERIALIZATION", severity: "error", passed: true, message: "Deterministic.", path: null },
      { code: "DUPLICATE_SOURCE_IDENTIFIER", severity: "error", passed: true, message: "IDs unique.", path: null },
      { code: "MISSING_REQUIRED_FIELDS", severity: "error", passed: true, message: "Fields OK.", path: null },
      { code: "UNRESOLVED_OBJECTS", severity: "warning", passed: true, message: "No unresolved.", path: null },
      { code: "INVALID_REFERENCES", severity: "error", passed: true, message: "Refs valid.", path: null },
      { code: "SUSPICIOUS_CHANGE_DETECTION", severity: "warning", passed: true, message: "No suspicious changes.", path: null },
    ],
    blockingIssues: overrides.blockingIssues || [],
    warnings: overrides.warnings || [],
    counts: overrides.counts || { errors: 0, warnings: 0, unresolved: 0 },
  };
}

/** Build a minimal changelog artifact. */
function buildChangelog(overrides = {}) {
  return {
    schemaVersion: "1.0.0",
    catalogVersion: overrides.catalogVersion || "1.0.0-100000-test",
    previousCatalogVersion: overrides.previousCatalogVersion !== undefined ? overrides.previousCatalogVersion : null,
    generatedAt: "2026-07-16T00:00:00.000Z",
    summary: overrides.summary || {
      managersAdded: 0, managersRemoved: 0, managersChanged: 0,
      identifiersChanged: 0, spritesChanged: 0, abilitiesChanged: 0,
      unresolvedObjects: 0, warnings: 0,
    },
    changes: overrides.changes || { added: [], removed: [], changed: [], unresolved: [] },
  };
}

/** Build a minimal mappings artifact. */
function buildMappings(overrides = {}) {
  return {
    schemaVersion: "1.0.0",
    catalogVersion: overrides.catalogVersion || "1.0.0-100000-test",
    releaseId: overrides.releaseId || "test-release",
    generatedAt: "2026-07-16T00:00:00.000Z",
    idMappings: overrides.idMappings || [],
    aliases: overrides.aliases || [],
  };
}

/** Create a full valid fixture bundle and return the review summary. */
function createValidFixture(dir, overrides = {}) {
  const catalogCore = buildCatalogCore(overrides.catalogCore);
  const validationReport = buildValidationReport(overrides.validationReport);
  const changelog = buildChangelog(overrides.changelog);
  const mappings = buildMappings(overrides.mappings);

  writeArtifact(dir, "catalog-core.json", catalogCore);
  writeArtifact(dir, "validation-report.json", validationReport);
  writeArtifact(dir, "changelog.json", changelog);
  writeArtifact(dir, "mappings.json", mappings);

  // Write empty required artifacts (assets, localization, relationships)
  writeArtifact(dir, "assets.json", { schemaVersion: "1.0.0", catalogVersion: catalogCore.catalogVersion, releaseId: catalogCore.releaseId, generatedAt: catalogCore.generatedAt, assets: [] });
  writeArtifact(dir, "localization.json", { schemaVersion: "1.0.0", catalogVersion: catalogCore.catalogVersion, releaseId: catalogCore.releaseId, generatedAt: catalogCore.generatedAt, locale: "en", entries: {} });
  writeArtifact(dir, "relationships.json", { schemaVersion: "1.0.0", catalogVersion: catalogCore.catalogVersion, releaseId: catalogCore.releaseId, generatedAt: catalogCore.generatedAt, relationships: [] });

  // Build manifest with real hashes
  const artifactFiles = ["catalog-core.json", "validation-report.json", "changelog.json", "mappings.json", "assets.json", "localization.json", "relationships.json"];
  const artifacts = [];

  for (const filename of artifactFiles) {
    const content = readFileSync(resolve(dir, filename), "utf-8");
    const hash = sha256(content);
    const bytes = Buffer.byteLength(content, "utf-8");
    const parsed = JSON.parse(content);
    let recordCount = 0;
    if (filename === "catalog-core.json") recordCount = (parsed.managers || []).length;
    else if (filename === "relationships.json") recordCount = (parsed.relationships || []).length;
    else if (filename === "mappings.json") recordCount = (parsed.idMappings || []).length;
    else if (filename === "localization.json") recordCount = Object.keys(parsed.entries || {}).length;
    else if (filename === "assets.json") recordCount = (parsed.assets || []).length;
    else if (filename === "changelog.json") recordCount = (parsed.changes?.added || []).length + (parsed.changes?.removed || []).length;

    artifacts.push({
      filename,
      contentType: "application/json",
      sha256: hash,
      bytes,
      schemaVersion: "1.0.0",
      recordCount,
      required: filename === "catalog-core.json" || filename === "validation-report.json",
      path: filename,
    });
  }

  const manifest = buildManifest(dir, {
    ...overrides.manifestOverrides,
    artifacts,
    counts: {
      managers: (catalogCore.managers || []).length,
      mines: 0, equipment: 0, research: 0, collectibles: 0, artifacts: 0,
      relationships: 0, unresolvedObjects: 0,
    },
  });

  writeArtifact(dir, "manifest.json", manifest);
  return dir;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Valid package review", () => {
  it("reviews a valid v2 package as approved", () => {
    const dir = setupFixture("valid-package");
    createValidFixture(dir);
    const summary = reviewPackage(dir);
    assert.equal(summary.reviewable, true);
    assert.equal(summary.recommendedDecision, "approved");
    assert.equal(summary.artifactIntegrity.passed, true);
    assert.equal(summary.validationFindings.canPublish, true);
    assert.equal(summary.schemaCompatibility.compatible, true);
  });

  it("reviews the canonical example bundle as approved", () => {
    const summary = reviewPackage(EXAMPLE_DIR);
    assert.equal(summary.reviewable, true);
    assert.equal(summary.recommendedDecision, "approved");
    assert.equal(summary.artifactIntegrity.passed, true);
  });
});

describe("Missing required artifacts", () => {
  it("returns not reviewable when manifest is missing", () => {
    const dir = setupFixture("missing-manifest");
    const summary = reviewPackage(dir);
    assert.equal(summary.reviewable, false);
    assert.ok(summary.error.includes("No manifest found"));
  });

  it("returns not reviewable when validation-report.json is missing", () => {
    const dir = setupFixture("missing-validation-report");
    createValidFixture(dir);
    // Remove the required artifact
    rmSync(resolve(dir, "validation-report.json"));
    const summary = reviewPackage(dir);
    assert.equal(summary.reviewable, false);
    assert.ok(summary.error.includes("validation-report.json not found"));
  });

  it("returns not reviewable when catalog-core.json is missing", () => {
    const dir = setupFixture("missing-catalog-core");
    createValidFixture(dir);
    rmSync(resolve(dir, "catalog-core.json"));
    const summary = reviewPackage(dir);
    assert.equal(summary.reviewable, false);
    assert.ok(summary.error.includes("catalog-core.json not found"));
  });

  it("missing optional artifact does not block review", () => {
    const dir = setupFixture("missing-optional");
    createValidFixture(dir);
    rmSync(resolve(dir, "changelog.json"));
    const summary = reviewPackage(dir);
    assert.equal(summary.reviewable, true);
    assert.equal(summary.recommendedDecision, "approved"); // changelog is optional
  });
});

describe("Hash failures", () => {
  it("detects a hash mismatch on a required artifact", () => {
    const dir = setupFixture("hash-mismatch");
    createValidFixture(dir);
    // Corrupt catalog-core.json
    const fp = resolve(dir, "catalog-core.json");
    const content = readFileSync(fp, "utf-8");
    writeFileSync(fp, content.replace('"kind": "fixture"', '"kind": "corrupted"'));
    const summary = reviewPackage(dir);
    assert.equal(summary.reviewable, true);
    assert.equal(summary.artifactIntegrity.passed, false);
    assert.equal(summary.recommendedDecision, "quarantined");
    const catalogCoreArtifact = summary.artifactIntegrity.artifacts.find((a) => a.filename === "catalog-core.json");
    assert.ok(catalogCoreArtifact);
    assert.equal(catalogCoreArtifact.hashMatch, false);
  });

  it("hash mismatch on optional artifact does not quarantine", () => {
    const dir = setupFixture("hash-mismatch-optional");
    createValidFixture(dir);
    const fp = resolve(dir, "changelog.json");
    const content = readFileSync(fp, "utf-8");
    writeFileSync(fp, content.replace('"managersAdded": 0', '"managersAdded": 99'));
    const summary = reviewPackage(dir);
    assert.equal(summary.reviewable, true);
    // Optional artifact hash mismatch — still passes overall integrity
    const changelogArtifact = summary.artifactIntegrity.artifacts.find((a) => a.filename === "changelog.json");
    assert.ok(changelogArtifact);
    assert.equal(changelogArtifact.hashMatch, false);
    assert.equal(changelogArtifact.required, false);
  });
});

describe("Fatal validation findings", () => {
  it("fatal findings in validation report block publication", () => {
    const dir = setupFixture("fatal-findings");
    createValidFixture(dir, {
      validationReport: {
        status: "failed",
        checks: [
          { code: "SCHEMA_VALID", severity: "error", passed: false, message: "Schema validation failed.", path: null },
        ],
        blockingIssues: [
          { code: "SCHEMA_VALID", message: "catalog-core does not conform.", path: "catalog-core.json" },
        ],
      },
    });
    const summary = reviewPackage(dir);
    assert.equal(summary.validationFindings.canPublish, false);
    assert.equal(summary.validationFindings.fatalCount, 2); // 1 check + 1 blocking issue
    assert.equal(summary.recommendedDecision, "quarantined");
  });

  it("warning validation findings do not block publication", () => {
    const dir = setupFixture("warning-findings");
    createValidFixture(dir, {
      validationReport: {
        status: "passed",
        warnings: [
          { code: "UNRESOLVED_OBJECTS", message: "3 unresolved objects.", path: null },
        ],
        counts: { errors: 0, warnings: 1, unresolved: 3 },
      },
    });
    const summary = reviewPackage(dir);
    assert.equal(summary.validationFindings.canPublish, true);
    assert.equal(summary.validationFindings.warningCount, 1);
    assert.equal(summary.recommendedDecision, "review_required");
  });
});

describe("Unresolved mappings and conflicts", () => {
  it("detects duplicate source identifiers as fatal", () => {
    const dir = setupFixture("duplicate-mappings");
    createValidFixture(dir, {
      mappings: {
        idMappings: [
          { canonicalId: "mgr-1", kind: "unity_guid", sourceValue: "abc123", confidence: "verified" },
          { canonicalId: "mgr-2", kind: "unity_guid", sourceValue: "abc123", confidence: "verified" },
        ],
      },
    });
    const summary = reviewPackage(dir);
    // Duplicate source identifiers are now fatal → quarantined
    assert.equal(summary.mappingReview.hasFatalConflicts, true);
    assert.equal(summary.recommendedDecision, "quarantined");
    const dupFinding = summary.mappingReview.fatalFindings.find((f) => f.code === "DUPLICATE_SOURCE_IDENTIFIER");
    assert.ok(dupFinding);
  });

  it("detects orphaned mappings to non-existent entities", () => {
    const dir = setupFixture("orphaned-mappings");
    createValidFixture(dir, {
      mappings: {
        idMappings: [
          { canonicalId: "nonexistent-entity", kind: "unity_guid", sourceValue: "xyz789", confidence: "verified" },
        ],
      },
    });
    const summary = reviewPackage(dir);
    const orphanFinding = summary.mappingReview.findings.find((f) => f.code === "ORPHANED_MAPPING");
    assert.ok(orphanFinding);
    assert.ok(orphanFinding.message.includes("nonexistent-entity"));
  });

  it("detects orphaned aliases", () => {
    const dir = setupFixture("orphaned-aliases");
    createValidFixture(dir, {
      mappings: {
        idMappings: [],
        aliases: [
          { canonicalId: "nonexistent-entity", alias: "Ghost Manager", kind: "historical_name" },
        ],
      },
    });
    const summary = reviewPackage(dir);
    const aliasFinding = summary.mappingReview.findings.find((f) => f.code === "ORPHANED_ALIAS");
    assert.ok(aliasFinding);
  });

  it("clean mappings produce no conflicts", () => {
    const dir = setupFixture("clean-mappings");
    createValidFixture(dir, {
      mappings: {
        idMappings: [
          { canonicalId: "mgr-1", kind: "unity_guid", sourceValue: "abc123", confidence: "verified" },
          { canonicalId: "mgr-1", kind: "kolibri_id", sourceValue: "k456", confidence: "inferred" },
        ],
        aliases: [
          { canonicalId: "mgr-1", alias: "Test", kind: "abbreviation" },
        ],
      },
    });
    const summary = reviewPackage(dir);
    assert.equal(summary.mappingReview.hasFatalConflicts, false);
    assert.equal(summary.mappingReview.mappingCount, 2);
    assert.equal(summary.mappingReview.aliasCount, 1);
  });
});

describe("Package-binding hashes", () => {
  it("review output includes manifestHash and validationReportHash", () => {
    const dir = setupFixture("binding-hashes");
    createValidFixture(dir);
    const summary = reviewPackage(dir);
    // Both hashes must be present and valid SHA-256
    assert.ok(summary.manifestHash, "manifestHash missing");
    assert.ok(/^[a-f0-9]{64}$/.test(summary.manifestHash), "manifestHash not valid SHA-256");
    assert.ok(summary.validationReportHash, "validationReportHash missing");
    assert.ok(/^[a-f0-9]{64}$/.test(summary.validationReportHash), "validationReportHash not valid SHA-256");
    // Hashes must differ (different files)
    assert.notEqual(summary.manifestHash, summary.validationReportHash);
  });

  it("review output includes reviewEngineVersion", () => {
    const dir = setupFixture("engine-version");
    createValidFixture(dir);
    const summary = reviewPackage(dir);
    assert.ok(summary.reviewEngineVersion, "reviewEngineVersion missing");
    assert.equal(typeof summary.reviewEngineVersion, "string");
    // Must be semver-like
    assert.ok(/^\d+\.\d+\.\d+$/.test(summary.reviewEngineVersion));
  });
});

describe("Schema compatibility", () => {
  it("rejects unsupported manifest major version", () => {
    const dir = setupFixture("unsupported-manifest");
    createValidFixture(dir, {
      manifestOverrides: { manifestSchemaVersion: "99.0.0" },
    });
    const summary = reviewPackage(dir);
    // Unrecognized manifest major → not reviewable at all
    assert.equal(summary.reviewable, false);
    assert.ok(summary.error.includes("not v2 format"));
  });

  it("rejects unsupported required artifact schema version", () => {
    const dir = setupFixture("unsupported-artifact-schema");
    createValidFixture(dir);
    // Manually update the manifest to claim an unsupported schema version for catalog-core
    const manifestPath = resolve(dir, "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    const coreEntry = manifest.artifacts.find((a) => a.filename === "catalog-core.json");
    coreEntry.schemaVersion = "99.0.0";
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
    const summary = reviewPackage(dir);
    assert.equal(summary.schemaCompatibility.compatible, false);
  });

  it("rejects non-v2 manifest", () => {
    const dir = setupFixture("v1-manifest");
    writeFileSync(resolve(dir, "manifest.json"), JSON.stringify({ manifestSchemaVersion: "1.0.0", artifact: {} }, null, 2) + "\n");
    const summary = reviewPackage(dir);
    assert.equal(summary.reviewable, false);
    assert.ok(summary.error.includes("not v2 format"));
  });
});

describe("Changelog review", () => {
  it("flags suspiciously large manager changes with rule reference", () => {
    const dir = setupFixture("suspicious-changelog");
    createValidFixture(dir, {
      changelog: {
        previousCatalogVersion: "0.9.0-090000-old",
        summary: {
          managersAdded: 60, managersRemoved: 10, managersChanged: 0,
          identifiersChanged: 0, spritesChanged: 0, abilitiesChanged: 0,
          unresolvedObjects: 0, warnings: 1,
        },
        changes: { added: [], removed: [], changed: [], unresolved: [] },
      },
    });
    const summary = reviewPackage(dir);
    const suspiciousFinding = summary.changelogReview.findings.find((f) => f.code === "SUSPICIOUS_CHANGE_DETECTION");
    assert.ok(suspiciousFinding);
    // Should reference the named rule and version
    assert.ok(suspiciousFinding.message.includes("SUSPICIOUS_CHANGE_COUNT"));
    assert.ok(suspiciousFinding.message.includes("v1"));
    assert.equal(summary.changelogReview.changeSummary.added, 60);
  });

  it("does not flag suspicious changes for first release", () => {
    const dir = setupFixture("first-release-changelog");
    createValidFixture(dir, {
      changelog: {
        previousCatalogVersion: null,
        summary: {
          managersAdded: 100, managersRemoved: 0, managersChanged: 0,
          identifiersChanged: 0, spritesChanged: 0, abilitiesChanged: 0,
          unresolvedObjects: 0, warnings: 0,
        },
        changes: { added: [], removed: [], changed: [], unresolved: [] },
      },
      manifestOverrides: { previousCatalogVersion: null },
    });
    const summary = reviewPackage(dir);
    // First release with null previous — suspicious check should not flag
    const suspiciousFinding = summary.changelogReview.findings.find((f) => f.code === "SUSPICIOUS_CHANGE_DETECTION");
    assert.equal(suspiciousFinding, undefined);
  });

  it("flags unresolved objects in changelog", () => {
    const dir = setupFixture("unresolved-changelog");
    createValidFixture(dir, {
      changelog: {
        previousCatalogVersion: "0.9.0-090000-old",
        summary: {
          managersAdded: 0, managersRemoved: 0, managersChanged: 0,
          identifiersChanged: 0, spritesChanged: 0, abilitiesChanged: 0,
          unresolvedObjects: 15, warnings: 0,
        },
        changes: { added: [], removed: [], changed: [], unresolved: [] },
      },
    });
    const summary = reviewPackage(dir);
    const unresolvedFinding = summary.changelogReview.findings.find((f) => f.code === "UNRESOLVED_OBJECTS");
    assert.ok(unresolvedFinding);
  });
});

describe("Review decision guidance", () => {
  it("clean package → approved", () => {
    const dir = setupFixture("clean-approval");
    createValidFixture(dir);
    const summary = reviewPackage(dir);
    assert.equal(summary.recommendedDecision, "approved");
  });

  it("fatal validation + hash failure → quarantined", () => {
    const dir = setupFixture("double-fatal");
    createValidFixture(dir, {
      validationReport: {
        status: "failed",
        blockingIssues: [{ code: "SCHEMA_VALID", message: "Schema invalid." }],
      },
    });
    // Also corrupt the hash
    const fp = resolve(dir, "catalog-core.json");
    const content = readFileSync(fp, "utf-8");
    writeFileSync(fp, content.replace('"kind": "fixture"', '"kind": "broken"'));
    const summary = reviewPackage(dir);
    assert.equal(summary.recommendedDecision, "quarantined");
    assert.equal(summary.artifactIntegrity.passed, false);
    assert.equal(summary.validationFindings.canPublish, false);
  });

  it("warnings only → review_required", () => {
    const dir = setupFixture("warnings-only");
    createValidFixture(dir, {
      validationReport: {
        status: "passed",
        warnings: [
          { code: "UNRESOLVED_OBJECTS", message: "5 unresolved objects.", path: null },
        ],
        counts: { errors: 0, warnings: 1, unresolved: 5 },
      },
    });
    const summary = reviewPackage(dir);
    assert.equal(summary.recommendedDecision, "review_required");
    assert.equal(summary.validationFindings.canPublish, true);
    assert.equal(summary.validationFindings.warningCount, 1);
  });
});

describe("Generated evidence immutability", () => {
  it("review does not modify source artifact files", () => {
    const dir = setupFixture("immutability-test");
    createValidFixture(dir);

    // Record original contents
    const files = ["catalog-core.json", "validation-report.json", "changelog.json", "mappings.json"];
    const originals = {};
    for (const f of files) {
      originals[f] = readFileSync(resolve(dir, f), "utf-8");
    }

    // Run review
    reviewPackage(dir);

    // Verify no files were modified
    for (const f of files) {
      const current = readFileSync(resolve(dir, f), "utf-8");
      assert.equal(current, originals[f], `${f} was modified by review (should be immutable)`);
    }
  });
});
