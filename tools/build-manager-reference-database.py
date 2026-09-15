#!/usr/bin/env python3
"""Build the checked-in manager reference database from sm-data and sm-actives.

The two input files are captured reference snapshots. This tool validates their
identity sets and joins them by the stable manager slug before emitting a typed
TypeScript module for the frontend. APK-derived catalog rows remain preferred
when the two sources overlap; this database supplies verified names and a
complete active-table fallback for partial or legacy package rows.

Usage:
  python3 tools/build-manager-reference-database.py \
    /path/to/sm-data /path/to/sm-actives

The defaults use the existing ignored validation snapshots under tools/data.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SM_DATA = ROOT / "tools/data/idleminers-sm-data.json"
DEFAULT_SM_ACTIVES = ROOT / "tools/data/idleminers-sm-actives.json"
DEFAULT_OUTPUT = ROOT / "frontend/src/lib/manager-reference-database.ts"


def read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise ValueError(f"Reference file does not exist: {path}") from error
    except json.JSONDecodeError as error:
        raise ValueError(f"Reference file is not valid JSON: {path}: {error}") from error


def require_number(value: Any, label: str) -> None:
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise ValueError(f"{label} must be numeric")


def validate_manager_data(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list) or not value:
        raise ValueError("sm-data must be a non-empty array")
    managers: list[dict[str, Any]] = []
    ids: set[str] = set()
    game_ids: set[int] = set()
    for index, manager in enumerate(value):
        if not isinstance(manager, dict):
            raise ValueError(f"sm-data[{index}] must be an object")
        manager_id = manager.get("id")
        game_id = manager.get("gameId")
        name = manager.get("name")
        if not isinstance(manager_id, str) or not manager_id:
            raise ValueError(f"sm-data[{index}].id must be a non-empty string")
        if manager_id in ids:
            raise ValueError(f"Duplicate manager slug in sm-data: {manager_id}")
        if not isinstance(game_id, int) or isinstance(game_id, bool):
            raise ValueError(f"sm-data[{index}].gameId must be an integer")
        if game_id in game_ids:
            raise ValueError(f"Duplicate manager gameId in sm-data: {game_id}")
        if not isinstance(name, str) or not name:
            raise ValueError(f"sm-data[{index}].name must be a non-empty string")
        for field in ("activeL1", "activeL100", "cooldown", "duration"):
            require_number(manager.get(field), f"sm-data[{index}].{field}")
        ids.add(manager_id)
        game_ids.add(game_id)
        managers.append(manager)
    return managers


def validate_active_data(value: Any, manager_ids: set[str]) -> dict[str, dict[str, Any]]:
    if not isinstance(value, dict) or not value:
        raise ValueError("sm-actives must be a non-empty object")
    active_ids = set(value)
    missing = sorted(manager_ids - active_ids)
    extra = sorted(active_ids - manager_ids)
    if missing or extra:
        raise ValueError(f"sm-data/sm-actives identity mismatch: missing={missing}, extra={extra}")

    validated: dict[str, dict[str, Any]] = {}
    for manager_id, active in value.items():
        if not isinstance(active, dict):
            raise ValueError(f"sm-actives[{manager_id}] must be an object")
        for field in ("type", "scaleType"):
            if not isinstance(active.get(field), int) or isinstance(active.get(field), bool):
                raise ValueError(f"sm-actives[{manager_id}].{field} must be an integer")
        values = active.get("values")
        if not isinstance(values, list) or not values:
            raise ValueError(f"sm-actives[{manager_id}].values must be a non-empty array")
        for level, row in enumerate(values, start=1):
            if row is None:
                continue
            if not isinstance(row, list) or len(row) != 6:
                raise ValueError(f"sm-actives[{manager_id}].values[{level}] must have six rank values or be null")
            for rank, number in enumerate(row):
                if number is not None:
                    require_number(number, f"sm-actives[{manager_id}].values[{level}][{rank}]")
        base_raw = active.get("baseRaw")
        if not isinstance(base_raw, list) or len(base_raw) != len(values):
            raise ValueError(f"sm-actives[{manager_id}].baseRaw must align with values")
        for index, number in enumerate(base_raw):
            if number is not None:
                require_number(number, f"sm-actives[{manager_id}].baseRaw[{index}]")
        rank_inc = active.get("rankInc")
        if not isinstance(rank_inc, list) or len(rank_inc) != 6:
            raise ValueError(f"sm-actives[{manager_id}].rankInc must contain six values")
        for rank, number in enumerate(rank_inc):
            require_number(number, f"sm-actives[{manager_id}].rankInc[{rank}]")
        validated[manager_id] = active
    return validated


def build_database(sm_data_path: Path, sm_actives_path: Path, output_path: Path) -> None:
    managers = validate_manager_data(read_json(sm_data_path))
    manager_ids = {manager["id"] for manager in managers}
    actives = validate_active_data(read_json(sm_actives_path), manager_ids)
    joined = [
        {
            **manager,
            "activeTable": actives[manager["id"]],
        }
        for manager in managers
    ]

    header = """/**
 * Generated manager reference database.
 *
 * Source snapshots: idle-miners.com sm-data + sm-actives. Do not edit this
 * file by hand; regenerate it with tools/build-manager-reference-database.py.
 */

export type ReferenceElement = { element: string; effectiveness: string; rankReq: number };
export type ReferencePassive = { type: string; value: number | null; promoReq: number };
export type ReferenceActiveTable = {
  type: number;
  scaleType: number;
  values: Array<Array<number | null> | null>;
  baseRaw: Array<number | null>;
  rankInc: number[];
  placeholders?: unknown[] | null;
};

export type ManagerReferenceRecord = {
  id: string;
  name: string;
  rarity: string;
  area: string;
  elements: ReferenceElement[];
  passives: ReferencePassive[];
  sprite: string;
  gameId: number;
  activeL1: number;
  activeL100: number;
  cooldown: number;
  duration: number;
  descriptionLong: string;
  descriptionShort: string;
  placeholderIndices: number[];
  legacyGameIds?: number[];
  maxLevel?: number;
  rental?: boolean;
  activeTable: ReferenceActiveTable;
};

export const MANAGER_REFERENCE_DATABASE: ManagerReferenceRecord[] = """
    output = header + json.dumps(joined, ensure_ascii=False, indent=2) + ";\n"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(output, encoding="utf-8")
    print(json.dumps({
        "output": str(output_path),
        "managers": len(managers),
        "activeTables": len(actives),
        "levels": sum(len(active.get("values", [])) for active in actives.values()),
    }, sort_keys=True))


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the frontend manager reference database")
    parser.add_argument("sm_data", nargs="?", type=Path, default=DEFAULT_SM_DATA)
    parser.add_argument("sm_actives", nargs="?", type=Path, default=DEFAULT_SM_ACTIVES)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    build_database(args.sm_data.resolve(), args.sm_actives.resolve(), args.output.resolve())


if __name__ == "__main__":
    main()
