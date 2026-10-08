/**
 * Save inspector — NAMES ONLY.
 *
 * The Kolibri save is a big box of drawers. The sync parser only opens a
 * few (managers, fragments, equipment, inventory). This inspector lists
 * every drawer NAME, whether it is a list or a box, how many things are
 * in it, and the field names inside one sample item. It never returns,
 * logs, or displays a single value from the save.
 */


export interface SaveChildSummary {
  key: string;
  kind: "list" | "box" | "single";
  count: number;
  fieldNames: string[];
}

export interface SaveSectionSummary {
  key: string;
  kind: "list" | "box" | "single";
  /** Items in a list, or fields in a box. */
  count: number;
  /** Field names found inside (box keys, or keys of the first list item). Names only. */
  fieldNames: string[];
  /** True when the name smells like mines/economy (worth a deeper look). */
  interesting: boolean;
  /** One level deeper, for interesting sections only: what is inside each
   * object/list field of a sample item. Still names and counts only. */
  children: SaveChildSummary[];
}

/** Game big-number { m, e } -> base units. */
function bigValue(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "object" && v != null) {
    const m = (v as Record<string, unknown>).m;
    const e = (v as Record<string, unknown>).e;
    if (typeof m === "number" && typeof e === "number") return m * 10 ** e;
  }
  return null;
}

function cashText(v: number | null): string {
  if (v == null || v <= 0) return "-";
  const suffixes = ["", "K", "M", "B", "T"];
  let step = Math.max(0, Math.floor(Math.log10(v) / 3));
  let suffix: string;
  if (step < suffixes.length) suffix = suffixes[step];
  else { const a = step - 5; suffix = String.fromCharCode(97 + Math.floor(a / 26)) + String.fromCharCode(97 + (a % 26)); }
  const scaled = v / 10 ** (step * 3);
  return `${scaled >= 100 ? scaled.toFixed(0) : scaled >= 10 ? scaled.toFixed(1) : scaled.toFixed(2)}${suffix}`;
}

export interface SaveStructure {
  rootKeys: string[];
  sections: SaveSectionSummary[];
  /** Structural ID labels only (mine numbers / continent types). These are
   * map labels, not player data — included so mine naming can be decoded. */
  mineIds: { progressionMineIds: number[]; saveMineNumbers: number[]; continentTypes: number[] };
  /** Compact per-mine numbers (prestige + building levels + unlock flags).
   * Same numbers the player sees in-game; included so continent blocks and
   * real mine names can be decoded. No cash, no currencies. */
  mineTable: string[];
}

const INTERESTING = /mine|continent|research|coin|cash|money|prestige|frontier|everdeep|shaft|elevator|warehouse|econom|island|tesseract|spark|crystal|essence/i;

function fieldNamesOf(value: unknown): string[] {
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === "object" && item != null);
    return first ? Object.keys(first as Record<string, unknown>).slice(0, 60) : [];
  }
  if (typeof value === "object" && value != null) return Object.keys(value as Record<string, unknown>).slice(0, 60);
  return [];
}

function kindOf(value: unknown): SaveChildSummary["kind"] {
  return Array.isArray(value) ? "list" : typeof value === "object" && value != null ? "box" : "single";
}

function countOf(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (typeof value === "object" && value != null) return Object.keys(value as Record<string, unknown>).length;
  return 1;
}

/** Deep-peek one level into a sample item's object/list fields. Names only. */
function childrenOf(value: unknown): SaveChildSummary[] {
  const sample = Array.isArray(value) ? value.find((item) => typeof item === "object" && item != null) : value;
  if (typeof sample !== "object" || sample == null || Array.isArray(sample)) return [];
  return Object.entries(sample as Record<string, unknown>)
    .filter(([, v]) => typeof v === "object" && v != null)
    .map(([key, v]) => ({ key, kind: kindOf(v), count: countOf(v), fieldNames: fieldNamesOf(v) }));
}

