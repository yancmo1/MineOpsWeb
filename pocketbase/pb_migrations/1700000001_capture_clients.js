/// <reference path="../pb_hooks/pb_types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    name: "capture_clients",
    type: "base",
    // No public rules — only superusers/admins manage via Admin UI.
    // The capture-ingest hook reads records via DAO (superuser context).
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { type: "text", name: "name", required: true },
      { type: "text", name: "tokenHash", required: true },
      { type: "bool", name: "active" },
      { type: "text", name: "lastUsedAt" },
    ],
  });

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("capture_clients");
  if (collection) app.delete(collection);
});
