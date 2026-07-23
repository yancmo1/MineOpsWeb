/// <reference path="../pb_hooks/pb_types.d.ts" />

migrate((app) => {
  const collection = new Collection({
    name: "catalog_releases",
    type: "base",
    listRule: "",
    viewRule: "",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
    fields: [
      { name: "releaseId", type: "text", required: true, unique: true, options: { min: 1, max: 255 } },
      { name: "catalogVersion", type: "text", required: true, options: { min: 1, max: 255 } },
      { name: "gameVersion", type: "text", required: true, options: { min: 1, max: 50 } },
      { name: "gameVersionCode", type: "number", required: true, options: { min: 1 } },
      { name: "status", type: "text", required: true, options: { min: 1, max: 50 } },
      { name: "manifestSha256", type: "text", required: true, options: { min: 64, max: 64 } },
      { name: "manifestRef", type: "text", required: false, options: { max: 500 } },
      { name: "artifactCount", type: "number", required: false, options: { min: 0 } },
      { name: "counts", type: "json", required: false },
      { name: "validationSummary", type: "json", required: false },
      { name: "previousCatalogVersion", type: "text", required: false, options: { max: 255 } },
      { name: "storageBaseUrl", type: "text", required: false, options: { max: 500 } },
      { name: "publishedAt", type: "date", required: false },
      { name: "reviewedBy", type: "text", required: false, options: { max: 255 } },
      { name: "reviewNotes", type: "json", required: false },
      { name: "auditLog", type: "json", required: false },
    ],
  });

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("catalog_releases");
  app.delete(collection);
});
