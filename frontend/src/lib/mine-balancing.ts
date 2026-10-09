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
 * MODEL SEMANTICS (pinned by calibration against the game's config and a
 * real save, 2026-10-08):
 * - Inside a level block, each level-up multiplies by that block's increase
 *   factor, using the block of the level being LEFT. (Tier-1 shaft gain:
 *   5 @L1, 33.6 @L21, ~1.59e4 @L101, ~1.38e7 @L201, ~1.7e37 @L800 - the
 *   config's own compounding checks out exactly.)
 * - Milestone multipliers apply once, when their level is reached.
 * - Shaft gain per shaft = block growth x milestone GainRate x workers
 *   (the growth underneath is the exactly-checked part; the milestone and
 *   worker composition follows the game's own class shape).
 * - HONEST GAP: the game's idle cash also carries player progression
 *   multipliers (research skill tree, artifacts, collectibles, manager
 *   passives) that do not live in these tables or in the save's leg
 *   levels. Against a real save the raw legs come out ~400-3700x BELOW
 *   the game's idle (mainland), so treat these as the true leg speeds
 *   and bottleneck shape - not as a promise of the final idle number.
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

/** Warehouse throughput (loading rate) at a level. */
export function warehousePerSecond(config: MineBalancingConfig, level: number): number {
  if (level <= 0) return 0;
  const grown = growSegments(bigPairValue(config.warehouseBase.loadingPerSecond), config.warehouseSegments, level, (s) => s.loadingPerSecond);
  return grown * milestoneProduct(config.warehouseMilestones, level, (m) => m.loadingPerSecond);
}

export type SlowLeg = "shaft" | "elevator" | "warehouse";

export interface DerivedMineRates {
  shaftPerSecond: number;
  elevatorPerSecond: number;
  warehousePerSecond: number;
  /** Sustainable mine output: the slowest leg sets the pace. */
  outputPerSecond: number;
  slowestLeg: SlowLeg;
}

/**
 * Derive a mine's leg speeds from its save levels.
 * `shaftLevelsDeepestFirst` is the save's CorridorLevels order (deepest
 * shaft first): element i works tier (count - i). Returns null when the
 * mine has no balancing config or no levels to work with.
 */
export function deriveMineRates(
  mineNumber: number | null,
  shaftLevelsDeepestFirst: number[],
  elevatorLevel: number | null,
  warehouseLevel: number | null,
): DerivedMineRates | null {
  const config = balancingConfigForMine(mineNumber);
  if (!config) return null;
  if (shaftLevelsDeepestFirst.length === 0 && elevatorLevel == null && warehouseLevel == null) return null;
  const count = shaftLevelsDeepestFirst.length;
  let shaftPerSecond = 0;
  shaftLevelsDeepestFirst.forEach((level, i) => {
    shaftPerSecond += shaftGainPerSecond(config, count - i, level);
  });
  const elevator = elevatorLevel != null ? elevatorPerSecond(config, elevatorLevel) : 0;
  const warehouse = warehouseLevel != null ? warehousePerSecond(config, warehouseLevel) : 0;
  const legs: Array<[SlowLeg, number]> = [
    ["shaft", shaftPerSecond],
    ["elevator", elevator],
    ["warehouse", warehouse],
  ];
  const slowest = legs.reduce((a, b) => (b[1] < a[1] ? b : a));
  return {
    shaftPerSecond,
    elevatorPerSecond: elevator,
    warehousePerSecond: warehouse,
    outputPerSecond: slowest[1],
    slowestLeg: slowest[0],
  };
}
