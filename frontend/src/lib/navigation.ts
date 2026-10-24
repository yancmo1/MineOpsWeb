/**
 * App navigation: three tabs since the 2026-10-23 Home -> My Plan ->
 * Toolbox refactor. Home answers "what do you want to work on?", My Plan
 * shows the steps for the chosen goal, and Toolbox holds everything else
 * behind one door (plays, crew roster, save-mines detail, leaders, and
 * Settings & data).
 *
 * Old hashes keep working: #today -> Home, #managers -> Toolbox (crew),
 * #strategy -> Toolbox (plays), #more -> Toolbox (settings & data).
 */

export type Tab = "home" | "plan" | "toolbox";

/** Sub-views inside the Toolbox tab. "menu" is the flat entry list. */
export type ToolboxView = "menu" | "plays" | "crew" | "mines" | "leaders" | "data";

export interface NavigationItem {
  id: Tab;
  label: string;
}

export const navigationItems: NavigationItem[] = [
  { id: "home", label: "Home" },
  { id: "plan", label: "My Plan" },
  { id: "toolbox", label: "Toolbox" },
];

const TAB_HASH: Record<Tab, string> = {
  home: "#home",
  plan: "#plan",
  toolbox: "#toolbox",
};

/** Legacy hashes from the pre-refactor four-tab shell. */
const LEGACY_TAB_HASH: Record<string, Tab> = {
  "#today": "home",
  "#overview": "home",
  "#managers": "toolbox",
  "#strategy": "toolbox",
  "#more": "toolbox",
};

const LEGACY_TOOLBOX_VIEW: Record<string, ToolboxView> = {
  "#managers": "crew",
  "#strategy": "plays",
  "#more": "data",
};

function normalizeHash(hash: string): string {
  const raw = hash.trim().toLowerCase().replace(/\/+$/, "");
  return raw.startsWith("#/") ? `#${raw.slice(2)}` : raw;
}

export function hashForTab(tab: Tab): string {
  return TAB_HASH[tab];
}

export function tabFromHash(hash: string): Tab {
  const normalized = normalizeHash(hash);
  if (normalized === "" || normalized === "#") return "home";
  for (const tab of Object.keys(TAB_HASH) as Tab[]) {
    if (TAB_HASH[tab] === normalized) return tab;
  }
  return LEGACY_TAB_HASH[normalized] ?? "home";
}

/**
 * Which Toolbox sub-view a hash points at, or null when the hash doesn't
 * name one (plain #toolbox and non-toolbox hashes land on the menu).
 */
export function toolboxViewFromHash(hash: string): ToolboxView | null {
  return LEGACY_TOOLBOX_VIEW[normalizeHash(hash)] ?? null;
}

export function getTabLabel(tab: Tab): string {
  return navigationItems.find((item) => item.id === tab)?.label ?? tab;
}
