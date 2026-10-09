/**
 * Ahead / Stockpiling strategy — verified comparative rules only.
 *
 * Sources (Oct 2026 delta research, report in research_notes):
 * - Fandom Mining Strategies / Super Managers: Balanced, Shaft-Ahead,
 *   Shaft-Behind -> Elevator-Ahead / Warehouse-Ahead / Stockpiling are
 *   COMPARATIVE rate labels. No canonical numeric ratio exists anywhere.
 * - Kolibri Help Center (values redacted as ++/--, level-dependent):
 *   Belle non-consuming % of frozen elevator pile (1m/5m),
 *   Luxario multiplies each warehouse unload (1m/30m, consuming),
 *   Dr Lilly beams collected elevator resources to Warehouse,
 *   Mr Turner Piggy Bank -> direct cash, Zi beams mined -> elevator building,
 *   Phineas crate refill on elevator take, Sir Axiom (2025-11-21) Instant Cash
 *   hub, Harumi (2026-04-30) stores/multiplies Instant Cash.
 * - Damian / Sojo detailed actives remain undocumented; never invented here.
 *
 * Rates are LIVE user inputs: mine numbers change constantly and SM
 * multipliers already active are reflected in the numbers the player reads
 * in-game. Nothing here hardcodes a player's rates.
 */

import type { CatalogManager, PlayerManager } from "./db";
import { rankThreshold } from "./db";

export type AheadLabel = "balanced" | "shaft-ahead" | "elevator-ahead" | "warehouse-ahead" | "stockpiling-setup" | "unknown";

export interface MineRates {
  /** Total Mineshaft extraction $/s as shown in Mine Overview. */
  mineshaft: number | null;
  /** Total Elevator transportation $/s. */
  elevator: number | null;
  /** Total Warehouse transportation $/s. */
  warehouse: number | null;
}

export interface AheadDiagnosis {
  label: AheadLabel;
  labelText: string;
  bottleneck: "mineshaft" | "elevator" | "warehouse" | null;
  /** Where value is piling up right now. */
  pileLocation: "shaft-crate" | "elevator-building" | "none" | null;
  headline: string;
  nextAction: string;
  /** Comparative ratios only — never presented as a canonical target. */
  ratios: { elevatorVsWarehouse: number | null; elevatorVsMineshaft: number | null; warehouseVsMineshaft: number | null };
}

function ratio(a: number | null, b: number | null): number | null {
  if (a == null || b == null || b <= 0) return null;
  return a / b;
}

export function diagnoseAhead(rates: MineRates): AheadDiagnosis {
  const { mineshaft: ms, elevator: e, warehouse: w } = rates;
  const ratios = {
    elevatorVsWarehouse: ratio(e, w),
    elevatorVsMineshaft: ratio(e, ms),
    warehouseVsMineshaft: ratio(w, ms),
  };
  if (ms == null || e == null || w == null) {
    return {
      label: "unknown", labelText: "Enter your three Mine Overview rates",
      bottleneck: null, pileLocation: null, ratios,
      headline: "Rates change constantly — enter what Mine Overview shows right now, with whatever SMs are currently active.",
      nextAction: "Fill in Mineshaft extraction, Elevator transportation, and Warehouse transportation ($/s). Re-check after any big level-up or SM activation.",
    };
  }
  // Comparative only: "ahead" = strictly the largest rate; ties ~ balanced.
  const max = Math.max(ms, e, w);
  const near = (v: number) => v >= max * 0.9;
  if (near(ms) && near(e) && near(w)) {
    return {
      label: "balanced", labelText: "Balanced", bottleneck: null, pileLocation: "none", ratios,
      headline: "All three legs are close. Safe for idle, but no burst multiplier is being fed.",
      nextAction: "To set up a burst, deliberately push one leg ahead: elevator for a Lilly/Axiom run, or hold transport back to stockpile a crate.",
    };
  }
  if (ms === max) {
    return {
      label: "shaft-ahead", labelText: "Mineshaft Ahead (Shaft-Ahead)", bottleneck: e <= w ? "elevator" : "warehouse", pileLocation: "shaft-crate", ratios,
      headline: "Shafts out-produce transport. Value piles in shaft crates and earns nothing until a shaft SM bypasses transport.",
      nextAction: "Run the Shaft-Ahead rotation on the deepest shaft (Turner → Blingsley → Steiner). Expect little/no idle income between bursts.",
    };
  }
  if (e === max) {
    return {
      label: "elevator-ahead", labelText: "Elevator Ahead", bottleneck: Math.min(ms, w) === w ? "warehouse" : "mineshaft", pileLocation: w < e ? "elevator-building" : "none", ratios,
      headline: w < ms
        ? "Elevator is strongest, warehouse is the choke. Value piles in the elevator building."
        : "Elevator is strongest. Elevator-scaled effects (Lilly beam, Axiom Instant Cash) have the biggest base to multiply.",
      nextAction: w < ms
        ? "Either level the warehouse past the elevator to unlock Warehouse Ahead, or convert the elevator-building pile with a warehouse finisher (Luxario now; Belle when unlocked)."
        : "Build a crate stockpile (hold the elevator, run Sue/Gordon/Chester on the deep shaft), then assign Dr Lilly. Re-enter rates after — they will have moved.",
    };
  }
  return {
    label: "warehouse-ahead", labelText: "Warehouse Ahead", bottleneck: "mineshaft", pileLocation: "none", ratios,
    headline: "Warehouse is the fastest leg and clears the elevator building. Warehouse unload multipliers get maximum throughput.",
    nextAction: "Feed the elevator building (Zi beam), then fire Luxario so every multiplied unload lands. If the elevator building stops returning toward zero, the warehouse is secretly behind — re-enter rates.",
  };
}

