"""Lossless, release-scoped inputs for strategy catalog candidates.

The functions in this module are deliberately transport-neutral: they can be
fed UnityPy environments in production and small fake environments in tests.
No output here is a claim about player-facing effect semantics.
"""
from __future__ import annotations

import base64
import hashlib
import json
import math
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


AUDITED_BUNDLE_GROUPS = {
    "configfiles-jsonfallback": "configfiles_jsonfallback",
    "configfiles": "configfiles",
    "supermanagerpowerscore": "supermanagerpowerscore",
    "chapters": "chapters",
    "barrierrewards": "barrier_event",
    "eventhub": "eventhub",
    "genericbattlepass": "genericbattlepass",
    "mainlandcontent": "mainlandcontent",
    "competitiveelementalmines": "competitiveelementalmines",
    "frontiermines": "frontiermines",
    "collectibles": "collectibles",
    "generalassets": "generalassets",
}


def json_safe(value: Any, *, depth: int = 0) -> Any:
    """Serialize observable Unity values without silently inventing meaning."""
    if depth > 4:
        return {"unresolvedRepresentation": type(value).__name__}
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, bytes):
        return {"encoding": "base64", "value": base64.b64encode(value).decode("ascii")}
    if isinstance(value, (list, tuple)):
        return [json_safe(item, depth=depth + 1) for item in value]
    if isinstance(value, dict):
        return {str(key): json_safe(item, depth=depth + 1) for key, item in value.items()}
    values: dict[str, Any] = {}
    for name in dir(value):
        if name.startswith("_") or name in {"assets_file", "get_type", "object_reader", "save", "set_object_reader"}:
            continue
        try:
            item = getattr(value, name)
        except Exception:
            continue
        if callable(item):
            continue
        if isinstance(item, (str, int, float, bool, type(None), bytes, list, tuple, dict)):
            values[name] = json_safe(item, depth=depth + 1)
    return values or {"unresolvedRepresentation": type(value).__name__}


def classify_bundle(bundle_name: str) -> str:
    """Classify only from capture provenance; records stay semantically raw."""
    lowered = bundle_name.lower()
    for token, group in AUDITED_BUNDLE_GROUPS.items():
        if token in lowered:
            return group
    return "unclassified"


def _pointer_type_name(pointer: Any, fallback: str = "") -> str:
    """Read a Unity pointer type without dereferencing null PPtrs."""
    try:
        return str(getattr(getattr(pointer, "type", None), "name", fallback))
    except (ValueError, AttributeError):
        return fallback


def _is_data_shaped(pointer: Any, data: Any, asset_name: str) -> bool:
    """Exclude sprites/textures/audio before reading them into a data package."""
    type_name = _pointer_type_name(pointer, type(data).__name__)
    if type_name in {"MonoBehaviour", "TextAsset"}:
        return True
    lowered = asset_name.lower()
    return lowered.endswith((".json", ".asset", ".config")) and bool(getattr(data, "Params", None) is not None)


def _raw_bytes(pointer: Any, env: Any) -> dict[str, Any]:
    reader = getattr(pointer, "object_reader", None)
    if reader is None:
        for asset in getattr(env, "assets", []):
            candidate = getattr(asset, "objects", {}).get(getattr(pointer, "path_id", None))
            if candidate is not None:
                reader = candidate
                break
    if reader is None:
        return {"unavailableReason": "object_reader_not_found"}
    try:
        value = reader.get_raw_data()
    except Exception as error:
        return {"unavailableReason": f"raw_data_read_failed:{type(error).__name__}"}
    return {
        "rawEncoding": "base64",
        "rawBytes": base64.b64encode(value).decode("ascii"),
        "rawSha256": hashlib.sha256(value).hexdigest(),
        "rawByteLength": len(value),
    }


