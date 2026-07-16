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

export function getTabLabel(tab: Tab): string {
  return navigationItems.find(item => item.id === tab)?.label ?? tab;
}