// ---------------------------------------------------------------------------
// Combo Runner — owned-only playable combos, locked chains as targets
// ---------------------------------------------------------------------------

export interface ComboStep { managerId: string; name: string; station: string; action: string }
export interface ComboCard {
  id: string;
  title: string;
  playable: boolean;
  missing: string[];
  setup: string[];
  steps: ComboStep[];
  why: string;
  sourceNote: string;
}

interface ComboDef {
  id: string; title: string;
  required: Array<{ id: string; name: string; station: string; action: string }>;
  anyOf?: Array<Array<{ id: string; name: string; station: string; action: string }>>;
  setup: string[]; why: string; sourceNote: string;
}

const COMBOS: ComboDef[] = [
  {
    id: "lilly-crate-stockpile",
    title: "Elevator-Ahead crate stockpile — Dr Lilly",
    required: [{ id: "dr-lilly", name: "Dr Lilly", station: "Elevator", action: "Assign to the elevator and activate once the crate is large — she beams a multiple of what the elevator collects straight to the Warehouse (5 min)." }],
    anyOf: [[
      { id: "ranger-sue", name: "Ranger Sue", station: "Mineshaft", action: "Activate on the deepest shaft (mining speed + infinite capacity, 1 min) to build the crate pile fast." },
      { id: "gordon", name: "Gordon", station: "Mineshaft", action: "Activate on the deepest shaft to build the crate pile." },
      { id: "chester", name: "Chester", station: "Mineshaft", action: "Activate on the deepest shaft to build the crate pile." },
    ]],
    setup: ["Leave the elevator unassigned so resources stockpile in the shaft crate.", "Elevator rate should be the strongest leg (Elevator Ahead)."],
    why: "The foundational accessible EA burst. Fandom's EA-stage tip; treat any '5x' claim as a late-continent wiki tip, not a guarantee.",
    sourceNote: "Fandom Super Managers (EA stage). No dedicated Kolibri page for Dr Lilly; multiplier is level-dependent — read it in-game.",
  },
  {
    id: "shaft-ahead-rotation",
    title: "Shaft-Ahead rotation (deepest shaft)",
    required: [
      { id: "mr-turner", name: "Mr Turner", station: "Mineshaft", action: "Activate first: stores 30s in the Piggy Bank, then unloads multiplied direct to cash (15 min cooldown)." },
      { id: "blingsley", name: "Blingsley", station: "Mineshaft", action: "Activate next: instant cash every few seconds for 1 min." },
      { id: "dr-steiner", name: "Dr Steiner", station: "Mineshaft", action: "Activate next: beams a multiple of mined resources to the Warehouse." },
    ],
    setup: ["Shafts ahead of elevator/warehouse (stop levelling E/W; Fandom notes this bites around E/W level ~1400).", "Goodman Jr. in for shaft upgrade cost when levelling."],
    why: "Every pay-off bypasses the behind elevator/warehouse. No idle income between activations — that is expected, not a bug.",
    sourceNote: "Fandom Mining Strategies Shaft-Ahead list (Turner, Blingsley, Sir Henry, Steiner, Jade Kim, Floating Agatha, Rabbid Blingsley, Sir Lorenzo).",
  },
  {
    id: "zi-beam-convert",
    title: "Zi beam → warehouse conversion",
    required: [
      { id: "zi-galvani", name: "Zi Galvani", station: "Mineshaft", action: "Activate: beams a multiple of mined resources to the elevator building (60s / 15 min)." },
    ],
    anyOf: [[
      { id: "luxario", name: "Luxario", station: "Warehouse", action: "Activate after the beam lands: every warehouse unload is multiplied for 1 min (consuming)." },
      { id: "jade-kim", name: "Jade Kim", station: "Warehouse", action: "Activate after the beam lands to convert through the warehouse. (Detailed current active is not officially documented — verify in-game HQ.)" },
    ]],
    setup: ["Warehouse should be able to clear the volume, otherwise the beam is wasted (community handoff-guide warning)."],
    why: "Turns a shaft burst into multiplied warehouse unloads without waiting on the elevator.",
    sourceNote: "Kolibri Zi + Luxario pages (Luxario lists Zi/Thalia as partners). Jade Kim detailed active still undocumented — flagged, not invented.",
  },
  {
    id: "instant-cash-chain",
    title: "Instant Cash chain — Axiom hub → Harumi finisher (2025–26 meta)",
    required: [
      { id: "sir-axiom", name: "Sir Axiom", station: "Elevator", action: "Activate first (3 min / 10 min): each elevator unload becomes Instant Cash and boosts other SMs' Instant Cash while active." },
      { id: "harumi", name: "Harumi", station: "Warehouse", action: "Activate to finish (65s / 15 min): stores all Instant Cash produced by other SMs, pays the stored total multiplied at the end." },
    ],
    setup: ["Build an elevator-building pile or a crate stockpile first — Axiom pays on unloads, Harumi pays on what others produced during her window."],
    why: "The new late-2025/2026 economy. Turner and Selena are explicit Harumi inputs, so this chain upgrades the value of managers you already own.",
    sourceNote: "Kolibri Sir Axiom (2025-11-21) + Harumi (2026-04-30) pages. Values redacted/level-dependent in Help Center.",
  },
  {
    id: "sue-belle-handoff",
    title: "Sue handoff → Belle elevator stockpile (endgame target)",
    required: [
      { id: "ranger-sue", name: "Ranger Sue", station: "Mineshaft", action: "Generate the initial pile on the collecting shaft." },
      { id: "belle-snowdrop", name: "Belle Snowdrop", station: "Warehouse", action: "Finish: periodically gains % of the frozen elevator-building pile WITHOUT consuming it (1 min / 5 min). Warehouse level is irrelevant to her." },
    ],
    setup: ["Full chain also needs a handoff bridge (Ut'ux), a crate multiplier (Abeo/Ula/Pebble), a collector (Eternity) and a mover (Eivor/Zi/Thalia/Lavender, or Meridia at the elevator).", "Let the elevator building accumulate — hold warehouse effects back until Belle reads the pile."],
    why: "Belle re-reads the same pile every 5 minutes because she does not spend it. Without Belle, handoff chains create more pile than other converters can use.",
    sourceNote: "Kolibri Belle page + community Sue–Belle chain guides. Locked pieces are shown as unlock targets, never as playable steps.",
  },
];

