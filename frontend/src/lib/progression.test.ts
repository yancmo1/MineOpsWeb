import { describe, expect, it } from "vitest";
import type { DerivedMineRates } from "./mine-balancing";
import { extractMineState } from "./mine-state";
import { COLLECTIBLE_PRODUCTION, SKILL_PRODUCTION } from "./progression-data";
import { applyProgressionToRates, continentTypeOfMine, progressionFactorsForMine, type OwnedProgression } from "./progression";

/**
 * The progression tables were extracted from the game's own entity assets
 * (game 5.64.1 bin/Data; see tools/generate-progression-data.py). These
 * tests pin the extraction (row counts, spot values) and the application
 * rules in progression.ts. Expected factors below are read off the real
 * tables, e.g. SkillLevels: skill 1 level 10 ParamX = 1.825.
 */

describe("progression data integrity", () => {
  it("emits every production-effect skill and all 60 collectibles", () => {
    expect(Object.keys(SKILL_PRODUCTION)).toHaveLength(119);
    expect(Object.keys(COLLECTIBLE_PRODUCTION)).toHaveLength(60);
    const byEffect = new Map<number, number>();
    for (const row of Object.values(SKILL_PRODUCTION)) byEffect.set(row.effect, (byEffect.get(row.effect) ?? 0) + 1);
    expect(byEffect.get(1)).toBe(56); // SingleMine
    expect(byEffect.get(2)).toBe(3); // AllMines
    expect(byEffect.get(14)).toBe(18); // ContinentMines
    for (const effect of [24, 25, 26, 27, 28, 29]) expect(byEffect.get(effect)).toBe(7);
    const byType = new Map<string, number>();
    for (const row of Object.values(COLLECTIBLE_PRODUCTION)) byType.set(row.type, (byType.get(row.type) ?? 0) + 1);
    expect(byType.get("Corridor")).toBe(20);
    expect(byType.get("Ground")).toBe(20);
    expect(byType.get("Elevator")).toBe(20);
  });

  it("carries the real table values", () => {
    // SkillLevels skill 1: L0 1.0, L1 1.4, L10 1.825; SkillNode: SingleMine -> mine 1.
    expect(SKILL_PRODUCTION[1]).toEqual({ effect: 1, target: 1, x: [1, 1.4, 1.44, 1.485, 1.53, 1.575, 1.62, 1.67, 1.72, 1.77, 1.825] });
    // CollectibleProductionFactors collectible 1 (Corridor): L2 = 1.49.
    expect(COLLECTIBLE_PRODUCTION[1].type).toBe("Corridor");
    expect(COLLECTIBLE_PRODUCTION[1].f[2]).toBe(1.49);
    expect(COLLECTIBLE_PRODUCTION[1].f).toHaveLength(31);
    // Top-rarity Elevator collectible 60 maxes at 32.78 (level 30).
    expect(COLLECTIBLE_PRODUCTION[60].type).toBe("Elevator");
    expect(COLLECTIBLE_PRODUCTION[60].f[30]).toBe(32.78);
  });
});

