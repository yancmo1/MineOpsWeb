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
 *   releaseId, decision, reviewedAt, reviewedBy, manifestHash,
 *   validationReportHash, reviewEngineVersion
 *
 * Mutable if re-reviewing:
 *   notes, annotations, manualOverrides, findings
 *
 * Fields:
 *   releaseId            — FK to catalog_releases.releaseId
 *   decision             — approved | rejected | quarantined
 *   reviewedBy           — Server-derived: PocketBase auth identity (never from request body)
 *   reviewedAt           — ISO-8601 timestamp
 *   notes                — Free-text reviewer notes
 *   annotations          — JSON: array of specific annotations on findings
 *                           [{checkCode, finding, annotation, severity}]
 *   manualOverrides      — JSON: array of manual mapping overrides (see contract below)
 *   findingsSummary      — JSON: compact summary of findings reviewed
 *                           {fatalCount, warningCount, fatalCodes[], warningCodes[]}
 *   schemaCompat         — JSON: schema compatibility assessment
 *                           {manifestSupported, requiredArtifactsSupported, unsupportedArtifacts[]}
 *   manifestHash         — SHA-256 of the manifest.json this review evaluated (immutable)
 *   validationReportHash — SHA-256 of the validation-report.json this review evaluated (immutable)
 *   reviewEngineVersion  — Version of the review engine that produced this review (immutable)
 *   isLatest             — True if this is the most recent review for this release
 *
 * Manual override contract (each entry in manualOverrides array):
 *   {
 *     "type": "manager_mapping",
 *     "sourceId": "<source-system-identifier>",
 *     "canonicalId": "<mineops-canonical-id>",
 *     "reason": "<why the override was needed>",
 *     "reviewedBy": "<server-derived reviewer identity>",
 *     "createdAt": "<ISO-8601 timestamp>",
 *     "supersedes": null | "<previous-override-id>"
 *   }
 *   Overrides must be auditable, reversible, and validated against known canonical IDs.
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
        type: "text",
        required: true,
        options: {
          min: 1,
          max: 50,
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
        name: "validationReportHash",
        type: "text",
        required: true,
        options: {
          min: 64,
          max: 64,
          pattern: "^[a-f0-9]{64}$",
        },
      },
      {
        name: "reviewEngineVersion",
        type: "text",
        required: true,
        options: {
          min: 1,
          max: 20,
        },
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
