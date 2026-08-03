/**
 * Contract tests for the catalog PocketBase control plane.
 *
 * These deliberately model the data invariants rather than pretending Node can
 * execute PocketBase's JSVM hooks. The source assertions keep the tested
 * invariants tied to the actual hooks and migration.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

function legacyId(releaseId, recordId, suffix = "") {
  const prefix = "legacy-";
  const tail = `-${suffix}${recordId}`;
  return prefix + String(releaseId).slice(0, Math.max(1, 255 - prefix.length - tail.length)) + tail;
}

function newest(rows, field) {
  return [...rows].sort((a, b) => String(b[field] || b.created).localeCompare(String(a[field] || a.created)) || b.id.localeCompare(a.id))[0];
}

/** Mirrors the intended additive migration mapping rules. */
function repair(records, reviews, pointer) {
  const byId = Map.groupBy(records, (record) => record.releaseId);
  const mapping = new Map();
  for (const [releaseId, rows] of byId) {
    const active = rows.filter((row) => pointer.activeReleaseId === releaseId && row.status === "active" && row.manifestSha256 === pointer.manifestSha256);
    const canonical = active.length ? newest(active, "updated") : newest(rows, "updated");
    const byHash = new Map();
    for (const row of rows) {
      if (row !== canonical) row.releaseId = legacyId(releaseId, row.id);
      const mapped = byHash.get(row.manifestSha256);
      if (!mapped || row === canonical || newest([mapped, row], "updated") === row) byHash.set(row.manifestSha256, row);
    }
    mapping.set(releaseId, byHash);
  }
  for (const review of reviews) {
    const mapped = mapping.get(review.releaseId)?.get(review.manifestHash);
    review.releaseId = mapped ? mapped.releaseId : legacyId(review.releaseId, review.id, "review-");
  }
  for (const rows of Map.groupBy(reviews, (review) => review.releaseId).values()) {
    const latest = newest(rows, "reviewedAt");
    for (const review of rows) review.isLatest = review === latest;
  }
}

describe("duplicate repair contract", () => {
  it("keeps pointer+active+manifest release canonical and maps each review by manifest hash", () => {
    const records = [
      { id: "active-record", releaseId: "5.59.0", manifestSha256: HASH_A, status: "active", updated: "2026-08-01" },
      { id: "candidate-record", releaseId: "5.59.0", manifestSha256: HASH_B, status: "candidate", updated: "2026-08-02" },
    ];
    const reviews = [
      { id: "review-a-old", releaseId: "5.59.0", manifestHash: HASH_A, reviewedAt: "2026-08-01" },
      { id: "review-a-new", releaseId: "5.59.0", manifestHash: HASH_A, reviewedAt: "2026-08-03" },
      { id: "review-b", releaseId: "5.59.0", manifestHash: HASH_B, reviewedAt: "2026-08-02" },
    ];
    repair(records, reviews, { activeReleaseId: "5.59.0", manifestSha256: HASH_A });
    assert.equal(records[0].releaseId, "5.59.0");
    assert.equal(records[1].releaseId, "legacy-5.59.0-candidate-record");
    assert.equal(reviews[0].releaseId, "5.59.0");
    assert.equal(reviews[1].releaseId, "5.59.0");
    assert.equal(reviews[2].releaseId, records[1].releaseId);
    assert.equal(reviews[0].isLatest, false);
    assert.equal(reviews[1].isLatest, true);
    assert.equal(reviews[2].isLatest, true);
  });

  it("preserves unmatched review history without attaching it to a different package", () => {
    const records = [{ id: "record-a", releaseId: "rel", manifestSha256: HASH_A, status: "active", updated: "2026-08-01" }];
    const reviews = [{ id: "orphan-review", releaseId: "rel", manifestHash: HASH_B, reviewedAt: "2026-08-02" }];
    repair(records, reviews, { activeReleaseId: "rel", manifestSha256: HASH_A });
    assert.equal(reviews[0].releaseId, "legacy-rel-review-orphan-review");
    assert.equal(reviews[0].isLatest, true);
  });
});

describe("hook source contract", () => {
  it("uses exact hash-bound identities, a transaction, superuser support, and closed collection rules", () => {
    const publish = readFileSync(resolve(ROOT, "pocketbase/pb_hooks/catalog-publish.pb.js"), "utf8");
    const review = readFileSync(resolve(ROOT, "pocketbase/pb_hooks/catalog-review.pb.js"), "utf8");
    const artifacts = readFileSync(resolve(ROOT, "pocketbase/pb_hooks/catalog-artifacts.pb.js"), "utf8");
    const migration = readFileSync(resolve(ROOT, "pocketbase/pb_migrations/1700000008_catalog_control_plane_hardening.js"), "utf8");
    // PB 0.39 does not preserve file-level helpers for later route callbacks.
    // Each hook registers its callback before declaring the callback-local
    // helper functions, proving the helpers live in the route closure.
    for (const [hook, helper] of [[publish, "function hash"], [review, "function hash"], [artifacts, "function bytesToText"]]) {
      assert.ok(hook.indexOf("routerAdd") < hook.indexOf(helper));
    }
    assert.match(publish, /\$app\.runInTransaction/);
    assert.match(publish, /releaseId = \{:\w+\} && manifestSha256 = \{:\w+\}/);
    assert.match(publish, /validationReportHash = \{:\w+\}/);
    assert.match(publish, /manifestSha256: manifestHash/);
    assert.doesNotMatch(publish, /reason: reason/);
    assert.match(publish, /auth\.isSuperuser/);
    assert.match(publish, /c\.auth \|\| info\.auth/);
    assert.match(publish, /capture_token" : "unauthenticated/);
    assert.match(review, /validationReportSha256/);
    assert.match(review, /auth\.isSuperuser/);
    assert.match(review, /c\.auth \|\| info\.auth/);
    assert.match(review, /capture_token" : "unauthenticated/);
    assert.match(artifacts, /activeReleaseId/);
    assert.match(artifacts, /ACTIVE_MANIFEST_HASH_MISMATCH/);
    assert.match(artifacts, /\/pb\/catalog-artifacts\/releases\//);
    assert.match(artifacts, /c\.response\.header\(\)\.set/);
    assert.match(artifacts, /c\.blob\(200,/);
    assert.doesNotMatch(artifacts, /c\.response\(\)/);
    for (const hook of [publish, review, artifacts]) {
      assert.doesNotMatch(hook, /findRecordsByFilter\([^\n]+undefined, 0, 2,/);
    }
    assert.match(artifacts, /findRecordsByFilter\([^\n]+undefined, 2, 0,/);
    assert.match(migration, /validationReportSha256/);
    assert.ok(migration.indexOf("txApp.save(releases)") < migration.indexOf("const pointerRows"));
    assert.match(migration, /idx_catalogReleases_releaseId_unique/);
    assert.match(migration, /idx_catalogReviews_oneLatestPerRelease/);
    assert.match(migration, /collection\.createRule = null/);
  });
});
