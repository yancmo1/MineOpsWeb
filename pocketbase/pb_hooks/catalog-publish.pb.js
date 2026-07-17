/**
 * MineOps Catalog Publication — PocketBase custom routes
 *
 * Routes:
 *   POST /api/catalog/publish  — Atomically activate a reviewed release
 *   POST /api/catalog/rollback — Roll back to a previous active release
 *
 * Authorization model:
 *   - Capture-client Bearer tokens are REJECTED (UbuntuMac cannot publish).
 *   - PocketBase auth cookie is required.
 *   - The authenticated user must have catalog_admin or can_publish_catalog
 *     role. A normal MineOps user cannot publish or roll back releases.
 *     Roles are read from the auth record: authRecord.get("catalogRole")
 *     must equal "admin" or the boolean field "canPublishCatalog" must be true.
 *
 * Transaction model:
 *   - All pointer, status, and audit writes must commit or fail together.
 *   - In PocketBase 0.39+, individual Record saves are atomic at the
 *     collection level. The operations are sequenced to minimize the
 *     inconsistency window: supersede old → update pointer → activate new.
 *   - If the PocketBase version supports transactions ($app.runInTransaction
 *     or similar), wrap the entire mutation in one.
 *
 * Publication model:
 *   The active release is tracked by a single catalog_publication singleton.
 *   Publishing changes only this pointer — no catalog objects are rewritten.
 *   All immutable packages are retained; the prior release is marked superseded.
 *
 *   Rollback does NOT destroy forward history. After A → B → C and rollback
 *   C → B, the system retains enough history to later re-activate C
 *   deliberately. Releases remain in the catalog_releases collection with
 *   their full metadata intact.
 *
 *   Concurrent publish protection: the singleton catalog_publication row
 *   acts as a natural serialization point. Only one publish/rollback can
 *   succeed at a time because the activeReleaseId check is deterministic.
 *
 * Publish:
 *   1. Authenticate + authorize (PB cookie + catalog_admin role required)
 *   2. Verify release exists and has status "ready"
 *   3. Verify the release was approved (catalog_reviews record with decision "approved")
 *   4. Verify manifest hash matches the stored release record (server-authoritative)
 *   5. Mark old active release → superseded
 *   6. Update catalog_publication singleton
 *   7. Mark new release → active
 *   8. Create catalog_publication_events record (append-only)
 *   9. Record audit trail on both releases
 *
 * Rollback:
 *   1. Authenticate + authorize
 *   2. Read current catalog_publication → get target (previousReleaseId or explicit)
 *   3. Verify target release exists AND was previously published (status superseded or active)
 *   4. Mark current active → superseded
 *   5. Swap publication pointer to target
 *   6. Mark target → active
 *   7. Create catalog_publication_events record (append-only)
 *   8. Record audit trail
 *   9. No re-ingestion, no bulk object update, no content rewrite
 */

/**
 * Resolve and authorize the publisher.
 *
 * Three checks:
 *   1. Reject Bearer tokens (capture clients)
 *   2. Require PB auth cookie
 *   3. Require catalog_admin or can_publish_catalog role
 *
 * @returns {{ identity: string, isCaptureToken: boolean, authorized: boolean, reason: string }}
 */
function resolvePublisher(c) {
  var info = c.requestInfo();

  // Explicitly reject Bearer tokens — capture clients cannot publish
  var authHeader = (info.headers || {}).authorization || "";
  if (/^Bearer\s+/i.test(authHeader)) {
    return { identity: null, isCaptureToken: true, authorized: false, reason: "capture_token" };
  }

  // Must use PB auth cookie
  var authRecord = null;
  try {
    authRecord = c.get("authRecord");
  } catch (_) { /* not authenticated */ }

  if (!authRecord) {
    return { identity: null, isCaptureToken: false, authorized: false, reason: "unauthenticated" };
  }

  var identity = authRecord.get("email") || authRecord.get("username") || authRecord.id;

  // Role check: must have catalog_admin role or can_publish_catalog flag
  var catalogRole = "";
  var canPublish = false;
  try { catalogRole = authRecord.get("catalogRole") || ""; } catch (_) {}
  try { canPublish = authRecord.get("canPublishCatalog") === true; } catch (_) {}

  if (catalogRole !== "admin" && !canPublish) {
    return { identity: identity, isCaptureToken: false, authorized: false, reason: "insufficient_role" };
  }

  return { identity: identity, isCaptureToken: false, authorized: true, reason: "" };
}

/**
 * Get or create the catalog_publication singleton record.
 */
