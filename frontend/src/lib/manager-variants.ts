/**
 * Duplicate / legacy Super Manager identity classification (evidence-based).
 *
 * The lossless APK extraction preserves six same-name manager pairs under
 * distinct Super Manager IDs. For each pair the two records carry identical
 * identity data (nameKey, rarity, area, cooldown, passive IDs) and identical
 * progression tables (100 active-level rows / 10 promotion rows), but only ONE
 * twin carries the per-manager bundles: `rankEffects` (rank active/passive
 * increases) and `effectFactors` (active effect type), plus a fragment
 * mapping. The other twin is a stub with no rank effects.
 *
 * Classification rule (from manager-domain evidence): the twin WITH
 * rankEffects + effectFactors is the canonical record; the twin without them
 * is the variant (legacy/duplicate) record. Variants must never be scored as
 * independent roster candidates.
 *
 * Pair evidence (canonical has rankEffects+effectFactors+effectFactors;
 * variant has none):
 *   Blingsley          sm-10005 (full) / sm-10021 (stub)
 *   Dr. Steiner        sm-10003 (full) / sm-10023 (stub)
 *   Ezio Auditore      sm-10019 (full) / sm-10022 (stub)
 *   Professor Impossible sm-10017 (full) / sm-10020 (stub)
 *   Queen Aurora       sm-10026 (full) / sm-10027 (stub)
 *   Rabbid Blingsley   sm-10028 (full) / sm-10025 (stub)   <- inverted pair
 */

export interface ManagerVariantPair {
  canonicalId: string;
  variantId: string;
  name: string;
}

export const MANAGER_VARIANT_PAIRS: ManagerVariantPair[] = [
  { canonicalId: "sm-10005", variantId: "sm-10021", name: "Blingsley" },
  { canonicalId: "sm-10003", variantId: "sm-10023", name: "Dr. Steiner" },
  { canonicalId: "sm-10019", variantId: "sm-10022", name: "Ezio Auditore" },
  { canonicalId: "sm-10017", variantId: "sm-10020", name: "Professor Impossible" },
  { canonicalId: "sm-10026", variantId: "sm-10027", name: "Queen Aurora" },
  { canonicalId: "sm-10028", variantId: "sm-10025", name: "Rabbid Blingsley" },
];

const CANONICAL_BY_VARIANT: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(MANAGER_VARIANT_PAIRS.map((pair) => [pair.variantId, pair.canonicalId])),
);

const VARIANT_IDS: ReadonlySet<string> = new Set(MANAGER_VARIANT_PAIRS.map((pair) => pair.variantId));

/** Returns the canonical manager id for a variant id, or null if not a variant. */
export function variantOf(managerId: string): string | null {
  return CANONICAL_BY_VARIANT[managerId] ?? null;
}

/** True when the id is a duplicate/legacy variant record (never scored independently). */
export function isVariantId(managerId: string): boolean {
  return VARIANT_IDS.has(managerId);
}
