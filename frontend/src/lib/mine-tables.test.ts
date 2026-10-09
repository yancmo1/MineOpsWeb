import { describe, expect, it } from "vitest";
import {
  FEATURE_UNLOCKS,
  continentUnlockFor,
  elementalConfigFor,
  mineCostOverrideFor,
  mineDifficultyFor,
  prestigeFactorAt,
  prestigeFactorFor,
  prestigeRewardFor,
} from "./mine-tables";

// Sample values below are copied from the raw game config JSONs the data
// module was generated from (release 5.63.0 fallback TextAssets).

describe("prestigeFactorFor", () => {
  it("knows the Start mines", () => {
    expect(prestigeFactorFor(1)).toBe(1);
    expect(prestigeFactorFor(2)).toBe(3);
    expect(prestigeFactorFor(3)).toBe(6);
    expect(prestigeFactorFor(4)).toBe(10);
    expect(prestigeFactorFor(5)).toBe(14);
  });

  it("moves to the next continent's rows after mine 5", () => {
    expect(prestigeFactorFor(6)).toBe(4); // Ice, first mine
    expect(prestigeFactorFor(10)).toBe(24); // Ice, last mine
    expect(prestigeFactorFor(35)).toBe(130); // Lost Desert, last covered mine
  });

  it("agrees with the continent + position lookup", () => {
    expect(prestigeFactorAt(0, 2)).toBe(prestigeFactorFor(3));
    expect(prestigeFactorAt(6, 4)).toBe(prestigeFactorFor(35));
  });

  it("returns null where the fallback has no rows", () => {
    expect(prestigeFactorFor(36)).toBeNull(); // Underwater: no fallback group
    expect(prestigeFactorFor(40)).toBeNull();
    expect(prestigeFactorFor(0)).toBeNull();
    expect(prestigeFactorFor(5001)).toBeNull(); // elemental, different table
    expect(prestigeFactorFor(6000)).toBeNull(); // Everdeep
  });
});

describe("continentUnlockFor", () => {
  it("knows the Ice unlock cost", () => {
    const ice = continentUnlockFor(1);
    expect(ice?.continent).toBe("Ice");
    expect(ice?.unlockCost).toBe(3.68e29);
    expect(ice?.unlockPrestigeCountRequired).toBe(0);
  });

  it("bridges the app's Lost Desert name to the game's key", () => {
    // continentType 6 is "Lost Desert" in the app, "LostDesert" in game data.
    expect(continentUnlockFor(6)?.unlockCost).toBe(4.675e51);
  });

  it("returns null for Start (open by default) and specials", () => {
    expect(continentUnlockFor(0)).toBeNull();
    expect(continentUnlockFor(-2)).toBeNull();
  });
});

describe("prestigeRewardFor", () => {
  it("knows the Start continent rewards", () => {
    expect(prestigeRewardFor(0, 1)).toEqual({ id: 2207, amount: 100 });
    expect(prestigeRewardFor(0, 6)).toEqual({ id: 2207, amount: 100 });
  });

  it("returns null for unknown levels", () => {
    expect(prestigeRewardFor(0, 99)).toBeNull();
  });
});

describe("mine difficulty and cost overrides", () => {
  it("reads difficulty by global mine number", () => {
    expect(mineDifficultyFor(1)).toBe(1);
    expect(mineDifficultyFor(6)).toBe(5);
    expect(mineDifficultyFor(40)).toBe(350);
    expect(mineDifficultyFor(5001)).toBeNull();
  });

  it("reads sparse cost overrides honestly", () => {
    expect(mineCostOverrideFor(2)).toBe(2e11);
    expect(mineCostOverrideFor(1)).toBeNull(); // no row: the game sets none
  });
});

describe("elementalConfigFor", () => {
  it("knows the elemental mines", () => {
    const first = elementalConfigFor(5001);
    expect(first?.mainElement).toBe("Nature");
    expect(first?.unlockCost).toBe(0);
    expect(first?.difficultyMultipliers[0].costMultiplier).toBe(80);
    expect(elementalConfigFor(5020)?.mainElement).toBe("Light");
  });

  it("returns null for non-elemental mines", () => {
    expect(elementalConfigFor(6000)).toBeNull();
    expect(elementalConfigFor(3)).toBeNull();
  });
});

describe("feature unlocks", () => {
  it("carries the Research cash milestone", () => {
    expect(FEATURE_UNLOCKS.Research?.[0].cashPayment?.unlockCashAmount).toBe(5600000000000);
  });
});
