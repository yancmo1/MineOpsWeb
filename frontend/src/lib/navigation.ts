export type Tab = "overview" | "mines" | "managers" | "strategy" | "resources" | "more";

export interface NavigationItem {
  id: Tab;
  label: string;
  mobile?: boolean; // true means show on mobile bottom nav
}

export const navigationItems: NavigationItem[] = [
  { id: "overview", label: "Overview", mobile: true },
  { id: "mines", label: "Mines", mobile: true },
  { id: "managers", label: "Managers", mobile: true },
  { id: "strategy", label: "Strategy" },
  { id: "resources", label: "Resources" },
  { id: "more", label: "More", mobile: true },
];

export const mobileNavigationItems = navigationItems.filter(item => item.mobile);
export const desktopNavigationItems = navigationItems;

export function getTabLabel(tab: Tab): string {
  return navigationItems.find(item => item.id === tab)?.label ?? tab;
}
