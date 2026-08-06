import { describe, expect, it } from "vitest";
import { essenceInventoryFromEntries, planEssenceUpgrade } from "./essence-planner";

describe("essence planner", () => {
  it("maps save inventory IDs and calculates a rank-step shortfall", () => {
    const parsed = essenceInventoryFromEntries([
      { key: "nature", kind: "essence", quantity: 12, sourcePath: "Essences", sourceKey: "NatureEssence", itemId: 4100000 },
      { key: "epic", kind: "essence", quantity: 1, sourcePath: "Essences", sourceKey: "EpicEssence", itemId: 4100008 },
    ]);
    const plan = planEssenceUpgrade({ id: "sm-10003", name: "Dr. Steiner", rarity: "epic", type: "Mine Shaft", elements: [], elementalRecipe: [{ rank: 0, ingredients: [{ id: 4100000, amount: 20 }, { id: 4100009, amount: 1 }] }] }, 0, 1, parsed.inventory);
    expect(parsed.matchedRows).toBe(2);
    expect(plan.available).toBe(true);
    expect(plan.rows.find((row) => row.key === "nature")).toMatchObject({ needed: 20, owned: 12, delta: -8 });
  });

  it("does not claim a complete plan when a rank recipe is missing", () => {
    const plan = planEssenceUpgrade({ id: "sm-10003", name: "Dr. Steiner", rarity: "epic", type: "Mine Shaft", elements: [] }, 0, 1, essenceInventoryFromEntries([]).inventory);
    expect(plan.available).toBe(false);
    expect(plan.recipeCount).toBe(0);
  });
});
