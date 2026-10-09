import { describe, expect, it } from "vitest";
import {
  balancingConfigForMine,
  deriveMineRates,
  elevatorPerSecond,
  shaftGainPerSecond,
  shaftTierBaseGain,
  shaftWorkersAt,
  warehousePerSecond,
  warehouseWorkersAt,
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

  it("assigns shaft levels in shaft order: element i works tier i+1", () => {
    const config = balancingConfigForMine(1)!;
    // Two shafts: the first in the save list is Mineshaft 1 (tier 1).
    // (An earlier build paired the list backwards, first entry with the
    // highest tier, and overshot a real mine's shaft total by ~2e9.)
    const derived = deriveMineRates(1, [101, 1], 800, 800)!;
    const manual =
      shaftGainPerSecond(config, 1, 101) + shaftGainPerSecond(config, 2, 1);
    expect(derived.shaftPerSecond).toBeCloseTo(manual, 4);
  });

  it("shaft output scales with the tier base gains (game: shaft 2 = 50x shaft 1)", () => {
    const config = balancingConfigForMine(15)!;
    // Game truth (Mine Overview, equal levels): Mineshaft 2 shows exactly
    // 50x Mineshaft 1 - the tier-2/tier-1 base-gain ratio. This is what
    // pins "tier = shaft number" over grouped/cycling tier schemes.
    const ratio = shaftGainPerSecond(config, 2, 800) / shaftGainPerSecond(config, 1, 800);
    expect(ratio).toBeCloseTo(50, 6);
  });

  it("counts warehouse workers from milestones (base crew + increments)", () => {
    const config = balancingConfigForMine(15)!;
    expect(warehouseWorkersAt(config, 1)).toBe(1);
    expect(warehouseWorkersAt(config, 20)).toBe(2);
    expect(warehouseWorkersAt(config, 2003)).toBe(5);
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
      // ~1.24e4 with warehouse workers counted - the same progression
      // band the mine-15 leg calibration pins below.
      expect(residual).toBeGreaterThan(5000);
      expect(residual).toBeLessThan(50000);
    });

    it("Everdeep elevator is NOT its limit (legs sit above its game idle)", () => {
      const config = balancingConfigForMine(6000)!;
      // Game idle for Everdeep: 2.63av/s = 2.63e78 at elevator 1832.
      expect(elevatorPerSecond(config, 1832)).toBeGreaterThan(2.63e78 * 10);
    });
  });

  describe("calibration against the game's Mine Overview (Obsidian, mine 15)", () => {
    // Game truth, read off the game's own Mine Overview screen 2026-10-08
    // (Obsidian = save mine 15, Fire, prestige 5; suffixes: ak=1e45,
    // ay=1e87, az=1e90):
    // - Mineshaft 1 @800: 6.98 ak/s WITH a regular manager's 3.56x mining
    //   speed boost on that shaft -> 1.96e45 before that manager.
    // - Elevator @1997 "Total Transportation": 731 ay/s = 7.31e89.
    // - Warehouse @2003 "Total Transportation": 1.15 az/s = 1.15e90.
    // - Mineshafts total (30 shafts): 1.38 az/s = 1.38e90.
    // The game totals include regular-manager multipliers and player
    // progression (research/artifacts/collectibles) that the tables
    // cannot see, so the raw model must land BELOW every game number.
    // After the 2026-10-08 semantic fixes (tier = shaft number, warehouse
    // x workers) all four residuals cluster at ~1.8e4-2.9e4 - one
    // progression band. The band below is that honest gap, asserted so
    // it cannot silently shrink: [1e4, 6e4] on every leg.
    const SHAFT1_GAME = 1.96e45;
    const ELEVATOR_GAME = 7.31e89;
    const WAREHOUSE_GAME = 1.15e90;
    const SHAFT_TOTAL_GAME = 1.38e90;
    const BAND: [number, number] = [1e4, 6e4];

    it("shaft 1 (tier 1 @800) sits in the progression band below the game", () => {
      const config = balancingConfigForMine(15)!;
      const model = shaftGainPerSecond(config, 1, 800);
      expect(model).toBeLessThan(SHAFT1_GAME);
      const residual = SHAFT1_GAME / model;
      expect(residual).toBeGreaterThan(BAND[0]);
      expect(residual).toBeLessThan(BAND[1]);
    });

    it("elevator and warehouse legs sit in the same band, warehouse above elevator", () => {
      const config = balancingConfigForMine(15)!;
      const elevator = elevatorPerSecond(config, 1997);
      const warehouse = warehousePerSecond(config, 2003);
      // The game calls the elevator this mine's slow leg; before the
      // warehouse-workers fix the model had the order flipped.
      expect(warehouse).toBeGreaterThan(elevator);
      for (const [model, game] of [[elevator, ELEVATOR_GAME], [warehouse, WAREHOUSE_GAME]] as const) {
        expect(model).toBeLessThan(game);
        const residual = game / model;
        expect(residual).toBeGreaterThan(BAND[0]);
        expect(residual).toBeLessThan(BAND[1]);
      }
    });

    it("calls the elevator the slowest leg, like the game", () => {
      // All shafts maxed (upper bound for the shaft leg):
      const maxed = deriveMineRates(15, Array(30).fill(800), 1997, 2003)!;
      expect(maxed.slowestLeg).toBe("elevator");
      // Real saves taper with depth (deep shafts lag); a representative
      // 800 -> 590 taper must keep the same call, and its shaft total
      // must land in the same progression band below the game's total.
      const taper = Array.from({ length: 30 }, (_, k) => Math.round(800 - (800 - 590) * (k / 29)));
      const tapered = deriveMineRates(15, taper, 1997, 2003)!;
      expect(tapered.slowestLeg).toBe("elevator");
      const residual = SHAFT_TOTAL_GAME / tapered.shaftPerSecond;
      expect(residual).toBeGreaterThan(BAND[0]);
      expect(residual).toBeLessThan(BAND[1]);
    });
  });
});