export function summarizeSave(root: Record<string, unknown>): SaveStructure {
  const data = (typeof root.Data === "object" && root.Data != null ? root.Data : root) as Record<string, unknown>;
  const sections: SaveSectionSummary[] = Object.entries(data).map(([key, value]) => {
    const kind: SaveSectionSummary["kind"] = Array.isArray(value) ? "list" : typeof value === "object" && value != null ? "box" : "single";
    const count = Array.isArray(value) ? value.length : kind === "box" ? Object.keys(value as Record<string, unknown>).length : 1;
    const fieldNames = fieldNamesOf(value);
    const interesting = INTERESTING.test(key) || fieldNames.some((name) => INTERESTING.test(name));
    return { key, kind, count, fieldNames, interesting, children: interesting ? childrenOf(value) : [] };
  });
  sections.sort((a, b) => Number(b.interesting) - Number(a.interesting) || a.key.localeCompare(b.key));
  const idsOf = (value: unknown, field: string): number[] =>
    Array.isArray(value)
      ? value.map((item) => (typeof item === "object" && item != null ? (item as Record<string, unknown>)[field] : undefined)).filter((v): v is number => typeof v === "number")
      : [];
  const continent = typeof data.ContinentSavegame === "object" && data.ContinentSavegame != null ? (data.ContinentSavegame as Record<string, unknown>).UnlockSavegames : undefined;
  const numOf = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const boxOf = (v: unknown) => (typeof v === "object" && v != null && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
  const mineRows = (Array.isArray(data.Mines) ? data.Mines : [])
    .map((item) => boxOf(item))
    .map((row) => ({
      n: numOf(row.MineNumber),
      prestige: numOf(row.PrestigeCount),
      elevator: numOf(boxOf(row.Elevator).Level),
      warehouse: numOf(boxOf(row.Ground).Level),
      selected: row.Selected === true ? 1 : 0,
      order: numOf(boxOf(row.MineRegion).CurrentOrder),
      unlock: numOf(boxOf(row.MineRegion).UnlockState),
    }))
    .filter((r) => r.n != null)
    .sort((a, b) => (a.n ?? 0) - (b.n ?? 0));
  const idleByNumber = new Map<number, Record<string, unknown>>();
  for (const item of Array.isArray(data.Mines) ? data.Mines : []) {
    const row = boxOf(item);
    const n = numOf(row.MineNumber);
    if (n != null) idleByNumber.set(n, row);
  }
  const mineTable = mineRows.map((r) => {
    const row = idleByNumber.get(r.n ?? -1) ?? {};
    const idle = boxOf(row.IdleSavegame);
    return `mine ${r.n}: prestige ${r.prestige ?? "?"}, elevator ${r.elevator ?? "?"}, warehouse ${r.warehouse ?? "?"}, selected ${r.selected}, regionOrder ${r.order ?? "?"}, unlockState ${r.unlock ?? "?"}, idleBase ${cashText(bigValue(idle.BigIdleCashWithoutBuffsPerSec))}/s, idleClosed ${cashText(bigValue(row.BigCashPerSecondWhenClosed))}/s, idlePossible ${cashText(bigValue(idle.PossibleBigIdleCashWithoutBuffsPerSec))}/s, stored ${cashText(bigValue(row.BigCashStored))}`;
  });
  return {
    rootKeys: Object.keys(root),
    sections,
    mineIds: {
      progressionMineIds: idsOf(data.ProgressionSavegames, "MineId"),
      saveMineNumbers: idsOf(data.Mines, "MineNumber"),
      continentTypes: idsOf(continent, "ContinentType"),
    },
    mineTable,
  };
}


/** Plain-text report the player can copy and paste to share the drawer list. */
export function formatSaveReport(structure: SaveStructure): string {
  const lines = ["MineOps save inspector (names only — no values)", `Top level: ${structure.rootKeys.join(", ")}`, ""];
  if (structure.mineIds) {
    lines.push(`Mine IDs (labels only): progression=[${structure.mineIds.progressionMineIds.join(", ")}] mines=[${structure.mineIds.saveMineNumbers.join(", ")}] continents=[${structure.mineIds.continentTypes.join(", ")}]`, "");
  }
  if (structure.mineTable && structure.mineTable.length > 0) {
    lines.push("Mine table (prestige + levels only, no cash):", ...structure.mineTable, "");
  }
  for (const section of structure.sections) {
    lines.push(`${section.interesting ? "⭐ " : ""}${section.key} — ${section.kind}, ${section.count}`);
    if (section.fieldNames.length > 0) lines.push(`   fields: ${section.fieldNames.join(", ")}`);
    for (const child of section.children) {
      lines.push(`   > ${child.key} — ${child.kind}, ${child.count}${child.fieldNames.length > 0 ? ` — fields: ${child.fieldNames.join(", ")}` : ""}`);
    }
  }
  return lines.join("\n");
}
