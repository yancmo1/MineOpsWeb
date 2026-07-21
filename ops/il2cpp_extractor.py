"""
IL2CPP Manager Extractor — Generalized batch extraction from Unity Addressables.

Extracts manager records from configfiles-supermanagers bundle using UnityPy IL2CPP
TypeTree deserialization. Produces managers.json, extraction-report.json,
unresolved-fields.json, and source-evidence.json.

Usage:
    ~/mineops-env/bin/python3 il2cpp_extractor.py <release-dir> [--output-dir <dir>]
"""
from __future__ import annotations

import json
import sys
import re
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Data containers
# ---------------------------------------------------------------------------

@dataclass
class ExtractedField:
    field_name: str
    raw_value: Any
    source_asset: str
    provenance: str  # "direct" | "computed" | "mapped"

@dataclass
class ExtractedManager:
    manager_id: int
    fields: dict[str, ExtractedField]
    assets_found: list[str]
    assets_missing: list[str]
    warnings: list[str]
    raw_asset_data: dict[str, Any] = field(default_factory=dict)

@dataclass
class BatchReport:
    release_id: str
    generated_at: str
    total_managers_discovered: int
    extracted_count: int
    partial_count: int
    failed_count: int
    warnings: list[str]
    manager_ids_extracted: list[int]

# ---------------------------------------------------------------------------
# Known enums (from Il2CppDumper dump.cs)
# ---------------------------------------------------------------------------

RARITY_MAP = {1: "Common", 2: "Rare", 3: "Epic", 4: "Legendary"}
CATEGORY_MAP = {1: "None", 2: "Gems", 3: "Iap", 4: "Event", 5: "ImpossibleMine"}
REGION_MAP = {1: "Corridor", 2: "Ground", 3: "Elevator"}
GENDER_MAP = {0: "Male", 1: "Female"}

def _enum_label(value: int | None, mapping: dict[int, str], name: str) -> str | None:
    if value is None:
        return None
    label = mapping.get(value)
    if label is None:
        return f"Unknown-{name}-{value}"
    return label

# ---------------------------------------------------------------------------
# Asset name patterns
# ---------------------------------------------------------------------------

ASSET_PATTERNS = {
    "SuperManagers": r"(\d+)_SuperManagers\.asset$",
    "ActivesToLevels": r"(\d+)_SuperManagersActivesToLevels\.asset$",
    "LevelsToPromotions": r"(\d+)_SuperManagersLevelsToPromotions\.asset$",
    "ActiveEffectFactorType": r"(\d+)_ActiveEffectFactorType\.asset$",
    "RankEffectsValues": r"(\d+)_RankEffectsValues\.asset$",
    "ToFragments": r"(\d+)_SuperManagerToFragments\.asset$",
    "DataConfig": r"(\d+)_SuperManagerDataConfig\.asset$",
}

EXPECTED_ASSET_TYPES = list(ASSET_PATTERNS.keys())

# ---------------------------------------------------------------------------
# Extraction logic
# ---------------------------------------------------------------------------

def load_bundle(release_dir: Path | str) -> Any:
    """Load the configfiles-supermanagers bundle and return the UnityPy env."""
    import UnityPy
    release_dir = Path(release_dir)
    bundle_dir = release_dir / "extracted/base.apk/assets/Addressables/Android"
    bundles = list(bundle_dir.glob("configfiles-supermanagers_assets_all_*.bundle"))
    if not bundles:
        raise FileNotFoundError(f"No configfiles-supermanagers bundle in {bundle_dir}")
    return UnityPy.load(str(bundles[0]))


def load_all_bundles(release_dir: Path | str) -> dict[str, Any]:
    """Load ALL Unity bundles and return a dict of bundle_name -> env."""
    import UnityPy
    release_dir = Path(release_dir)
    bundle_dir = release_dir / "extracted/base.apk/assets/Addressables/Android"
    result: dict[str, Any] = {}
    for bp in sorted(bundle_dir.glob("*.bundle")):
        try:
            env = UnityPy.load(str(bp))
            result[bp.name] = env
        except Exception as e:
            pass
    return result


