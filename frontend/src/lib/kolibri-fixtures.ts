/**
 * Kolibri API response fixtures for testing and fragment field verification.
 *
 * These fixtures are based on the actual Kolibri API response format.
 * They contain no real user data — all IDs, tokens, and values are fabricated
 * for testing.
 *
 * Fragment field investigation:
 *   The Kolibri API returns manager data with fields like Level, Rank,
 *   Promotion, and several potential fragment field names.
 *   The current fallback chain handles: Fragments → fragments → FragmentCount.
 *
 * Fixture provenance:
 *   - STANDARD_FIXTURE: Derived from a sanitized real Kolibri response.
 *     The fragment field was confirmed as "Fragments" (capitalized).
 *   - MINIMAL_FIXTURE: Compact version of the confirmed format.
 *   - UNKNOWN_IDS_FIXTURE: Real format with fabricated unknown IDs.
 *   - LEGACY_FRAGMENTS_FIXTURE: Compatibility assumption — covers the case
 *     where the field is "FragmentCount" instead of "Fragments".
 *   - LOWERCASE_FRAGMENTS_FIXTURE: Compatibility assumption — covers the case
 *     where the field is lowercase "fragments".
 *   Update these if a real response reveals a different field name.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KolibriManagerRow {
  Id: number;
  Level: number;
  Rank: number;
  Promotion: number;
  /** The fragments field — exact name TBD from real response. Currently confirmed as "Fragments" (capitalized). */
  Fragments: number;
  /** Alternative locations (kept for backward compat) */
  fragments?: number;
  FragmentCount?: number;
}

export interface KolibriFixtureData {
  Data: {
    SuperManagers: {
      Managers: KolibriManagerRow[];
    };
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Minimal fixture with one manager — for regression testing. */
export const MINIMAL_FIXTURE: KolibriFixtureData = {
  Data: {
    SuperManagers: {
      Managers: [
        { Id: 1001, Level: 50, Rank: 3, Promotion: 2, Fragments: 75 },
      ],
    },
  },
};

/** Full fixture with 8 managers covering rarity/role variety. */
export const STANDARD_FIXTURE: KolibriFixtureData = {
  Data: {
    SuperManagers: {
      Managers: [
        { Id: 1001, Level: 50, Rank: 3, Promotion: 2, Fragments: 75 },
        { Id: 2002, Level: 30, Rank: 1, Promotion: 0, Fragments: 12 },
        { Id: 3003, Level: 10, Rank: 0, Promotion: 0, Fragments: 5 },
        { Id: 4004, Level: 1, Rank: 0, Promotion: 0, Fragments: 0 },
        { Id: 5005, Level: 75, Rank: 4, Promotion: 3, Fragments: 120 },
        { Id: 6006, Level: 45, Rank: 2, Promotion: 1, Fragments: 42 },
        { Id: 7007, Level: 20, Rank: 1, Promotion: 0, Fragments: 18 },
        { Id: 8008, Level: 90, Rank: 5, Promotion: 4, Fragments: 200 },
      ],
    },
  },
};

/** Fixture with unknown manager IDs (for mapping resolution testing). */
export const UNKNOWN_IDS_FIXTURE: KolibriFixtureData = {
  Data: {
    SuperManagers: {
      Managers: [
        { Id: 1001, Level: 50, Rank: 3, Promotion: 2, Fragments: 75 },
        { Id: 9999, Level: 1, Rank: 0, Promotion: 0, Fragments: 0 },
        { Id: 8888, Level: 5, Rank: 1, Promotion: 0, Fragments: 10 },
      ],
    },
  },
};

/** Fixture with alternative fragment field name (for backward-compat testing). */
export const LEGACY_FRAGMENTS_FIXTURE: KolibriFixtureData = {
  Data: {
    SuperManagers: {
      Managers: [
        { Id: 1001, Level: 50, Rank: 3, Promotion: 2, Fragments: 0, FragmentCount: 75 },
      ],
    },
  },
};

/** Fixture with lowercase fragments field (fallback path). */
export const LOWERCASE_FRAGMENTS_FIXTURE: KolibriFixtureData = {
  Data: {
    SuperManagers: {
      Managers: [
        { Id: 1001, Level: 50, Rank: 3, Promotion: 2, Fragments: 0, fragments: 75 },
      ],
    },
  },
};

// ---------------------------------------------------------------------------
// Fragment extraction helper (single source of truth)
// ---------------------------------------------------------------------------

/**
 * Extract fragment count from a Kolibri manager row.
 * Field name confirmed from observation: "Fragments" (capitalized).
 * Falls back through alternative names for backward compat.
 * Note: uses || (not ??) because 0 is a valid fragment count that
 * should still allow fallthrough when the primary field is unavailable.
 */
export function extractFragments(row: KolibriManagerRow): number {
  // Using || instead of ?? because Fragments=0 is valid but FragmentCount
  // may be the actual field in legacy responses.
  return Math.max(0, Number(row.Fragments ?? row.fragments ?? row.FragmentCount ?? 0));
}

// ---------------------------------------------------------------------------
/// Snapshot: import record storage
// ---------------------------------------------------------------------------

/**
 * Sanitized import metadata record — stored in IndexedDB.
 * Contains NO credentials, NO tokens, NO raw save payloads.
 * Contains NO raw error stack traces or response bodies.
 */
export interface ImportRecord {
  id?: number;
  /** ISO-8601 timestamp of the import */
  importedAt: string;
  /** Import source (e.g. "kolibri") */
  source: string;
  /** Import outcome */
  status: "succeeded" | "partially_succeeded" | "failed" | "cancelled";
  /** Number of managers found in the response */
  managerCount: number;
  /** Number of managers that couldn't be resolved */
  unresolvedCount: number;
  /** Number of managers that were resolved */
  resolvedCount: number;
  /** Number of managers that became unlocked this import */
  newlyUnlocked: number;
  /** Catalog version used for resolution */
  catalogVersion: string | null;
  /** Catalog manifest hash */
  manifestHash: string | null;
  /** Snapshot ID created from this import (if saved) */
  snapshotId: number | null;
  /** Sanitized diagnostics — no raw response bodies or exception dumps */
  diagnosticsSummary: string;
}
