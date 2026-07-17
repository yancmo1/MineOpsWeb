/// <reference path="../pb_hooks/pb_types.d.ts" />

/**
 * Migration: catalog_releases collection
 *
 * Purpose: Store release-control-plane metadata for versioned JSON catalog
 * packages. PocketBase governs the release lifecycle (review, publish, rollback)
 * without mirroring the full static catalog.
 *
 * Each record represents one immutable catalog release package. The canonical
 * catalog data lives in JSON artifacts; this collection stores only the metadata
 * needed to identify, govern, review, and publish a package.
 *
 * Immutable fields (must never change after the release is accepted):
 *   releaseId, manifestSha256, artifact hashes, artifact paths, catalogVersion,
 *   gameVersion, gameVersionCode, previousCatalogVersion
 *
 * Mutable fields (may evolve during review/activation lifecycle):
 *   status, reviewedBy, reviewNotes, auditLog
 *
 * The active release is tracked separately in catalog_publication (migration
 * 1700000004), not via an isActive boolean on each release row.
 *
 * Fields:
 *   releaseId          — Source release identity (unique, immutable)
 *   catalogVersion     — Deterministic bundle directory name (immutable)
 *   gameVersion        — Human-readable game version (immutable)
 *   gameVersionCode    — Numeric APK version code (immutable)
 *   status             — Lifecycle state (candidate|review_required|ready|active|superseded|rejected)
 *   manifestSha256     — SHA-256 of the release manifest.json (immutable, content-addressed)
 *   manifestRef        — Storage URL/path to the manifest artifact (immutable)
 *   artifactCount      — Number of artifacts in the package (immutable)
 *   counts             — JSON: entity count summary from the manifest (immutable)
 *   validationSummary  — JSON: validation status, pass/fail counts, blocking issues
 *   previousCatalogVersion — Catalog version this release was diffed against (immutable)
 *   storageBaseUrl     — Base URL/path for artifact retrieval (immutable)
 *   publishedAt        — ISO-8601 timestamp of when status became 'active'
 *   reviewedBy         — Person/system that performed the review
 *   reviewNotes        — JSON: array of review notes/comments
 *   auditLog           — JSON: array of audit events (state changes, reviews, activations)
 */

migrate((app) => {
  const collection = new Collection({
    name: "catalog_releases",
    type: "base",
    // List/view: authenticated users can read release metadata
    listRule: "",
    viewRule: "",
    // Create/update/delete: only authenticated users (for now; tighten later)
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
    fields: [
      {
        name: "releaseId",
        type: "text",
        required: true,
        unique: true,
        options: {
          min: 1,
          max: 255,
        },
      },
      {
        name: "catalogVersion",
        type: "text",
        required: true,
        options: {
          min: 1,
          max: 255,
        },
      },
      {
        name: "gameVersion",
        type: "text",
        required: true,
        options: {
          min: 1,
          max: 50,
        },
      },
      {
        name: "gameVersionCode",
        type: "number",
        required: true,
        options: {
          min: 1,
        },
      },
      {
        name: "status",
        type: "select",
        required: true,
        options: {
          values: ["candidate", "review_required", "ready", "active", "superseded", "rejected"],
          maxSelect: 1,
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
        name: "manifestRef",
        type: "text",
        required: false,
        options: {
          max: 500,
        },
      },
      {
        name: "artifactCount",
        type: "number",
        required: false,
        options: {
          min: 0,
        },
      },
      {
        name: "counts",
        type: "json",
        required: false,
      },
      {
        name: "validationSummary",
        type: "json",
        required: false,
      },
      {
        name: "previousCatalogVersion",
        type: "text",
        required: false,
        options: {
          max: 255,
        },
      },
      {
        name: "storageBaseUrl",
        type: "text",
        required: false,
        options: {
          max: 500,
        },
      },
      {
        name: "publishedAt",
        type: "date",
        required: false,
      },
      {
        name: "reviewedBy",
        type: "text",
        required: false,
        options: {
          max: 255,
        },
      },
      {
        name: "reviewNotes",
        type: "json",
        required: false,
      },
      {
        name: "auditLog",
        type: "json",
        required: false,
      },
    ],
  });

  // Add indexes
  collection.addIndex("idx_catalogReleases_status", false, "status", "");
  collection.addIndex("idx_catalogReleases_gameVersionCode", false, "gameVersionCode", "");
  collection.addIndex("idx_catalogReleases_releaseId", true, "releaseId", "");

  app.save(collection);
}, (app) => {
  // Rollback: remove the collection
  const collection = app.findCollectionByNameOrId("catalog_releases");
  app.delete(collection);
});
