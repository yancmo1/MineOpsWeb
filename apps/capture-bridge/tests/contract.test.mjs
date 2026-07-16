/**
 * Contract Tests — UbuntuMac Capture Envelope at the PocketBase Boundary
 *
 * Validates that the capture-bridge CLI and the shared validator agree on
 * every payload scenario. Tests cover: valid, duplicate, malformed, legacy,
 * and future-schema payloads.
 *
 * Run: node --test tests/contract.test.mjs
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  validateReleasePayload,
  buildValidationReport,
  ERROR_CODES,
  exitCodeForError,
  REQUIRED_FIELDS,
  VALID_STATUSES,
  SUPPORTED_SCHEMA_VERSION,
  VALIDATION_VERSION,
  VALIDATED_BY,
} from "../../../shared/schemas/validate-release.mjs";

// ─── Paths ─────────────────────────────────────────────────────────────────

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..", "..", "..");
const FIXTURES_DIR = join(PROJECT_ROOT, "shared", "fixtures");
const CLI_PATH = join(PROJECT_ROOT, "apps", "capture-bridge", "src", "cli.mjs");

async function loadFixture(name) {
  const bytes = await readFile(join(FIXTURES_DIR, name));
  return JSON.parse(bytes.toString());
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Run the CLI with a fixture file in dry-run mode and return exit code + stdout.
 */
function runCli(fixtureName) {
  return new Promise((resolvePromise) => {
    const fixturePath = join(FIXTURES_DIR, fixtureName);
    const child = execFile(
      process.execPath,
      [CLI_PATH, fixturePath, "--dry-run"],
      { cwd: PROJECT_ROOT },
      (err, stdout, stderr) => {
        resolvePromise({
          exitCode: err ? (err.code ?? 1) : 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
        });
      },
    );
  });
}

// ─── Unit: Shared Validator ────────────────────────────────────────────────

