#!/usr/bin/env python3
"""Generate the mine-balancing TS modules from the game's REAL remote
balancing config (RemoteMineBalancing / Kolibri "Zodiac" LiveTune payload),
trapped from the ubuntumac emulator POC on 2026-10-08 (APK deep-dive dig #3).

Emits four files: frontend/src/lib/mine-balancing.ts (types, math, and the
assembled public tables) plus mine-balancing-data-1..3.ts (the raw segment /
config tables in roughly equal thirds, each < ~90 KB so GitHub pushes stay
under the per-argument size limit).

Source: ~/workspace/research_notes/remote-mine-balancing-2026-10-08/
  raw-zodiac-configuration-2026-10-08-fresh.json
(game 5.64.1, config synced 2026-10-09T00:02:07Z; the ">=5.63.0"
RemoteMineSelection is the one that applies to the current client.)

Usage:
  python3 tools/generate-mine-balancing.py [fresh-json] [out-ts]
(out-ts defaults to frontend/src/lib/mine-balancing.ts; the three data
files are written next to it.)

Nothing in the output is invented: values are copied from the game config,
only re-shaped (big numbers {m,e} become [m,e] pairs). Re-pull + re-run
after game updates (boot the POC, launch the game, adb pull
Zodiac/configuration/data.json).

Model semantics (validated in the calibration work, see the header of the
generated file): inside a level block, each level-up multiplies by that
block's increase factor, using the block of the level being LEFT; milestone
multipliers apply once when their level is reached.
"""
import json
import pathlib
import sys

SRC = pathlib.Path(
    sys.argv[1]
    if len(sys.argv) > 1
    else pathlib.Path.home()
    / "workspace/research_notes/remote-mine-balancing-2026-10-08/raw-zodiac-configuration-2026-10-08-fresh.json"
)
OUT = pathlib.Path(
    sys.argv[2] if len(sys.argv) > 2 else "frontend/src/lib/mine-balancing.ts"
)

# Save-space mine number for SuperMine/Everdeep content. The save calls it
# 6000; the remote selection keys the same content as 2500.
SAVE_ID_ALIASES = {6000: 2500}


def big(value):
    return [value["m"], value["e"]]


def load_entities():
    data = json.loads(SRC.read_text())
    selection = None
    configs = {}
    for entity in data:
        content = entity.get("content") or {}
        if entity.get("clientVersionRange") != ">=5.63.0":
            continue
        if content.get("key") == "RemoteMineSelection":
            selection = content["value"]["Mappings"]
        elif content.get("key") == "RemoteMineConfig":
            configs[entity["id"]] = content["value"]
    return selection, configs


def wanted_mine_ids():
    ids = set(range(1, 41)) | {1000} | set(range(5001, 5021)) | {2500}
    return ids


def shape_config(cfg):
    tiers = []
    for t in cfg["Mineshafts"]:
        tiers.append(
            {
                "tier": t["Tier"],
                "cost": big(t["BaseCostBig"]),
                "gain": big(t["BaseGainBig"]),
                "capacity": big(t["BaseCapacityBig"]),
                "levels": t["Levels"],
                "costInc": t["CostIncreases"],
                "gainInc": t["GainIncreases"],
                "capInc": t["CapacityIncreases"],
            }
        )
    elev = cfg["ElevatorBaseValues"]
    wh = cfg["WarehouseBaseValues"]
    return {
        "tiers": tiers,
        "shaftGlobals": {
            "starterSpeed": cfg["MineshaftsGlobalBaseValues"]["StarterSpeed"],
            "starterWorkers": cfg["MineshaftsGlobalBaseValues"]["StarterWorkers"],
            "maxLevel": cfg["MineshaftsGlobalBaseValues"]["MaxLevel"],
        },
        "shaftSpeedInc": [
            {"level": s["Level"], "speed": s["Speed"]}
            for s in cfg["MineshaftsGlobalSpeedIncreases"]
        ],
        "shaftMilestones": [
            {
                "level": m["Level"],
                "workerIncrement": m["WorkerIncrement"],
                "gainRate": m["GainRate"],
                "capacity": m["Capacity"],
            }
            for m in cfg["MineshaftsMilestones"]
        ],
        "elevatorBase": {
            "cost": big(elev["CostBig"]),
            "speed": elev["Speed"],
            "capacity": big(elev["CapacityBig"]),
            "loadingPerSecond": big(elev["LoadingPerSecondBig"]),
        },
        "elevatorSegments": [
            {
                "level": s["Level"],
                "cost": s["Cost"],
                "speed": s["Speed"],
                "capacity": s["Capacity"],
                "loadingPerSecond": s["LoadingPerSecond"],
            }
            for s in cfg["ElevatorSegments"]
        ],
        "elevatorMilestones": [
            {
                "level": m["Level"],
                "capacity": m["Capacity"],
                "loadingPerSecond": m["LoadingPerSecond"],
            }
            for m in cfg["ElevatorMilestones"]
        ],
        "warehouseBase": {
            "cost": big(wh["CostBig"]),
            "workers": wh["Workers"],
            "workerSpeed": wh["WorkerSpeed"],
            "workerCapacity": big(wh["WorkerCapacityBig"]),
            "loadingPerSecond": big(wh["LoadingPerSecondBig"]),
        },
        "warehouseSegments": [
            {
                "level": s["Level"],
                "cost": s["Cost"],
                "walkingSpeed": s["WalkingSpeed"],
                "capacity": s["Capacity"],
                "loadingPerSecond": s["LoadingPerSecond"],
            }
            for s in cfg["WarehouseSegments"]
        ],
        "warehouseMilestones": [
            {
                "level": m["Level"],
                "workerIncrement": m.get("WorkerIncrement", 0),
                "capacity": m["Capacity"],
                "loadingPerSecond": m["LoadingPerSecond"],
            }
            for m in cfg["WarehouseMilestones"]
        ],
        "barriers": [
            {
                "afterTier": b["AfterTier"],
                "cost": big(b["CostRoundedBigDouble"]),
                "breakTimeInSeconds": b["BreakTimeInSeconds"],
            }
            for b in cfg["Barriers"]
        ],
        "levelCaps": {
            "elevator": [
                {"from": c["From"], "to": c["To"]} for c in cfg["ElevatorLevelCaps"]
            ],
            "warehouse": [
                {"from": c["From"], "to": c["To"]} for c in cfg["WarehouseLevelCaps"]
            ],
        },
    }


