/**
 * MineOps Release Payload Validator — SHARED CONTRACT
 *
 * Single source of truth for capture envelope validation.
 * Used by both the capture-bridge CLI and the PocketBase ingest hook.
 *
 * Schema version:     1.0.0  (payload shape contract)
 * Validation version: 1.0.0  (validator rules — can evolve independently)
 *
 * Every payload MUST carry both schemaVersion and validationVersion.
 *
 * Returns { ok: true } on success, or { ok: false, code, error } on failure.
 *
 * Stable error codes (machine-readable, for contract testing):
 *   VALIDATION_ERROR / MISSING_REQUIRED_FIELD
 *   VALIDATION_ERROR / INVALID_RELEASE_ID
 *   VALIDATION_ERROR / INVALID_VERSION_CODE
 *   VALIDATION_ERROR / INVALID_APK_HASHES
 *   VALIDATION_ERROR / INVALID_STATUS
 *   VALIDATION_ERROR / UNSUPPORTED_SCHEMA_VERSION
 *   VALIDATION_ERROR / UNSUPPORTED_VALIDATION_VERSION
 */

// ─── Constants ─────────────────────────────────────────────────────────────

export const SUPPORTED_SCHEMA_VERSION = "1.0.0";
export const VALIDATION_VERSION = "1.0.0";

/** The canonical name of this validation system. */
export const VALIDATED_BY = "MineOpsDataEngine";

export const REQUIRED_FIELDS = [
  "releaseId",
  "versionName",
  "versionCode",
  "capturedAt",
  "engineVersion",
  "schemaVersion",
  "validationVersion",
  "apkHashes",
  "status",
];

export const VALID_STATUSES = Object.freeze([
  "acquired",
  "processed",
  "published",
  "failed",
]);

export const ERROR_CODES = Object.freeze({
  MISSING_REQUIRED_FIELD: "VALIDATION_ERROR / MISSING_REQUIRED_FIELD",
  INVALID_RELEASE_ID: "VALIDATION_ERROR / INVALID_RELEASE_ID",
  INVALID_VERSION_CODE: "VALIDATION_ERROR / INVALID_VERSION_CODE",
  INVALID_APK_HASHES: "VALIDATION_ERROR / INVALID_APK_HASHES",
  INVALID_STATUS: "VALIDATION_ERROR / INVALID_STATUS",
  UNSUPPORTED_SCHEMA_VERSION: "VALIDATION_ERROR / UNSUPPORTED_SCHEMA_VERSION",
  UNSUPPORTED_VALIDATION_VERSION: "VALIDATION_ERROR / UNSUPPORTED_VALIDATION_VERSION",
  DUPLICATE_RELEASE: "DUPLICATE_RELEASE",
  UNAUTHORIZED: "UNAUTHORIZED",
});

// ─── CLI exit codes mapped from error codes ────────────────────────────────

export const EXIT_CODES = Object.freeze({
  [ERROR_CODES.DUPLICATE_RELEASE]: 14,
  [ERROR_CODES.UNAUTHORIZED]: 2,
  // all VALIDATION_ERROR variants default to 1
});

/**
 * Returns the exit code for a given error code string.
 * Defaults to 1.
 */
export function exitCodeForError(errorCode) {
  return EXIT_CODES[errorCode] ?? 1;
}

// ─── Validation provenance ─────────────────────────────────────────────────

/**
 * Build a validation provenance report.
 *
 * Attached to every validation result so you can trace *who* validated,
 * *which* version of the rules were used, and *where* it ran.
 *
 * @param {object} [opts]
 * @param {string} [opts.gitCommit] - Git commit SHA (auto-detected if possible)
 * @param {string} [opts.host]       - Hostname (auto-detected if possible)
 * @param {string} [opts.timestamp]  - ISO 8601 timestamp (default: now)
 * @returns {{ validatedBy: string, validationVersion: string, timestamp: string, gitCommit: string | null, host: string | null }}
 */
export function buildValidationReport(opts = {}) {
  const report = {
    validatedBy: VALIDATED_BY,
    validationVersion: VALIDATION_VERSION,
    timestamp: opts.timestamp ?? new Date().toISOString(),
    gitCommit: opts.gitCommit ?? null,
    host: opts.host ?? null,
  };

  // Auto-detect git commit from runtime environment if available
  if (report.gitCommit === null) {
    report.gitCommit = process.env.MINEOPS_GIT_COMMIT ?? process.env.GIT_COMMIT ?? null;
  }

  // Auto-detect hostname if available
  if (report.host === null) {
    report.host = process.env.MINEOPS_HOST ?? process.env.HOSTNAME ?? null;
  }

  return report;
}

