import { describe, expect, it } from "vitest";
import {
  PROGRESS_STAGES,
  evaluateProgressStages,
  hasPassiveKind,
  passiveKindOf,
  progressSummary,
  stageTargetPromo,
} from "./progress-tracker";
import type { CatalogManager, CatalogPassive, PlayerManager } from "./db";

function manager(id: string, overrides: Partial<CatalogManager> = {}): CatalogManager {
  return {
    id,
    name: `M ${id}`,
    rarity: "rare",
    type: "Mine Shaft",
    elements: [],
    passives: [],
    ...overrides,
  };
}

function passive(kind: string, promoReq: number, passiveId?: number): CatalogPassive {
  const base: CatalogPassive = { type: kind, promoReq };
  if (passiveId != null) base.passiveId = passiveId;
  return base;
}

function progress(managerId: string, promoted: number, unlocked = true): PlayerManager {
  return { managerId, unlocked, level: 30, rank: 2, promoted, fragments: 0, updatedAt: "" };
}

describe("passiveKindOf", () => {
  it("maps stable APK ids and type labels to MIF/CIF/MSUCR", () => {
    expect(passiveKindOf(passive("MIF", 3, 1007))).toBe("MIF");
    expect(passiveKindOf(passive("MSUCR", 1, 7))).toBe("MSUCR");
    expect(passiveKindOf(passive("CIF", 3))).toBe("CIF");
    expect(passiveKindOf({ type: "Mineshaft Upgrade Cost Reduction" })).toBe("MSUCR");
    expect(passiveKindOf({ description: "x0.8 upgrade cost" })).toBe("MSUCR");
    expect(passiveKindOf({ description: "mine income factor" })).toBe("MIF");
    expect(passiveKindOf({ type: "Crate Resources" })).toBeNull();
  });
});

describe("evaluateProgressStages", () => {
  const catalog = [
    manager("sm-rare-a", { passives: [passive("MIF", 3, 1007)], rarity: "rare" }),
    manager("sm-rare-b", { passives: [passive("MIF", 3, 1007)], rarity: "rare" }),
    manager("sm-epic-shaft", { passives: [passive("MIF", 3, 1007)], rarity: "epic" }),
    manager("sm-epic-wh", { passives: [passive("CIF", 3)], rarity: "epic", type: "Warehouse" }),
    manager("sm-misucr", { passives: [passive("MSUCR", 1, 7)] }),
  ];

  it("stage 1 counts owned rare MIF managers at/above P30", () => {
    const results = evaluateProgressStages(catalog, [progress("sm-rare-a", 3), progress("sm-rare-b", 1)]);
    const stage1 = results.find((result) => result.stage.id === 1)!;
    expect(stage1.qualifying).toHaveLength(2);
    expect(stage1.satisfied).toBe(1);
    expect(stage1.complete).toBe(false);
    expect(stage1.fraction).toBeCloseTo(0.5, 5);
  });

  it("stage 3 (one warehouse) completes with a single qualifying manager", () => {
    const results = evaluateProgressStages(catalog, [progress("sm-epic-wh", 3)]);
    const stage3 = results.find((result) => result.stage.id === 3)!;
    expect(stage3.qualifying).toHaveLength(1);
    expect(stage3.complete).toBe(true);
  });

  it("stage 8 targets each manager's own passive unlock promo", () => {
    const legendary = manager("sm-leg", { passives: [passive("MIF", 5, 1007)], rarity: "legendary" });
    const results = evaluateProgressStages([legendary], [progress("sm-leg", 4)]);
    const stage8 = results.find((result) => result.stage.id === 8)!;
    expect(stage8.qualifying[0].target).toBe(5);
    expect(stage8.complete).toBe(false);
    const promoted = evaluateProgressStages([legendary], [progress("sm-leg", 5)]);
    expect(promoted.find((result) => result.stage.id === 8)!.complete).toBe(true);
  });

  it("ignores locked managers and managers absent from progress", () => {
    const results = evaluateProgressStages(catalog, [progress("sm-rare-a", 3, false), progress("sm-missing", 3)]);
    const stage1 = results.find((result) => result.stage.id === 1)!;
    expect(stage1.qualifying).toHaveLength(0);
  });

  it("stage 13 completionist requires every remaining manager at P50", () => {
    const all = evaluateProgressStages(catalog, ["sm-rare-a", "sm-rare-b", "sm-epic-shaft", "sm-epic-wh", "sm-misucr"].map((id) => progress(id, 5)));
    const stage13 = all.find((result) => result.stage.id === 13)!;
    expect(stage13.qualifying.length).toBe(5);
    expect(stage13.complete).toBe(true);
  });
});

describe("helpers", () => {
  it("hasPassiveKind and stageTargetPromo", () => {
    const m = manager("x", { passives: [passive("MIF", 4, 1007)] });
    expect(hasPassiveKind(m, "MIF")).toBe(true);
    expect(hasPassiveKind(m, "CIF")).toBe(false);
    expect(stageTargetPromo(PROGRESS_STAGES[7], m)).toBe(4); // stage 8, per-manager unlock promo
    expect(stageTargetPromo(PROGRESS_STAGES[0], m)).toBe(3); // stage 1 fixed target
  });

  it("progressSummary counts completed stages", () => {
    const results = evaluateProgressStages([], []);
    const summary = progressSummary(results);
    expect(summary.total).toBe(PROGRESS_STAGES.length);
    expect(summary.complete).toBe(0);
  });
});
