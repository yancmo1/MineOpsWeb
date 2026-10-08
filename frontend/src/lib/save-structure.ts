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

export interface SaveStructure {
  rootKeys: string[];
  sections: SaveSectionSummary[];
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
  return { rootKeys: Object.keys(root), sections };
}


/** Plain-text report the player can copy and paste to share the drawer list. */
export function formatSaveReport(structure: SaveStructure): string {
  const lines = ["MineOps save inspector (names only — no values)", `Top level: ${structure.rootKeys.join(", ")}`, ""];
  for (const section of structure.sections) {
    lines.push(`${section.interesting ? "⭐ " : ""}${section.key} — ${section.kind}, ${section.count}`);
    if (section.fieldNames.length > 0) lines.push(`   fields: ${section.fieldNames.join(", ")}`);
    for (const child of section.children) {
      lines.push(`   > ${child.key} — ${child.kind}, ${child.count}${child.fieldNames.length > 0 ? ` — fields: ${child.fieldNames.join(", ")}` : ""}`);
    }
  }
  return lines.join("\n");
}