function normalizeManagerName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function slugManagerId(value: string): string {
  return normalizeManagerName(value).replace(/ /g, "-");
}

/**
 * Resolve a combo requirement against the ACTUAL catalog/progress IDs.
 * Combo definitions use readable slugs ("dr-lilly"), but the live database
 * uses canonical IDs ("sm-...") and display names ("Dr. Lilly"). Matching
 * only the slug made owned managers look locked; match by canonical ID,
 * slug, gameId, variant, and normalized display name instead.
 */
export function findOwnedManager(catalog: CatalogManager[], progress: PlayerManager[], required: { id: string; name: string }): CatalogManager | null {
  const ownedIds = new Set(progress.filter((p) => p.unlocked).map((p) => p.managerId));
  const wantedId = required.id;
  const wantedSlug = slugManagerId(required.name);
  const wantedName = normalizeManagerName(required.name);
  const candidate = catalog.find((manager) => {
    if (manager.id === wantedId) return true;
    if (slugManagerId(manager.id) === wantedSlug) return true;
    if (normalizeManagerName(manager.name) === wantedName) return true;
    if (manager.variantOf && (manager.variantOf === wantedId || slugManagerId(manager.variantOf) === wantedSlug)) return true;
    return false;
  });
  if (!candidate) {
    // Partial/legacy data (or a unit-test fixture) can carry the readable
    // slug directly in progress. Treat that as the same manager rather than
    // reporting a false lock.
    const direct = [...ownedIds].find((id) => id === wantedId || slugManagerId(id) === wantedSlug);
    return direct ? { id: direct, name: required.name, rarity: "", type: "", elements: [] } : null;
  }
  if (ownedIds.has(candidate.id)) return candidate;
  if (candidate.variantOf && ownedIds.has(candidate.variantOf)) return candidate;
  const variant = catalog.find((manager) => manager.variantOf === candidate.id && ownedIds.has(manager.id));
  return variant ?? null;
}

