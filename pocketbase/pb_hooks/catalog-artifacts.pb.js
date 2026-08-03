/// <reference path="../pb_hooks/pb_types.d.ts" />

// Keep all implementation inside the registered callback. PocketBase 0.39's
// hook loader does not reliably retain file-level helper declarations.
routerAdd("GET", "/api/catalog/artifacts", function (c) {
  function bytesToText(bytes) {
    var text = "";
    for (var i = 0; i < bytes.length; i++) text += String.fromCharCode(bytes[i]);
    return text;
  }
  function safePath(filename) {
    return typeof filename === "string" && /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(filename) && filename.indexOf("..") === -1 && filename.indexOf("//") === -1 && filename.charAt(0) !== "/";
  }
  try {
    var filename = c.requestInfo().query && c.requestInfo().query.file;
    if (!filename || !safePath(filename)) return c.json(400, { error: "Invalid or missing ?file=" });
    var publicationCol = $app.findCollectionByNameOrId("catalog_publication");
    var publications = $app.findRecordsByFilter(publicationCol, "", undefined, 2, 0, {});
    if (publications.length !== 1) return c.json(409, { error: "CATALOG_PUBLICATION_POINTER_INVALID" });
    var activeReleaseId = publications[0].get("activeReleaseId");
    var manifestHash = publications[0].get("manifestSha256");
    if (!activeReleaseId || !manifestHash || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/.test(activeReleaseId)) return c.json(409, { error: "CATALOG_PUBLICATION_POINTER_EMPTY" });
    var releasesCol = $app.findCollectionByNameOrId("catalog_releases");
    var releases = $app.findRecordsByFilter(releasesCol, "releaseId = {:releaseId} && manifestSha256 = {:manifestHash}", undefined, 2, 0, { releaseId: activeReleaseId, manifestHash: manifestHash });
    if (releases.length !== 1 || releases[0].get("status") !== "active") return c.json(409, { error: "ACTIVE_CATALOG_RELEASE_INVALID" });
    var releaseDir = "/pb/catalog-artifacts/releases/" + activeReleaseId;
    var manifestBytes = $os.readFile(releaseDir + "/manifest.json");
    if (!manifestBytes || !manifestBytes.length) return c.json(404, { error: "Active manifest not found" });
    var manifestRaw = bytesToText(manifestBytes);
    if (!$security.equal($security.sha256(manifestRaw), manifestHash)) return c.json(409, { error: "ACTIVE_MANIFEST_HASH_MISMATCH" });
    var manifest = JSON.parse(manifestRaw);
    if (manifest.releaseId !== activeReleaseId) return c.json(409, { error: "ACTIVE_MANIFEST_RELEASE_ID_MISMATCH" });
    var allowed = filename === "manifest.json";
    var artifacts = Array.isArray(manifest.artifacts) ? manifest.artifacts : [];
    for (var i = 0; i < artifacts.length; i++) if (artifacts[i] && artifacts[i].filename === filename) { allowed = true; break; }
    if (!allowed && filename.indexOf("sprites/") === 0 && /\.png$/.test(filename)) allowed = true;
    if (!allowed) return c.json(404, { error: "Artifact is not part of the active release" });
    var bytes = $os.readFile(releaseDir + "/" + filename);
    if (!bytes || !bytes.length) return c.json(404, { error: "Artifact not found" });
    c.response.header().set("Cache-Control", "public, max-age=300");
    return c.blob(200, /\.png$/.test(filename) ? "image/png" : "application/json; charset=utf-8", bytes);
  } catch (e) {
    return c.json(409, { error: String(e) });
  }
});