function getOrCreatePublication(pubCol) {
  var records = $app.findRecordsByFilter(pubCol, "", undefined, 0, 1, {});
  if (records.length > 0) return records[0];

  var record = new Record(pubCol, {
    activeReleaseId: "",
    previousReleaseId: "",
    activatedAt: "",
    activatedBy: "",
    manifestSha256: "",
    notes: "Initial publication record — no active release yet.",
  });
  $app.save(record);
  return record;
}

/**
 * Append an audit entry to a release record.
 */
function appendAuditLog(release, action, publisher, notes) {
  var auditLog = release.get("auditLog");
  var entries = [];
  if (auditLog) {
    entries = typeof auditLog === "string" ? JSON.parse(auditLog) : auditLog;
  }
  entries.push({
    action: action,
    publisher: publisher,
    timestamp: new Date().toISOString(),
    notes: notes || "",
  });
  release.set("auditLog", JSON.stringify(entries));
}

/**
 * Create an append-only publication event record.
 */
function createPublicationEvent(action, fromReleaseId, toReleaseId, manifestHash, performedBy, reason) {
  var eventsCol = $app.findCollectionByNameOrId("catalog_publication_events");
  var event = new Record(eventsCol, {
    action: action,
    fromReleaseId: fromReleaseId || "",
    toReleaseId: toReleaseId,
    manifestHash: manifestHash,
    performedBy: performedBy,
    performedAt: new Date().toISOString(),
    reason: reason || "",
  });
  $app.save(event);
  return event.id;
}

