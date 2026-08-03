/// <reference path="../pb_hooks/pb_types.d.ts" />

/**
 * Additive catalog control-plane hardening.
 *
 * Before applying in production, create a PocketBase backup. This migration
 * never deletes a release, review, or event. Its reversible schema/rule changes
 * have a down migration; restoring the pre-migration backup is the recovery
 * path for the intentionally preserved legacy release identifiers.
 */
function catalogLegacyId(releaseId, recordId, suffix) {
  var prefix = "legacy-";
  var tail = "-" + (suffix || "") + recordId;
  var available = 255 - prefix.length - tail.length;
  return prefix + String(releaseId || "unknown").slice(0, Math.max(1, available)) + tail;
}

function catalogNewest(records, dateField) {
  var newest = records[0];
  for (var i = 1; i < records.length; i++) {
    var candidate = records[i];
    var newestDate = String(newest.get(dateField) || newest.get("created") || "");
    var candidateDate = String(candidate.get(dateField) || candidate.get("created") || "");
    if (candidateDate > newestDate || (candidateDate === newestDate && candidate.id > newest.id)) newest = candidate;
  }
  return newest;
}

migrate((app) => {
  app.runInTransaction((txApp) => {
    const releases = txApp.findCollectionByNameOrId("catalog_releases");
    const reviews = txApp.findCollectionByNameOrId("catalog_reviews");
    const publication = txApp.findCollectionByNameOrId("catalog_publication");

    // New field remains optional for existing rows. The review/publish routes
    // fail closed until a release has an authoritative report digest.
    if (!releases.fields.getByName("validationReportSha256")) {
      releases.fields.addMarshaledJSON(JSON.stringify({
        name: "validationReportSha256", type: "text", required: false,
        min: 64, max: 64,
      }));
    }
    if (!reviews.fields.getByName("reviewedAt")) {
      reviews.fields.addMarshaledJSON(JSON.stringify({ name: "reviewedAt", type: "date", required: false }));
    }
    let events = null;
    try {
      events = txApp.findCollectionByNameOrId("catalog_publication_events");
      if (!events.fields.getByName("performedAt")) {
        events.fields.addMarshaledJSON(JSON.stringify({ name: "performedAt", type: "date", required: false }));
      }
    } catch (_) {}

    // Persist field additions before any record save uses them. PocketBase
    // builds record UPDATE statements from the in-memory collection schema;
    // without this checkpoint an upgraded production database can reference a
    // column that has not yet been added to SQLite.
    txApp.save(releases);
    txApp.save(reviews);
    if (events) txApp.save(events);

    const pointerRows = txApp.findRecordsByFilter(publication, "", undefined, 0, 0, {});
    const allReleases = txApp.findRecordsByFilter(releases, "", undefined, 0, 0, {});
    const byOriginalId = {};
    for (let i = 0; i < allReleases.length; i++) {
      const releaseId = allReleases[i].get("releaseId");
      if (!byOriginalId[releaseId]) byOriginalId[releaseId] = [];
      byOriginalId[releaseId].push(allReleases[i]);
    }

    // Map each original release identity to its post-repair records. The one
    // record selected by pointer + active status + matching manifest retains
    // the original releaseId. Every other duplicate remains in history under
    // an explicit legacy identity that includes its immutable record id.
    const releaseByOriginalAndManifest = {};
    Object.keys(byOriginalId).forEach((originalId) => {
      const group = byOriginalId[originalId];
      let canonicalCandidates = [];
      for (let p = 0; p < pointerRows.length; p++) {
        const pointer = pointerRows[p];
        if (pointer.get("activeReleaseId") !== originalId) continue;
        for (let r = 0; r < group.length; r++) {
          if (group[r].get("status") === "active" && group[r].get("manifestSha256") === pointer.get("manifestSha256")) canonicalCandidates.push(group[r]);
        }
      }
      const canonical = canonicalCandidates.length ? catalogNewest(canonicalCandidates, "updated") : catalogNewest(group, "updated");
      const byHash = {};
      for (let r = 0; r < group.length; r++) {
        const record = group[r];
        if (record.id !== canonical.id) {
          record.set("releaseId", catalogLegacyId(originalId, record.id, ""));
          txApp.save(record);
        }
        const hash = record.get("manifestSha256") || "";
        // If historic rows share a manifest digest, bind reviews to the
        // canonical record when possible; otherwise use the newest row.
        if (!byHash[hash] || record.id === canonical.id || catalogNewest([byHash[hash], record], "updated").id === record.id) byHash[hash] = record;
      }
      releaseByOriginalAndManifest[originalId] = byHash;
    });

    const allReviews = txApp.findRecordsByFilter(reviews, "", undefined, 0, 0, {});
    for (let i = 0; i < allReviews.length; i++) {
      const review = allReviews[i];
      const originalId = review.get("releaseId");
      const mapped = releaseByOriginalAndManifest[originalId] && releaseByOriginalAndManifest[originalId][review.get("manifestHash") || ""];
      // Preserve reviews whose old release record is absent or whose immutable
      // manifest hash has no match, without falsely attaching them to a package.
      review.set("releaseId", mapped ? mapped.get("releaseId") : catalogLegacyId(originalId, review.id, "review-"));
      txApp.save(review);
    }

    // Repair historical isLatest conflicts deterministically after remapping.
    const repairedReviews = txApp.findRecordsByFilter(reviews, "", undefined, 0, 0, {});
    const byReleaseId = {};
    for (let i = 0; i < repairedReviews.length; i++) {
      const releaseId = repairedReviews[i].get("releaseId");
      if (!byReleaseId[releaseId]) byReleaseId[releaseId] = [];
      byReleaseId[releaseId].push(repairedReviews[i]);
    }
    Object.keys(byReleaseId).forEach((releaseId) => {
      const latest = catalogNewest(byReleaseId[releaseId], "reviewedAt");
      byReleaseId[releaseId].forEach((review) => {
        review.set("isLatest", review.id === latest.id);
        txApp.save(review);
      });
    });

    // Close all direct mutation paths. Server-side hooks use txApp.save and
    // are therefore not dependent on public collection rules.
    [releases, reviews, publication].forEach((collection) => {
      collection.createRule = null;
      collection.updateRule = null;
      collection.deleteRule = null;
      txApp.save(collection);
    });
    try {
      events.createRule = null; events.updateRule = null; events.deleteRule = null;
      txApp.save(events);
    } catch (_) {}
    try {
      const overrides = txApp.findCollectionByNameOrId("catalog_overrides");
      overrides.createRule = null; overrides.updateRule = null; overrides.deleteRule = null;
      txApp.save(overrides);
    } catch (_) {}

    // Unique indexes are added only after the repair has made their contents
    // valid. PocketBase/SQLite supports the partial review index used here.
    releases.addIndex("idx_catalogReleases_releaseId_unique", true, "releaseId", "");
    reviews.addIndex("idx_catalogReviews_oneLatestPerRelease", true, "releaseId", "isLatest = true");
    txApp.save(releases);
    txApp.save(reviews);
  });
}, (app) => {
  // The data repair intentionally remains: it is historical lineage, not
  // disposable migration state. A pre-migration PB backup restores old IDs.
  const releases = app.findCollectionByNameOrId("catalog_releases");
  const reviews = app.findCollectionByNameOrId("catalog_reviews");
  releases.removeIndex("idx_catalogReleases_releaseId_unique");
  reviews.removeIndex("idx_catalogReviews_oneLatestPerRelease");
  app.save(releases);
  app.save(reviews);
});
