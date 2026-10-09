/**
 * REAL mine production tables, lifted from the game's own remote balancing
 * config (RemoteMineBalancing / Kolibri "Zodiac" LiveTune), trapped from the
 * ubuntumac emulator POC (APK deep-dive dig #3, 2026-10-08).
 * DO NOT EDIT BY HAND - regenerate with tools/generate-mine-balancing.py.
 *
 * Source: raw-zodiac-configuration-2026-10-08-fresh.json (game 5.64.1,
 * config synced 2026-10-09T00:02:07Z), the ">=5.63.0" RemoteMineSelection
 * + RemoteMineConfig entities. Big numbers stay as [mantissa, exponent]
 * pairs (value = m x 10^e), the game's own format.
 *
 * MODEL SEMANTICS (pinned by calibration against the game's own Mine
 * Overview for a real save - Obsidian, save mine 15 - on 2026-10-08):
 * - Shaft tiers are shaft numbers: the save's CorridorLevels list is in
 *   shaft order (Mineshaft 1 first), and shaft k works tier k. (In the
 *   game, Mineshaft 2 produces exactly 50x Mineshaft 1 at equal level -
 *   the tier-2/tier-1 base-gain ratio. Grouping shafts into shared tiers
 *   (ceil(k/5) or cycling 1..6) would need a ~1e41 progression factor to
 *   reach the game's totals; shaft numbers need ~2e4, like the other
 *   legs.) An earlier build paired the list backwards (first entry with
 *   the highest tier) and overshot the shaft total by ~2e9.
 * - Inside a level block, each level-up multiplies by that block's increase
 *   factor, using the block of the level being LEFT. (Tier-1 shaft gain:
 *   5 @L1, 33.6 @L21, ~1.59e4 @L101, ~1.38e7 @L201, ~1.7e37 @L800 - the
 *   config's own compounding checks out exactly.)
 * - Milestone multipliers apply once, when their level is reached.
 * - Shaft gain per shaft = block growth x milestone GainRate x workers
 *   (the growth underneath is the exactly-checked part; the milestone and
 *   worker composition follows the game's own class shape).
 * - Warehouse throughput = loading rate x workers. Warehouse milestones
 *   carry WorkerIncrement (1 worker at L1, 5 by L500); leaving the workers
 *   out made the warehouse look ~6.5x weaker than the other legs and
 *   flipped the bottleneck call. Elevator has no workers - one car.
 * - PRESTIGE (applied): RemoteMineGlobal.PrestigeModifiers gives each
 *   mine a GeneralGainFactor per prestige count (Obsidian x110 at P5,
 *   Ruby x80 at P5, Coal x145 at P6). deriveMineRates multiplies every
 *   leg by it when the save's prestige count is passed. This one factor
 *   was most of the old ~2e4 gap.
 * - HONEST GAP (what is left): the player's research skill tree
 *   (per-continent x per-leg nodes), collectibles, artifacts, and
 *   assigned-manager passives/equipment multiply production further.
 *   They live in the save (SkillSavegames {SkillId, Level}, the
 *   collectible/artifact savegames, SuperManagers.Assignments), NOT in
 *   these balancing tables, so the model still lands below the game:
 *   on the 2026-10-08 calibration save, ~x8-36 under the save's own
 *   unboosted idle once prestige is counted (the game's Mine Overview
 *   totals read a further ~10x above its idle stack - active buffs and
 *   manager effects on the open mine). Treat the derived legs as true
 *   relative leg speeds and bottleneck shape - not as a promise of
 *   the final idle number. The residual bands are asserted in
 *   mine-balancing.test.ts; they must not silently shrink.
 */

export type BigPair = [mantissa: number, exponent: number];

export interface BalTier {
  tier: number;
  cost: BigPair;
  gain: BigPair;
  capacity: BigPair;
  /** Level-block starts, e.g. [1, 21, 101, 401]. */
  levels: number[];
  costInc: number[];
  gainInc: number[];
  capInc: number[];
}