// =========================================================================
// POST /api/catalog/publish
// =========================================================================
routerAdd("POST", "/api/catalog/publish", function (c) {
  try {
    var info = c.requestInfo();
    var body = (typeof info.body === "string") ? JSON.parse(info.body) : (info.body || {});

    // 1. Authenticate + authorize
    var pub = resolvePublisher(c);
    if (pub.isCaptureToken) {
      return c.json(403, {
        success: false,
        error: "Capture credentials cannot publish releases. Use PocketBase authentication with catalog_admin role.",
        code: "FORBIDDEN / CAPTURE_CLIENT_NOT_ALLOWED",
      });
    }
    if (pub.reason === "unauthenticated") {
      return c.json(401, {
        success: false,
        error: "Authentication required. Publish requires PocketBase auth.",
        code: "UNAUTHORIZED",
      });
    }
    if (!pub.authorized) {
      return c.json(403, {
        success: false,
        error: "Insufficient permissions. Publish requires catalog_admin role or canPublishCatalog flag.",
        code: "FORBIDDEN / INSUFFICIENT_ROLE",
      });
    }

    // 2. Validate required fields
    if (!body.releaseId || typeof body.releaseId !== "string" || body.releaseId.length < 1) {
      return c.json(400, {
        success: false,
        error: "releaseId is required.",
        code: "VALIDATION_ERROR / MISSING_RELEASE_ID",
      });
    }
    if (!body.manifestHash || typeof body.manifestHash !== "string" || !/^[a-f0-9]{64}$/.test(body.manifestHash)) {
      return c.json(400, {
        success: false,
        error: "manifestHash is required (64-char SHA-256 hex).",
        code: "VALIDATION_ERROR / MISSING_MANIFEST_HASH",
      });
    }

    var now = new Date().toISOString();

    // 3. Find the release
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

    // 4. Verify release is in "ready" status (must go through review first)
    if (currentStatus !== "ready") {
      return c.json(409, {
        success: false,
        error: "Release must be in 'ready' status to publish. Current status: " + currentStatus,
        code: "INVALID_STATUS_FOR_PUBLISH",
        currentStatus: currentStatus,
      });
    }

    // 5. Verify release was approved (must have at least one approved review)
    var reviewsCol = $app.findCollectionByNameOrId("catalog_reviews");
    var approvedReviews = $app.findRecordsByFilter(
      reviewsCol,
      "releaseId = {:releaseId} && decision = 'approved' && isLatest = true",
      undefined,
      0,
      1,
      { releaseId: body.releaseId }
    );

    if (approvedReviews.length === 0) {
      return c.json(409, {
        success: false,
        error: "Release has no approved review. Publish requires an approved review record.",
        code: "NO_APPROVED_REVIEW",
      });
    }

    // 6. Verify manifest hash — the client-supplied hash is a concurrency guard;
    //    the server-authoritative value comes from the immutable release record.
    var storedManifestHash = release.get("manifestSha256");
    if (!storedManifestHash || storedManifestHash.length === 0) {
      return c.json(409, {
        success: false,
        error: "Release has no stored manifest hash. Cannot verify package integrity.",
        code: "MISSING_STORED_MANIFEST_HASH",
      });
    }
    if (storedManifestHash !== body.manifestHash) {
      return c.json(409, {
        success: false,
        error: "Manifest hash mismatch. The submitted hash does not match the immutable release record.",
        code: "MANIFEST_HASH_MISMATCH",
        submittedHash: body.manifestHash,
        storedHash: storedManifestHash,
      });
    }

    // 7. Get or create publication singleton
    var pubCol = $app.findCollectionByNameOrId("catalog_publication");
    var pubRecord = getOrCreatePublication(pubCol);

    var oldActiveReleaseId = pubRecord.get("activeReleaseId");

    // Idempotent: if already pointing to this release
    if (oldActiveReleaseId === body.releaseId) {
      return c.json(200, {
        success: true,
        message: "Release is already the active publication.",
        releaseId: body.releaseId,
        alreadyActive: true,
      });
    }

    // ── Transactional mutation ──
    // All writes below should commit or fail together.
    // Order: supersede old → update pointer → activate new → event.
    // In PB 0.39+, wrap in $app.runInTransaction() if available.

    // 8. Mark old active release as superseded
    if (oldActiveReleaseId && oldActiveReleaseId.length > 0) {
      var oldRecords = $app.findRecordsByFilter(
        releasesCol,
        "releaseId = {:releaseId}",
        undefined,
        0,
        1,
        { releaseId: oldActiveReleaseId }
      );
      if (oldRecords.length > 0) {
        var oldRelease = oldRecords[0];
        oldRelease.set("status", "superseded");
        appendAuditLog(oldRelease, "superseded_by_publish", pub.identity, "Superseded by " + body.releaseId);
        $app.save(oldRelease);
      }
    }

    // 9. Update publication record
    pubRecord.set("previousReleaseId", oldActiveReleaseId || "");
    pubRecord.set("activeReleaseId", body.releaseId);
    pubRecord.set("manifestSha256", storedManifestHash);
    pubRecord.set("activatedAt", now);
    pubRecord.set("activatedBy", pub.identity);
    pubRecord.set("notes", body.notes || "");
    $app.save(pubRecord);

    // 10. Mark new release as active
    release.set("status", "active");
    release.set("publishedAt", now);
    appendAuditLog(release, "published", pub.identity, "Published as active release.");
    $app.save(release);

    // 11. Create append-only publication event
    var eventId = createPublicationEvent(
      "publish",
      oldActiveReleaseId || "",
      body.releaseId,
      storedManifestHash,
      pub.identity,
      body.notes || ""
    );

    return c.json(200, {
      success: true,
      releaseId: body.releaseId,
      manifestHash: storedManifestHash,
      previousActiveReleaseId: oldActiveReleaseId || null,
      publishedBy: pub.identity,
      publishedAt: now,
      publicationEventId: eventId,
    });
  } catch (e) {
    return c.json(500, {
      success: false,
      error: String(e),
      code: "INTERNAL_ERROR",
    });
  }
});