def discover_manager_ids(env: Any) -> set[int]:
    """Scan all MonoBehaviours for SuperManagersData assets and extract IDs."""
    ids: set[int] = set()
    pattern = re.compile(r"/(\d+)_SuperManagers\.asset$")
    for key in env.container:
        m = pattern.search(key)
        if m:
            ids.add(int(m.group(1)))
    return ids


def discover_all_manager_ids(all_bundles: dict[str, Any]) -> set[int]:
    """Scan ALL bundles for SuperManagers.asset and collect all IDs."""
    ids: set[int] = set()
    pattern = re.compile(r"/(\d+)_SuperManagers\.asset$")
    for bname, env in all_bundles.items():
        for key in env.container:
            m = pattern.search(key)
            if m:
                ids.add(int(m.group(1)))
    return ids


def _read_params(data: Any) -> list[dict[str, Any]] | None:
    """Extract readable field values from a MonoBehaviour's Params list."""
    if not hasattr(data, "Params"):
        return None
    params = data.Params
    if not isinstance(params, list):
        return None
    results = []
    for p in params:
        entry = {}
        for attr in dir(p):
            if attr.startswith("_") or attr in ("assets_file", "get_type", "object_reader", "save", "set_object_reader"):
                continue
            val = getattr(p, attr)
            if isinstance(val, (str, int, float, bool, type(None))):
                entry[attr] = val
        results.append(entry)
    return results


def _read_simple_attrs(data: Any) -> dict[str, Any]:
    """Extract readable attributes from a MonoBehaviour without Params."""
    attrs = {}
    for attr in dir(data):
        if attr.startswith("_") or attr in ("assets_file", "get_type", "object_reader", "save", "set_object_reader"):
            continue
        val = getattr(data, attr)
        if isinstance(val, (str, int, float, bool, type(None))):
            attrs[attr] = val
    return attrs


def extract_manager(env: Any, manager_id: int, all_bundles: dict[str, Any] | None = None) -> ExtractedManager:
    """Extract all assets for a single manager ID. Searches across all bundles if all_bundles provided."""
    warnings: list[str] = []
    assets_found: list[str] = []
    assets_missing: list[str] = []
    raw_data: dict[str, Any] = {}
    fields: dict[str, ExtractedField] = {}

    id_str = str(manager_id)
    envs_to_search = list(all_bundles.values()) if all_bundles else [env]

    for search_env in envs_to_search:
        for key, pptr in search_env.container.items():
            if ".asset" not in key or id_str not in key:
                continue
            try:
                if pptr.type.name != "MonoBehaviour":
                    continue
            except:
                continue

            entry_name = key.split("/")[-1]
            data = pptr.read()
            if entry_name not in assets_found:
                assets_found.append(entry_name)
            raw_data[entry_name] = {"raw_type": type(data).__name__, "key": key}

            if hasattr(data, "Params") and isinstance(data.Params, list):
                params = _read_params(data)
                raw_data[entry_name]["params"] = params
                if params:
                    # Flatten single-param assets
                    p = params[0]
                    for k, v in p.items():
                        src_field = f"{entry_name}.{k}"
                        fields[src_field] = ExtractedField(
                        field_name=k,
                        raw_value=v,
                        source_asset=entry_name,
                        provenance="direct",
                    )
            else:
                attrs = _read_simple_attrs(data)
                raw_data[entry_name]["attrs"] = attrs

    # Check for expected asset types
    for asset_type in EXPECTED_ASSET_TYPES:
        pattern = ASSET_PATTERNS[asset_type]
        found = any(re.search(pattern, a) for a in assets_found)
        if not found:
            assets_missing.append(asset_type)

    # Construct canonical fields from SuperManagers.asset
    super_key = f"{id_str}_SuperManagers.asset"
    super_params = raw_data.get(super_key, {}).get("params")
    if super_params and len(super_params) > 0:
        p = super_params[0]
        sid = p.get("SuperManagerId")
        if sid is not None and sid != manager_id:
            warnings.append(f"ID mismatch: asset has SuperManagerId={sid}, expected {manager_id}")

        # Enrich with enum labels
        rarity = p.get("SuperManagerRarity")
        category = p.get("Category")
        area_id = p.get("AreaId")
        gender = p.get("Gender")

        fields["rarity_label"] = ExtractedField(
            field_name="rarityLabel",
            raw_value=_enum_label(rarity, RARITY_MAP, "Rarity"),
            source_asset=super_key,
            provenance="mapped",
        )
        fields["category_label"] = ExtractedField(
            field_name="categoryLabel",
            raw_value=_enum_label(category, CATEGORY_MAP, "Category"),
            source_asset=super_key,
            provenance="mapped",
        )
        fields["area"] = ExtractedField(
            field_name="area",
            raw_value=_enum_label(area_id, REGION_MAP, "Region"),
            source_asset=super_key,
            provenance="mapped",
        )
        fields["gender_label"] = ExtractedField(
            field_name="genderLabel",
            raw_value=_enum_label(gender, GENDER_MAP, "Gender"),
            source_asset=super_key,
            provenance="mapped",
        )
    else:
        warnings.append(f"Missing SuperManagers.asset params for manager {manager_id}")

    return ExtractedManager(
        manager_id=manager_id,
        fields=fields,
        assets_found=assets_found,
        assets_missing=assets_missing,
        warnings=warnings,
        raw_asset_data=raw_data,
    )