export interface BalShaftMilestone {
  level: number;
  workerIncrement: number;
  gainRate: number;
  capacity: number;
}

export interface BalElevatorSegment {
  level: number;
  cost: number;
  /** Additive speed per level-up. */
  speed: number;
  capacity: number;
  loadingPerSecond: number;
}

export interface BalWarehouseSegment {
  level: number;
  cost: number;
  /** Additive walking speed per level-up. */
  walkingSpeed: number;
  capacity: number;
  loadingPerSecond: number;
}

export interface BalLegMilestone {
  level: number;
  capacity: number;
  loadingPerSecond: number;
  workerIncrement?: number;
}

export interface MineBalancingConfig {
  tiers: BalTier[];
  shaftGlobals: { starterSpeed: number; starterWorkers: number; maxLevel: number };
  shaftSpeedInc: Array<{ level: number; speed: number }>;
  shaftMilestones: BalShaftMilestone[];
  elevatorBase: { cost: BigPair; speed: number; capacity: BigPair; loadingPerSecond: BigPair };
  elevatorSegments: BalElevatorSegment[];
  elevatorMilestones: BalLegMilestone[];
  warehouseBase: { cost: BigPair; workers: number; workerSpeed: number; workerCapacity: BigPair; loadingPerSecond: BigPair };
  warehouseSegments: BalWarehouseSegment[];
  warehouseMilestones: BalLegMilestone[];
  barriers: Array<{ afterTier: number; cost: BigPair; breakTimeInSeconds: number }>;
  levelCaps: { elevator: Array<{ from: number; to: number }>; warehouse: Array<{ from: number; to: number }> };
}

// ------------------------------------------------------------ game tables
// Split across ./mine-balancing-data-1..3.ts (each < ~90 KB) so GitHub
// pushes stay under the per-file argument limit; assembled here.

import { CONFIGS_PART_1 } from "./mine-balancing-data-1";
import { CONFIGS_PART_2 } from "./mine-balancing-data-2";
import { CONFIGS_PART_3 } from "./mine-balancing-data-3";

export const MINE_BALANCING_CONFIGS: Record<string, MineBalancingConfig> = { ...CONFIGS_PART_1, ...CONFIGS_PART_2, ...CONFIGS_PART_3 };

/** Save mine number -> balancing config key. Save mine 6000 (Everdeep) is
 * keyed 2500 in the game's own selection; both are included. */
export const MINE_BALANCING_BY_MINE: Record<number, string> = {"1":"fde44e49","2":"fde44e49","3":"fde44e49","4":"fde44e49","5":"fde44e49","6":"fde44e49","7":"fde44e49","8":"fde44e49","9":"fde44e49","10":"fde44e49","11":"fde44e49","12":"fde44e49","13":"fde44e49","14":"fde44e49","15":"fde44e49","16":"fde44e49","17":"fde44e49","18":"fde44e49","19":"fde44e49","20":"fde44e49","21":"fde44e49","22":"fde44e49","23":"fde44e49","24":"fde44e49","25":"fde44e49","26":"fde44e49","27":"fde44e49","28":"fde44e49","29":"fde44e49","30":"2f83ad2c","31":"fde44e49","32":"fde44e49","33":"fde44e49","34":"fde44e49","35":"b76ae713","36":"fde44e49","37":"fde44e49","38":"fde44e49","39":"fde44e49","40":"08b00aff","1000":"a52767ad","2500":"b5e31ec5","5001":"e03f2f42","5002":"e03f2f42","5003":"e03f2f42","5004":"e03f2f42","5005":"e03f2f42","5006":"e03f2f42","5007":"e03f2f42","5008":"e03f2f42","5009":"e03f2f42","5010":"e03f2f42","5011":"e03f2f42","5012":"e03f2f42","5013":"e03f2f42","5014":"e03f2f42","5015":"e03f2f42","5016":"e03f2f42","5017":"e03f2f42","5018":"e03f2f42","5019":"e03f2f42","5020":"e03f2f42","6000":"b5e31ec5"};

