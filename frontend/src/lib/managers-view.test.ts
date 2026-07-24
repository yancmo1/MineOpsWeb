import { describe, expect, it } from "vitest";
import { compareManagers, defaultOwnership, sortOptions } from "./managers-view";
import type { CatalogManager, PlayerManager } from "./db";

function makeProgress(overrides: Partial<PlayerManager> & { managerId: string; catalog: CatalogManager }) {
  return {
    managerId: overrides.managerId,
    level: 1,
    rank: 0,
    promoted: 0,
    fragments: 0,
    unlocked: true,
    updatedAt: "2024-01-01T00:00:00.000Z",
    catalog: overrides.catalog,
  } as PlayerManager & { catalog: CatalogManager };
}

describe("managers view defaults", () => {
  it("defaults the ownership filter to unlocked", () => {
    expect(defaultOwnership).toBe("unlocked");
  });

  it("supports rarity descending order in the sort menu", () => {
    const catalog = [
      { id: "common", name: "Common Manager", rarity: "Common", type: "Mine Shaft", elements: [] },
      { id: "legendary", name: "Legendary Manager", rarity: "Legendary", type: "Mine Shaft", elements: [] },
      { id: "rare", name: "Rare Manager", rarity: "Rare", type: "Mine Shaft", elements: [] },
    ] as CatalogManager[];

    const managers = [
      makeProgress({ managerId: "common", catalog: catalog[0] }),
      makeProgress({ managerId: "legendary", catalog: catalog[1] }),
      makeProgress({ managerId: "rare", catalog: catalog[2] }),
    ];

    const sorted = [...managers].sort((a, b) => compareManagers(a, b, "rarityZA", () => 0, () => null));

    expect(sorted.map((manager) => manager.catalog.id)).toEqual(["legendary", "rare", "common"]);
    expect(sortOptions.some((option) => option.value === "rarityZA")).toBe(true);
  });
});
