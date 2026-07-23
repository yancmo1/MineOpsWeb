migrate((app) => {
  const collections = [
    ["profiles", "base", "owner = @request.auth.id", ["owner", "displayName"]],
    ["catalog_versions", "base", "", ["version", "source", "recordCount"]],
    ["raw_imports", "base", "owner = @request.auth.id", ["owner", "source", "contentHash", "payload", "parserVersion", "validation"]],
    ["player_snapshots_v2", "base", "owner = @request.auth.id", [
      { name: "owner", type: "text", required: true },
      { name: "rawImport", type: "text", required: true },
      { name: "state", type: "text", required: false },
      { name: "active", type: "text", required: false },
      { name: "capturedAt", type: "date", required: true },
      { name: "progress", type: "text", required: true },
      { name: "metadata", type: "text", required: false },
      { name: "catalogVersion", type: "text", required: false },
      { name: "manifestHash", type: "text", required: false },
      { name: "revision", type: "number", required: false },
      { name: "idempotencyKey", type: "text", required: false },
      { name: "unresolvedSourceIds", type: "text", required: false },
      { name: "source", type: "text", required: false },
    ]],
    ["workspace_records", "base", "owner = @request.auth.id", ["owner", "recordType", "recordKey", "payload", "revision"]],
    ["saved_strategies", "base", "owner = @request.auth.id", ["owner", "name", "payload"]],
    ["sync_events", "base", "owner = @request.auth.id", ["owner", "status", "source", "summary"]],
    ["devices", "base", "owner = @request.auth.id", ["owner", "installationId", "label", "lastSeenAt"]]
  ];
  for (const [name, type, rule, fields] of collections) {
    const c = new Collection({
      name, type, listRule: rule, viewRule: rule, createRule: rule, updateRule: rule, deleteRule: rule,
      fields: fields.map((field) => {
        if (typeof field === "string") {
          return { type: "text", name: field, required: field === "owner" || field === "installationId" };
        }
        return field;
      })
    });
    app.save(c);
  }
}, (app) => {});