/** Per-mine prestige gain factors from the game's RemoteMineGlobal
 * (PrestigeModifiers.GeneralGainFactor): mine number -> [factor at
 * prestige count 0, 1, 2, ...]. This multiplies ALL of the mine's
 * production (every leg) - it is the game's prestige bonus, exact.
 * Mines with no rows (Everdeep/SuperMine, Mainland 1000) get no factor. */
export const PRESTIGE_GAIN_FACTORS: Record<number, number[]> = {"1":[1,10,20,30,45,60,145],"2":[3,12,28,42,63,90,154],"3":[4,14,33,52,76,80,150],"4":[6,17,38,57,84,120,158],"5":[8,24,48,70,100,140,162],"6":[1,4,20,30,45,60,145],"7":[3,8,28,42,63,90,154],"8":[6,12,33,52,76,80,150],"9":[10,17,38,57,84,120,158],"10":[14,24,48,70,100,140,162],"11":[1,4,20,30,45,60,115],"12":[3,8,28,42,63,80,120],"13":[6,12,33,52,76,90,124],"14":[10,17,38,57,84,105,127],"15":[14,24,48,70,100,110,130],"16":[1,4,20,30,45,60,115],"17":[3,8,28,42,63,80,120],"18":[6,12,33,52,76,90,124],"19":[10,17,38,57,84,105,127],"20":[14,24,48,70,100,110,130],"21":[1,4,20,30,45,60,115],"22":[3,8,28,42,63,80,120],"23":[6,12,33,52,76,90,124],"24":[10,17,38,57,84,105,127],"25":[14,24,48,70,100,110,130],"26":[1,4,20,30,45,60,115],"27":[3,8,28,42,63,80,120],"28":[6,12,33,52,76,90,124],"29":[10,17,38,57,84,105,127],"30":[14,24,48,70,100,110,130],"31":[1,4,20,30,45,60,115],"32":[3,8,28,42,63,80,120],"33":[6,12,33,52,76,90,124],"34":[10,17,38,57,84,105,127],"35":[14,24,48,70,100,110,130],"36":[1,4,20,30,45,60,115],"37":[3,8,28,42,63,80,120],"38":[6,12,33,52,76,90,124],"39":[10,17,38,57,84,105,127],"40":[14,24,48,70,100,110,130],"5001":[1,4,20,30,45,60,120,150],"5002":[5,7,25,35,51,68,129,155],"5003":[6,10,30,40,57,76,138,160],"5004":[10,13,35,45,63,84,147,165],"5005":[14,16,40,50,69,92,156,170],"5006":[1,4,20,30,45,60,120,150],"5007":[5,7,25,35,51,68,129,155],"5008":[6,10,30,40,57,76,138,160],"5009":[10,13,35,45,63,84,147,165],"5010":[14,16,40,50,69,92,156,170],"5011":[1,4,20,30,45,60,120,150],"5012":[5,7,25,35,51,68,129,155],"5013":[6,10,30,40,57,76,138,160],"5014":[10,13,35,45,63,84,147,165],"5015":[14,16,40,50,69,92,156,170],"5016":[1,4,20,30,45,60,120,150],"5017":[5,7,25,35,51,68,129,155],"5018":[6,10,30,40,57,76,138,160],"5019":[10,13,35,45,63,84,147,165],"5020":[14,16,40,50,69,92,156,170]};

// ------------------------------------------------------------------- math

/** [m, e] -> m x 10^e (may overflow to Infinity past ~1e308, like the game). */
export function bigPairValue(pair: BigPair): number {
  return pair[0] * 10 ** pair[1];
}

