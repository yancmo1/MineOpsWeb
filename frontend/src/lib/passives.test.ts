import { describe, expect, it } from "vitest";
import { activePassives, isPassiveUnlocked, passiveLabel, passiveRequirement } from "./passives";
import type { PlayerManager } from "./db";

const progress: PlayerManager = {
  managerId: "sm-10006",
  level: 30,
  rank: 0,
  promoted: 3,
  fragments: 0,
  unlocked: true,
  updatedAt: "2026-08-02T00:00:00Z",
};

describe("manager passives", () => {
  it("uses the game-facing MIF label and milestone", () => {
    const passive = { passiveId: 1007, type: "MIF", multiplier: 1.44, promoReq: 3 };
    expect(passiveLabel(passive)).toBe("Mine Income Factor");
    expect(passiveRequirement(passive)).toBe("Lv 30 · P3");
    expect(isPassiveUnlocked(passive, progress)).toBe(true);
  });

  it("filters future passives out of active strategy inputs", () => {
    const passives = [
      { type: "WMSB", promoReq: 1 },
      { type: "MIF", promoReq: 3 },
      { type: "CIF", promoReq: 5 },
    ];
    expect(activePassives(passives, { ...progress, promoted: 2 }).map((passive) => passive.type)).toEqual(["WMSB"]);
  });

  it("does not expose raw catalog placeholder labels", () => {
    expect(passiveLabel({ passiveId: 1007, type: "passive_2" })).toBe("Mine Income Factor");
  });

  it("uses stable APK identity for Damian's elevator cost passive", () => {
    expect(passiveLabel({ passiveId: 8, type: "CR" })).toBe("Elevator Upgrade Cost Reduction");
  });

  it("requires every captured unlock constraint", () => {
    const passive = { passiveId: 1007, type: "MIF", unlockLevel: 30, promoReq: 3 };
    expect(isPassiveUnlocked(passive, { ...progress, level: 29 })).toBe(false);
    expect(isPassiveUnlocked(passive, { ...progress, promoted: 2 })).toBe(false);
    expect(isPassiveUnlocked(passive, progress)).toBe(true);
  });

  it("keeps passives with unknown requirements out of strategy", () => {
    expect(isPassiveUnlocked({ passiveId: 1007, type: "MIF" }, progress)).toBe(false);
  });
});