describe("progressionFactorsForMine", () => {
  const owned = (partial: Partial<OwnedProgression>): OwnedProgression => ({ skills: {}, collectibles: [], ...partial });

  it("applies nothing without save-proven ownership", () => {
    expect(progressionFactorsForMine(1, null)).toEqual({ shaft: 1, elevator: 1, warehouse: 1 });
    expect(progressionFactorsForMine(1, owned({}))).toEqual({ shaft: 1, elevator: 1, warehouse: 1 });
    expect(progressionFactorsForMine(1, owned({ skills: { 1: 0 } }))).toEqual({ shaft: 1, elevator: 1, warehouse: 1 });
  });

  it("SingleMine hits only its target mine, on every leg", () => {
    const o = owned({ skills: { 1: 10 } });
    expect(progressionFactorsForMine(1, o)).toEqual({ shaft: 1.825, elevator: 1.825, warehouse: 1.825 });
    expect(progressionFactorsForMine(2, o)).toEqual({ shaft: 1, elevator: 1, warehouse: 1 });
  });

  it("AllMines hits every mine; distinct owned nodes multiply", () => {
    const o = owned({ skills: { 1: 10, 6: 1 } });
    const mine1 = progressionFactorsForMine(1, o);
    expect(mine1.shaft).toBeCloseTo(1.825 * 1.2, 10);
    const mine9 = progressionFactorsForMine(9, o);
    expect(mine9).toEqual({ shaft: 1.2, elevator: 1.2, warehouse: 1.2 });
  });

  it("ContinentMines and leg-speed nodes key on the mine's continentType", () => {
    // Skill 5003: ContinentMines -> continent 2 (Fire). Skill 4015:
    // ElevatorLoadingSpeed -> continent 2. Mine 15 is Fire, mine 3 is Start.
    const o = owned({ skills: { 5003: 10, 4015: 10 } });
    const fire = progressionFactorsForMine(15, o);
    expect(fire.shaft).toBeCloseTo(1.565, 10);
    expect(fire.elevator).toBeCloseTo(1.565 * 1.565, 10);
    expect(fire.warehouse).toBeCloseTo(1.565, 10);
    expect(progressionFactorsForMine(3, o)).toEqual({ shaft: 1, elevator: 1, warehouse: 1 });
    // Skill 4023: CorridorGainPerSecond -> continent 3 (Dawn); mine 18 is Dawn.
    const dawn = progressionFactorsForMine(18, owned({ skills: { 4023: 1 } }));
    expect(dawn).toEqual({ shaft: 1.2, elevator: 1, warehouse: 1 });
  });

  it("capacity skill nodes are not rate-applied", () => {
    // Skill 4002: WarehouseCapacity -> continent 0 (effect 25).
    expect(SKILL_PRODUCTION[4002]?.effect).toBe(25);
    expect(progressionFactorsForMine(1, owned({ skills: { 4002: 10 } }))).toEqual({ shaft: 1, elevator: 1, warehouse: 1 });
  });

  it("collectibles multiply only their own leg, and only when unlocked", () => {
    const o = owned({
      collectibles: [
        { id: 1, level: 2, state: 1 }, // Corridor x1.49 on the shaft leg
        { id: 60, level: 30, state: 2 }, // Elevator x32.78
        { id: 2, level: 30, state: 0 }, // Locked: must not apply
      ],
    });
    const f = progressionFactorsForMine(7, o);
    expect(f.shaft).toBeCloseTo(1.49, 10);
    expect(f.elevator).toBeCloseTo(32.78, 10);
    expect(f.warehouse).toBe(1);
  });

  it("continentTypeOfMine mirrors the mainland 1..40 layout", () => {
    expect(continentTypeOfMine(1)).toBe(0);
    expect(continentTypeOfMine(15)).toBe(2);
    expect(continentTypeOfMine(40)).toBe(7);
    expect(continentTypeOfMine(6000)).toBeNull();
    expect(continentTypeOfMine(null)).toBeNull();
  });
});

describe("applyProgressionToRates", () => {
  const rates: DerivedMineRates = { shaftPerSecond: 100, elevatorPerSecond: 50, warehousePerSecond: 80, outputPerSecond: 50, slowestLeg: "elevator", prestigeFactor: 3 };

  it("scales legs and recomputes the slowest leg", () => {
    const out = applyProgressionToRates(rates, { shaft: 1, elevator: 4, warehouse: 1 });
    expect(out.elevatorPerSecond).toBe(200);
    expect(out.outputPerSecond).toBe(80);
    expect(out.slowestLeg).toBe("warehouse");
    expect(out.prestigeFactor).toBe(3);
  });

  it("is the identity when no factor applies", () => {
    expect(applyProgressionToRates(rates, { shaft: 1, elevator: 1, warehouse: 1 })).toBe(rates);
  });
});

describe("save parsing for progression drawers", () => {
  it("reads SkillSavegames / CollectibleSavegames / ArtifactsSavegame", () => {
    const state = extractMineState({
      Data: {
        SkillSavegames: [{ SkillId: 1, Level: 10 }, { SkillId: 6, Level: 1 }],
        CollectibleSavegames: [{ CollectibleId: 1, Level: 2, Parts: 4, State: 1 }],
        ArtifactsSavegame: { UnlockedArtifacts: [5, 9] },
      },
    });
    expect(state.skills).toEqual({ 1: 10, 6: 1 });
    expect(state.collectibles).toEqual([{ id: 1, level: 2, state: 1 }]);
    expect(state.unlockedArtifacts).toEqual([5, 9]);
  });

  it("accepts the game's Data field names (Skills / Collectibles) too", () => {
    const state = extractMineState({ Data: { Skills: [{ SkillId: 30, Level: 3 }], Collectibles: [{ CollectibleId: 60, Level: 30, State: 2 }] } });
    expect(state.skills).toEqual({ 30: 3 });
    expect(state.collectibles).toEqual([{ id: 60, level: 30, state: 2 }]);
  });

  it("defaults to empty progression on a save without those drawers", () => {
    const state = extractMineState({ Data: {} });
    expect(state.skills).toEqual({});
    expect(state.collectibles).toEqual([]);
    expect(state.unlockedArtifacts).toEqual([]);
  });
});