/** Balancing config for a save mine number, or null when not covered. */
export function balancingConfigForMine(mineNumber: number | null): MineBalancingConfig | null {
  if (mineNumber == null || !Number.isFinite(mineNumber)) return null;
  const key = MINE_BALANCING_BY_MINE[mineNumber];
  return key ? MINE_BALANCING_CONFIGS[key] ?? null : null;
}

function blockIndex(starts: number[], level: number): number {
  let idx = 0;
  for (let i = 0; i < starts.length; i++) if (starts[i] <= level) idx = i;
  return idx;
}

/** base x product of the block increase for each level-up from 1 to `level`,
 * using the block of the level being left. */
function growBlocks(base: number, starts: number[], increases: number[], level: number): number {
  let value = base;
  for (let n = 1; n < level; n++) value *= increases[blockIndex(starts, n)] ?? 1;
  return value;
}

interface SegmentLike { level: number }
function growSegments<S extends SegmentLike>(
  base: number,
  segments: S[],
  level: number,
  pick: (segment: S) => number,
): number {
  let value = base;
  for (let n = 1; n < level; n++) {
    let segment = segments[0];
    for (const candidate of segments) if (candidate.level <= n) segment = candidate;
    value *= pick(segment);
  }
  return value;
}

function milestoneProduct<M extends { level: number }>(milestones: M[], level: number, pick: (m: M) => number): number {
  let product = 1;
  for (const milestone of milestones) if (milestone.level <= level) product *= pick(milestone);
  return product;
}

/** Workers on one shaft at a level: starters + milestone increments. */
export function shaftWorkersAt(config: MineBalancingConfig, level: number): number {
  let workers = config.shaftGlobals.starterWorkers;
  for (const milestone of config.shaftMilestones) {
    if (milestone.level <= level) workers += milestone.workerIncrement;
  }
  return workers;
}

/** One shaft's base gain at (tier, level): pure block growth of the tier
 * base. This is the piece that checks out exactly against the config's
 * own compounding (5 @L1, 33.6 @L21, ~1.59e4 @L101, ~1.38e7 @L201). */
export function shaftTierBaseGain(config: MineBalancingConfig, tier: number, level: number): number {
  const row = config.tiers.find((t) => t.tier === tier) ?? config.tiers[config.tiers.length - 1];
  if (!row || level <= 0) return 0;
  return growBlocks(bigPairValue(row.gain), row.levels, row.gainInc, level);
}

/** One shaft's cash gain per second at (tier, level): base gain x milestone
 * GainRate jumps x its workers (dump.cs: GainPerSecondPerWorker x
 * NumberOfWorkers). The milestone/worker composition is the game's class
 * shape; the block growth underneath is the exactly-validated part. */
export function shaftGainPerSecond(config: MineBalancingConfig, tier: number, level: number): number {
  if (level <= 0) return 0;
  const jumps = milestoneProduct(config.shaftMilestones, level, (m) => m.gainRate);
  return shaftTierBaseGain(config, tier, level) * jumps * shaftWorkersAt(config, level);
}

/** Elevator throughput (loading rate) at a level. */
export function elevatorPerSecond(config: MineBalancingConfig, level: number): number {
  if (level <= 0) return 0;
  const grown = growSegments(bigPairValue(config.elevatorBase.loadingPerSecond), config.elevatorSegments, level, (s) => s.loadingPerSecond);
  return grown * milestoneProduct(config.elevatorMilestones, level, (m) => m.loadingPerSecond);
}

/** Warehouse workers at a level: base crew + milestone WorkerIncrements. */
export function warehouseWorkersAt(config: MineBalancingConfig, level: number): number {
  let workers = config.warehouseBase.workers;
  for (const milestone of config.warehouseMilestones) {
    if (milestone.level <= level) workers += milestone.workerIncrement ?? 0;
  }
  return workers;
}

/** Warehouse throughput at a level: loading rate x workers. The loading
 * rate alone (an earlier build) ignores the crew the milestones hire and
 * undershoots the game's warehouse by the crew size. */
