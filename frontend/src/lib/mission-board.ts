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
  /** Researched payout-ceiling order (1 = highest ceiling when set up correctly).
   * This is a mechanics order, not a guarantee for today's rates. */
  profitabilityRank: number;
  profitabilityLabel: string;
  /** 0..100 projected-pace score (relative, labelled — not a dollar figure). */
  paceScore: number | null;
  /** Sustainable bottleneck pace when rates are known ($/s, min of 3 legs). */
  bottleneckPace: number | null;
  why: string;
  nextStep: string;
  /** Plain-English explanation of what the play actually does. */
  whatItDoes: string;
  /** Step-by-step run instructions using the current combo definitions. */
  howToRun: string[];
  /** When this play is the right tool. */
  bestWhen: string;
  /** The failure mode to avoid. */
  watchOut: string;
  lineup: Array<{ area: string; name: string; managerId: string }>;
}

const PLAY_GUIDES: Record<string, { profitabilityRank: number; profitabilityLabel: string; whatItDoes: string; howToRun: string[]; bestWhen: string; watchOut: string }> = {
  "instant-cash-chain": {
    profitabilityRank: 1,
    profitabilityLabel: "#1 ceiling — Instant Cash chain",
    whatItDoes: "Sir Axiom converts elevator unloads into Instant Cash and boosts other Super Managers' Instant Cash while active. Harumi then stores all Instant Cash produced during her window and pays the stored total multiplied at the end.",
    howToRun: ["Build an elevator-building pile or shaft crate first.", "Assign Sir Axiom to the Elevator and activate him.", "While Axiom is active, fire other Instant Cash producers you own (Turner/Selena-type effects) so their output is boosted.", "Finish with Harumi at the Warehouse before the window closes so she stores and multiplies the total."],
    bestWhen: "You have a large pile ready and several Instant Cash producers available together.",
    watchOut: "Do not fire Harumi first. She only multiplies Instant Cash produced while she is storing it.",
  },
  "sue-belle-handoff": {
    profitabilityRank: 2,
    profitabilityLabel: "#2 ceiling — repeatable endgame handoff",
    whatItDoes: "Ranger Sue builds the pile, the handoff chain moves/collects it into the elevator building, and Belle Snowdrop repeatedly gains a percentage of that frozen pile without consuming it.",
    howToRun: ["Run Ranger Sue on the deepest/collecting shaft to build resources.", "Use your handoff/collector/mover chain to build the elevator-building pile.", "Hold warehouse finishers back while the pile grows.", "Assign Belle Snowdrop to the Warehouse and activate her; repeat on cooldown while the same pile remains."],
    bestWhen: "The elevator building can hold a very large pile and Belle is unlocked.",
    watchOut: "A consuming warehouse finisher can spend the pile Belle needs to re-read. Keep the pile frozen until Belle has taken her cut.",
  },
  "elevator-ahead-lilly": {
    profitabilityRank: 3,
    profitabilityLabel: "#3 ceiling — proven Elevator-Ahead burst",
    whatItDoes: "The shafts build a crate while transport is held back. Dr Lilly then beams a multiple of what the elevator collects directly to the Warehouse, bypassing the warehouse transport bottleneck for that burst.",
    howToRun: ["Leave the Elevator unassigned so resources stockpile in the deepest shaft crate.", "Run Ranger Sue, Gordon, or Chester on that shaft to build the crate faster.", "When the crate is large, assign Dr Lilly to the Elevator.", "Activate Lilly and let the beam land. Re-enter your mine rates afterward because the mine shape will have changed."],
    bestWhen: "Your Elevator is the strongest leg and the Warehouse is too slow to clear a normal pile.",
    watchOut: "Assigning Lilly too early beams a small pile. The setup time is part of the play.",
  },
  "warehouse-ahead-zi": {
    profitabilityRank: 4,
    profitabilityLabel: "#4 ceiling — Warehouse conversion burst",
    whatItDoes: "Zi Galvani beams mined resources into the elevator building. Luxario then multiplies every Warehouse unload while active; Jade Kim is the alternate warehouse converter where her in-game active fits.",
    howToRun: ["Make sure the Warehouse can clear volume; level it first if it is choking.", "Assign Zi Galvani to the deepest shaft and activate the beam.", "Immediately assign/activate Luxario at the Warehouse so multiplied unloads land during his window.", "If using Jade Kim instead, verify her current in-game active first; public documentation is thin."],
    bestWhen: "Your Warehouse is fast enough to clear the elevator building and Luxario is off cooldown.",
    watchOut: "A slow Warehouse wastes Zi's beam. Fix the clearing leg before firing the combo.",
  },
  "shaft-ahead-rotation": {
    profitabilityRank: 5,
    profitabilityLabel: "#5 ceiling — direct shaft cash rotation",
    whatItDoes: "Mineshaft Super Managers pay cash or beam resources directly from the deepest shaft, bypassing the slower Elevator/Warehouse legs instead of waiting for normal transport.",
    howToRun: ["Stop over-levelling Elevator/Warehouse if you are deliberately running Shaft-Ahead.", "On the deepest shaft, activate Mr Turner first; his Piggy Bank stores a short window, then unloads multiplied direct to cash.", "Activate Blingsley next for repeated Instant Cash during his window.", "Activate Dr Steiner next to beam a multiple of mined resources to the Warehouse.", "Expect little or no idle income between rotations."],
    bestWhen: "Your shafts are much stronger than transport and the rotation managers are off cooldown together.",
    watchOut: "This is a burst rotation, not an idle setup. If you need away income, Balanced is safer.",
  },
  "balanced-idle": {
    profitabilityRank: 6,
    profitabilityLabel: "#6 ceiling — sustainable idle baseline",
    whatItDoes: "All three legs move at a similar pace, so cash flows continuously without a setup window or cooldown choreography. Your weakest leg sets the sustainable pace.",
    howToRun: ["Keep Mineshaft, Elevator, and Warehouse rates reasonably close.", "Assign your strongest passive/income managers for away play.", "Level the current bottleneck first rather than pushing one leg far ahead.", "Re-check rates after major upgrades and switch to a burst play when a large pile is ready."],
    bestWhen: "You are away from the game or do not have a burst combo off cooldown.",
    watchOut: "Balanced is dependable, not explosive. A bottleneck left behind quietly caps every dollar.",
  },
};

