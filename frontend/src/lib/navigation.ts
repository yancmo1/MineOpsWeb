export type Tab = "overview" | "managers" | "strategy" | "more";

export interface NavigationItem {
  id: Tab;
  label: string;
}

export const navigationItems: NavigationItem[] = [
  { id: "overview", label: "Today" },
  { id: "managers", label: "Managers" },
  { id: "strategy", label: "Strategy" },
  { id: "more", label: "More" },
];

export function hashForTab(tab: Tab): string {
  switch (tab) {
    case "overview": return "#today";
    case "managers": return "#managers";
    case "strategy": return "#strategy";
    case "more": return "#more";
    default: {
      const _exhaustive: never = tab;
      return _exhaustive;
    }
  }
}

export function tabFromHash(hash: string): Tab {
  const route = hash.replace(/^#\/?/, "").replace(/\/+$/, "").toLowerCase();
  switch (route) {
    case "today": return "overview";
    case "managers": return "managers";
    case "strategy": return "strategy";
    case "more": return "more";
    default: return "overview";
  }
}

export function getTabLabel(tab: Tab): string {
  return navigationItems.find(item => item.id === tab)?.label ?? tab;
}
