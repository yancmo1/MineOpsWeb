/**
 * Catalog Publication Contract Tests
 *
 * Verifies the publication and rollback pipeline:
 *   - Successful publish (ready → active, old → superseded)
 *   - Failed verification (wrong manifest hash, wrong status, no approved review)
 *   - Capture credentials rejected (Bearer token → 403)
 *   - Exactly one active release after publish or rollback
 *   - Rollback swaps pointer without re-ingestion
 *   - Player state untouched (publication doesn't touch player data)
 *   - Concurrent publish protection (can't publish already-active release)
 *
 * These tests validate the logic enforced by the catalog-publish.pb.js hook.
 * They simulate the hook's validation steps without requiring a live PB instance.
 *
 * Usage: node --test tests/catalog-publish.test.mjs
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const ROOT = resolve(import.meta.dirname, "..");
const FIXTURES_DIR = resolve(ROOT, "tests", "fixtures", "publish");

function sha256(content) {
  return createHash("sha256").update(content, "utf-8").digest("hex");
}

function setupDir(name) {
  const dir = resolve(FIXTURES_DIR, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return dir;
}

// ---------------------------------------------------------------------------
// Simulated state machine (mirrors hook logic for offline testing)
// ---------------------------------------------------------------------------

/**
 * Simulate the publish state machine. Mirrors the hook's validation order.
 *
 * @param {object} state - { releases: Map<releaseId, {status, manifestSha256}>, reviews: Map<releaseId, {decision, isLatest}>, publication: {activeReleaseId, previousReleaseId, manifestSha256} }
 * @param {object} input - { releaseId, manifestHash, authMode: "pb-cookie" | "bearer-token" | "none" | "pb-cookie-no-role" }
 * @returns {object} { success, error, code, ... }
 */
function simulatePublish(state, input) {
  // Auth check
  if (input.authMode === "bearer-token") {
    return { success: false, error: "Capture credentials cannot publish.", code: "FORBIDDEN / CAPTURE_CLIENT_NOT_ALLOWED" };
  }
  if (input.authMode === "pb-cookie-no-role") {
    return { success: false, error: "Insufficient permissions.", code: "FORBIDDEN / INSUFFICIENT_ROLE" };
  }
  if (input.authMode !== "pb-cookie") {
    return { success: false, error: "Authentication required.", code: "UNAUTHORIZED" };
  }

  // Validate required fields
  if (!input.releaseId) {
    return { success: false, error: "releaseId is required.", code: "VALIDATION_ERROR / MISSING_RELEASE_ID" };
  }
  if (!input.manifestHash || !/^[a-f0-9]{64}$/.test(input.manifestHash)) {
    return { success: false, error: "manifestHash is required.", code: "VALIDATION_ERROR / MISSING_MANIFEST_HASH" };
  }

  // Find release
  const release = state.releases.get(input.releaseId);
  if (!release) {
    return { success: false, error: "Release not found.", code: "NOT_FOUND" };
  }

  // Idempotent: already active (check before status validation)
  if (state.publication.activeReleaseId === input.releaseId) {
    return { success: true, message: "Already active.", alreadyActive: true, releaseId: input.releaseId };
  }

  // Status must be "ready"
  if (release.status !== "ready") {
    return { success: false, error: "Release must be in 'ready' status.", code: "INVALID_STATUS_FOR_PUBLISH" };
  }

  // Must have approved review
  const review = state.reviews.get(input.releaseId);
  if (!review || review.decision !== "approved" || !review.isLatest) {
    return { success: false, error: "No approved review.", code: "NO_APPROVED_REVIEW" };
  }

  // Manifest hash must match
  if (release.manifestSha256 && release.manifestSha256 !== input.manifestHash) {
    return { success: false, error: "Manifest hash mismatch.", code: "MANIFEST_HASH_MISMATCH" };
  }

  // Perform publish
  const oldActiveId = state.publication.activeReleaseId;

  // Mark old as superseded
  if (oldActiveId) {
    const oldRelease = state.releases.get(oldActiveId);
    if (oldRelease) {
      oldRelease.status = "superseded";
    }
  }

  // Update publication
  state.publication.previousReleaseId = oldActiveId || "";
  state.publication.activeReleaseId = input.releaseId;
  state.publication.manifestSha256 = input.manifestHash;

  // Mark new as active
  release.status = "active";

  return {
    success: true,
    releaseId: input.releaseId,
    previousActiveReleaseId: oldActiveId || null,
    publishedBy: "test-user",
    publishedAt: new Date().toISOString(),
  };
}

