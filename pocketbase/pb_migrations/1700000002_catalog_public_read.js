/// <reference path="../pb_hooks/pb_types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("catalog_versions");
  // Set listRule and viewRule to "" (empty = public read in PB 0.39.x)
  // so the frontend capture-status card and any other consumer can
  // list/read catalog versions without authentication.
  collection.listRule = "";
  collection.viewRule = "";
  app.save(collection);
}, (app) => {
  // Restore to original (empty string = no one)
  const collection = app.findCollectionByNameOrId("catalog_versions");
  collection.listRule = "";
  collection.viewRule = "";
  app.save(collection);
});
