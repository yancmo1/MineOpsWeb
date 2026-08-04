import { describe, expect, it } from "vitest";
import {
  Q16_SCALE,
  buildPowerScoreParityRows,
  decodePowerScoreSettings,
  strengthScoreBreakdown,
} from "./power-score";
import type { CatalogManager, PlayerManager } from "./db";

// Real SuperManagerPowerScoreSettings payload from the lossless APK capture
// (rawBytes of the single supermanagerpowerscore record, 168 bytes).
const REAL_PAYLOAD =
  "AAAAAAAAAAAAAAAAAQAAAAAAAACswumZ7JwZYx4AAABTdXBlck1hbmFnZXJQb3dlclNjb3JlU2V0dGluZ3MAAAAAAAABAAAAAAAAAAEAAAAEAAAAAQAAAAEAAAAKAAAAAgAAAAIAAAAoAAAAAwAAAAQAAACWAAAABAAAAAYAAACQAQAAAQAAAAIAAAAQAAAACAAAAAIAAAACAAAABQAAAAUAAAACAAAA";

describe("decodePowerScoreSettings structural decode", () => {
  it("parses the Unity header (m_Enabled, name) from the real payload", () => {
    const decoded = decodePowerScoreSettings(REAL_PAYLOAD);
    expect(decoded).not.toBeNull();
    expect(decoded?.mEnabled).toBe(1);
    expect(decoded?.name).toBe("SuperManagerPowerScoreSettings");
    expect(decoded?.fieldNamesUnverified).toBe(true);
  });

  it("normalizes custom fields as Q16.16 fixed-point", () => {
    const decoded = decodePowerScoreSettings(REAL_PAYLOAD)!;
    expect(decoded.q16Consistent).toBe(true);
    expect(decoded.int32Payload.length).toBe(26);
    expect(decoded.q16Values[0]).toBe(0);
    expect(decoded.q16Values[1]).toBe(1);
    expect(decoded.q16Values[7]).toBe(10);
    expect(decoded.q16Values[13]).toBe(150);
    expect(decoded.q16Values[16]).toBe(400);
    for (const value of decoded.int32Payload) {
      expect(value % Q16_SCALE).toBe(0);
    }
  });

  it("returns null for a payload that is too short or malformed", () => {
    expect(decodePowerScoreSettings("")).toBeNull();
    expect(decodePowerScoreSettings("AAAA")).toBeNull();
  });
});

describe("strengthScoreBreakdown", () => {
  function manager(multiplier: number, rarity = "rare"): CatalogManager {
    return {
      id: "sm-10001",
      name: "Lee Vatori",
      rarity,
      type: "Mine Shaft",
      elements: [],
      active: { multiplier },
      activeLevels: [{ level: 1, value: multiplier }],
    };
  }
  function progress(level: number, rank: number, promoted: number): PlayerManager {
    return { managerId: "sm-10001", unlocked: true, level, rank, promoted, fragments: 0, updatedAt: "" };
  }

  it("matches the documented heuristic formula", () => {
    const m = manager(10, "rare");
    const p = progress(30, 3, 1);
    const b = strengthScoreBreakdown(m, p);
    expect(b.activeTerm).toBeCloseTo(100, 5); // log10(10)*100
    expect(b.levelTerm).toBe(45); // 30 * 1.5
    expect(b.rankTerm).toBe(60); // 3 * 20
    expect(b.promotionTerm).toBe(10);
    expect(b.rarityTerm).toBe(12);
    expect(b.total).toBeCloseTo(227, 5);
  });

  it("uses the exact active-level row when present", () => {
    const m = manager(1, "rare");
    m.activeLevels = [{ level: 1, value: 10 }, { level: 50, value: 100 }];
    const b = strengthScoreBreakdown(m, progress(50, 0, 0));
    expect(b.activeTerm).toBeCloseTo(200, 5); // log10(100)*100
  });
});

describe("buildPowerScoreParityRows", () => {
  it("builds a row per unlocked manager with heuristic score and unverified marker", () => {
    const manager: CatalogManager = {
      id: "sm-10001",
      name: "Lee Vatori",
      rarity: "legendary",
      type: "Mine Shaft",
      elements: [],
      active: { multiplier: 100 },
    };
    const progressByManager = new Map<string, PlayerManager>([
      ["sm-10001", { managerId: "sm-10001", unlocked: true, level: 30, rank: 4, promoted: 2, fragments: 0, updatedAt: "" }],
    ]);
    const { rows, settings } = buildPowerScoreParityRows([manager], progressByManager, REAL_PAYLOAD);
    expect(rows).toHaveLength(1);
    expect(rows[0].heuristicScore).toBeGreaterThan(0);
    expect(rows[0].gamePowerScore).toBeNull();
    expect(rows[0].gamePowerScoreNote).toContain("unverified");
    expect(settings?.q16Consistent).toBe(true);
  });

  it("skips locked managers", () => {
    const manager: CatalogManager = {
      id: "sm-10001",
      name: "Lee Vatori",
      rarity: "rare",
      type: "Mine Shaft",
      elements: [],
      active: { multiplier: 10 },
    };
    const progressByManager = new Map<string, PlayerManager>([
      ["sm-10001", { managerId: "sm-10001", unlocked: false, level: 1, rank: 0, promoted: 0, fragments: 0, updatedAt: "" }],
    ]);
    expect(buildPowerScoreParityRows([manager], progressByManager).rows).toHaveLength(0);
  });
});
