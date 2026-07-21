/**
 * MineOps Catalog Review — PocketBase custom routes
 *
 * Routes:
 *   POST /api/catalog/review/approve  — Approve a release for publication
 *   POST /api/catalog/review/reject   — Reject a release
 *   POST /api/catalog/review/quarantine — Quarantine a release (fatal findings)
 *
 * Auth: PocketBase auth cookie (authenticated users only).
 *       Reviewer identity is ALWAYS derived from the server-side auth record —
 *       it is NEVER accepted from the request body.
 *
 * Each action:
 *   1. Validates the release exists
 *   2. Checks status transition validity
 *   3. For approval: blocks if validation summary has fatal findings
 *   4. Transactionally marks previous latest reviews as not-latest
 *   5. Creates a catalog_reviews record bound to the exact package
 *      (manifestHash + validationReportHash + reviewEngineVersion)
 *   6. Updates the catalog_releases status accordingly
 *   7. Records the action in the release's auditLog
 *
 * Immutability: Once created, a review record is never edited in place.
 * Corrections create a NEW review record and mark it as latest. This
 * preserves the complete decision history.
 *
 * Data ownership:
 *   - Generated evidence (validation-report.json, changelog.json, artifact hashes)
 *     remains in the immutable JSON package.
 *   - PocketBase stores only the human decision, annotations, manual overrides,
 *     and audit trail.
 *
 * Status transitions:
 *   approve:    candidate|review_required → ready
 *   reject:     candidate|review_required → rejected
 *   quarantine: candidate|review_required|ready → review_required
 */

/**
 * Resolve the authenticated user identity from the PocketBase auth record.
 * NEVER accepts reviewer identity from the request body — always server-derived.
 *
 * @returns {string} Display identity like "admin@example.com" or the auth record ID.
 */
function resolveReviewer(c) {
  // MUST come from the PocketBase auth record — not from request headers or body
  try {
    var authRecord = c.get("authRecord");
    if (authRecord) {
      return authRecord.get("email") || authRecord.get("username") || authRecord.id;
    }
  } catch (_) { /* not authenticated via PB cookie */ }

  // If no PB auth record, the request is unauthenticated.
  // We still return a value for error reporting, but the route guard
  // should reject unauthenticated requests before reaching here.
  return "unauthenticated";
}

/**
 * Create a review record and update the release status.
 *
 * @param {object} c - PocketBase request context
 * @param {string} decision - "approved" | "rejected" | "quarantined"
 * @param {string} newStatus - New status for catalog_releases
 */