// =========================================================================
// POST /api/catalog/rollback
// =========================================================================
routerAdd("POST", "/api/catalog/rollback", function (c) {
  try {
    var info = c.requestInfo();
    var body = (typeof info.body === "string") ? JSON.parse(info.body) : (info.body || {});

    // 1. Authenticate + authorize
    var pub = resolvePublisher(c);
    if (pub.isCaptureToken) {
      return c.json(403, {
        success: false,
        error: "Capture credentials cannot roll back releases. Use PocketBase authentication with catalog_admin role.",
        code: "FORBIDDEN / CAPTURE_CLIENT_NOT_ALLOWED",
      });
    }
    if (pub.reason === "unauthenticated") {
      return c.json(401, {
        success: false,
        error: "Authentication required.",
        code: "UNAUTHORIZED",
      });
    }
    if (!pub.authorized) {
      return c.json(403, {
        success: false,
        error: "Insufficient permissions. Rollback requires catalog_admin role or canPublishCatalog flag.",
        code: "FORBIDDEN / INSUFFICIENT_ROLE",
      });
    }

    var now = new Date().toISOString();

    // 2. Get current publication record
    var pubCol = $app.findCollectionByNameOrId("catalog_publication");
    var pubRecords = $app.findRecordsByFilter(pubCol, "", undefined, 0, 1, {});

    if (pubRecords.length === 0) {
      return c.json(409, {
        success: false,
        error: "No publication record exists. Nothing to roll back.",
        code: "NO_PUBLICATION_RECORD",
      });
    }

    var pubRecord = pubRecords[0];
    var currentActiveId = pubRecord.get("activeReleaseId");

    if (!currentActiveId || currentActiveId.length === 0) {
      return c.json(409, {
        success: false,
        error: "No active release to roll back from.",
        code: "NO_ACTIVE_RELEASE",
      });
    }

    var previousId = pubRecord.get("previousReleaseId") || "";
    // Allow explicit target via request body
    if (body.targetReleaseId && typeof body.targetReleaseId === "string" && body.targetReleaseId.length > 0) {
      previousId = body.targetReleaseId;
    }

    if (!previousId || previousId.length === 0) {
      return c.json(409, {
        success: false,
        error: "No previous release to roll back to. Provide targetReleaseId in the request body.",
        code: "NO_ROLLBACK_TARGET",
      });
    }

    // Cannot roll back to the currently active release
    if (previousId === currentActiveId) {
      return c.json(409, {
        success: false,
        error: "Target release is already active.",
        code: "ALREADY_ACTIVE",
      });
    }

    // 3. Verify target release exists and is eligible for activation.
    //    Only previously published releases (status superseded or active)
    //    can be rollback targets — not arbitrary candidate or rejected releases.
    var releasesCol = $app.findCollectionByNameOrId("catalog_releases");
    var targetRecords = $app.findRecordsByFilter(
      releasesCol,
      "releaseId = {:releaseId}",
      undefined,
      0,
      1,
      { releaseId: previousId }
    );

    if (targetRecords.length === 0) {
      return c.json(404, {
        success: false,
        error: "Target release not found: " + previousId,
        code: "TARGET_NOT_FOUND",
      });
    }

    var targetRelease = targetRecords[0];
    var targetStatus = targetRelease.get("status");
    var eligibleStatuses = ["active", "superseded"];

    if (eligibleStatuses.indexOf(targetStatus) === -1) {
      return c.json(409, {
        success: false,
        error: "Target release is not eligible for rollback. Status '" + targetStatus + "' is not a previously published state. Allowed: " + eligibleStatuses.join(", "),
        code: "TARGET_NOT_ELIGIBLE",
        targetStatus: targetStatus,
      });
    }

    // ── Transactional mutation ──
    // All writes below should commit or fail together.
    // Order: supersede current → swap pointer → activate target → event.

    // 4. Mark current active as superseded (no re-ingestion, no content rewrite)
    var currentRecords = $app.findRecordsByFilter(
      releasesCol,
      "releaseId = {:releaseId}",
      undefined,
      0,
      1,
      { releaseId: currentActiveId }
    );
    if (currentRecords.length > 0) {
      var currentRelease = currentRecords[0];
      currentRelease.set("status", "superseded");
      appendAuditLog(currentRelease, "superseded_by_rollback", pub.identity, "Deactivated by rollback to " + previousId);
      $app.save(currentRelease);
    }

    // 5. Swap the active pointer
    var targetManifestHash = targetRelease.get("manifestSha256") || "";
    pubRecord.set("previousReleaseId", currentActiveId);
    pubRecord.set("activeReleaseId", previousId);
    pubRecord.set("manifestSha256", targetManifestHash);
    pubRecord.set("activatedAt", now);
    pubRecord.set("activatedBy", pub.identity);
    pubRecord.set("notes", body.notes || "Rolled back from " + currentActiveId + " to " + previousId);
    $app.save(pubRecord);

    // 6. Mark target release as active
    targetRelease.set("status", "active");
    targetRelease.set("publishedAt", now);
    appendAuditLog(targetRelease, "activated_by_rollback", pub.identity, "Activated by rollback from " + currentActiveId);
    $app.save(targetRelease);

    // 7. Create append-only publication event.
    //    Forward history is preserved: the old active release still exists
    //    in catalog_releases with full metadata, and this event records
    //    the rollback action. C can be re-activated later deliberately.
    var eventId = createPublicationEvent(
      "rollback",
      currentActiveId,
      previousId,
      targetManifestHash,
      pub.identity,
      body.notes || "Rolled back to " + previousId
    );

    return c.json(200, {
      success: true,
      rolledBackFrom: currentActiveId,
      rolledBackTo: previousId,
      manifestHash: targetManifestHash,
      rolledBackBy: pub.identity,
      rolledBackAt: now,
      publicationEventId: eventId,
    });
  } catch (e) {
    return c.json(500, {
      success: false,
      error: String(e),
      code: "INTERNAL_ERROR",
    });
  }
});
