/// <reference path="../pb_hooks/pb_types.d.ts" />

/**
 * Migration: catalog_overrides collection
 *
 * Purpose: Dedicated collection for manual mapping overrides that augment
 * or correct the auto-generated mappings in mappings.json.
 *
 * Source-of-truth boundary:
 *   - mappings.json  → auto-generated candidates (immutable, in the package)
 *   - catalog_overrides → human-audited corrections (in PocketBase)
 *
 * Each override binds a source identifier to a canonical MineOps ID with
 * review metadata. Overrides are release-scoped so they can be re-evaluated
 * when a newer catalog is loaded.
 *
 * Fields:
 *   releaseId      — Catalog release this override applies to
 *   sourceKind     — Source identifier kind ("kolibri_id", "unity_guid", etc.)
 *   sourceValue    — The source identifier value
 *   canonicalId    — The MineOps canonical ID to map to
 *   confidence     — Override confidence level ("verified", "inferred", "manual")
 *   reason         — Why the override exists
 *   createdBy      — Server-derived identity of who created the override
 *   createdAt      — ISO-8601 timestamp
 *   supersedes     — ID of a previous override this replaces, or null
 *   isActive       — True if this is the currently active override for this source
 */

migrate((app) => {
  const collection = new Collection({
    name: "catalog_overrides",
    type: "base",
    // Public read so the frontend can resolve during catalog load
    listRule: "",
    viewRule: "",
    // Only authenticated users can create/update overrides
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
    fields: [
      {
        name: "releaseId",
        type: "text",
        required: true,
        options: {
          min: 1,
          max: 255,
        },
      },
      {
        name: "sourceKind",
        type: "select",
        required: true,
        options: {
          values: ["kolibri_id", "unity_guid", "display_name", "inferred"],
          maxSelect: 1,
        },
      },
      {
        name: "sourceValue",
        type: "text",
        required: true,
        options: {
          min: 1,
          max: 255,
        },
      },
      {
        name: "canonicalId",
        type: "text",
        required: true,
        options: {
          min: 1,
          max: 255,
        },
      },
      {
        name: "confidence",
        type: "select",
        required: true,
        options: {
          values: ["verified", "inferred", "manual"],
          maxSelect: 1,
        },
      },
      {
        name: "reason",
        type: "text",
        required: false,
        options: {
          max: 2000,
        },
      },
      {
        name: "createdBy",
        type: "text",
        required: true,
        options: {
          min: 1,
          max: 255,
        },
      },
      {
        name: "createdAt",
        type: "date",
        required: true,
      },
      {
        name: "supersedes",
        type: "text",
        required: false,
        options: {
          max: 255,
        },
      },
      {
        name: "isActive",
        type: "bool",
        required: false,
      },
    ],
  });

  // Add indexes
  collection.addIndex("idx_overrides_releaseId", false, "releaseId", "");
  collection.addIndex("idx_overrides_source", false, "sourceKind", "sourceValue");
  collection.addIndex("idx_overrides_canonicalId", false, "canonicalId", "");
  collection.addIndex("idx_overrides_isActive", false, "isActive", "");

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("catalog_overrides");
  app.delete(collection);
});
