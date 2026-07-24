import type { CatalogManager, PlayerManager } from "./db";

export type ManagersSortOption =
  | "recommended"
  | "rarityAZ"
  | "rarityZA"
  | "inGameOrder"
  | "closestToRankUp"
  | "element"
  | "area"
  | "levelHighToLow"
  | "levelLowToHigh";

export type ManagersOwnership = "unlocked" | "all";

export const defaultOwnership: ManagersOwnership = "unlocked";

export const sortOptions: { value: ManagersSortOption; label: string }[] = [
  { value: "recommended", label: "Recommended" },
  { value: "rarityAZ", label: "Rarity (A-Z)" },
  { value: "rarityZA", label: "Rarity (Z-A)" },
  { value: "inGameOrder", label: "In-game Order" },
  { value: "closestToRankUp", label: "Closest to Rank Up" },
  { value: "element", label: "By Element" },
  { value: "area", label: "By Area" },
  { value: "levelHighToLow", label: "Level (high→low)" },
  { value: "levelLowToHigh", label: "Level (low→high)" },
];

const rarityAZOrder: Record<string, number> = {
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
};

function getFirstElement(manager: CatalogManager): string {
  if (manager.elements.length === 0) return "";
  const el = manager.elements[0];
  const parenIdx = el.indexOf("(");
  return parenIdx > 0 ? el.slice(0, parenIdx).trim().toLowerCase() : el.toLowerCase();
}

const elementOrder: Record<string, number> = {
  fire: 0,
  water: 1,
  wind: 2,
  earth: 3,
  lightning: 4,
  dark: 5,
  light: 6,
  nature: 7,
  sand: 8,
  chrome: 9,
  orb: 10,
};

const areaOrder: Record<string, number> = {
  "Mine Shaft": 0,
  "Elevator": 1,
  "Warehouse": 2,
};

export function compareManagers(
  a: PlayerManager & { catalog: CatalogManager },
  b: PlayerManager & { catalog: CatalogManager },
  sort: ManagersSortOption,
  strengthScoreFn: (catalog: CatalogManager, player: PlayerManager) => number,
  rankThresholdFn: (rank: number) => number | null | undefined,
) {
  const nameCmp = a.catalog.name.localeCompare(b.catalog.name);
  switch (sort) {
    case "recommended":
      return strengthScoreFn(b.catalog, b) - strengthScoreFn(a.catalog, a) || nameCmp;

    case "rarityAZ": {
      const ra = rarityAZOrder[a.catalog.rarity.toLowerCase()] ?? 99;
      const rb = rarityAZOrder[b.catalog.rarity.toLowerCase()] ?? 99;
      return ra - rb || nameCmp;
    }

    case "rarityZA": {
      const ra = rarityAZOrder[a.catalog.rarity.toLowerCase()] ?? 99;
      const rb = rarityAZOrder[b.catalog.rarity.toLowerCase()] ?? 99;
      return rb - ra || nameCmp;
    }

    case "inGameOrder": {
      const ga = a.catalog.gameId ?? 999999;
      const gb = b.catalog.gameId ?? 999999;
      return ga - gb || nameCmp;
    }

    case "closestToRankUp": {
      const thresholdA = rankThresholdFn(a.rank);
      const thresholdB = rankThresholdFn(b.rank);
      const deficitA = thresholdA != null ? thresholdA - a.fragments : 999999;
      const deficitB = thresholdB != null ? thresholdB - b.fragments : 999999;
      if (deficitA !== deficitB) return deficitA - deficitB;
      if (a.fragments !== b.fragments) return b.fragments - a.fragments;
      return nameCmp;
    }

    case "element": {
      const ea = elementOrder[getFirstElement(a.catalog)] ?? 99;
      const eb = elementOrder[getFirstElement(b.catalog)] ?? 99;
      return ea - eb || nameCmp;
    }

    case "area": {
      const aa = areaOrder[a.catalog.type] ?? 99;
      const ab = areaOrder[b.catalog.type] ?? 99;
      return aa - ab || nameCmp;
    }

    case "levelHighToLow":
      if (a.level !== b.level) return b.level - a.level;
      return nameCmp;

    case "levelLowToHigh":
      if (a.level !== b.level) return a.level - b.level;
      return nameCmp;

    default:
      return nameCmp;
  }
}