def run_batch(release_dir: Path | str) -> tuple[list[ExtractedManager], BatchReport]:
    """Extract all discoverable managers and produce a report."""
    import UnityPy  # noqa: F811
    release_dir = Path(release_dir)
    all_bundles = load_all_bundles(release_dir)
    all_ids = discover_all_manager_ids(all_bundles)
    all_ids_sorted = sorted(all_ids)

    release_id = release_dir.name
    warnings: list[str] = []
    managers: list[ExtractedManager] = []
    extracted_count = 0
    partial_count = 0
    failed_count = 0

    print(f"Discovered {len(all_ids_sorted)} manager IDs across {len(all_bundles)} bundles")

    for mid in all_ids_sorted:
        try:
            mgr = extract_manager(None, mid, all_bundles=all_bundles)
            managers.append(mgr)

            if mgr.assets_missing:
                mgr.warnings.append(f"Missing assets: {mgr.assets_missing}")
                partial_count += 1
            else:
                extracted_count += 1
        except Exception as e:
            warnings.append(f"Failed to extract manager {mid}: {e}")
            failed_count += 1

    report = BatchReport(
        release_id=release_id,
        generated_at=datetime.now(timezone.utc).isoformat(),
        total_managers_discovered=len(all_ids_sorted),
        extracted_count=extracted_count,
        partial_count=partial_count,
        failed_count=failed_count,
        warnings=warnings,
        manager_ids_extracted=[m.manager_id for m in managers],
    )

    return managers, report


# ---------------------------------------------------------------------------
# Output serialization
# ---------------------------------------------------------------------------

def _serialize_manager(mgr: ExtractedManager) -> dict:
    """Convert an ExtractedManager to a JSON-serializable dict."""
    fields_out = {}
    for k, f in mgr.fields.items():
        fields_out[k] = {
            "value": f.raw_value,
            "source": f.source_asset,
            "provenance": f.provenance,
        }

    # Build a compact canonical record from core fields
    core = {}
    for k, f in mgr.fields.items():
        if f.provenance == "direct":
            core[f.field_name] = f.raw_value
    # Add derived labels
    for k, f in mgr.fields.items():
        if f.provenance == "mapped" and f.field_name.endswith("Label"):
            core[f.field_name] = f.raw_value

    return {
        "managerId": mgr.manager_id,
        "canonical": core,
        "fields": fields_out,
        "assetsFound": sorted(mgr.assets_found),
        "assetsMissing": sorted(mgr.assets_missing),
        "warnings": mgr.warnings,
    }


def serialize_report(report: BatchReport, managers: list[ExtractedManager]) -> dict:
    """Serialize the batch report."""
    return {
        "releaseId": report.release_id,
        "generatedAt": report.generated_at,
        "extractionSummary": {
            "totalDiscovered": report.total_managers_discovered,
            "fullyExtracted": report.extracted_count,
            "partial": report.partial_count,
            "failed": report.failed_count,
        },
        "warnings": report.warnings,
        "managerIds": report.manager_ids_extracted,
    }


