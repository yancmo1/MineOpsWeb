/// <reference path="../pb_hooks/pb_types.d.ts" />

/**
 * Catalog Artifacts Hook
 *
 * Serves static catalog artifact files from /pb/catalog-artifacts/.
 * Files are baked into the Docker image at build time.
 *
 * Endpoint: GET /api/catalog/artifacts?file=<filename>
 *
 * Allowed files: manifest.json, catalog-core.json, mappings.json,
 *   localization.json, validation-report.json, relationships.json,
 *   assets.json, changelog.json
 */

routerAdd("GET", "/api/catalog/artifacts", (c) => {
  try {
    var filename = c.requestInfo().query && c.requestInfo().query.file;
    if (!filename) { return c.json(400, {"error":"Missing ?file="}); }
    var allowed = [
      "manifest.json","catalog-core.json","validation-report.json",
      "relationships.json","mappings.json","localization.json",
      "assets.json","changelog.json"
    ];
    var ok = false;
    for (var i = 0; i < allowed.length; i++) {
      if (allowed[i] === filename) { ok = true; break; }
    }
    if (!ok) { return c.json(400, {"error":"Invalid file: " + filename}); }
    var bytes = $os.readFile("/pb/catalog-artifacts/" + filename);
    if (!bytes || !bytes.length) { return c.json(404, {"error":"Not found"}); }
    var str = "";
    for (var j = 0; j < bytes.length; j++) { str += String.fromCharCode(bytes[j]); }
    return c.json(200, JSON.parse(str));
  } catch (e) {
    return c.json(500, {"error":String(e)});
  }
});
