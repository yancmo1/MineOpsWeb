/// <reference path="../pb_hooks/pb_types.d.ts" />

/**
 * Catalog Artifacts Hook
 *
 * Serves static catalog artifact files from /pb/catalog-artifacts/.
 * Files are baked into the Docker image at build time.
 *
 * Endpoint: GET /api/catalog/artifacts?file=<filename>
 *
 * JSON artifacts: manifest.json, catalog-core.json, validation-report.json,
 *   relationships.json, mappings.json, localization.json, assets.json, changelog.json
 * Sprites: sprites/*.png
 */

routerAdd("GET", "/api/catalog/artifacts", (c) => {
  try {
    var filename = c.requestInfo().query && c.requestInfo().query.file;
    if (!filename) { return c.json(400, {"error":"Missing ?file="}); }

    // JSON artifacts — return raw string (no re-serialization)
    var jsonAllowed = [
      "manifest.json","catalog-core.json","validation-report.json",
      "relationships.json","mappings.json","localization.json",
      "assets.json","changelog.json"
    ];
    for (var i = 0; i < jsonAllowed.length; i++) {
      if (jsonAllowed[i] === filename) {
        var bytes = $os.readFile("/pb/catalog-artifacts/" + filename);
        if (!bytes || !bytes.length) { return c.json(404, {"error":"Not found"}); }
        var str = "";
        for (var j = 0; j < bytes.length; j++) { str += String.fromCharCode(bytes[j]); }
        return c.string(200, str);
      }
    }

    // Sprites — return as raw bytes via the string response
    // Frontend will construct an img src from the response
    if (filename.indexOf("sprites/") === 0 && filename.indexOf(".png") > 0) {
      var spritePath = "/pb/catalog-artifacts/" + filename;
      var spriteBytes = $os.readFile(spritePath);
      if (!spriteBytes || !spriteBytes.length) { return c.json(404, {"error":"Sprite not found"}); }
      var raw = "";
      for (var j = 0; j < spriteBytes.length; j++) { raw += String.fromCharCode(spriteBytes[j]); }
      c.response().header().set("Content-Type", "application/octet-stream");
      return c.string(200, raw);
    }

    return c.json(400, {"error":"Invalid file: " + filename});
  } catch (e) {
    return c.json(500, {"error":String(e)});
  }
});