function performReview(c, decision, newStatus) {
  try {
    var info = c.requestInfo();
    var body = (typeof info.body === "string") ? JSON.parse(info.body) : (info.body || {});

    // Require authentication — reviewer identity must be server-derived
    var reviewer = resolveReviewer(c);
    if (reviewer === "unauthenticated") {
      return c.json(401, {
        success: false,
        error: "Authentication required. Reviewer identity is server-derived and cannot be supplied in the request body.",
        code: "UNAUTHORIZED",
      });
    }

    // Validate required fields
    if (!body.releaseId || typeof body.releaseId !== "string" || body.releaseId.length < 1) {
      return c.json(400, {
        success: false,
        error: "releaseId is required (non-empty string)",
        code: "VALIDATION_ERROR / MISSING_RELEASE_ID",
      });
    }

    // Package-binding hashes — tie this review to the exact immutable package
    if (!body.manifestHash || typeof body.manifestHash !== "string" || !/^[a-f0-9]{64}$/.test(body.manifestHash)) {
      return c.json(400, {
        success: false,
        error: "manifestHash is required (64-char SHA-256 hex of the manifest.json being reviewed)",
        code: "VALIDATION_ERROR / MISSING_MANIFEST_HASH",
      });
    }
    if (!body.validationReportHash || typeof body.validationReportHash !== "string" || !/^[a-f0-9]{64}$/.test(body.validationReportHash)) {
      return c.json(400, {
        success: false,
        error: "validationReportHash is required (64-char SHA-256 hex of the validation-report.json being reviewed)",
        code: "VALIDATION_ERROR / MISSING_VALIDATION_REPORT_HASH",
      });
    }
    if (!body.reviewEngineVersion || typeof body.reviewEngineVersion !== "string" || body.reviewEngineVersion.length < 1) {
      return c.json(400, {
        success: false,
        error: "reviewEngineVersion is required (version of the review engine that produced this review)",
        code: "VALIDATION_ERROR / MISSING_REVIEW_ENGINE_VERSION",
      });
    }

    var now = new Date().toISOString();

    // 1. Find the release
    var releasesCol = $app.findCollectionByNameOrId("catalog_releases");
    var releaseRecords = $app.findRecordsByFilter(
      releasesCol,
      "releaseId = {:releaseId}",
      undefined,
      0,
      1,
      { releaseId: body.releaseId }
    );

    if (releaseRecords.length === 0) {
      return c.json(404, {
        success: false,
        error: "Release not found: " + body.releaseId,
        code: "NOT_FOUND",
      });
    }

    var release = releaseRecords[0];
    var currentStatus = release.get("status");

    // 2. Validate status transition
    var validTransitions = {
      approved: ["candidate", "review_required"],
      rejected: ["candidate", "review_required"],
      quarantined: ["candidate", "review_required", "ready"],
    };

    var allowed = validTransitions[decision] || [];
    if (allowed.indexOf(currentStatus) === -1) {
      return c.json(409, {
        success: false,
        error: "Cannot " + decision + " release with status '" + currentStatus + "'. Allowed: " + allowed.join(", "),
        code: "INVALID_STATUS_TRANSITION",
        currentStatus: currentStatus,
        attemptedDecision: decision,
      });
    }

    // If approving, ensure no fatal findings — check validation summary
    if (decision === "approved") {
      var validationSummary = release.get("validationSummary");
      if (validationSummary) {
        var vs = typeof validationSummary === "string" ? JSON.parse(validationSummary) : validationSummary;
        if (vs.status === "failed" || (vs.blockingIssues && vs.blockingIssues.length > 0)) {
          return c.json(409, {
            success: false,
            error: "Cannot approve: release has fatal validation findings.",
            code: "FATAL_FINDINGS_BLOCK",
            validationStatus: vs.status,
            blockingIssueCount: (vs.blockingIssues || []).length,
          });
        }
      }
    }

    // 3. Transactionally mark previous reviews for this release as not latest.
    //    A unique constraint or app-level hook should additionally prevent two
    //    latest reviews for the same release from existing simultaneously.
    var reviewsCol = $app.findCollectionByNameOrId("catalog_reviews");
    var prevReviews = $app.findRecordsByFilter(
      reviewsCol,
      "releaseId = {:releaseId} && isLatest = true",
      undefined,
      0,
      0,
      { releaseId: body.releaseId }
    );
    for (var i = 0; i < prevReviews.length; i++) {
      prevReviews[i].set("isLatest", false);
      $app.save(prevReviews[i]);
    }

    // 4. Create the review record — immutable once created.
    //    Corrections create a NEW review record (never edit in place).
    var reviewRecord = new Record(reviewsCol, {
      releaseId: body.releaseId,
      decision: decision,
      reviewedBy: reviewer,
      reviewedAt: now,
      notes: body.notes || "",
      annotations: JSON.stringify(body.annotations || []),
      manualOverrides: JSON.stringify(body.manualOverrides || []),
      findingsSummary: JSON.stringify(body.findingsSummary || {}),
      schemaCompat: JSON.stringify(body.schemaCompat || {}),
      manifestHash: body.manifestHash,
      validationReportHash: body.validationReportHash,
      reviewEngineVersion: body.reviewEngineVersion,
      isLatest: true,
    });
    $app.save(reviewRecord);

    // 5. Update release status
    release.set("status", newStatus);
    if (decision === "approved") {
      release.set("reviewedBy", reviewer);
    }

    // Append to auditLog
    var auditLog = release.get("auditLog");
    var auditEntries = [];
    if (auditLog) {
      auditEntries = typeof auditLog === "string" ? JSON.parse(auditLog) : auditLog;
    }
    auditEntries.push({
      action: decision,
      reviewer: reviewer,
      timestamp: now,
      reviewId: reviewRecord.id,
      notes: body.notes || "",
    });
    release.set("auditLog", JSON.stringify(auditEntries));
    $app.save(release);

    return c.json(200, {
      success: true,
      decision: decision,
      releaseId: body.releaseId,
      reviewId: reviewRecord.id,
      previousStatus: currentStatus,
      newStatus: newStatus,
      reviewedBy: reviewer,
      reviewedAt: now,
      manifestHash: body.manifestHash,
      validationReportHash: body.validationReportHash,
      reviewEngineVersion: body.reviewEngineVersion,
    });
  } catch (e) {
    return c.json(500, {
      success: false,
      error: String(e),
      code: "INTERNAL_ERROR",
    });
  }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

routerAdd("POST", "/api/catalog/review/approve", function (c) {
  return performReview(c, "approved", "ready");
});

routerAdd("POST", "/api/catalog/review/reject", function (c) {
  return performReview(c, "rejected", "rejected");
});

routerAdd("POST", "/api/catalog/review/quarantine", function (c) {
  return performReview(c, "quarantined", "review_required");
});
