/**
 * Mission Board — mine profiles + ranked strategy plays.
 *
 * Design (Yancy, 2026-10-08):
 * - Every mine carries its own profile: live MS/E/W rates, selected play.
 * - Every strategy is evaluated in every mine; the board ranks them and
 *   names the biggest cash earner for the current lineup, but the player
 *   can choose a different play to run.
 * - Data honesty: exact game multipliers are level-dependent and partly
 *   undocumented, so rankings use (a) the live bottleneck pace when rates
 *   are entered (min of MS/E/W = sustainable cash pace), (b) how well the
 *   mine's shape fits the play's engine leg, and (c) verified roster
 *   strength from the catalog (strengthScore). Scores are labelled
 *   "projected pace", never fabricated dollar figures.
 * - Backend/PocketBase sync of mine profiles is future work; v1 persists
 *   in localStorage like the Ahead rate inputs do.
 */

import type { CatalogManager, PlayerManager } from "./db";
import { effectiveActiveValue, strengthScore } from "./db";
import { buildComboCards, diagnoseAhead, type MineRates } from "./ahead-strategy";

export interface MineProfile {
  id: string;
  name: string;
  kind: "continent" | "everdeep" | "frontier" | "event" | "custom";
  rates: MineRates;
  /** Per-leg multiplier used for burst/effective pace (x). Totals entered
   * from Mine Overview stay raw; the board shows rate x multiplier so the
   * player can model an active SM window without pretending it is idle pace. */
  multipliers: MineRates;
  ratesUpdatedAt?: string;
  selectedPlayId?: string;
  source?: "catalog" | "stored" | "fallback";
}

export type MineMultipliers = MineRates;

export const DEFAULT_MULTIPLIERS: MineMultipliers = { mineshaft: 1, elevator: 1, warehouse: 1 };

export function effectiveRates(rates: MineRates, multipliers: MineRates = DEFAULT_MULTIPLIERS): MineRates {
  const apply = (rate: number | null, multiplier: number | null) => rate == null ? null : rate * (multiplier && multiplier > 0 ? multiplier : 1);
  return {
    mineshaft: apply(rates.mineshaft, multipliers.mineshaft),
    elevator: apply(rates.elevator, multipliers.elevator),
    warehouse: apply(rates.warehouse, multipliers.warehouse),
  };
}

export const MINES_STORAGE_KEY = "mineops.mines.v1";

const EMPTY_RATES: MineRates = { mineshaft: null, elevator: null, warehouse: null };

export const DEFAULT_MINES: MineProfile[] = [
  { id: "everdeep", name: "Everdeep", kind: "everdeep", rates: EMPTY_RATES, multipliers: DEFAULT_MULTIPLIERS, source: "fallback" },
  { id: "frontier-mine", name: "Frontier Mine", kind: "frontier", rates: EMPTY_RATES, multipliers: DEFAULT_MULTIPLIERS, source: "fallback" },
];

/**
 * Build the selectable mine list from the CURRENT verified catalog package.
 * Source: mine-economy-domain.json, whose continent identities are extracted
 * from the game files (ops/strategy_semantics.py CONTINENT_TYPES). Everdeep
 * and Frontier Mine are operating modes already used by this app, appended
 * after the continent list rather than pretending they are continents.
 */
export function minesFromCatalogDomain(domain: unknown, stored: MineProfile[] = []): MineProfile[] {
  const record = typeof domain === "object" && domain != null ? domain as Record<string, unknown> : {};
  const continents = Array.isArray(record.continents) ? record.continents : [];
  const byId = new Map(stored.map((mine) => [mine.id, mine]));
  const fromCatalog: MineProfile[] = [];
  for (const item of continents) {
    if (typeof item !== "object" || item == null) continue;
    const row = item as Record<string, unknown>;
    const type = typeof row.continentType === "number" ? row.continentType : null;
    const name = typeof row.name === "string" ? row.name : null;
    if (type == null || !name) continue;
    const id = `continent-${type}`;
    const previous = byId.get(id);
    fromCatalog.push(previous ? { ...previous, name, kind: "continent", source: "catalog" } : { id, name, kind: "continent", rates: EMPTY_RATES, multipliers: DEFAULT_MULTIPLIERS, source: "catalog" });
  }
  const modes: MineProfile[] = [
    byId.get("everdeep") ? { ...byId.get("everdeep")!, source: "catalog" } : { id: "everdeep", name: "Everdeep", kind: "everdeep", rates: EMPTY_RATES, multipliers: DEFAULT_MULTIPLIERS, source: "catalog" },
    byId.get("frontier-mine") ? { ...byId.get("frontier-mine")!, source: "catalog" } : { id: "frontier-mine", name: "Frontier Mine", kind: "frontier", rates: EMPTY_RATES, multipliers: DEFAULT_MULTIPLIERS, source: "catalog" },
  ];
  const custom = stored.filter((mine) => mine.kind === "custom" && !fromCatalog.some((m) => m.id === mine.id) && !modes.some((m) => m.id === mine.id));
  return [...fromCatalog, ...modes, ...custom];
}