def named_records_from_env(env: Any, bundle_name: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Read each named container object that successfully deserializes."""
    records: list[dict[str, Any]] = []
    unresolved: list[dict[str, Any]] = []
    for source_path, pointer in sorted(env.container.items(), key=lambda item: item[0]):
        asset_name = source_path.rsplit("/", 1)[-1]
        if not asset_name:
            continue
        type_name = _pointer_type_name(pointer)
        if not type_name and getattr(pointer, "path_id", None) in (None, 0):
            continue
        candidate = asset_name.lower()
        possible_data = type_name in {"MonoBehaviour", "TextAsset"} or candidate.endswith((".json", ".asset", ".config"))
        if not possible_data:
            continue
        # Do this before deserializing generalassets: it is primarily visual
        # content and can otherwise force tens of thousands of pointless reads.
        if classify_bundle(bundle_name) == "generalassets" and not (
            candidate.endswith(".json") or any(token in candidate for token in ("supermanager", "artifact", "collectible", "mine", "barrier", "frontier", "event", "element"))
        ):
            continue
        try:
            data = pointer.read()
        except Exception as error:
            unresolved.append({
                "kind": "config_deserialization_failed",
                "sourceBundle": bundle_name,
                "sourceAssetPath": source_path,
                "sourceObjectPathId": getattr(pointer, "path_id", None),
                "errorType": type(error).__name__,
            })
            continue
        if not _is_data_shaped(pointer, data, asset_name):
            continue
        raw: dict[str, Any] = {
            "recordId": hashlib.sha256(f"{bundle_name}\0{source_path}\0{getattr(pointer, 'path_id', None)}".encode()).hexdigest(),
            "domain": classify_bundle(bundle_name),
            "semanticStatus": "partial",
            "source": {
                "bundle": bundle_name,
                "assetPath": source_path,
                "objectType": _pointer_type_name(pointer, type(data).__name__),
                "pathId": getattr(pointer, "path_id", None),
            },
            "name": asset_name,
        }
        params = getattr(data, "Params", None)
        if isinstance(params, list):
            raw["params"] = [json_safe(row) for row in params]
        else:
            raw["fields"] = json_safe(data)
        serialized = _raw_bytes(pointer, env)
        if "rawBytes" not in serialized:
            evidence_id = f"strategy-config-raw-bytes-{raw['recordId']}"
            raw["raw"] = {"serialized": {"unresolvedEvidenceId": evidence_id}}
            unresolved.append({
                "evidenceId": evidence_id,
                "domain": raw["domain"],
                "subjectId": raw["recordId"],
                "fieldPath": "raw.serialized",
                "status": "partial",
                "severity": "warning",
                "reason": "Serialized Unity object bytes were unavailable; readable fields were retained with exact object provenance.",
                "source": raw["source"],
                "rawValue": serialized,
            })
        else:
            raw["raw"] = {"serialized": serialized}
        records.append(raw)
    return records, unresolved


def _elemental_json_evidence(release_dir: Path) -> list[dict[str, Any]]:
    """Include previously extracted element JSON without requiring a reparse."""
    records = []
    paths = set()
    for root in (release_dir / "exports", release_dir / "extracted" / "supermanager_configs"):
        if root.is_dir():
            paths.update(root.glob("**/SuperManagerElementalConfig_*.json"))
    for path in sorted(paths, key=lambda item: str(item.relative_to(release_dir))):
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        records.append({
            "recordId": hashlib.sha256(f"extracted-json\0{path.relative_to(release_dir)}".encode()).hexdigest(),
            "domain": "supermanager_elemental",
            "semanticStatus": "partial",
            "source": {"bundle": "previously-extracted", "assetPath": str(path.relative_to(release_dir)), "objectType": "TextAsset", "pathId": None},
            "name": path.name,
            "raw": {"value": value, "rawSha256": digest},
        })
    return records


def extract_strategy_configs(
    release_dir: Path | str,
    *,
    catalog_version: str | None = None,
    generated_at: str | None = None,
    source: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Losslessly preserve audited named config objects for a captured release."""
    import UnityPy

    release_dir = Path(release_dir)
    bundle_dir = release_dir / "extracted/base.apk/assets/Addressables/Android"
    records: list[dict[str, Any]] = []
    unresolved: list[dict[str, Any]] = []
    audited_bundle_records: dict[str, int] = {}
    audited_bundle_names: dict[str, list[str]] = {}
    for bundle_path in sorted(bundle_dir.glob("*.bundle")):
        group = classify_bundle(bundle_path.name)
        if group == "unclassified":
            continue
        audited_bundle_names.setdefault(group, []).append(bundle_path.name)
        try:
            env = UnityPy.load(str(bundle_path))
        except Exception as error:
            unresolved.append({"kind": "bundle_load_failed", "sourceBundle": bundle_path.name, "errorType": type(error).__name__})
            continue
        found, failures = named_records_from_env(env, bundle_path.name)
        records.extend(found)
        unresolved.extend(failures)
        audited_bundle_records[group] = audited_bundle_records.get(group, 0) + len(found)
    for group, bundle_names in sorted(audited_bundle_names.items()):
        if audited_bundle_records.get(group, 0) != 0:
            continue
        for bundle_name in bundle_names:
            unresolved.append({
                "kind": "no_data_shaped_records",
                "domain": group,
                "status": "blocked",
                "severity": "warning",
                "sourceBundle": bundle_name,
                "reason": "The audited bundle contained no selected MonoBehaviour or TextAsset strategy records; its balancing/config source remains unlocated.",
            })
    records.extend(_elemental_json_evidence(release_dir))
    return {
        "schemaVersion": "1.0.0",
        "catalogVersion": catalog_version or release_dir.name,
        "releaseId": release_dir.name,
        "generatedAt": generated_at or datetime.now(timezone.utc).isoformat(),
        "source": {**(source or {"kind": "apk_capture", "extraction": "Unity config records"}), "unresolved": unresolved},
        "records": sorted(records, key=lambda record: record["recordId"]),
    }


def canonical_json(value: Any) -> str:
    return json.dumps(_unicode_safe(value), ensure_ascii=False, sort_keys=True, indent=2) + "\n"


def _unicode_safe(value: Any) -> Any:
    """Keep canonical JSON lossless and stable in JavaScript consumers."""
    if isinstance(value, bool) or value is None:
        return value
    if isinstance(value, int):
        # JSON.parse uses IEEE-754 numbers. Preserve Unity SInt64 path IDs as
        # decimal strings when they cannot round-trip exactly in the app.
        return str(value) if abs(value) > 9_007_199_254_740_991 else value
    if isinstance(value, float):
        if not math.isfinite(value):
            return {"numberEncoding": "nonfinite", "value": str(value)}
        if abs(value) > 9_007_199_254_740_991:
            return str(value)
        return int(value) if value.is_integer() else value
    if isinstance(value, str):
        return re.sub(r"[\ud800-\udfff]", lambda match: f"\\u{ord(match.group(0)):04x}", value)
    if isinstance(value, list):
        return [_unicode_safe(item) for item in value]
    if isinstance(value, tuple):
        return [_unicode_safe(item) for item in value]
    if isinstance(value, dict):
        return {_unicode_safe(str(key)): _unicode_safe(item) for key, item in value.items()}
    return value


def write_canonical_json(path: Path, value: Any) -> tuple[str, int]:
    path.parent.mkdir(parents=True, exist_ok=True)
    content = canonical_json(value)
    path.write_text(content, encoding="utf-8")
    return hashlib.sha256(content.encode("utf-8")).hexdigest(), len(content.encode("utf-8"))
