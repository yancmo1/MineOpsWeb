import { describe, expect, it } from "vitest";
import { buildUpgradeFocus, clampFocusLevel, focusProgress } from "./upgrade-focus";
import type { CatalogManager, PlayerManager } from "./db";

const player: PlayerManager = {
  managerId: "sm-10003",
  level: 17,
  rank: 2,
  promoted: 2,
  fragments: 0,
  unlocked: true,
  updatedAt: "2026-08-05T00:00:00Z",
};

const steiner: CatalogManager = {
  id: "sm-10003",
  name: "Dr. Steiner",
  rarity: "Epic",
  type: "Mine Shaft",
  elements: [],
  progression: [{ level: 30, promotion: 3, cost: 110000000000 }],
  passives: [
    { unlockLevel: 10, description: "Walking and Mining Speed Boost" },
    { unlockLevel: 30, description: "Continent Income Boost" },
  ],
};

describe("upgrade focus", () => {
  it("clamps a target to the next supported milestone", () => {
    expect(clampFocusLevel(27, 17)).toBe(30);
    expect(clampFocusLevel(12, 17)).toBe(20);
  });

  it("calculates progress toward a target", () => {
    expect(focusProgress(17, 30)).toBe(57);
    expect(focusProgress(30, 30)).toBe(100);
  });

  it("surfaces the verified milestone and next passive", () => {
    const focus = buildUpgradeFocus(steiner, player, 30);
    expect(focus.target).toBe(30);
    expect(focus.levelsRemaining).toBe(13);
    expect(focus.targetPromotion).toBe(3);
    expect(focus.targetMilestoneCost).toBe(110000000000);
    expect(focus.targetPassives[0]?.description).toBe("Continent Income Boost");
  });
});