export function warehousePerSecond(config: MineBalancingConfig, level: number): number {
  if (level <= 0) return 0;
  const grown = growSegments(bigPairValue(config.warehouseBase.loadingPerSecond), config.warehouseSegments, level, (s) => s.loadingPerSecond);
  return grown * milestoneProduct(config.warehouseMilestones, level, (m) => m.loadingPerSecond) * warehouseWorkersAt(config, level);
}

export type SlowLeg = "shaft" | "elevator" | "warehouse";

export interface DerivedMineRates {
  shaftPerSecond: number;
  elevatorPerSecond: number;
  warehousePerSecond: number;
  /** Sustainable mine output: the slowest leg sets the pace. */
  outputPerSecond: number;
  slowestLeg: SlowLeg;
  /** The prestige factor folded into the legs above (1 = none applied). */
  prestigeFactor: number;
}

/**
 * The game's prestige multiplier for a mine at a prestige count
 * (RemoteMineGlobal.PrestigeModifiers.GeneralGainFactor - it scales ALL
 * of the mine's production, every leg). Mines with no table rows
 * (Everdeep/SuperMine 2500/6000, Mainland 1000) and unknown counts get 1.
 * Prestige counts past the table clamp to the last row.
 */
export function prestigeGainFactor(mineNumber: number | null, prestigeCount: number | null): number {
  if (mineNumber == null || prestigeCount == null || !Number.isFinite(prestigeCount)) return 1;
  const rows = PRESTIGE_GAIN_FACTORS[mineNumber];
  if (!rows || rows.length === 0) return 1;
  const idx = Math.max(0, Math.min(Math.floor(prestigeCount), rows.length - 1));
  return rows[idx] ?? 1;
}

/**
 * Derive a mine's leg speeds from its save levels. When the save's
 * prestige count is passed, every leg is scaled by the game's prestige
 * gain factor for that mine (see prestigeGainFactor). Still NOT in
 * these numbers: the player's research skill tree, collectibles,
 * artifacts, and assigned-manager passives/equipment - those live in
 * the save (SkillSavegames, collectible/artifact savegames, manager
 * assignments), not in the balancing tables.
 * `shaftLevels` is the save's CorridorLevels order - shaft order, so
 * element i is Mineshaft (i + 1) and works tier (i + 1). (Game check:
 * Mineshaft 2 / Mineshaft 1 output ratio is exactly the tier-2/tier-1
 * base ratio, 50x, at equal levels.) Returns null when the mine has no
 * balancing config or no levels to work with.
 */
export function deriveMineRates(
  mineNumber: number | null,
  shaftLevels: number[],
  elevatorLevel: number | null,
  warehouseLevel: number | null,
  prestigeCount: number | null = null,
): DerivedMineRates | null {
  const config = balancingConfigForMine(mineNumber);
  if (!config) return null;
  if (shaftLevels.length === 0 && elevatorLevel == null && warehouseLevel == null) return null;
  const prestigeFactor = prestigeGainFactor(mineNumber, prestigeCount);
  let shaftPerSecond = 0;
  shaftLevels.forEach((level, i) => {
    shaftPerSecond += shaftGainPerSecond(config, i + 1, level);
  });
  const elevator = elevatorLevel != null ? elevatorPerSecond(config, elevatorLevel) : 0;
  const warehouse = warehouseLevel != null ? warehousePerSecond(config, warehouseLevel) : 0;
  const legs: Array<[SlowLeg, number]> = [
    ["shaft", shaftPerSecond * prestigeFactor],
    ["elevator", elevator * prestigeFactor],
    ["warehouse", warehouse * prestigeFactor],
  ];
  const slowest = legs.reduce((a, b) => (b[1] < a[1] ? b : a));
  return {
    shaftPerSecond: legs[0][1],
    elevatorPerSecond: legs[1][1],
    warehousePerSecond: legs[2][1],
    outputPerSecond: slowest[1],
    slowestLeg: slowest[0],
    prestigeFactor,
  };
}