export function normalizeMine(mine: MineProfile): MineProfile {
  return {
    ...mine,
    rates: { ...EMPTY_RATES, ...mine.rates },
    multipliers: { ...DEFAULT_MULTIPLIERS, ...mine.multipliers },
  };
}

export function loadMines(storage: Pick<Storage, "getItem">): MineProfile[] {
  try {
    const raw = storage.getItem(MINES_STORAGE_KEY);
    if (!raw) return DEFAULT_MINES;
    const parsed = JSON.parse(raw) as MineProfile[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed.map(normalizeMine) : DEFAULT_MINES;
  } catch {
    return DEFAULT_MINES;
  }
}

export function saveMines(storage: Pick<Storage, "setItem">, mines: MineProfile[]): void {
  storage.setItem(MINES_STORAGE_KEY, JSON.stringify(mines));
}

// ---------------------------------------------------------------------------
// Strategy plays
// ---------------------------------------------------------------------------

export interface StrategyPlay {
  id: string;
  title: string;
  engine: "balanced" | "shaft" | "elevator" | "warehouse" | "instant-cash" | "handoff";
  playable: boolean;
  missing: string[];
  /** 0..100 projected-pace score (relative, labelled — not a dollar figure). */
  paceScore: number | null;
  /** Sustainable bottleneck pace when rates are known ($/s, min of 3 legs). */
  bottleneckPace: number | null;
  why: string;
  nextStep: string;
  lineup: Array<{ area: string; name: string; managerId: string }>;
}

function strongestByArea(catalog: CatalogManager[], progress: PlayerManager[]) {
  const byId = new Map(catalog.map((m) => [m.id, m]));
  const owned = progress
    .filter((p) => p.unlocked)
    .map((p) => ({ player: p, manager: byId.get(p.managerId) }))
    .filter((x): x is { player: PlayerManager; manager: CatalogManager } => Boolean(x.manager))
    .sort((a, b) => strengthScore(b.manager, b.player) - strengthScore(a.manager, a.player));
  const pick = (area: string) => owned.find((x) => x.manager.type === area);
  return {
    "Mine Shaft": pick("Mine Shaft"),
    Elevator: pick("Elevator"),
    Warehouse: pick("Warehouse"),
  };
}

function fitScore(rate: number | null, max: number | null): number | null {
  if (rate == null || max == null || max <= 0) return null;
  return Math.round((rate / max) * 100);
}

export interface SuggestedMultiplier { area: "Mine Shaft" | "Elevator" | "Warehouse"; managerId: string; name: string; multiplier: number; }

export function suggestedMultipliers(catalog: CatalogManager[], progress: PlayerManager[]): SuggestedMultiplier[] {
  const leaders = strongestByArea(catalog, progress);
  const result: SuggestedMultiplier[] = [];
  (Object.entries(leaders) as Array<[SuggestedMultiplier["area"], (typeof leaders)["Mine Shaft"]]>).forEach(([area, pick]) => {
    if (!pick) return;
    const multiplier = effectiveActiveValue(pick.manager, pick.player);
    if (Number.isFinite(multiplier) && multiplier > 0) result.push({ area, managerId: pick.manager.id, name: pick.manager.name, multiplier });
  });
  return result;
}

export function rankPlays(catalog: CatalogManager[], progress: PlayerManager[], rates: MineRates, multipliers: MineRates = DEFAULT_MULTIPLIERS): StrategyPlay[] {
  const diagnosis = diagnoseAhead(rates);
  const burstRates = effectiveRates(rates, multipliers);
  const combos = buildComboCards(catalog, progress);
  const comboById = new Map(combos.map((c) => [c.id, c]));
  const leaders = strongestByArea(catalog, progress);
  const lineup = (Object.entries(leaders) as Array<[string, (typeof leaders)["Mine Shaft"]]>) 
    .filter(([, v]) => Boolean(v))
    .map(([area, v]) => ({ area, name: v!.manager.name, managerId: v!.manager.id }));

  const { mineshaft: ms, elevator: e, warehouse: w } = burstRates;
  const raw = rates;
  const maxRate = ms != null && e != null && w != null ? Math.max(ms, e, w) : null;
  const rawMax = raw.mineshaft != null && raw.elevator != null && raw.warehouse != null ? Math.max(raw.mineshaft, raw.elevator, raw.warehouse) : null;
  const bottleneckPace = raw.mineshaft != null && raw.elevator != null && raw.warehouse != null ? Math.min(raw.mineshaft, raw.elevator, raw.warehouse) : null;

  const lilly = comboById.get("lilly-crate-stockpile");
  const shaftRotation = comboById.get("shaft-ahead-rotation");
  const zi = comboById.get("zi-beam-convert");
  const instantCash = comboById.get("instant-cash-chain");
  const handoff = comboById.get("sue-belle-handoff");

  const rosterReady = progress.some((p) => p.unlocked);

  const plays: StrategyPlay[] = [
    {
      id: "balanced-idle",
      title: "Balanced / idle",
      engine: "balanced",
      playable: rosterReady,
      missing: rosterReady ? [] : ["Any unlocked roster (sync first)"],
      paceScore: bottleneckPace != null && rawMax ? Math.round((bottleneckPace / rawMax) * 100) : null,
      bottleneckPace,
      why: "Sustainable cash pace is set by your weakest leg. Balanced needs no setup and earns while you're away.",
      nextStep: diagnosis.nextAction,
      lineup,
    },
    {
      id: "elevator-ahead-lilly",
      title: "Elevator-Ahead stockpile → Lilly",
      engine: "elevator",
      playable: Boolean(lilly?.playable),
      missing: lilly?.missing ?? [],
      paceScore: fitScore(e, maxRate),
      bottleneckPace,
      why: "Elevator is the engine: build a shaft crate, hold transport, let Lilly beam the pile to the Warehouse.",
      nextStep: lilly?.playable ? "Hold the elevator, build the crate on your deepest shaft, then assign Lilly." : `Unlock/assign: ${(lilly?.missing ?? []).join(", ") || "roster"}.`,
      lineup,
    },
    {
      id: "shaft-ahead-rotation",
      title: "Shaft-Ahead rotation",
      engine: "shaft",
      playable: Boolean(shaftRotation?.playable),
      missing: shaftRotation?.missing ?? [],
      paceScore: fitScore(ms, maxRate),
      bottleneckPace,
      why: "Shafts out-produce transport, so cash comes from shaft bursts that bypass it (Turner → Blingsley → Steiner).",
      nextStep: shaftRotation?.playable ? "Run the rotation on your deepest shaft. No idle income between bursts — expected." : `Needs: ${(shaftRotation?.missing ?? []).join(", ") || "roster"}.`,
      lineup,
    },
    {
      id: "warehouse-ahead-zi",
      title: "Warehouse-Ahead: Zi beam → converter",
      engine: "warehouse",
      playable: Boolean(zi?.playable),
      missing: zi?.missing ?? [],
      paceScore: fitScore(w, maxRate),
      bottleneckPace,
      why: "Warehouse clears the elevator building fastest; Zi feeds it, Luxario/Jade converts each unload multiplied.",
      nextStep: zi?.playable ? "Fire Zi, then convert through the warehouse before the pile drains." : `Needs: ${(zi?.missing ?? []).join(", ") || "roster"}.`,
      lineup,
    },
    {
      id: "instant-cash-chain",
      title: "Instant Cash chain (Axiom → Harumi)",
      engine: "instant-cash",
      playable: Boolean(instantCash?.playable),
      missing: instantCash?.missing ?? [],
      paceScore: fitScore(e, maxRate),
      bottleneckPace,
      why: "2025–26 meta: Axiom turns elevator unloads into boosted Instant Cash, Harumi stores and multiplies the total.",
      nextStep: instantCash?.playable ? "Build a pile, run Axiom, finish with Harumi." : `Unlock target: ${(instantCash?.missing ?? []).join(", ")}.`,
      lineup,
    },
    {
      id: "sue-belle-handoff",
      title: "Sue → Belle handoff (endgame)",
      engine: "handoff",
      playable: Boolean(handoff?.playable),
      missing: handoff?.missing ?? [],
      paceScore: fitScore(e, maxRate),
      bottleneckPace,
      why: "Belle re-reads the frozen elevator pile every 5 minutes without consuming it — the endgame warehouse engine.",
      nextStep: handoff?.playable ? "Build the elevator pile with Sue, hold warehouse effects, finish with Belle." : `Unlock target: ${(handoff?.missing ?? []).join(", ")}.`,
      lineup,
    },
  ];

  // Rank: playable first, then projected pace. Plays without rates keep
  // their natural order after scored ones within the same playability.
  return plays.sort((a, b) => {
    if (a.playable !== b.playable) return a.playable ? -1 : 1;
    return (b.paceScore ?? -1) - (a.paceScore ?? -1);
  });
}

export function bestPlay(plays: StrategyPlay[]): StrategyPlay | undefined {
  return plays.find((p) => p.playable) ?? plays[0];
}