// ─── Validation ────────────────────────────────────────────────────────────

/**
 * Validate a release payload against the shared contract.
 *
 * @param {object} obj - Parsed JSON payload
 * @returns {{ ok: true } | { ok: false, code: string, error: string }}
 */
export function validateReleasePayload(obj) {
  // Guard: non-object input
  if (obj === null || obj === undefined || typeof obj !== "object" || Array.isArray(obj)) {
    return {
      ok: false,
      code: ERROR_CODES.MISSING_REQUIRED_FIELD,
      error: "Payload must be a non-null object",
    };
  }

  // 1. Required fields
  const missing = REQUIRED_FIELDS.filter(
    (f) => obj[f] === undefined || obj[f] === null,
  );
  if (missing.length > 0) {
    return {
      ok: false,
      code: ERROR_CODES.MISSING_REQUIRED_FIELD,
      error: `Missing required fields: ${missing.join(", ")}`,
    };
  }

  // 2. Schema version check
  if (typeof obj.schemaVersion !== "string" || obj.schemaVersion.length < 1) {
    return {
      ok: false,
      code: ERROR_CODES.UNSUPPORTED_SCHEMA_VERSION,
      error: `schemaVersion must be a non-empty string`,
    };
  }
  // Compare major version: future major versions are unsupported
  const supportedMajor = parseInt(SUPPORTED_SCHEMA_VERSION.split(".")[0], 10);
  const schemaPayloadMajor = parseInt(obj.schemaVersion.split(".")[0], 10);
  if (Number.isNaN(schemaPayloadMajor) || schemaPayloadMajor > supportedMajor) {
    return {
      ok: false,
      code: ERROR_CODES.UNSUPPORTED_SCHEMA_VERSION,
      error: `Unsupported schemaVersion: ${obj.schemaVersion} (supported: ${SUPPORTED_SCHEMA_VERSION})`,
    };
  }

  // 2b. Validation version check (independent of schema version)
  if (typeof obj.validationVersion !== "string" || obj.validationVersion.length < 1) {
    return {
      ok: false,
      code: ERROR_CODES.MISSING_REQUIRED_FIELD,
      error: "validationVersion must be a non-empty string",
    };
  }
  const valMajor = parseInt(obj.validationVersion.split(".")[0], 10);
  const supportedValMajor = parseInt(VALIDATION_VERSION.split(".")[0], 10);
  if (Number.isNaN(valMajor) || valMajor > supportedValMajor) {
    return {
      ok: false,
      code: ERROR_CODES.UNSUPPORTED_VALIDATION_VERSION,
      error: `Unsupported validationVersion: ${obj.validationVersion} (supported: ${VALIDATION_VERSION})`,
    };
  }

  // 3. releaseId — non-empty string
  if (typeof obj.releaseId !== "string" || obj.releaseId.length < 1) {
    return {
      ok: false,
      code: ERROR_CODES.INVALID_RELEASE_ID,
      error: "releaseId must be a non-empty string",
    };
  }

  // 4. versionCode — positive integer
  if (typeof obj.versionCode !== "number" || !Number.isInteger(obj.versionCode) || obj.versionCode < 1) {
    return {
      ok: false,
      code: ERROR_CODES.INVALID_VERSION_CODE,
      error: "versionCode must be a positive integer",
    };
  }

  // 5. apkHashes — non-empty object with SHA-256 hex values
  if (typeof obj.apkHashes !== "object" || obj.apkHashes === null || Array.isArray(obj.apkHashes)) {
    return {
      ok: false,
      code: ERROR_CODES.INVALID_APK_HASHES,
      error: "apkHashes must be a non-empty object",
    };
  }
  const hashKeys = Object.keys(obj.apkHashes);
  if (hashKeys.length === 0) {
    return {
      ok: false,
      code: ERROR_CODES.INVALID_APK_HASHES,
      error: "apkHashes must contain at least one entry",
    };
  }
  const sha256Pattern = /^[a-f0-9]{64}$/;
  for (const key of hashKeys) {
    const val = obj.apkHashes[key];
    if (typeof val !== "string" || !sha256Pattern.test(val)) {
      return {
        ok: false,
        code: ERROR_CODES.INVALID_APK_HASHES,
        error: `apkHashes["${key}"] must be a 64-char SHA-256 hex string`,
      };
    }
  }

  // 6. status — valid enum
  if (!VALID_STATUSES.includes(obj.status)) {
    return {
      ok: false,
      code: ERROR_CODES.INVALID_STATUS,
      error: `status must be one of: ${VALID_STATUSES.join(", ")}`,
    };
  }

  return { ok: true };
}
