/// <reference path="../pb_hooks/pb_types.d.ts" />

/**
 * Migration: catalog_publication collection
 *
 * Purpose: Singleton record that points to the currently active catalog release.
 * Separating the active pointer from individual release rows makes atomic
 * publish and rollback simpler: change one record instead of updating
 * isActive booleans across multiple rows.
 *
 * Exactly one record should exist in this collection. The active pointer is
 * updated atomically when publishing or rolling back a release.
 *
 * Fields:
 *   activeReleaseId  — releaseId of the currently active catalog_releases record
 *   previousReleaseId — releaseId of the previously active release (for rollback)
 *   activatedAt      — ISO-8601 timestamp of the most recent activation
 *   activatedBy      — Person/system that performed the activation
 *   manifestSha256   — SHA-256 of the active release's manifest.json (for integrity)
 *   notes            — Optional activation notes
 */

migrate((app) => {
  const collection = new Collection({
    name: "catalog_publication",
    type: "base",
    // Public read so the frontend can discover the active release without auth
    listRule: "",
    viewRule: "",
    // Only authenticated users can change the active pointer
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
    fields: [
      {
        name: "activeReleaseId",
        type: "text",
        required: true,
        options: {
          min: 1,
          max: 255,
        },
      },
      {
        name: "previousReleaseId",
        type: "text",
        required: false,
        options: {
          max: 255,
        },
      },
      {
        name: "activatedAt",
        type: "date",
        required: true,
      },
      {
        name: "activatedBy",
        type: "text",
        required: false,
        options: {
          max: 255,
        },
      },
      {
        name: "manifestSha256",
        type: "text",
        required: true,
        options: {
          min: 64,
          max: 64,
          pattern: "^[a-f0-9]{64}$",
        },
      },
      {
        name: "notes",
        type: "text",
        required: false,
        options: {
          max: 1000,
        },
      },
    ],
  });

  app.save(collection);
}, (app) => {
  // Rollback: remove the collection
  const collection = app.findCollectionByNameOrId("catalog_publication");
  app.delete(collection);
});