function withGuide(play: Omit<StrategyPlay, "profitabilityRank" | "profitabilityLabel" | "whatItDoes" | "howToRun" | "bestWhen" | "watchOut">): StrategyPlay {
  const guide = PLAY_GUIDES[play.id];
  return { ...play, ...(guide ?? { profitabilityRank: 99, profitabilityLabel: "Unranked", whatItDoes: play.why, howToRun: [play.nextStep], bestWhen: "Use when its required managers and mine shape fit.", watchOut: "Check the required managers and current rates before running it." }) };
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

  const plays: Array<Omit<StrategyPlay, "profitabilityRank" | "profitabilityLabel" | "whatItDoes" | "howToRun" | "bestWhen" | "watchOut">> = [
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

  const guided = plays.map(withGuide);

  // Researched ceiling order first: Instant Cash chain, Belle handoff,
  // Lilly burst, Zi conversion, shaft rotation, then balanced idle. Projected
  // pace breaks ties/near-ties; it does not pretend a universal dollar payout
  // exists independent of rates, pile size, cooldowns, and manager levels.
  return guided.sort((a, b) => {
    if (a.playable !== b.playable) return a.playable ? -1 : 1;
    if (a.profitabilityRank !== b.profitabilityRank) return a.profitabilityRank - b.profitabilityRank;
    return (b.paceScore ?? -1) - (a.paceScore ?? -1);
  });
}

export function bestPlay(plays: StrategyPlay[]): StrategyPlay | undefined {
  return plays.find((p) => p.playable) ?? plays[0];
}
