/**
 * Save inspector — NAMES ONLY.
 *
 * The Kolibri save is a big box of drawers. The sync parser only opens a
 * few (managers, fragments, equipment, inventory). This inspector lists
 * every drawer NAME, whether it is a list or a box, how many things are
 * in it, and the field names inside one sample item. It never returns,
 * logs, or displays a single value from the save.
 */


export interface SaveSectionSummary {
  key: string;
  kind: "list" | "box" | "single";
  /** Items in a list, or fields in a box. */
  count: number;
  /** Field names found inside (box keys, or keys of the first list item). Names only. */
  fieldNames: string[];
  /** True when the name smells like mines/economy (worth a deeper look). */
  interesting: boolean;
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

export function summarizeSave(root: Record<string, unknown>): SaveStructure {
  const data = (typeof root.Data === "object" && root.Data != null ? root.Data : root) as Record<string, unknown>;
  const sections: SaveSectionSummary[] = Object.entries(data).map(([key, value]) => {
    const kind: SaveSectionSummary["kind"] = Array.isArray(value) ? "list" : typeof value === "object" && value != null ? "box" : "single";
    const count = Array.isArray(value) ? value.length : kind === "box" ? Object.keys(value as Record<string, unknown>).length : 1;
    const fieldNames = fieldNamesOf(value);
    const interesting = INTERESTING.test(key) || fieldNames.some((name) => INTERESTING.test(name));
    return { key, kind, count, fieldNames, interesting };
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
  }
  return lines.join("\n");
}
