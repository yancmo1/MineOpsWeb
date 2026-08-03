/** Publication/rollback control plane; intentionally self-contained for PB JSVM. */
routerAdd("POST", "/api/catalog/{operation}", function (c) {
  function hash(value) { return typeof value === "string" && /^[a-f0-9]{64}$/.test(value); }
  function caller() {
    var info = c.requestInfo(), header = (info.headers || {}).authorization || "", auth = c.auth || info.auth || null;
    if (!auth) { try { auth = c.get("authRecord"); } catch (_) {} }
    // Standard PocketBase authentication also uses Bearer, so only classify
    // it as a capture credential if PocketBase failed to authenticate it.
    if (!auth) return { authorized: false, reason: /^Bearer\s+/i.test(header) ? "capture_token" : "unauthenticated" };
    var superuser = false, role = "", canPublish = false;
    try { superuser = typeof auth.isSuperuser === "function" && auth.isSuperuser(); } catch (_) {}
    try { role = auth.get("catalogRole") || ""; } catch (_) {}
    try { canPublish = auth.get("canPublishCatalog") === true; } catch (_) {}
    return { authorized: superuser || role === "admin" || canPublish, reason: superuser || role === "admin" || canPublish ? "" : "insufficient_role", identity: auth.get("email") || auth.get("username") || auth.id };
  }
  function exact(app, col, releaseId, manifestHash) { return app.findRecordsByFilter(col, "releaseId = {:releaseId} && manifestSha256 = {:manifestHash}", undefined, 2, 0, { releaseId: releaseId, manifestHash: manifestHash }); }
  function audit(release, action, identity, notes, now) { var entries = release.get("auditLog") || []; if (typeof entries === "string") entries = JSON.parse(entries); if (!Array.isArray(entries)) entries = []; entries.push({ action: action, publisher: identity, timestamp: now, notes: notes || "" }); release.set("auditLog", JSON.stringify(entries)); }
  function event(app, action, fromId, toId, manifestHash, identity, notes, now) { var col = app.findCollectionByNameOrId("catalog_publication_events"), record = new Record(col, { action: action, fromReleaseId: fromId || "", toReleaseId: toId, manifestSha256: manifestHash, performedBy: identity, performedAt: now, notes: notes || "" }); app.save(record); return record.id; }
  try {
    var operation = c.request.pathValue("operation");
    if (operation !== "publish" && operation !== "rollback") return c.json(404, { success: false, code: "NOT_FOUND", error: "Unknown catalog operation." });
    var body = c.requestInfo().body || {}, actor = caller();
    if (!actor.authorized) {
      if (actor.reason === "capture_token") return c.json(403, { success: false, code: "FORBIDDEN / CAPTURE_CLIENT_NOT_ALLOWED", error: "Capture credentials cannot publish or roll back catalog releases." });
      if (actor.reason === "unauthenticated") return c.json(401, { success: false, code: "UNAUTHORIZED", error: "PocketBase authentication is required." });
      return c.json(403, { success: false, code: "FORBIDDEN / INSUFFICIENT_ROLE", error: "Publish requires a PocketBase superuser or explicit catalog admin." });
    }
    if (operation === "publish" && (!body.releaseId || typeof body.releaseId !== "string" || !hash(body.manifestHash))) return c.json(400, { success: false, code: "VALIDATION_ERROR / INVALID_RELEASE_IDENTITY", error: "releaseId and manifestHash are required." });
    var outcome = null;
    $app.runInTransaction(function (txApp) {
      var publicationCol = txApp.findCollectionByNameOrId("catalog_publication"), pointers = txApp.findRecordsByFilter(publicationCol, "", undefined, 2, 0, {});
      if (pointers.length !== 1) { outcome = { status: 409, body: { success: false, code: "CATALOG_PUBLICATION_POINTER_INVALID", error: "Exactly one catalog publication pointer is required." } }; return; }
      var pointer = pointers[0], releasesCol = txApp.findCollectionByNameOrId("catalog_releases"), now = new Date().toISOString();
      if (operation === "publish") {
        var matches = exact(txApp, releasesCol, body.releaseId, body.manifestHash);
        if (matches.length !== 1) { outcome = { status: matches.length ? 409 : 404, body: { success: false, code: matches.length ? "AMBIGUOUS_RELEASE_IDENTITY" : "RELEASE_IDENTITY_NOT_FOUND", error: "Release identity must match exactly one record." } }; return; }
        var release = matches[0], priorId = pointer.get("activeReleaseId") || "", priorHash = pointer.get("manifestSha256") || "";
        if (priorId === body.releaseId && priorHash === body.manifestHash && release.get("status") === "active") { outcome = { status: 200, body: { success: true, alreadyActive: true, releaseId: body.releaseId, manifestHash: body.manifestHash } }; return; }
        if (release.get("status") !== "ready") { outcome = { status: 409, body: { success: false, code: "INVALID_STATUS_FOR_PUBLISH", error: "Release must be ready before publication." } }; return; }
        var reviewCol = txApp.findCollectionByNameOrId("catalog_reviews"), approvals = txApp.findRecordsByFilter(reviewCol, "releaseId = {:releaseId} && manifestHash = {:manifestHash} && validationReportHash = {:validationHash} && decision = 'approved' && isLatest = true", undefined, 2, 0, { releaseId: body.releaseId, manifestHash: body.manifestHash, validationHash: release.get("validationReportSha256") });
        if (approvals.length !== 1) { outcome = { status: 409, body: { success: false, code: approvals.length ? "AMBIGUOUS_LATEST_APPROVAL" : "NO_BOUND_APPROVED_REVIEW", error: "Exactly one latest review bound to both stored hashes is required." } }; return; }
        if (priorId) { var prior = exact(txApp, releasesCol, priorId, priorHash); if (prior.length !== 1 || prior[0].get("status") !== "active") { outcome = { status: 409, body: { success: false, code: "ACTIVE_RELEASE_IDENTITY_INVALID", error: "Current active release does not match its pointer." } }; return; } prior[0].set("status", "superseded"); audit(prior[0], "superseded_by_publish", actor.identity, "Superseded by " + body.releaseId, now); txApp.save(prior[0]); }
        pointer.set("previousReleaseId", priorId); pointer.set("activeReleaseId", body.releaseId); pointer.set("manifestSha256", body.manifestHash); pointer.set("activatedAt", now); pointer.set("activatedBy", actor.identity); pointer.set("notes", body.notes || ""); txApp.save(pointer);
        release.set("status", "active"); release.set("publishedAt", now); audit(release, "published", actor.identity, body.notes || "", now); txApp.save(release);
        outcome = { status: 200, body: { success: true, releaseId: body.releaseId, manifestHash: body.manifestHash, previousActiveReleaseId: priorId || null, publishedBy: actor.identity, publishedAt: now, publicationEventId: event(txApp, "publish", priorId, body.releaseId, body.manifestHash, actor.identity, body.notes, now) } };
        return;
      }
      var currentId = pointer.get("activeReleaseId") || "", currentHash = pointer.get("manifestSha256") || "", targetId = body.targetReleaseId || pointer.get("previousReleaseId") || "";
      if (!currentId || !currentHash) { outcome = { status: 409, body: { success: false, code: "NO_ACTIVE_RELEASE", error: "No active release to roll back from." } }; return; }
      if (!targetId || typeof targetId !== "string") { outcome = { status: 409, body: { success: false, code: "NO_ROLLBACK_TARGET", error: "No rollback target is available." } }; return; }
      if (targetId === currentId) { outcome = { status: 409, body: { success: false, code: "ALREADY_ACTIVE", error: "Target release is already active." } }; return; }
      var candidates = txApp.findRecordsByFilter(releasesCol, "releaseId = {:releaseId}", undefined, 2, 0, { releaseId: targetId });
      if (candidates.length !== 1) { outcome = { status: candidates.length ? 409 : 404, body: { success: false, code: candidates.length ? "AMBIGUOUS_RELEASE_IDENTITY" : "TARGET_NOT_FOUND", error: "Rollback target must match exactly one record." } }; return; }
      var targetHash = candidates[0].get("manifestSha256"), target = exact(txApp, releasesCol, targetId, targetHash), current = exact(txApp, releasesCol, currentId, currentHash);
      if (target.length !== 1 || current.length !== 1 || current[0].get("status") !== "active") { outcome = { status: 409, body: { success: false, code: "ACTIVE_RELEASE_IDENTITY_INVALID", error: "Publication pointer does not match a unique active release." } }; return; }
      if (["active", "superseded"].indexOf(target[0].get("status")) === -1) { outcome = { status: 409, body: { success: false, code: "TARGET_NOT_ELIGIBLE", error: "Rollback target was not previously published." } }; return; }
      current[0].set("status", "superseded"); audit(current[0], "superseded_by_rollback", actor.identity, "Rolled back to " + targetId, now); txApp.save(current[0]);
      pointer.set("previousReleaseId", currentId); pointer.set("activeReleaseId", targetId); pointer.set("manifestSha256", targetHash); pointer.set("activatedAt", now); pointer.set("activatedBy", actor.identity); pointer.set("notes", body.notes || ""); txApp.save(pointer);
      target[0].set("status", "active"); target[0].set("publishedAt", now); audit(target[0], "activated_by_rollback", actor.identity, body.notes || "", now); txApp.save(target[0]);
      outcome = { status: 200, body: { success: true, rolledBackFrom: currentId, rolledBackTo: targetId, manifestHash: targetHash, rolledBackBy: actor.identity, rolledBackAt: now, publicationEventId: event(txApp, "rollback", currentId, targetId, targetHash, actor.identity, body.notes, now) } };
    });
    return c.json(outcome.status, outcome.body);
  } catch (e) { return c.json(500, { success: false, code: "INTERNAL_ERROR", error: String(e) }); }
});