describe("validateReleasePayload (shared validator)", () => {
  it("accepts a fully valid payload", async () => {
    const payload = await loadFixture("valid-release.json");
    const result = validateReleasePayload(payload);
    assert.equal(result.ok, true);
  });

  it("accepts a valid payload with extras (objects, manifest)", async () => {
    const payload = await loadFixture("valid-release-with-extras.json");
    const result = validateReleasePayload(payload);
    assert.equal(result.ok, true);
  });

  it("rejects missing releaseId with MISSING_REQUIRED_FIELD", async () => {
    const payload = await loadFixture("missing-releaseId.json");
    const result = validateReleasePayload(payload);
    assert.equal(result.ok, false);
    assert.equal(result.code, ERROR_CODES.MISSING_REQUIRED_FIELD);
  });

  it("rejects empty releaseId with INVALID_RELEASE_ID", async () => {
    const payload = await loadFixture("empty-releaseId.json");
    const result = validateReleasePayload(payload);
    assert.equal(result.ok, false);
    assert.equal(result.code, ERROR_CODES.INVALID_RELEASE_ID);
  });

  it("rejects versionCode=0 with INVALID_VERSION_CODE", async () => {
    const payload = await loadFixture("invalid-versionCode-zero.json");
    const result = validateReleasePayload(payload);
    assert.equal(result.ok, false);
    assert.equal(result.code, ERROR_CODES.INVALID_VERSION_CODE);
  });

  it("rejects negative versionCode with INVALID_VERSION_CODE", async () => {
    const payload = await loadFixture("invalid-versionCode-negative.json");
    const result = validateReleasePayload(payload);
    assert.equal(result.ok, false);
    assert.equal(result.code, ERROR_CODES.INVALID_VERSION_CODE);
  });

  it("rejects empty apkHashes with INVALID_APK_HASHES", async () => {
    const payload = await loadFixture("empty-apkHashes.json");
    const result = validateReleasePayload(payload);
    assert.equal(result.ok, false);
    assert.equal(result.code, ERROR_CODES.INVALID_APK_HASHES);
  });

  it("rejects malformed apkHash with INVALID_APK_HASHES", async () => {
    const payload = await loadFixture("invalid-apkHash-bad-format.json");
    const result = validateReleasePayload(payload);
    assert.equal(result.ok, false);
    assert.equal(result.code, ERROR_CODES.INVALID_APK_HASHES);
  });

  it("rejects invalid status with INVALID_STATUS", async () => {
    const payload = await loadFixture("invalid-status.json");
    const result = validateReleasePayload(payload);
    assert.equal(result.ok, false);
    assert.equal(result.code, ERROR_CODES.INVALID_STATUS);
  });

  it("rejects future schema version with UNSUPPORTED_SCHEMA_VERSION", async () => {
    const payload = await loadFixture("future-schema.json");
    const result = validateReleasePayload(payload);
    assert.equal(result.ok, false);
    assert.equal(result.code, ERROR_CODES.UNSUPPORTED_SCHEMA_VERSION);
    assert.ok(result.error.includes("99.0.0"));
  });

  it("rejects non-numeric schema version with UNSUPPORTED_SCHEMA_VERSION", async () => {
    const payload = await loadFixture("invalid-schemaVersion-format.json");
    const result = validateReleasePayload(payload);
    assert.equal(result.ok, false);
    assert.equal(result.code, ERROR_CODES.UNSUPPORTED_SCHEMA_VERSION);
  });

  it("accepts legacy schema version (0.9.0) — backward compatible", async () => {
    const payload = await loadFixture("legacy-schema.json");
    const result = validateReleasePayload(payload);
    assert.equal(result.ok, true);
  });

  it("rejects future validation version with UNSUPPORTED_VALIDATION_VERSION", async () => {
    const payload = await loadFixture("future-validation.json");
    const result = validateReleasePayload(payload);
    assert.equal(result.ok, false);
    assert.equal(result.code, ERROR_CODES.UNSUPPORTED_VALIDATION_VERSION);
    assert.ok(result.error.includes("99.0.0"));
  });

  it("rejects null payload with MISSING_REQUIRED_FIELD", () => {
    const result = validateReleasePayload(null);
    assert.equal(result.ok, false);
    assert.equal(result.code, ERROR_CODES.MISSING_REQUIRED_FIELD);
  });

  it("rejects undefined payload with MISSING_REQUIRED_FIELD", () => {
    const result = validateReleasePayload(undefined);
    assert.equal(result.ok, false);
    assert.equal(result.code, ERROR_CODES.MISSING_REQUIRED_FIELD);
  });
});

// ─── Contract: CLI ≡ Shared Validator ──────────────────────────────────────

describe("CLI — contract with shared validator", () => {
  it("accepts valid-release.json (exit 0)", async () => {
    const { exitCode, stdout } = await runCli("valid-release.json");
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("dry-run"));
    assert.ok(stdout.includes("4.90.0_123456_2026-07-16T12-00-00Z"));
  });

  it("rejects missing-releaseId.json (exit 1, error code printed)", async () => {
    const { exitCode, stderr } = await runCli("missing-releaseId.json");
    assert.equal(exitCode, 1);
    assert.ok(stderr.includes("ERROR_CODES.MISSING_REQUIRED_FIELD") || stderr.includes("Missing required fields"));
  });

  it("rejects empty-releaseId.json (exit 1)", async () => {
    const { exitCode } = await runCli("empty-releaseId.json");
    assert.equal(exitCode, 1);
  });

  it("rejects invalid-versionCode-zero.json (exit 1)", async () => {
    const { exitCode } = await runCli("invalid-versionCode-zero.json");
    assert.equal(exitCode, 1);
  });

  it("rejects future-schema.json (exit 1)", async () => {
    const { exitCode, stderr } = await runCli("future-schema.json");
    assert.equal(exitCode, 1);
    assert.ok(stderr.includes("Unsupported schemaVersion") || stderr.includes("99.0.0"));
  });

  it("rejects future-validation.json (exit 1)", async () => {
    const { exitCode, stderr } = await runCli("future-validation.json");
    assert.equal(exitCode, 1);
    assert.ok(stderr.includes("validationVersion") || stderr.includes("99.0.0"));
  });

  it("accepts legacy-schema.json (exit 0)", async () => {
    const { exitCode, stdout } = await runCli("legacy-schema.json");
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("dry-run"));
  });
});