INTERN_FIELDS = (
    "shaftSpeedInc",
    "shaftMilestones",
    "elevatorSegments",
    "elevatorMilestones",
    "warehouseSegments",
    "warehouseMilestones",
)

# TS type for each interned field's segment tables (named types live in the
# generated mine-balancing.ts TYPES block).
FIELD_TYPES = {
    "shaftSpeedInc": "Array<{ level: number; speed: number }>",
    "shaftMilestones": "BalShaftMilestone[]",
    "elevatorSegments": "BalElevatorSegment[]",
    "elevatorMilestones": "BalLegMilestone[]",
    "warehouseSegments": "BalWarehouseSegment[]",
    "warehouseMilestones": "BalLegMilestone[]",
}

# How many data files the tables are split across (plus the main module).
NUM_PARTS = 3


def main():
    selection, raw_configs = load_entities()
    if selection is None:
        raise SystemExit("no >=5.63.0 RemoteMineSelection found")
    shaped = {cid: shape_config(cfg) for cid, cfg in raw_configs.items()}

    wanted = wanted_mine_ids()
    mine_to_config = {}
    used = set()
    for mapping in selection:
        for mine_id in mapping["MineIds"]:
            if mine_id in wanted:
                mine_to_config[mine_id] = mapping["ConfigId"]
                used.add(mapping["ConfigId"])
    for save_id, game_id in SAVE_ID_ALIASES.items():
        if game_id in mine_to_config:
            mine_to_config[save_id] = mine_to_config[game_id]

    # Intern repeated arrays (segments/milestones are near-identical across
    # configs) so the emitted files stay honest but small.
    interned = {}
    intern_kind = {}

    def intern(value, field):
        key = json.dumps(value, separators=(",", ":"), sort_keys=True)
        if len(key) < 120:
            return value
        if key not in interned:
            interned[key] = f"S{len(interned)}"
            intern_kind[interned[key]] = FIELD_TYPES[field]
        return {"__ref": interned[key]}

    def emit(value):
        if isinstance(value, dict) and set(value.keys()) == {"__ref"}:
            return value["__ref"]
        return json.dumps(value, separators=(",", ":"))

    out_configs = {}
    config_refs = {}
    for cid in sorted(used):
        cfg = dict(shaped[cid])
        refs = []
        for field in INTERN_FIELDS:
            value = intern(cfg[field], field)
            cfg[field] = value
            if isinstance(value, dict) and "__ref" in value:
                refs.append(value["__ref"])
        out_configs[cid[:8]] = cfg
        config_refs[cid[:8]] = refs

    def config_block(key):
        fields = ",\n".join(
            f"    {field}: {emit(value)}" for field, value in out_configs[key].items()
        )
        return f"  {json.dumps(key)}: {{\n{fields}\n  }}"

    by_mine = {str(m): c[:8] for m, c in sorted(mine_to_config.items())}
    by_mine_ts = json.dumps(by_mine, separators=(",", ":"))

    # --- split the tables across three data files (< ~90 KB each so GitHub
    # pushes fit the per-argument limit), layered so imports only ever flow
    # from a later part back to part 1: segment tables shared by more than
    # one config live in part 1; every other segment table travels with the
    # config chunk that uses it; config chunks are packed largest-first
    # into the lightest part. mine-balancing.ts assembles the parts.
    by_json = {v: k for k, v in interned.items()}
    s_decl = {
        name: f"export const {name}: {intern_kind[name]} = {by_json[name]};"
        for name in interned.values()
    }

    refs_by_config = {key: set(refs) for key, refs in config_refs.items()}
    ref_counts = {}
    for refs in refs_by_config.values():
        for name in refs:
            ref_counts[name] = ref_counts.get(name, 0) + 1
    shared = {name for name, count in ref_counts.items() if count > 1}

    def chunk_bytes(key):
        total = len(config_block(key)) + 2
        for name in refs_by_config[key]:
            if name not in shared:
                total += len(s_decl[name]) + 1
        return total

    parts = [[] for _ in range(NUM_PARTS)]
    part_bytes = [0] * NUM_PARTS
    for key in sorted(out_configs, key=lambda k: (-chunk_bytes(k), k)):
        lightest = min(range(NUM_PARTS), key=lambda i: part_bytes[i])
        parts[lightest].append(key)
        part_bytes[lightest] += chunk_bytes(key)

    s_home = {name: 0 for name in shared}
    for idx, keys in enumerate(parts):
        for key in keys:
            for name in refs_by_config[key]:
                if name not in shared:
                    s_home[name] = idx

    stem = OUT.name[:-3] if OUT.name.endswith(".ts") else OUT.stem
    for idx, keys in enumerate(parts):
        local_s = sorted(
            (name for name, home in s_home.items() if home == idx),
            key=lambda n: int(n[1:]),
        )
        needed_shared = sorted(
            {
                name
                for key in keys
                for name in refs_by_config[key]
                if name in shared and idx != 0
            },
            key=lambda n: int(n[1:]),
        )
        type_imports = {"MineBalancingConfig"}
        for name in local_s:
            kind = intern_kind[name]
            if kind.endswith("[]"):
                type_imports.add(kind[:-2])
        lines = [
            HEADER.rstrip("\n"),
            "",
            f"// Generated tables, part {idx + 1} of {NUM_PARTS}: raw segment/config",
            "// tables. mine-balancing.ts assembles and re-exports the whole.",
            "",
            f'import type {{ {", ".join(sorted(type_imports))} }} from "./{stem}";',
        ]
        if needed_shared:
            lines.append(f'import {{ {", ".join(needed_shared)} }} from "./{stem}-data-1";')
        lines.append("")
        lines.extend(s_decl[name] for name in local_s)
        lines.append("")
        body = ",\n".join(config_block(key) for key in sorted(keys))
        lines.append(
            f"export const CONFIGS_PART_{idx + 1}: Record<string, MineBalancingConfig> = {{\n{body}\n}};"
        )
        data_out = OUT.with_name(f"{stem}-data-{idx + 1}.ts")
        data_out.write_text("\n".join(lines) + "\n")
        print(f"wrote {data_out} ({data_out.stat().st_size} bytes)")

    imports = "\n".join(
        f'import {{ CONFIGS_PART_{i + 1} }} from "./{stem}-data-{i + 1}";'
        for i in range(NUM_PARTS)
    )
    merged = ", ".join(f"...CONFIGS_PART_{i + 1}" for i in range(NUM_PARTS))
    OUT.write_text(
        HEADER + TYPES + f"""
// ------------------------------------------------------------ game tables
// Split across ./mine-balancing-data-1..3.ts (each < ~90 KB) so GitHub
// pushes stay under the per-file argument limit; assembled here.

{imports}

export const MINE_BALANCING_CONFIGS: Record<string, MineBalancingConfig> = {{ {merged} }};

/** Save mine number -> balancing config key. Save mine 6000 (Everdeep) is
 * keyed 2500 in the game's own selection; both are included. */
export const MINE_BALANCING_BY_MINE: Record<number, string> = {by_mine_ts};
""" + MATH
    )
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes), configs: {sorted(used)}")


HEADER = """/**
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
 * - HONEST GAP: the game's leg totals also carry player progression
 *   (research skill tree, artifacts, collectibles) and regular-manager
 *   multipliers that do not live in these tables or in the save's leg
 *   levels. For mine 15 every leg lands the same ~1.8e4-2.9e4 BELOW the
 *   game's own numbers (shaft 1, elevator, warehouse once workers are
 *   counted), so treat these as true relative leg speeds and bottleneck
 *   shape - not as a promise of the final idle number. The residual band
 *   is asserted in mine-balancing.test.ts; it must not silently shrink.
 */
"""

TYPES = """
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
"""

MATH = """
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
}

/**
 * Derive a mine's leg speeds from its save levels.
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
): DerivedMineRates | null {
  const config = balancingConfigForMine(mineNumber);
  if (!config) return null;
  if (shaftLevels.length === 0 && elevatorLevel == null && warehouseLevel == null) return null;
  let shaftPerSecond = 0;
  shaftLevels.forEach((level, i) => {
    shaftPerSecond += shaftGainPerSecond(config, i + 1, level);
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
"""


if __name__ == "__main__":
    main()