def build_unresolved(managers: list[ExtractedManager]) -> list[dict]:
    """Build list of unresolved or unknown fields."""
    unresolved = []
    for mgr in managers:
        for k, f in mgr.fields.items():
            if f.raw_value is None:
                unresolved.append({
                    "managerId": mgr.manager_id,
                    "field": f.field_name,
                    "reason": "null value",
                    "sourceAsset": f.source_asset,
                })
            elif isinstance(f.raw_value, str) and f.raw_value.startswith("Unknown-"):
                unresolved.append({
                    "managerId": mgr.manager_id,
                    "field": f.field_name,
                    "reason": "unknown enum value",
                    "rawValue": f.raw_value,
                    "sourceAsset": f.source_asset,
                })
        # Report missing assets
        for missing in mgr.assets_missing:
            unresolved.append({
                "managerId": mgr.manager_id,
                "field": missing,
                "reason": "missing asset",
                "sourceAsset": None,
            })
        for w in mgr.warnings:
            if "Missing" in w or "unknown" in w.lower() or "unexpected" in w.lower():
                unresolved.append({
                    "managerId": mgr.manager_id,
                    "field": "general",
                    "reason": w,
                    "sourceAsset": None,
                })
    return unresolved


def build_evidence(managers: list[ExtractedManager]) -> list[dict]:
    """Build source-evidence records for every extracted field."""
    evidence = []
    for mgr in managers:
        for k, f in mgr.fields.items():
            evidence.append({
                "managerId": mgr.manager_id,
                "field": f.field_name,
                "value": str(f.raw_value),
                "sourceAsset": f.source_asset,
                "provenance": f.provenance,
                "releaseId": "5.59.0_96449_20260716T143539Z",
            })
    return evidence


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Batch extract manager data from APK")
    parser.add_argument("release_dir", type=Path, help="Release directory path")
    parser.add_argument("--output-dir", type=Path, default=None,
                        help="Output directory (default: <release-dir>/exports/extracted_managers)")
    parser.add_argument("--manager-id", type=int, default=None,
                        help="Single manager ID to extract (omit for batch)")
    args = parser.parse_args()

    output_dir = args.output_dir or (args.release_dir / "exports" / "extracted_managers")
    output_dir.mkdir(parents=True, exist_ok=True)

    if args.manager_id:
        # Single extraction
        env = load_bundle(args.release_dir)
        mgr = extract_manager(env, args.manager_id)
        result = _serialize_manager(mgr)
        print(json.dumps(result, indent=2, default=str))
        with open(output_dir / f"manager_{args.manager_id}.json", "w") as f:
            json.dump(result, f, indent=2, default=str)
        print(f"\nSaved to {output_dir / f'manager_{args.manager_id}.json'}")
        return

    # Batch extraction
    managers, report = run_batch(args.release_dir)
    unresolved = build_unresolved(managers)
    evidence = build_evidence(managers)

    # Save outputs
    managers_out = [_serialize_manager(m) for m in managers]
    with open(output_dir / "managers.json", "w") as f:
        json.dump(managers_out, f, indent=2, default=str)

    with open(output_dir / "extraction-report.json", "w") as f:
        json.dump(serialize_report(report, managers), f, indent=2, default=str)

    with open(output_dir / "unresolved-fields.json", "w") as f:
        json.dump(unresolved, f, indent=2, default=str)

    with open(output_dir / "source-evidence.json", "w") as f:
        json.dump(evidence, f, indent=2, default=str)

    # Print summary
    print(f"\n=== Batch Extraction Complete ===")
    print(f"Release: {report.release_id}")
    print(f"Discovered: {report.total_managers_discovered}")
    print(f"Fully extracted: {report.extracted_count}")
    print(f"Partial: {report.partial_count}")
    print(f"Failed: {report.failed_count}")
    print(f"Unresolved fields: {len(unresolved)}")
    print(f"Evidence records: {len(evidence)}")
    print(f"\nOutput directory: {output_dir}")
    print(f"  - managers.json ({len(managers_out)} managers)")
    print(f"  - extraction-report.json")
    print(f"  - unresolved-fields.json ({len(unresolved)} entries)")
    print(f"  - source-evidence.json ({len(evidence)} entries)")


if __name__ == "__main__":
    main()