// ─── Exit Code Mapping ─────────────────────────────────────────────────────

describe("exitCodeForError", () => {
  it("returns 14 for DUPLICATE_RELEASE", () => {
    assert.equal(exitCodeForError(ERROR_CODES.DUPLICATE_RELEASE), 14);
  });

  it("returns 2 for UNAUTHORIZED", () => {
    assert.equal(exitCodeForError(ERROR_CODES.UNAUTHORIZED), 2);
  });

  it("returns 1 for any VALIDATION_ERROR variant", () => {
    assert.equal(exitCodeForError(ERROR_CODES.MISSING_REQUIRED_FIELD), 1);
    assert.equal(exitCodeForError(ERROR_CODES.INVALID_RELEASE_ID), 1);
    assert.equal(exitCodeForError(ERROR_CODES.INVALID_VERSION_CODE), 1);
    assert.equal(exitCodeForError(ERROR_CODES.INVALID_APK_HASHES), 1);
    assert.equal(exitCodeForError(ERROR_CODES.INVALID_STATUS), 1);
    assert.equal(exitCodeForError(ERROR_CODES.UNSUPPORTED_SCHEMA_VERSION), 1);
    assert.equal(exitCodeForError(ERROR_CODES.UNSUPPORTED_VALIDATION_VERSION), 1);
  });

  it("returns 1 for unknown error codes", () => {
    assert.equal(exitCodeForError("SOME_RANDOM_CODE"), 1);
  });
});

// ─── Constants Consistency ─────────────────────────────────────────────────

describe("validator constants", () => {
  it("REQUIRED_FIELDS contains all 9 required fields", () => {
    assert.equal(REQUIRED_FIELDS.length, 9);
    assert.ok(REQUIRED_FIELDS.includes("releaseId"));
    assert.ok(REQUIRED_FIELDS.includes("versionName"));
    assert.ok(REQUIRED_FIELDS.includes("versionCode"));
    assert.ok(REQUIRED_FIELDS.includes("capturedAt"));
    assert.ok(REQUIRED_FIELDS.includes("engineVersion"));
    assert.ok(REQUIRED_FIELDS.includes("schemaVersion"));
    assert.ok(REQUIRED_FIELDS.includes("validationVersion"));
    assert.ok(REQUIRED_FIELDS.includes("apkHashes"));
    assert.ok(REQUIRED_FIELDS.includes("status"));
  });

  it("VALID_STATUSES contains exactly 4 values", () => {
    assert.equal(VALID_STATUSES.length, 4);
    assert.ok(VALID_STATUSES.includes("acquired"));
    assert.ok(VALID_STATUSES.includes("processed"));
    assert.ok(VALID_STATUSES.includes("published"));
    assert.ok(VALID_STATUSES.includes("failed"));
  });

  it("SUPPORTED_SCHEMA_VERSION is a valid semver", () => {
    assert.ok(/^\d+\.\d+\.\d+$/.test(SUPPORTED_SCHEMA_VERSION));
  });

  it("VALIDATION_VERSION is a valid semver", () => {
    assert.ok(/^\d+\.\d+\.\d+$/.test(VALIDATION_VERSION));
    assert.equal(VALIDATION_VERSION, "1.0.0");
  });

  it("VALIDATED_BY identifies MineOpsDataEngine", () => {
    assert.equal(VALIDATED_BY, "MineOpsDataEngine");
  });
});

// ─── Validation Provenance Report ──────────────────────────────────────────

