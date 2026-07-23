/// <reference path="../pb_hooks/pb_types.d.ts" />

/**
 * Migration: player_snapshots v2 — add revision, catalog metadata, and sync fields.
 *
 * The original player_snapshots collection from 1700000000 was a placeholder
 * with only owner, rawImport, state, and active. This migration adds the
 * actual data fields used by the frontend sync orchestrator.
 *
 * Added fields:
 *   capturedAt          — ISO-8601 timestamp when the snapshot was captured locally
 *   progress            — JSON-serialized PlayerManager[]
 *   metadata            — JSON-serialized SyncMetadata
 *   catalogVersion      — Catalog version used to interpret this snapshot
 *   manifestHash        — SHA-256 of the manifest at time of interpretation
 *   revision            — Monotonic revision counter for conflict detection
 *   idempotencyKey      — Client-generated UUID for deduplication
 *   unresolvedSourceIds — JSON-serialized string[] of source IDs that couldn't be mapped
 *   source              — Import source (e.g. "kolibri", "manual")
 */

migrate((app) => {
  const collection = app.findCollectionByNameOrId("player_snapshots");

  const existingNames = new Set(collection.fields.map((f) => f.name));
  const v2Fields = [
    { name: "capturedAt", type: "date", required: true },
    { name: "progress", type: "text", required: true },
    { name: "metadata", type: "text", required: false },
    { name: "catalogVersion", type: "text", required: false },
    { name: "manifestHash", type: "text", required: false },
    { name: "revision", type: "number", required: false },
    { name: "idempotencyKey", type: "text", required: false },
    { name: "unresolvedSourceIds", type: "text", required: false },
    { name: "source", type: "text", required: false },
  ];

  let changed = false;
  for (const field of v2Fields) {
    if (!existingNames.has(field.name)) {
      // PB 0.39.x: collection.fields.add(plainObject) fails.
      // Push directly to the fields array instead.
      collection.fields.push(field);
      changed = true;
    }
  }

  if (changed) {
    app.save(collection);
  }

  // Add indexes
  const col = app.findCollectionByNameOrId("player_snapshots");
  col.addIndex("idx_snapshots_capturedAt", false, "capturedAt", "");
  col.addIndex("idx_snapshots_idempotencyKey", false, "idempotencyKey", "");
  app.save(col);
}, (app) => {
  // Rollback: cannot safely remove fields in PocketBase without data loss.
  // Leave the fields in place. Migration is non-destructive.
  console.warn("Rollback of 1700000008 skipped: fields are additive and non-destructive.");
});
