/**
 * MineOps Capture Ingest — PocketBase custom route
 *
 * Route: POST /api/capture/ingest
 * Auth:  Bearer token (matched against capture_clients collection via SHA256)
 *
 * Accepts catalog package uploads from the ubuntumac capture pipeline,
 * validates them, stores raw payload in raw_imports, and registers the
 * release in catalog_versions.
 *
 * Stable error codes (mirrors shared/schemas/validate-release.mjs):
 *   VALIDATION_ERROR / MISSING_REQUIRED_FIELD    → 400
 *   VALIDATION_ERROR / INVALID_RELEASE_ID        → 400
 *   VALIDATION_ERROR / INVALID_VERSION_CODE      → 400
 *   VALIDATION_ERROR / INVALID_APK_HASHES        → 400
 *   VALIDATION_ERROR / INVALID_STATUS            → 400
 *   VALIDATION_ERROR / UNSUPPORTED_SCHEMA_VERSION → 400
 *   DUPLICATE_RELEASE                             → 409
 *   UNAUTHORIZED                                  → 401
 */

routerAdd("POST", "/api/capture/ingest", (c) => {
  try {
    var REQUIRED = ["releaseId","versionName","versionCode","capturedAt","engineVersion","schemaVersion","apkHashes","status"];
    var VALID_STATUSES = { acquired: true, processed: true, published: true, failed: true };
    var SUPPORTED_SCHEMA_VERSION = "1.0.0";
    var SHA256_PATTERN = /^[a-f0-9]{64}$/;

    var info = c.requestInfo();
    var body = info.body || {};

    // 1. Authenticate via Bearer token (SHA256 comparison)
    var authHeader = info.headers.authorization || "";
    var tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!tokenMatch) return c.json(401, { success: false, error: "Missing or malformed Authorization header", code: "UNAUTHORIZED" });

    var tokenHash = $security.sha256(tokenMatch[1]);

    var clientsCol = $app.findCollectionByNameOrId("capture_clients");
    var clientRecords = $app.findRecordsByFilter(clientsCol, "active = true", undefined, 0, 0);
    var clientRecord = null;
    for (var i = 0; i < clientRecords.length; i++) {
      var storedHash = clientRecords[i].get("tokenHash");
      if (storedHash && $security.equal(storedHash, tokenHash)) {
        clientRecord = clientRecords[i];
        break;
      }
    }
    if (!clientRecord) return c.json(401, { success: false, error: "Invalid or inactive capture token", code: "UNAUTHORIZED" });

    clientRecord.set("lastUsedAt", new Date().toISOString());
    $app.save(clientRecord);

    // 2. Validate payload fields
    for (var i = 0; i < REQUIRED.length; i++) {
      var f = REQUIRED[i];
      if (body[f] === undefined || body[f] === null)
        return c.json(400, { success: false, error: "Missing required field: " + f, code: "VALIDATION_ERROR / MISSING_REQUIRED_FIELD" });
    }

    // 2a. Schema version check
    if (typeof body.schemaVersion !== "string" || body.schemaVersion.length < 1)
      return c.json(400, { success: false, error: "schemaVersion must be a non-empty string", code: "VALIDATION_ERROR / UNSUPPORTED_SCHEMA_VERSION" });
    var supportedMajor = parseInt(SUPPORTED_SCHEMA_VERSION.split(".")[0]);
    var payloadMajor = parseInt(body.schemaVersion.split(".")[0]);
    if (isNaN(payloadMajor) || payloadMajor > supportedMajor)
      return c.json(400, { success: false, error: "Unsupported schemaVersion: " + body.schemaVersion + " (supported: " + SUPPORTED_SCHEMA_VERSION + ")", code: "VALIDATION_ERROR / UNSUPPORTED_SCHEMA_VERSION" });

    if (typeof body.releaseId !== "string" || body.releaseId.length < 1)
      return c.json(400, { success: false, error: "releaseId must be a non-empty string", code: "VALIDATION_ERROR / INVALID_RELEASE_ID" });
    if (typeof body.versionCode !== "number" || body.versionCode < 1)
      return c.json(400, { success: false, error: "versionCode must be a positive integer", code: "VALIDATION_ERROR / INVALID_VERSION_CODE" });
    if (typeof body.apkHashes !== "object" || Object.keys(body.apkHashes).length < 1)
      return c.json(400, { success: false, error: "apkHashes must be a non-empty object", code: "VALIDATION_ERROR / INVALID_APK_HASHES" });
    // Validate SHA-256 format on each hash value
    var hashKeys = Object.keys(body.apkHashes);
    for (var hi = 0; hi < hashKeys.length; hi++) {
      var hk = hashKeys[hi];
      var hv = body.apkHashes[hk];
      if (typeof hv !== "string" || !SHA256_PATTERN.test(hv))
        return c.json(400, { success: false, error: "apkHashes[\"" + hk + "\"] must be a 64-char SHA-256 hex string", code: "VALIDATION_ERROR / INVALID_APK_HASHES" });
    }
    if (!VALID_STATUSES[body.status])
      return c.json(400, { success: false, error: "status must be one of: acquired, processed, published, failed", code: "VALIDATION_ERROR / INVALID_STATUS" });

    // 3. Check for duplicate release
    var catalogCol = $app.findCollectionByNameOrId("catalog_versions");
    var existing = $app.findRecordsByFilter(catalogCol, "version = {:id}", undefined, 0, 1, { id: body.releaseId });
    if (existing.length > 0)
      return c.json(409, { success: false, error: "Release already ingested", existingId: existing[0].id, code: "DUPLICATE_RELEASE" });

    // 4. Create raw_imports record
    var rawCol = $app.findCollectionByNameOrId("raw_imports");
    var rawRecord = new Record(rawCol, {
      owner: clientRecord.get("name"),
      source: "ubuntumac/" + (body.engineVersion || "unknown"),
      contentHash: body.releaseId,
      payload: JSON.stringify(body),
      parserVersion: body.engineVersion || "0.0.0",
      validation: JSON.stringify({ validatedAt: new Date().toISOString(), status: "accepted" }),
    });
    $app.save(rawRecord);

    // 5. Create catalog_versions record
    var catRecord = new Record(catalogCol, {
      version: body.releaseId,
      source: "ubuntumac/" + (body.engineVersion || "unknown"),
      recordCount: Array.isArray(body.objects) ? body.objects.length : 0,
    });
    $app.save(catRecord);

    return c.json(200, {
      success: true,
      rawImportId: rawRecord.id,
      catalogVersionId: catRecord.id,
      releaseId: body.releaseId,
    });
  } catch (e) {
    return c.json(500, { success: false, error: String(e) });
  }
});