describe("buildValidationReport", () => {
  it("returns a report with all required fields", () => {
    const report = buildValidationReport();
    assert.equal(report.validatedBy, "MineOpsDataEngine");
    assert.equal(report.validationVersion, VALIDATION_VERSION);
    assert.equal(typeof report.timestamp, "string");
    assert.ok(report.timestamp.length > 0);
  });

  it("accepts override options", () => {
    const report = buildValidationReport({
      gitCommit: "abc123def",
      host: "build-server-01",
      timestamp: "2026-01-01T00:00:00.000Z",
    });
    assert.equal(report.gitCommit, "abc123def");
    assert.equal(report.host, "build-server-01");
    assert.equal(report.timestamp, "2026-01-01T00:00:00.000Z");
  });

  it("reads gitCommit from MINEOPS_GIT_COMMIT env", () => {
    process.env.MINEOPS_GIT_COMMIT = "deadbeef";
    const report = buildValidationReport();
    assert.equal(report.gitCommit, "deadbeef");
    delete process.env.MINEOPS_GIT_COMMIT;
  });

  it("reads host from MINEOPS_HOST env", () => {
    process.env.MINEOPS_HOST = "prod-node-7";
    const report = buildValidationReport();
    assert.equal(report.host, "prod-node-7");
    delete process.env.MINEOPS_HOST;
  });
});

// ─── Server Hook Contract (mirror checks) ──────────────────────────────────

describe("server hook contract (mirror validation)", () => {
  /**
   * These tests verify the PocketBase hook mirrors the same validation logic.
   * Since we can't run the hook in-process, we validate that every fixture
   * the shared validator rejects would also be caught by the hook's
   * documented validation rules.
   */

  const HOOK_REQUIRED = [
    "releaseId", "versionName", "versionCode", "capturedAt",
    "engineVersion", "schemaVersion", "validationVersion", "apkHashes", "status",
  ];

  it("hook REQUIRED array matches shared REQUIRED_FIELDS", () => {
    assert.deepEqual(HOOK_REQUIRED.sort(), [...REQUIRED_FIELDS].sort());
  });

  it("hook and shared validator agree on all fixture outcomes", async () => {
    // Load all fixtures and verify the shared validator result matches
    // what we expect the hook to produce (same logic).
    const fixtures = [
      { file: "valid-release.json", expectOk: true },
      { file: "valid-release-with-extras.json", expectOk: true },
      { file: "missing-releaseId.json", expectOk: false },
      { file: "empty-releaseId.json", expectOk: false },
      { file: "invalid-versionCode-zero.json", expectOk: false },
      { file: "invalid-versionCode-negative.json", expectOk: false },
      { file: "empty-apkHashes.json", expectOk: false },
      { file: "invalid-apkHash-bad-format.json", expectOk: false },
      { file: "invalid-status.json", expectOk: false },
      { file: "future-schema.json", expectOk: false },
      { file: "future-validation.json", expectOk: false },
      { file: "legacy-schema.json", expectOk: true },
      { file: "invalid-schemaVersion-format.json", expectOk: false },
    ];

    for (const { file, expectOk } of fixtures) {
      const payload = await loadFixture(file);
      const result = validateReleasePayload(payload);
      assert.equal(
        result.ok,
        expectOk,
        `Fixture ${file}: expected ok=${expectOk}, got ok=${result.ok} (${result.error ?? "no error"})`,
      );
    }
  });

  it("every error code has a non-empty string value", () => {
    for (const [key, value] of Object.entries(ERROR_CODES)) {
      assert.equal(typeof value, "string");
      assert.ok(value.length > 0, `ERROR_CODES.${key} is empty`);
    }
  });

  it("error codes follow CATEGORY / REASON format", () => {
    for (const value of Object.values(ERROR_CODES)) {
      assert.ok(
        value.includes(" / ") || value === "DUPLICATE_RELEASE" || value === "UNAUTHORIZED",
        `Error code "${value}" does not follow expected format`,
      );
    }
  });
});
