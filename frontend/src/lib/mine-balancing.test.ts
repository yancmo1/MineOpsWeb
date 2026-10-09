import { describe, expect, it } from "vitest";
import {
  balancingConfigForMine,
  deriveMineRates,
  elevatorPerSecond,
  prestigeGainFactor,
  shaftGainPerSecond,
  shaftTierBaseGain,
  shaftWorkersAt,
  warehousePerSecond,
  warehouseWorkersAt,
} from "./mine-balancing";

describe("prestige gain factors (RemoteMineGlobal, game 5.64.1)", () => {
  it("matches the game's per-mine prestige table", () => {
    // RemoteMineGlobal.PrestigeModifiers.GeneralGainFactor rows.
    expect(prestigeGainFactor(15, 5)).toBe(110); // Obsidian at prestige 5
    expect(prestigeGainFactor(3, 5)).toBe(80); // Ruby at prestige 5
    expect(prestigeGainFactor(1, 6)).toBe(145); // Coal at prestige 6
    expect(prestigeGainFactor(1, 0)).toBe(1); // no prestige, no factor
    expect(prestigeGainFactor(2, 0)).toBe(3); // per-mine P0 baseline differs
    expect(prestigeGainFactor(5001, 5)).toBe(60); // elemental rows exist too
  });

  it("defaults to 1 where the game has no prestige factor", () => {
    expect(prestigeGainFactor(6000, 39)).toBe(1); // Everdeep: no rows
    expect(prestigeGainFactor(2500, 10)).toBe(1); // (its game-side key)
    expect(prestigeGainFactor(1000, 3)).toBe(1); // Mainland: no rows
    expect(prestigeGainFactor(null, 5)).toBe(1);
    expect(prestigeGainFactor(15, null)).toBe(1);
    // Counts past the table clamp to the last row (P7 for mine 15 = 130+).
    expect(prestigeGainFactor(15, 99)).toBe(prestigeGainFactor(15, 7));
  });

  it("deriveMineRates scales every leg by the prestige factor", () => {
    const plain = deriveMineRates(15, [800], 1997, 2003)!;
    const boosted = deriveMineRates(15, [800], 1997, 2003, 5)!;
    expect(boosted.prestigeFactor).toBe(110);
    expect(boosted.elevatorPerSecond / plain.elevatorPerSecond).toBeCloseTo(110, 6);
    expect(boosted.warehousePerSecond / plain.warehousePerSecond).toBeCloseTo(110, 6);
    expect(boosted.shaftPerSecond / plain.shaftPerSecond).toBeCloseTo(110, 6);
    expect(boosted.slowestLeg).toBe(plain.slowestLeg);
    // No prestige count passed -> raw tables, factor 1.
    expect(plain.prestigeFactor).toBe(1);
  });
});

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
    // elevator 2216, warehouse 2190, prestige 5 (factor 80). With the
    // game's own prestige factor counted, the elevator leg lands ~8x
    // below the save idle: that remainder is the player's research
    // skill tree / collectibles / artifacts / manager passives, which
    // live in the save (SkillSavegames etc.), not in these tables.
    // The bands below encode that honest gap - they must not silently
    // shrink.
    const GAME_IDLE_MINE3 = 1.73e96;

    it("mine 3 elevator leg (with prestige) is below game idle by the progression gap", () => {
      const config = balancingConfigForMine(3)!;
      const elevator = elevatorPerSecond(config, 2216) * prestigeGainFactor(3, 5);
      const residual = GAME_IDLE_MINE3 / elevator;
      expect(residual).toBeGreaterThan(4);
      expect(residual).toBeLessThan(20);
    });

    it("mine 3 warehouse leg (with prestige) also stays below game idle", () => {
      const config = balancingConfigForMine(3)!;
      const warehouse = warehousePerSecond(config, 2190) * prestigeGainFactor(3, 5);
      expect(warehouse).toBeLessThan(GAME_IDLE_MINE3);
      // ~155x: a lower bound only - the warehouse is not this mine's
      // binding leg, so its own progression multiplier is at least this.
      const residual = GAME_IDLE_MINE3 / warehouse;
      expect(residual).toBeGreaterThan(50);
      expect(residual).toBeLessThan(500);
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
    // cannot see, so the model must land BELOW every game number. With
    // the game's own prestige factor (x110 at P5) counted, all four
    // residuals cluster at ~170-270 - the progression band that is
    // left. (Before prestige they read ~1.8e4-2.9e4; prestige was
    // nearly all of that gap.) The band below is asserted so it
    // cannot silently shrink: [100, 500] on every leg.
    const SHAFT1_GAME = 1.96e45;
    const ELEVATOR_GAME = 7.31e89;
    const WAREHOUSE_GAME = 1.15e90;
    const SHAFT_TOTAL_GAME = 1.38e90;
    const BAND: [number, number] = [100, 500];
    const PF15 = prestigeGainFactor(15, 5);

    it("shaft 1 (tier 1 @800, prestige counted) sits in the progression band below the game", () => {
      const config = balancingConfigForMine(15)!;
      const model = shaftGainPerSecond(config, 1, 800) * PF15;
      expect(model).toBeLessThan(SHAFT1_GAME);
      const residual = SHAFT1_GAME / model;
      expect(residual).toBeGreaterThan(BAND[0]);
      expect(residual).toBeLessThan(BAND[1]);
    });

    it("elevator and warehouse legs sit in the same band, warehouse above elevator", () => {
      const config = balancingConfigForMine(15)!;
      const elevator = elevatorPerSecond(config, 1997) * PF15;
      const warehouse = warehousePerSecond(config, 2003) * PF15;
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

    it("against the save's own unboosted idle, the elevator residual is ~20x", () => {
      // The save stores this mine's unboosted idle: 73.1 ay/s = 7.31e88.
      // The Mine Overview totals above read ~10x higher than the idle
      // stack (active buffs / manager effects on the open mine), so the
      // idle is the tighter anchor: prestige-included elevator ~20x
      // below it is the research/collectible remainder.
      const GAME_IDLE_MINE15 = 7.31e88;
      const config = balancingConfigForMine(15)!;
      const elevator = elevatorPerSecond(config, 1997) * PF15;
      const residual = GAME_IDLE_MINE15 / elevator;
      expect(residual).toBeGreaterThan(10);
      expect(residual).toBeLessThan(60);
    });

    it("calls the elevator the slowest leg, like the game", () => {
      // All shafts maxed (upper bound for the shaft leg):
      const maxed = deriveMineRates(15, Array(30).fill(800), 1997, 2003, 5)!;
      expect(maxed.slowestLeg).toBe("elevator");
      // Real saves taper with depth (deep shafts lag); a representative
      // 800 -> 590 taper must keep the same call, and its shaft total
      // must land in the same progression band below the game's total.
      const taper = Array.from({ length: 30 }, (_, k) => Math.round(800 - (800 - 590) * (k / 29)));
      const tapered = deriveMineRates(15, taper, 1997, 2003, 5)!;
      expect(tapered.slowestLeg).toBe("elevator");
      const residual = SHAFT_TOTAL_GAME / tapered.shaftPerSecond;
      expect(residual).toBeGreaterThan(BAND[0]);
      expect(residual).toBeLessThan(BAND[1]);
    });
  });
});
