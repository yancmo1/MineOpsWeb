/// <reference path="../pb_hooks/pb_types.d.ts" />

migrate((app) => {
  var col;
  
  // Update catalog_versions to allow public read
  col = app.findCollectionByNameOrId("catalog_versions");
  col.listRule = "";
  col.viewRule = "";
  app.save(col);

}, (app) => {
  // Rollback not implemented
});
