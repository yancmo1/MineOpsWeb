/** Catalog review control plane; intentionally self-contained for PB JSVM. */
routerAdd("POST", "/api/catalog/review/{action}", function (c) {
  function hash(value) { return typeof value === "string" && /^[a-f0-9]{64}$/.test(value); }
  function bytesToText(bytes) { var text = ""; for (var i = 0; i < bytes.length; i++) text += String.fromCharCode(bytes[i]); return text; }
  function admin() {
    var info = c.requestInfo(), header = (info.headers || {}).authorization || "", auth = c.auth || info.auth || null;
    if (!auth) { try { auth = c.get("authRecord"); } catch (_) {} }
    if (!auth) return { authorized: false, reason: /^Bearer\s+/i.test(header) ? "capture_token" : "unauthenticated" };
    var superuser = false, role = "", canPublish = false;
    try { superuser = typeof auth.isSuperuser === "function" && auth.isSuperuser(); } catch (_) {}
    try { role = auth.get("catalogRole") || ""; } catch (_) {}
    try { canPublish = auth.get("canPublishCatalog") === true; } catch (_) {}
    return { authorized: superuser || role === "admin" || canPublish, reason: superuser || role === "admin" || canPublish ? "" : "insufficient_role", identity: auth.get("email") || auth.get("username") || auth.id };
  }
  function serverHashes(releaseId) {
    if (typeof releaseId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/.test(releaseId)) throw new Error("INVALID_RELEASE_ID_PATH");
    var directory = "/pb/catalog-artifacts/releases/" + releaseId;
    var manifest = $os.readFile(directory + "/manifest.json"), validation = $os.readFile(directory + "/validation-report.json");
    if (!manifest || !manifest.length || !validation || !validation.length) throw new Error("RELEASE_PACKAGE_EVIDENCE_MISSING");
    var manifestRaw = bytesToText(manifest), parsed = JSON.parse(manifestRaw);
    if (parsed.releaseId !== releaseId) throw new Error("MANIFEST_RELEASE_ID_MISMATCH");
    return { manifestHash: $security.sha256(manifestRaw), validationReportHash: $security.sha256(bytesToText(validation)) };
  }
  function appendAudit(release, action, identity, reviewId, notes, now) {
    var entries = release.get("auditLog") || [];
    if (typeof entries === "string") entries = JSON.parse(entries);
    if (!Array.isArray(entries)) entries = [];
    entries.push({ action: action, reviewer: identity, reviewId: reviewId, timestamp: now, notes: notes || "" });
    release.set("auditLog", JSON.stringify(entries));
  }
  try {
    var action = c.request.pathValue("action");
    var decisionMap = { approve: ["approved", "ready"], reject: ["rejected", "rejected"], quarantine: ["quarantined", "review_required"] };
    if (!decisionMap[action]) return c.json(404, { success: false, code: "NOT_FOUND", error: "Unknown review action." });
    var body = c.requestInfo().body || {}, caller = admin();
    if (!caller.authorized) {
      if (caller.reason === "capture_token") return c.json(403, { success: false, code: "FORBIDDEN / CAPTURE_CLIENT_NOT_ALLOWED", error: "Capture credentials cannot review catalog releases." });
      if (caller.reason === "unauthenticated") return c.json(401, { success: false, code: "UNAUTHORIZED", error: "PocketBase authentication is required." });
      return c.json(403, { success: false, code: "FORBIDDEN / INSUFFICIENT_ROLE", error: "Review requires a PocketBase superuser or explicit catalog admin." });
    }
    if (!body.releaseId || typeof body.releaseId !== "string") return c.json(400, { success: false, code: "VALIDATION_ERROR / MISSING_RELEASE_ID", error: "releaseId is required." });
    if (!hash(body.manifestHash) || !hash(body.validationReportHash)) return c.json(400, { success: false, code: "VALIDATION_ERROR / MISSING_PACKAGE_HASH", error: "Both package hashes must be SHA-256 hex digests." });
    if (!body.reviewEngineVersion || typeof body.reviewEngineVersion !== "string") return c.json(400, { success: false, code: "VALIDATION_ERROR / MISSING_REVIEW_ENGINE_VERSION", error: "reviewEngineVersion is required." });
    var computed = serverHashes(body.releaseId);
    if (body.manifestHash !== computed.manifestHash || body.validationReportHash !== computed.validationReportHash) return c.json(409, { success: false, code: "SERVER_PACKAGE_HASH_MISMATCH", error: "Submitted hashes do not match the server-mounted immutable package." });
    var outcome = null, decision = decisionMap[action][0], nextStatus = decisionMap[action][1];
    $app.runInTransaction(function (txApp) {
      var releasesCol = txApp.findCollectionByNameOrId("catalog_releases");
      var matches = txApp.findRecordsByFilter(releasesCol, "releaseId = {:releaseId} && manifestSha256 = {:manifestHash}", undefined, 2, 0, { releaseId: body.releaseId, manifestHash: computed.manifestHash });
      if (matches.length !== 1) { outcome = { status: matches.length ? 409 : 404, body: { success: false, code: matches.length ? "AMBIGUOUS_RELEASE_IDENTITY" : "RELEASE_IDENTITY_NOT_FOUND", error: "Release identity must match exactly one record." } }; return; }
      var release = matches[0];
      if (release.get("validationReportSha256") !== computed.validationReportHash) { outcome = { status: 409, body: { success: false, code: "VALIDATION_REPORT_HASH_MISMATCH", error: "Server validation report hash does not match the release record." } }; return; }
      var allowed = decision === "quarantined" ? ["candidate", "review_required", "ready"] : ["candidate", "review_required"];
      if (allowed.indexOf(release.get("status")) === -1) { outcome = { status: 409, body: { success: false, code: "INVALID_STATUS_TRANSITION", error: "Release status cannot transition through this review decision." } }; return; }
      if (decision === "approved") { var summary = release.get("validationSummary") || {}; if (typeof summary === "string") summary = JSON.parse(summary); if (summary.status === "failed" || (summary.blockingIssues && summary.blockingIssues.length)) { outcome = { status: 409, body: { success: false, code: "FATAL_FINDINGS_BLOCK", error: "Fatal validation findings block approval." } }; return; } }
      var reviewsCol = txApp.findCollectionByNameOrId("catalog_reviews"), old = txApp.findRecordsByFilter(reviewsCol, "releaseId = {:releaseId} && isLatest = true", undefined, 0, 0, { releaseId: body.releaseId });
      for (var i = 0; i < old.length; i++) { old[i].set("isLatest", false); txApp.save(old[i]); }
      var now = new Date().toISOString();
      var review = new Record(reviewsCol, { releaseId: body.releaseId, decision: decision, reviewedBy: caller.identity, reviewedAt: now, notes: body.notes || "", annotations: JSON.stringify(body.annotations || []), manualOverrides: JSON.stringify(body.manualOverrides || []), findingsSummary: JSON.stringify(body.findingsSummary || {}), schemaCompat: JSON.stringify(body.schemaCompat || {}), manifestHash: computed.manifestHash, validationReportHash: computed.validationReportHash, reviewEngineVersion: body.reviewEngineVersion, isLatest: true });
      txApp.save(review); release.set("status", nextStatus); if (decision === "approved") release.set("reviewedBy", caller.identity); appendAudit(release, decision, caller.identity, review.id, body.notes, now); txApp.save(release);
      outcome = { status: 200, body: { success: true, decision: decision, releaseId: body.releaseId, reviewId: review.id, manifestHash: computed.manifestHash, validationReportHash: computed.validationReportHash, reviewedBy: caller.identity, reviewedAt: now } };
    });
    return c.json(outcome.status, outcome.body);
  } catch (e) { return c.json(500, { success: false, code: "INTERNAL_ERROR", error: String(e) }); }
});
