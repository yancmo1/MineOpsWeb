#!/usr/bin/env python3
"""Create a new immutable catalog candidate with elemental recipes projected.

This repairs packages produced before the recipe join was added. The source
package remains untouched; the output receives a new release identity and a
fresh manifest hash so it can go through the normal review/publication gate.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from pathlib import Path
from typing import Any

OPS = Path(__file__).resolve().parents[1] / "ops"
import sys

sys.path.insert(0, str(OPS))
from strategy_package import project_elemental_recipes  # noqa: E402


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def load_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"Expected a JSON object in {path}")
    return value


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.write_text(canonical_json(value), encoding="utf-8")


def rewrite_identity(value: dict[str, Any], release_id: str) -> dict[str, Any]:
    if "catalogVersion" in value:
        value["catalogVersion"] = release_id
    if "releaseId" in value:
        value["releaseId"] = release_id
    return value


def _append_projection_check(report: dict[str, Any], coverage: dict[str, int]) -> None:
    checks = report.get("checks")
    if not isinstance(checks, list):
        checks = []
        report["checks"] = checks
    check = {
        "code": "ELEMENTAL_RECIPE_PROJECTION",
        "severity": "info",
        "passed": coverage["unresolvedManagers"] == 0,
        "message": f"Projected {coverage['projectedManagers']}/{coverage['sourceManagers']} recipe-bearing manager configs into catalog-core.",
    }
    checks[:] = [item for item in checks if not isinstance(item, dict) or item.get("code") != check["code"]]
    checks.append(check)


def repair_package(source_dir: Path | str, output_dir: Path | str, release_id: str | None = None) -> tuple[Path, dict[str, int]]:
    source = Path(source_dir).resolve()
    output = Path(output_dir).resolve()
    if output.exists():
        raise FileExistsError(f"Output package already exists: {output}")

    manifest = load_json(source / "manifest.json")
    if manifest.get("manifestSchemaVersion") != "2.0.0":
        raise ValueError("Recipe repair requires a v2 multi-artifact package")
    source_release = manifest.get("releaseId")
    if not isinstance(source_release, str) or not source_release:
        raise ValueError("Source manifest has no releaseId")
    target_release = release_id or f"{source_release}.elemental-recipes-v1"
    if target_release == source_release:
        raise ValueError("Recipe repair must write a new release identity")

    config_path = source / "strategy-configs.json"
    core_path = source / "catalog-core.json"
    if not config_path.is_file() or not core_path.is_file():
        raise FileNotFoundError("Source package must contain catalog-core.json and strategy-configs.json")
    configs = load_json(config_path)
    if configs.get("releaseId") != source_release:
        raise ValueError("strategy-configs.json releaseId does not match the source manifest")
    core = load_json(core_path)
    if core.get("releaseId") != source_release:
        raise ValueError("catalog-core.json releaseId does not match the source manifest")

    coverage = project_elemental_recipes(core, configs)
    if coverage["sourceManagers"] == 0:
        raise ValueError("No recipe-bearing SuperManagerElementalConfig records were found")

    shutil.copytree(source, output)
    rewrite_identity(core, target_release)
    write_json(output / "catalog-core.json", core)

    for entry in manifest.get("artifacts", []):
        filename = entry.get("filename") if isinstance(entry, dict) else None
        if not isinstance(filename, str) or filename in {"catalog-core.json", "validation-report.json", "manifest.json"}:
            continue
        path = output / str(entry.get("path", filename))
        if path.is_file() and path.suffix == ".json":
            artifact = load_json(path)
            rewrite_identity(artifact, target_release)
            write_json(path, artifact)

    validation_path = output / "validation-report.json"
    validation = load_json(validation_path)
    rewrite_identity(validation, target_release)
    _append_projection_check(validation, coverage)
    write_json(validation_path, validation)

    final_manifest = load_json(output / "manifest.json")
    rewrite_identity(final_manifest, target_release)
    final_manifest["counts"] = {
        **(final_manifest.get("counts") if isinstance(final_manifest.get("counts"), dict) else {}),
        "managers": len(core.get("managers", [])),
        "mines": len(core.get("mines", [])),
        "equipment": len(core.get("equipment", [])),
        "research": len(core.get("research", [])),
        "collectibles": len(core.get("collectibles", [])),
        "artifacts": len(core.get("artifacts", [])),
    }
    for entry in final_manifest.get("artifacts", []):
        if not isinstance(entry, dict):
            continue
        filename = entry.get("filename")
        relative_path = entry.get("path", filename)
        if not isinstance(filename, str) or not isinstance(relative_path, str):
            raise ValueError("Manifest contains an invalid artifact entry")
        path = output / relative_path
        if not path.is_file():
            raise FileNotFoundError(f"Manifest artifact is missing after copy: {relative_path}")
        content = path.read_bytes()
        entry["sha256"] = hashlib.sha256(content).hexdigest()
        entry["bytes"] = len(content)
    write_json(output / "manifest.json", final_manifest)
    return output, coverage


def main() -> None:
    parser = argparse.ArgumentParser(description="Project APK elemental recipes into a new catalog candidate")
    parser.add_argument("source_dir", type=Path)
    parser.add_argument("output_dir", type=Path)
    parser.add_argument("--release-id")
    args = parser.parse_args()
    output, coverage = repair_package(args.source_dir, args.output_dir, args.release_id)
    print(json.dumps({"output": str(output), **coverage}, sort_keys=True))


if __name__ == "__main__":
    main()
