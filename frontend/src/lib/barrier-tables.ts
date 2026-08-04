/**
 * Verified barrier tables and prestige timing.
 *
 * The Frontier playbook currently uses `FRONTIER_BARRIERS` — patch-sensitive
 * reference data observed from Idle Master's Hub (2026-08-01). The APK's
 * frontier/barrier bundles are NOT decoded into cost tables in the published
 * catalog yet, so this module is schema-ready for the verified replacement:
 * when a future release emits barrier rows in `frontier-domain.json`, the
 * playbook consumes them automatically. Until then it reports the reason the
 * reference table stays in use. Prestige timing uses only VERIFIED roster
 * data; exact income-timing math needs the (undecoded) mine-economy
 * magnitudes and is explicitly not claimed.
 */

import type { CatalogManager, PlayerManager } from "./db";
import type { StrategyEvaluation } from "./strategy";

export interface VerifiedBarrierRow {
  id: string;
  tier: string;
  shaft: number;
  costAfter: number;
  reward: { free: number; premium: number; elite: number };
}

export interface BarrierTableStatus {
  available: boolean;
  barriers: VerifiedBarrierRow[];
  reason: string;
}

/**
 * Parse a verified barrier table from the frontier-domain artifact.
 * Expected emission schema (release-scoped, once the frontier bundles are
 * decoded): `{ barriers: [{ tier, shaft, costAfter, rewardFree,
 * rewardPremium, rewardElite }] }`. Returns unavailable today with the
 * reason documented.
 */
export function verifiedBarrierTableFromDomain(domain: unknown): BarrierTableStatus {
  const record = typeof domain === "object" && domain != null ? domain as Record<string, unknown> : {};
  const rows = Array.isArray(record.barriers) ? record.barriers : [];
  if (rows.length === 0) {
    return {
      available: false,
      barriers: [],
      reason: "APK frontier/barrier cost tables are not decoded in the published catalog yet. The playbook uses the reference FRONTIER_BARRIERS table (Idle Master's Hub, observed 2026-08-01) until a validated mapping exists.",
    };
  }
  const barriers: VerifiedBarrierRow[] = [];
  for (const row of rows) {
    const r = row as Record<string, unknown>;
    if (typeof r.tier !== "string" || typeof r.shaft !== "number") continue;
    barriers.push({
      id: `FM ${r.tier} ${r.shaft}`,
      tier: r.tier,
      shaft: r.shaft,
      costAfter: typeof r.costAfter === "number" ? r.costAfter : 0,
      reward: {
        free: typeof r.rewardFree === "number" ? r.rewardFree : 0,
        premium: typeof r.rewardPremium === "number" ? r.rewardPremium : 0,
        elite: typeof r.rewardElite === "number" ? r.rewardElite : 0,
      },
    });
  }
  return {
    available: barriers.length > 0,
    barriers,
    reason: barriers.length > 0
      ? `Verified APK barrier table (${barriers.length} checkpoints, release-scoped).`
      : "Emitted barrier rows failed schema validation; reference table stays in use.",
  };
}

export interface PrestigeTiming {
  ready: boolean;
  areasCovered: number;
  bottleneckArea: string | null;
  checklist: string[];
  note: string;
}

/**
 * Prestige readiness from VERIFIED roster data only. Exact prestige-income
 * timing needs mine-economy magnitudes (not yet decoded), so this reports the
 * roster conditions that gate a prestige run and says why the exact timing is
 * not claimed.
 */
export function prestigeTiming(catalog: CatalogManager[], progress: PlayerManager[], evaluation: StrategyEvaluation): PrestigeTiming {
  const byId = new Map(catalog.map((manager) => [manager.id, manager]));
  const unlocked = progress.filter((player) => player.unlocked && byId.has(player.managerId));
  const areasCovered = Object.keys(evaluation.areaRecommendations).length;
  const bottleneck = Object.entries(evaluation.areaRecommendations)
    .map(([area, recs]) => ({ area, topScore: recs[0]?.score ?? 0 }))
    .filter((entry) => entry.topScore > 0)
    .sort((a, b) => a.topScore - b.topScore)[0];
  const checklist: string[] = [];
  if (areasCovered >= 3) checklist.push("All three operating areas have an assignable manager.");
  else checklist.push(`Only ${areasCovered}/3 areas have an assignable manager — prestige into the missing area.`);
  if (bottleneck) checklist.push(`Weakest covered area: ${bottleneck.area} (top pick ${bottleneck.topScore.toFixed(1)}).`);
  if (unlocked.length === 0) checklist.push("No unlocked managers — sync a roster before planning prestige.");
  const ready = unlocked.length > 0 && areasCovered >= 2;
  return {
    ready,
    areasCovered,
    bottleneckArea: bottleneck?.area ?? null,
    checklist,
    note: "Prestige income-timing math requires mine-economy magnitudes from the APK that are not decoded yet; only roster conditions are evaluated here.",
  };
}
