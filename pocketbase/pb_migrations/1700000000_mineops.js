migrate((app) => {
  const collections = [
    ["profiles", "base", "owner = @request.auth.id", ["owner", "displayName"]],
    ["catalog_versions", "base", "", ["version", "source", "recordCount"]],
    ["raw_imports", "base", "owner = @request.auth.id", ["owner", "source", "contentHash", "payload", "parserVersion", "validation"]],
    ["player_snapshots", "base", "owner = @request.auth.id", ["owner", "rawImport", "state", "active"]],
    ["workspace_records", "base", "owner = @request.auth.id", ["owner", "recordType", "recordKey", "payload", "revision"]],
    ["saved_strategies", "base", "owner = @request.auth.id", ["owner", "name", "payload"]],
    ["sync_events", "base", "owner = @request.auth.id", ["owner", "status", "source", "summary"]],
    ["devices", "base", "owner = @request.auth.id", ["owner", "installationId", "label", "lastSeenAt"]]
  ];
  for (const [name, type, rule, fields] of collections) {
    const c = new Collection({
      name, type, listRule: rule, viewRule: rule, createRule: rule, updateRule: rule, deleteRule: rule,
      fields: fields.map((field) => ({ type: "text", name: field, required: field === "owner" || field === "installationId" }))
    });
    app.save(c);
  }
}, (app) => {});