export function buildComboCards(catalog: CatalogManager[], progress: PlayerManager[]): ComboCard[] {
  const nameOf = (manager: CatalogManager | null, fallback: string) => manager?.name ?? fallback;
  return COMBOS.map((def) => {
    const missing: string[] = [];
    const steps: ComboStep[] = [];
    for (const req of def.required) {
      const ownedManager = findOwnedManager(catalog, progress, req);
      if (ownedManager) steps.push({ managerId: ownedManager.id, name: nameOf(ownedManager, req.name), station: req.station, action: req.action });
      else missing.push(req.name);
    }
    if (def.anyOf) {
      for (const group of def.anyOf) {
        const found = group.map((g) => ({ req: g, manager: findOwnedManager(catalog, progress, g) })).find((x) => x.manager);
        if (found?.manager) steps.push({ managerId: found.manager.id, name: nameOf(found.manager, found.req.name), station: found.req.station, action: found.req.action });
        else missing.push(group.map((g) => g.name).join(" or "));
      }
    }
    return { id: def.id, title: def.title, playable: missing.length === 0, missing, setup: def.setup, steps, why: def.why, sourceNote: def.sourceNote };
  });
}

// ---------------------------------------------------------------------------
// Learn / Do Next — auto checklist from roster + diagnosis
// ---------------------------------------------------------------------------

export interface NextTask {
  id: string;
  title: string;
  detail: string;
  /** 0..1 progress toward the task, null when not measurable from roster. */
  progress: number | null;
  kind: "rate" | "unlock" | "promote" | "fragments" | "learn";
}

const UNLOCK_TARGETS: Array<{ id: string; name: string; detail: string }> = [
  { id: "belle-snowdrop", name: "Belle Snowdrop", detail: "Unlock Belle (Events): non-consuming elevator-pile converter, re-readable every 5 min. Top endgame warehouse target." },
  { id: "sir-axiom", name: "Sir Axiom", detail: "Unlock Sir Axiom (Nov 2025): Instant Cash hub — boosts every other SM's Instant Cash while active." },
  { id: "harumi", name: "Harumi", detail: "Unlock Harumi (Apr 2026): stores all Instant Cash produced during her window, pays it multiplied. Pairs with Axiom + Turner." },
  { id: "phineas-cogsmith", name: "Phineas Cogsmith", detail: "Unlock Phineas: crate refill scales with elevator strength — the Elevator-Ahead stockpile engine." },
  { id: "eternity", name: "Eternity", detail: "Unlock Eternity: collects all shaft crates into MS1 for handoff chains (needed from Everdeep Biome 5 in community guides)." },
  { id: "ut-ux", name: "Ut'ux", detail: "Unlock Ut'ux (Frontier): handoff bridge from Sue to Abeo/Ula/Pebble." },
  { id: "meridia", name: "Meridia", detail: "Unlock Meridia (Jul 2026): copies every shaft crate on an infinite-capacity elevator descent." },
  { id: "celestia", name: "Celestia", detail: "Unlock Celestia (Jun 2026): Warehouse Total Transportation feeds Mineshaft Production (Everdeep)." },
];

