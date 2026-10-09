import { describe, expect, it } from "vitest";
import {
  balancingConfigForMine,
  deriveMineRates,
  elevatorPerSecond,
  shaftGainPerSecond,
  shaftTierBaseGain,
  shaftWorkersAt,
  warehousePerSecond,
} from "./mine-balancing";

describe("mine balancing tables (game 5.64.1 remote config)", () => {
  it("maps save mines to configs: shared mainland, special deep mines, Everdeep", () => {
    expect(balancingConfigForMine(1)).not.toBeNull();
    expect(balancingConfigForMine(1)).toBe(balancingConfigForMine(29));
    expect(balancingConfigForMine(30)).not.toBe(balancingConfigForMine(1));
    expect(balancingConfigForMine(35)).not.toBe(balancingConfigForMine(1));
    expect(balancingConfigForMine(40)).not.toBe(balancingConfigForMine(1));
    // Save mine 6000 (Everdeep) is keyed 2500 in the game's selection.
    expect(balancingConfigForMine(6000)).not.toBeNull();
    expect(balancingConfigForMine(6000)?.tiers.length).toBe(100);
    expect(balancingConfigForMine(6000)?.levelCaps.elevator[0]).toEqual({ from: 1, to: 7400 });
    expect(balancingConfigForMine(5001)).not.toBeNull();
    expect(balancingConfigForMine(999)).toBeNull();
    expect(balancingConfigForMine(null)).toBeNull();
  });

  it("compounds tier-1 shaft gain exactly like the game's config", () => {
    const config = balancingConfigForMine(1)!;
    // The config's own compounding: 5 @L1, 33.6 @L21, ~1.59e4 @L101,
    // ~1.38e7 @L201 (block of the level being LEFT, no milestones here).
    expect(shaftTierBaseGain(config, 1, 1)).toBeCloseTo(5, 6);
    expect(shaftTierBaseGain(config, 1, 21)).toBeCloseTo(33.6, 0);
    expect(shaftTierBaseGain(config, 1, 101) / 15875).toBeGreaterThan(0.98);
    expect(shaftTierBaseGain(config, 1, 101) / 15875).toBeLessThan(1.02);
    expect(shaftTierBaseGain(config, 1, 201) / 1.38e7).toBeGreaterThan(0.97);
    expect(shaftTierBaseGain(config, 1, 201) / 1.38e7).toBeLessThan(1.03);
  });

  it("counts shaft workers from milestones (starter + increments)", () => {
    const config = balancingConfigForMine(1)!;
    expect(shaftWorkersAt(config, 1)).toBe(1);
    expect(shaftWorkersAt(config, 10)).toBe(2);
    expect(shaftWorkersAt(config, 800)).toBe(6);
  });

  it("full shaft rate = base gain x milestone jumps x workers", () => {
    const config = balancingConfigForMine(1)!;
    const level = 101;
    const expected =
      shaftTierBaseGain(config, 1, level) *
      config.shaftMilestones.filter((m) => m.level <= level).reduce((p, m) => p * m.gainRate, 1) *
      shaftWorkersAt(config, level);
    expect(shaftGainPerSecond(config, 1, level)).toBeCloseTo(expected, 4);
  });

  it("elevator and warehouse rates grow monotonically with level", () => {
    const config = balancingConfigForMine(1)!;
    expect(elevatorPerSecond(config, 1)).toBeCloseTo(150, 6);
    expect(warehousePerSecond(config, 1)).toBeCloseTo(250, 6);
    expect(elevatorPerSecond(config, 500)).toBeGreaterThan(elevatorPerSecond(config, 100));
    expect(warehousePerSecond(config, 500)).toBeGreaterThan(warehousePerSecond(config, 100));
    expect(elevatorPerSecond(config, 0)).toBe(0);
  });

  it("picks the slowest leg as the mine pace (bottleneck)", () => {
    // One fresh shaft (5/s) with fresh elevator/warehouse: shaft is slowest.
    const fresh = deriveMineRates(1, [1], 1, 1);
    expect(fresh?.slowestLeg).toBe("shaft");
    expect(fresh?.outputPerSecond).toBeCloseTo(fresh!.shaftPerSecond, 6);
    // Maxed shaft with fresh elevator (150/s) and warehouse (250/s):
    // the elevator is slowest.
    const elevatorSlow = deriveMineRates(1, [800], 1, 1);
    expect(elevatorSlow?.slowestLeg).toBe("elevator");
    // No levels at all: nothing to derive.
    expect(deriveMineRates(1, [], null, null)).toBeNull();
    expect(deriveMineRates(999, [800], 800, 800)).toBeNull();
  });

  it("assigns deepest-first shaft levels to the highest tiers", () => {
    const config = balancingConfigForMine(1)!;
    // Two shafts: the deepest (first in the save list) works tier 2.
    const derived = deriveMineRates(1, [101, 1], 800, 800)!;
    const manual =
      shaftGainPerSecond(config, 2, 101) + shaftGainPerSecond(config, 1, 1);
    expect(derived.shaftPerSecond).toBeCloseTo(manual, 4);
  });

  describe("calibration against a real save (2026-10-08)", () => {
    // Game truth (save idle, unboosted): mine 3 (Ruby) 1.73bb/s = 1.73e96,
    // elevator 2216, warehouse 2190. The raw game tables must land BELOW
    // that: the rest is player progression (research, artifacts,
    // collectibles, passives) that these tables cannot see. Measured
    // residual on this save: ~640x (elevator leg). The band below encodes
    // the honest gap - it must not silently shrink.
    const GAME_IDLE_MINE3 = 1.73e96;

    it("mine 3 elevator leg is below game idle by the documented progression gap", () => {
      const config = balancingConfigForMine(3)!;
      const elevator = elevatorPerSecond(config, 2216);
      expect(elevator / 2.71e93).toBeGreaterThan(0.99);
      expect(elevator / 2.71e93).toBeLessThan(1.01);
      const residual = GAME_IDLE_MINE3 / elevator;
      expect(residual).toBeGreaterThan(100);
      expect(residual).toBeLessThan(5000);
    });

    it("mine 3 warehouse leg is also below game idle (not the hidden booster)", () => {
      const config = balancingConfigForMine(3)!;
      const warehouse = warehousePerSecond(config, 2190);
      const residual = GAME_IDLE_MINE3 / warehouse;
      expect(residual).toBeGreaterThan(1000);
      expect(residual).toBeLessThan(500000);
    });

    it("Everdeep elevator is NOT its limit (legs sit above its game idle)", () => {
      const config = balancingConfigForMine(6000)!;
      // Game idle for Everdeep: 2.63av/s = 2.63e78 at elevator 1832.
      expect(elevatorPerSecond(config, 1832)).toBeGreaterThan(2.63e78 * 10);
    });
  });
});
