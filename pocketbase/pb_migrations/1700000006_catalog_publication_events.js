/// <reference path="../pb_hooks/pb_types.d.ts" />

/**
 * Migration: catalog_publication_events collection
 *
 * Purpose: Append-only history of every publish and rollback action.
 * Separate from per-release audit logs so publication history can be
 * queried independently of individual release records.
 *
 * Each event records one publish or rollback action. Events are never
 * edited or deleted — this is an append-only audit log.
 *
 * Fields:
 *   action        — "publish" | "rollback"
 *   fromReleaseId — Previous active release (or empty string for first publish)
 *   toReleaseId   — New active release
 *   manifestHash  — SHA-256 of the manifest that was activated
 *   performedBy   — Server-derived identity of the user
 *   performedAt   — ISO-8601 timestamp
 *   reason        — Optional reason/notes
 */

migrate((app) => {
  const collection = new Collection({
    name: "catalog_publication_events",
    type: "base",
    // Public read so the frontend can display publication history
    listRule: "",
    viewRule: "",
    // No create/update/delete from client — only server-side hook writes
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        name: "action",
        type: "select",
        required: true,
        options: {
          values: ["publish", "rollback"],
          maxSelect: 1,
        },
      },
      {
        name: "fromReleaseId",
        type: "text",
        required: false,
        options: {
          max: 255,
        },
      },
      {
        name: "toReleaseId",
        type: "text",
        required: true,
        options: {
          min: 1,
          max: 255,
        },
      },
      {
        name: "manifestHash",
        type: "text",
        required: true,
        options: {
          min: 64,
          max: 64,
          pattern: "^[a-f0-9]{64}$",
        },
      },
      {
        name: "performedBy",
        type: "text",
        required: true,
        options: {
          min: 1,
          max: 255,
        },
      },
      {
        name: "performedAt",
        type: "date",
        required: true,
      },
      {
        name: "reason",
        type: "text",
        required: false,
        options: {
          max: 1000,
        },
      },
    ],
  });

  // Add indexes for querying history
  collection.addIndex("idx_pubEvents_action", false, "action", "");
  collection.addIndex("idx_pubEvents_performedAt", false, "performedAt", "");
  collection.addIndex("idx_pubEvents_toReleaseId", false, "toReleaseId", "");

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("catalog_publication_events");
  app.delete(collection);
});