export function buildNextTasks(catalog: CatalogManager[], progress: PlayerManager[], diagnosis: AheadDiagnosis, rates: MineRates): NextTask[] {
  const tasks: NextTask[] = [];
  const byId = new Map(progress.map((p) => [p.managerId, p]));
  const nameOf = (id: string, fallback: string) => catalog.find((m) => m.id === id)?.name ?? fallback;

  // Rate task from live diagnosis
  if (diagnosis.label === "elevator-ahead" && rates.elevator != null && rates.warehouse != null && rates.warehouse < rates.elevator) {
    tasks.push({
      id: "rate-warehouse-past-elevator", kind: "rate",
      title: "Level Warehouse past the Elevator to unlock Warehouse Ahead",
      detail: `Warehouse ${rates.warehouse}/s vs Elevator ${rates.elevator}/s right now. Use Mr Goodman for warehouse upgrade cost, then re-enter rates — they move.`,
      progress: Math.min(1, rates.warehouse / rates.elevator),
    });
  }
  if (diagnosis.label === "shaft-ahead") {
    tasks.push({
      id: "rate-shaft-ahead-note", kind: "learn",
      title: "Shaft-Ahead means bursts only — no idle income expected",
      detail: "Cash arrives when Turner/Blingsley/Steiner fire. If you want idle earnings, rebalance toward equal rates instead.",
      progress: null,
    });
  }

  // Unlock targets still locked. Resolve through the catalog so canonical
  // sm- IDs do not make an owned manager look like an unlock target.
  for (const target of UNLOCK_TARGETS) {
    const ownedManager = findOwnedManager(catalog, progress, target);
    if (!ownedManager) tasks.push({ id: `unlock-${target.id}`, kind: "unlock", title: `Unlock: ${target.name}`, detail: target.detail, progress: 0 });
  }

  // Promotion target: Dr Lilly powers the playable EA combo
  const lillyManager = findOwnedManager(catalog, progress, { id: "dr-lilly", name: "Dr Lilly" });
  const lilly = lillyManager ? byId.get(lillyManager.id) : byId.get("dr-lilly");
  if (lilly?.unlocked && lilly.promoted < 3) {
    tasks.push({
      id: "promote-dr-lilly", kind: "promote",
      title: `Promote ${nameOf("dr-lilly", "Dr Lilly")} (currently P${lilly.promoted})`,
      detail: "Lilly is your playable Elevator-Ahead finisher until Belle/Axiom/Harumi are unlocked. Promotions unlock her passives.",
      progress: lilly.promoted / 3,
    });
  }

  // Fragment readiness using verified thresholds R0=15, R1=30, R2=50, R3=80
  for (const p of progress) {
    if (!p.unlocked) continue;
    const threshold = rankThreshold(p.rank);
    if (threshold == null) continue;
    const needed = threshold - p.fragments;
    if (needed > 0 && needed <= 20) {
      tasks.push({
        id: `fragments-${p.managerId}`, kind: "fragments",
        title: `${nameOf(p.managerId, p.managerId)}: ${needed} fragments to Rank ${p.rank + 1}`,
        detail: `${p.fragments}/${threshold} fragments. Rank-ups add a verified % to active value (see Upgrade focus).`,
        progress: p.fragments / threshold,
      });
    }
  }

  // Learn tasks for the current meta
  tasks.push({
    id: "learn-instant-cash", kind: "learn",
    title: "Learn: Instant Cash chain (Axiom → producers → Harumi)",
    detail: "New 2025–26 economy: Axiom boosts Instant Cash, Selena/Turner/Don Emiliano/Drethos produce it, Harumi stores and multiplies it. Even before unlocking them, Turner is now a Harumi input — his value went up.",
    progress: null,
  });
  tasks.push({
    id: "learn-tesseract-lock", kind: "learn",
    title: "Learn: Tesseract locks your SM set until the mine completes",
    detail: "Frontier variant with limited/rarity-restricted slots, T-Cores and Blast-Perk Sparks. Choose the set deliberately — you cannot swap mid-mine.",
    progress: null,
  });

  return tasks;
}
