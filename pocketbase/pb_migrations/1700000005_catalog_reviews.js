/// <reference path="../pb_hooks/pb_types.d.ts" />

/**
 * Migration: catalog_reviews collection
 *
 * Purpose: Store human review decisions, annotations, and manual mapping
 * overrides for catalog releases. Generated evidence (validation-report.json,
 * changelog.json, artifact hashes) remains in the immutable JSON package;
 * PocketBase stores only the human decision, audit trail, and any manual
 * overrides.
 *
 * Each record represents one review of one catalog release. Multiple reviews
 * can exist per release (initial review + re-review after fixes).
 *
 * Immutable after creation:
 *   releaseId, decision, reviewedAt, reviewedBy
 *
 * Mutable if re-reviewing:
 *   notes, annotations, manualOverrides, findings
 *
 * Fields:
 *   releaseId        — FK to catalog_releases.releaseId
 *   decision         — approved | rejected | quarantined
 *   reviewedBy       — Person/system that made the decision
 *   reviewedAt       — ISO-8601 timestamp
 *   notes            — Free-text reviewer notes
 *   annotations      — JSON: array of specific annotations on findings
 *                       [{checkCode, finding, annotation, severity}]
 *   manualOverrides  — JSON: array of manual mapping overrides
 *                       [{canonicalId, kind, sourceValue, reason}]
 *   findingsSummary  — JSON: compact summary of findings reviewed
 *                       {fatalCount, warningCount, fatalCodes[], warningCodes[]}
 *   schemaCompat     — JSON: schema compatibility assessment
 *                       {manifestSupported, requiredArtifactsSupported, unsupportedArtifacts[]}
 *   isLatest         — True if this is the most recent review for this release
 */

migrate((app) => {
  const collection = new Collection({
    name: "catalog_reviews",
    type: "base",
    // Public read so the frontend can display review status
    listRule: "",
    viewRule: "",
    // Only authenticated users can create/update reviews
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
        name: "decision",
        type: "select",
        required: true,
        options: {
          values: ["approved", "rejected", "quarantined"],
          maxSelect: 1,
        },
      },
      {
        name: "reviewedBy",
        type: "text",
        required: true,
        options: {
          min: 1,
          max: 255,
        },
      },
      {
        name: "reviewedAt",
        type: "date",
        required: true,
      },
      {
        name: "notes",
        type: "text",
        required: false,
        options: {
          max: 2000,
        },
      },
      {
        name: "annotations",
        type: "json",
        required: false,
      },
      {
        name: "manualOverrides",
        type: "json",
        required: false,
      },
      {
        name: "findingsSummary",
        type: "json",
        required: false,
      },
      {
        name: "schemaCompat",
        type: "json",
        required: false,
      },
      {
        name: "isLatest",
        type: "bool",
        required: false,
      },
    ],
  });

  // Add indexes
  collection.addIndex("idx_catalogReviews_releaseId", false, "releaseId", "");
  collection.addIndex("idx_catalogReviews_decision", false, "decision", "");
  collection.addIndex("idx_catalogReviews_isLatest", false, "isLatest", "");
  collection.addIndex("idx_catalogReviews_reviewedAt", false, "reviewedAt", "");

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("catalog_reviews");
  app.delete(collection);
});