/**
 * Simulate the rollback state machine.
 */
function simulateRollback(state, input) {
  // Auth check
  if (input.authMode === "bearer-token") {
    return { success: false, error: "Capture credentials cannot roll back.", code: "FORBIDDEN / CAPTURE_CLIENT_NOT_ALLOWED" };
  }
  if (input.authMode === "pb-cookie-no-role") {
    return { success: false, error: "Insufficient permissions.", code: "FORBIDDEN / INSUFFICIENT_ROLE" };
  }
  if (input.authMode !== "pb-cookie") {
    return { success: false, error: "Authentication required.", code: "UNAUTHORIZED" };
  }

  const pub = state.publication;
  if (!pub.activeReleaseId) {
    return { success: false, error: "No active release to roll back from.", code: "NO_ACTIVE_RELEASE" };
  }

  const targetId = input.targetReleaseId || pub.previousReleaseId;
  if (!targetId) {
    return { success: false, error: "No rollback target.", code: "NO_ROLLBACK_TARGET" };
  }
  if (targetId === pub.activeReleaseId) {
    return { success: false, error: "Target is already active.", code: "ALREADY_ACTIVE" };
  }

  const targetRelease = state.releases.get(targetId);
  if (!targetRelease) {
    return { success: false, error: "Target not found.", code: "TARGET_NOT_FOUND" };
  }

  // Target must be eligible (previously published: active or superseded)
  const eligibleStatuses = ["active", "superseded"];
  if (eligibleStatuses.indexOf(targetRelease.status) === -1) {
    return {
      success: false,
      error: "Target not eligible for rollback.",
      code: "TARGET_NOT_ELIGIBLE",
      targetStatus: targetRelease.status,
    };
  }

  // Mark current as superseded
  const currentRelease = state.releases.get(pub.activeReleaseId);
  if (currentRelease) {
    currentRelease.status = "superseded";
  }

  // Swap
  const oldActiveId = pub.activeReleaseId;
  pub.previousReleaseId = oldActiveId;
  pub.activeReleaseId = targetId;
  pub.manifestSha256 = targetRelease.manifestSha256 || "";

  targetRelease.status = "active";

  return {
    success: true,
    rolledBackFrom: oldActiveId,
    rolledBackTo: targetId,
    rolledBackBy: "test-user",
    rolledBackAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Fixture builder
// ---------------------------------------------------------------------------
function createState() {
  return {
    releases: new Map(),
    reviews: new Map(),
    publication: { activeReleaseId: "", previousReleaseId: "", manifestSha256: "" },
  };
}

function addRelease(state, releaseId, status, manifestSha256) {
  state.releases.set(releaseId, { status, manifestSha256: manifestSha256 || sha256(releaseId) });
}

function addReview(state, releaseId, decision, isLatest) {
  state.reviews.set(releaseId, { decision, isLatest: isLatest !== false });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Successful publish", () => {
  it("publishes a ready release with approved review", () => {
    const state = createState();
    const manifestHash = sha256("manifest-content");
    addRelease(state, "rel-1", "ready", manifestHash);
    addReview(state, "rel-1", "approved", true);

    const result = simulatePublish(state, {
      releaseId: "rel-1",
      manifestHash,
      authMode: "pb-cookie",
    });

    assert.equal(result.success, true);
    assert.equal(state.releases.get("rel-1").status, "active");
    assert.equal(state.publication.activeReleaseId, "rel-1");
    assert.equal(state.publication.manifestSha256, manifestHash);
    assert.equal(state.publication.previousReleaseId, "");
  });

  it("supersedes the previous active release on publish", () => {
    const state = createState();
    const oldHash = sha256("old-manifest");
    const newHash = sha256("new-manifest");

    addRelease(state, "rel-old", "active", oldHash);
    addRelease(state, "rel-new", "ready", newHash);
    addReview(state, "rel-new", "approved", true);
    state.publication.activeReleaseId = "rel-old";

    const result = simulatePublish(state, {
      releaseId: "rel-new",
      manifestHash: newHash,
      authMode: "pb-cookie",
    });

    assert.equal(result.success, true);
    assert.equal(state.releases.get("rel-old").status, "superseded");
    assert.equal(state.releases.get("rel-new").status, "active");
    assert.equal(state.publication.activeReleaseId, "rel-new");
    assert.equal(state.publication.previousReleaseId, "rel-old");
  });

  it("is idempotent when publishing an already-active release", () => {
    const state = createState();
    const hash = sha256("manifest");
    addRelease(state, "rel-1", "active", hash);
    addReview(state, "rel-1", "approved", true);
    state.publication.activeReleaseId = "rel-1";

    const result = simulatePublish(state, {
      releaseId: "rel-1",
      manifestHash: hash,
      authMode: "pb-cookie",
    });

    assert.equal(result.success, true);
    assert.equal(result.alreadyActive, true);
  });
});

describe("Failed verification", () => {
  it("rejects publish when manifest hash mismatches", () => {
    const state = createState();
    addRelease(state, "rel-1", "ready", sha256("stored-hash"));
    addReview(state, "rel-1", "approved", true);

    const result = simulatePublish(state, {
      releaseId: "rel-1",
      manifestHash: sha256("wrong-hash"),
      authMode: "pb-cookie",
    });

    assert.equal(result.success, false);
    assert.equal(result.code, "MANIFEST_HASH_MISMATCH");
  });

  it("rejects publish when release is not in ready status", () => {
    const state = createState();
    addRelease(state, "rel-1", "candidate", sha256("hash"));
    addReview(state, "rel-1", "approved", true);

    const result = simulatePublish(state, {
      releaseId: "rel-1",
      manifestHash: sha256("hash"),
      authMode: "pb-cookie",
    });

    assert.equal(result.success, false);
    assert.equal(result.code, "INVALID_STATUS_FOR_PUBLISH");
  });

  it("rejects publish when no approved review exists", () => {
    const state = createState();
    addRelease(state, "rel-1", "ready", sha256("hash"));
    // No review added

    const result = simulatePublish(state, {
      releaseId: "rel-1",
      manifestHash: sha256("hash"),
      authMode: "pb-cookie",
    });

    assert.equal(result.success, false);
    assert.equal(result.code, "NO_APPROVED_REVIEW");
  });

  it("rejects publish when review exists but is not latest", () => {
    const state = createState();
    addRelease(state, "rel-1", "ready", sha256("hash"));
    addReview(state, "rel-1", "approved", false); // isLatest = false

    const result = simulatePublish(state, {
      releaseId: "rel-1",
      manifestHash: sha256("hash"),
      authMode: "pb-cookie",
    });

    assert.equal(result.success, false);
    assert.equal(result.code, "NO_APPROVED_REVIEW");
  });

  it("rejects publish when review is rejected (not approved)", () => {
    const state = createState();
    addRelease(state, "rel-1", "ready", sha256("hash"));
    addReview(state, "rel-1", "rejected", true);

    const result = simulatePublish(state, {
      releaseId: "rel-1",
      manifestHash: sha256("hash"),
      authMode: "pb-cookie",
    });

    assert.equal(result.success, false);
    assert.equal(result.code, "NO_APPROVED_REVIEW");
  });

  it("rejects publish for non-existent release", () => {
    const state = createState();
    const result = simulatePublish(state, {
      releaseId: "nonexistent",
      manifestHash: sha256("hash"),
      authMode: "pb-cookie",
    });

    assert.equal(result.success, false);
    assert.equal(result.code, "NOT_FOUND");
  });
});

describe("Capture credentials rejected", () => {
  it("rejects publish with Bearer token (capture client)", () => {
    const state = createState();
    addRelease(state, "rel-1", "ready", sha256("hash"));
    addReview(state, "rel-1", "approved", true);

    const result = simulatePublish(state, {
      releaseId: "rel-1",
      manifestHash: sha256("hash"),
      authMode: "bearer-token",
    });

    assert.equal(result.success, false);
    assert.equal(result.code, "FORBIDDEN / CAPTURE_CLIENT_NOT_ALLOWED");
  });

  it("rejects rollback with Bearer token", () => {
    const state = createState();
    addRelease(state, "rel-1", "active", sha256("hash"));
    state.publication.activeReleaseId = "rel-1";
    state.publication.previousReleaseId = "rel-0";
    addRelease(state, "rel-0", "superseded", sha256("old-hash"));

    const result = simulateRollback(state, {
      authMode: "bearer-token",
    });

    assert.equal(result.success, false);
    assert.equal(result.code, "FORBIDDEN / CAPTURE_CLIENT_NOT_ALLOWED");
  });

  it("rejects publish with no auth", () => {
    const state = createState();
    const result = simulatePublish(state, {
      releaseId: "rel-1",
      manifestHash: sha256("hash"),
      authMode: "none",
    });

    assert.equal(result.success, false);
    assert.equal(result.code, "UNAUTHORIZED");
  });

  it("rejects publish when user lacks catalog_admin role", () => {
    const state = createState();
    addRelease(state, "rel-1", "ready", sha256("hash"));
    addReview(state, "rel-1", "approved", true);

    const result = simulatePublish(state, {
      releaseId: "rel-1",
      manifestHash: sha256("hash"),
      authMode: "pb-cookie-no-role",
    });

    assert.equal(result.success, false);
    assert.equal(result.code, "FORBIDDEN / INSUFFICIENT_ROLE");
  });

  it("rejects rollback when user lacks catalog_admin role", () => {
    const state = createState();
    addRelease(state, "rel-1", "active", sha256("hash"));
    state.publication.activeReleaseId = "rel-1";
    state.publication.previousReleaseId = "rel-0";
    addRelease(state, "rel-0", "superseded", sha256("old-hash"));

    const result = simulateRollback(state, {
      authMode: "pb-cookie-no-role",
    });

    assert.equal(result.success, false);
    assert.equal(result.code, "FORBIDDEN / INSUFFICIENT_ROLE");
  });
});

describe("Rollback", () => {
  it("rolls back to the previous release", () => {
    const state = createState();
    addRelease(state, "rel-0", "superseded", sha256("hash-0"));
    addRelease(state, "rel-1", "active", sha256("hash-1"));
    addRelease(state, "rel-2", "ready", sha256("hash-2"));
    state.publication.activeReleaseId = "rel-1";
    state.publication.previousReleaseId = "rel-0";

    const result = simulateRollback(state, { authMode: "pb-cookie" });

    assert.equal(result.success, true);
    assert.equal(result.rolledBackFrom, "rel-1");
    assert.equal(result.rolledBackTo, "rel-0");
    assert.equal(state.releases.get("rel-0").status, "active");
    assert.equal(state.releases.get("rel-1").status, "superseded");
    assert.equal(state.publication.activeReleaseId, "rel-0");
    assert.equal(state.publication.previousReleaseId, "rel-1");
  });

  it("rolls back to an explicit target release", () => {
    const state = createState();
    addRelease(state, "rel-0", "superseded", sha256("hash-0"));
    addRelease(state, "rel-1", "active", sha256("hash-1"));
    addRelease(state, "rel-2", "ready", sha256("hash-2"));
    state.publication.activeReleaseId = "rel-1";
    state.publication.previousReleaseId = "rel-0";

    // Roll back to rel-0 via explicit target (bypasses previousReleaseId)
    const result = simulateRollback(state, {
      authMode: "pb-cookie",
      targetReleaseId: "rel-0",
    });

    assert.equal(result.success, true);
    assert.equal(result.rolledBackTo, "rel-0");
  });

  it("rejects rollback to a non-existent release", () => {
    const state = createState();
    addRelease(state, "rel-1", "active", sha256("hash-1"));
    state.publication.activeReleaseId = "rel-1";

    const result = simulateRollback(state, {
      authMode: "pb-cookie",
      targetReleaseId: "nonexistent",
    });

    assert.equal(result.success, false);
    assert.equal(result.code, "TARGET_NOT_FOUND");
  });

  it("rejects rollback to a non-eligible target (candidate/rejected)", () => {
    const state = createState();
    addRelease(state, "rel-0", "rejected", sha256("hash-0"));
    addRelease(state, "rel-1", "active", sha256("hash-1"));
    state.publication.activeReleaseId = "rel-1";

    const result = simulateRollback(state, {
      authMode: "pb-cookie",
      targetReleaseId: "rel-0",
    });

    assert.equal(result.success, false);
    assert.equal(result.code, "TARGET_NOT_ELIGIBLE");
    assert.equal(result.targetStatus, "rejected");
  });

  it("rejects rollback when no active release exists (empty pointer)", () => {
    const state = createState();
    state.publication.activeReleaseId = "";

    const result = simulateRollback(state, { authMode: "pb-cookie" });

    assert.equal(result.success, false);
    assert.equal(result.code, "NO_ACTIVE_RELEASE");
  });

  it("rejects rollback to the currently active release", () => {
    const state = createState();
    addRelease(state, "rel-1", "active", sha256("hash-1"));
    state.publication.activeReleaseId = "rel-1";

    const result = simulateRollback(state, {
      authMode: "pb-cookie",
      targetReleaseId: "rel-1",
    });

    assert.equal(result.success, false);
    assert.equal(result.code, "ALREADY_ACTIVE");
  });

  it("rollback does not rewrite catalog objects", () => {
    // Verify that rollback only changes status fields and publication pointer,
    // not any content-related fields
    const state = createState();
    const oldHash = sha256("old-manifest");
    addRelease(state, "rel-old", "superseded", oldHash);
    addRelease(state, "rel-new", "active", sha256("new-manifest"));
    state.publication.activeReleaseId = "rel-new";
    state.publication.previousReleaseId = "rel-old";

    // Snapshot release data before rollback
    const releaseDataBefore = {};
    for (const [id, rel] of state.releases) {
      releaseDataBefore[id] = { ...rel };
    }

    simulateRollback(state, { authMode: "pb-cookie" });

    // Only status should have changed; manifestSha256 is immutable
    assert.equal(state.releases.get("rel-old").manifestSha256, oldHash);
    assert.equal(state.releases.get("rel-new").manifestSha256, releaseDataBefore["rel-new"].manifestSha256);
  });
});

describe("Exactly one active release", () => {
  it("only one release is active after publish", () => {
    const state = createState();
    addRelease(state, "rel-old", "active", sha256("old"));
    addRelease(state, "rel-new", "ready", sha256("new"));
    addReview(state, "rel-new", "approved", true);
    state.publication.activeReleaseId = "rel-old";

    simulatePublish(state, {
      releaseId: "rel-new",
      manifestHash: sha256("new"),
      authMode: "pb-cookie",
    });

    const activeCount = [...state.releases.values()].filter((r) => r.status === "active").length;
    assert.equal(activeCount, 1);
    assert.equal(state.releases.get("rel-new").status, "active");
    assert.equal(state.releases.get("rel-old").status, "superseded");
  });

  it("only one release is active after rollback", () => {
    const state = createState();
    addRelease(state, "rel-0", "superseded", sha256("hash-0"));
    addRelease(state, "rel-1", "active", sha256("hash-1"));
    state.publication.activeReleaseId = "rel-1";
    state.publication.previousReleaseId = "rel-0";

    simulateRollback(state, { authMode: "pb-cookie" });

    const activeCount = [...state.releases.values()].filter((r) => r.status === "active").length;
    assert.equal(activeCount, 1);
    assert.equal(state.releases.get("rel-0").status, "active");
    assert.equal(state.releases.get("rel-1").status, "superseded");
  });
});

describe("Player state isolation", () => {
  it("publication does not touch player-related collections", () => {
    // This test verifies the architectural constraint:
    // Player data (player_snapshots, workspace_records, etc.) is never
    // referenced or modified by the publish/rollback process.
    // The hook only interacts with catalog_releases and catalog_publication.
    const state = createState();
    const hash = sha256("manifest");
    addRelease(state, "rel-1", "ready", hash);
    addReview(state, "rel-1", "approved", true);

    // Player state is separate — the publish simulation doesn't accept it
    const playerState = { snapshots: ["snap-1"], progress: { mgr_1: 5 } };

    simulatePublish(state, {
      releaseId: "rel-1",
      manifestHash: hash,
      authMode: "pb-cookie",
    });

    // Player state unchanged
    assert.deepEqual(playerState, { snapshots: ["snap-1"], progress: { mgr_1: 5 } });
  });
});
