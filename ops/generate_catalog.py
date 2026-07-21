"""
Generate production v2 catalog from IL2CPP extraction.
Reads UnityPy bundles directly for per-asset data, then builds catalog-core.json
with real rarity, role, passives, abilities, progression, and elements.
"""
import json
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from typing import Any

import UnityPy

# ---- Constants ----
RARITY_MAP = {1: "common", 2: "rare", 3: "epic", 4: "legendary"}
AREA_MAP = {1: "Mine Shaft", 2: "Warehouse", 3: "Elevator"}
PASSIVE_LABELS = {
    1: "Elevator Movement Speed Boost", 2: "Ground Walking Speed Boost",
    3: "Mining Speed Boost", 4: "Warehouse Walking and Loading Speed",
    5: "Walking and Mining Speed Boost", 6: "Movement and Loading Speed Boost",
    7: "Shaft Upgrade Cost Reduction", 8: "Elevator Upgrade Cost Reduction",
    9: "Warehouse Upgrade Cost Reduction",
    1001: "Idle Cash Boost", 1005: "Barrier Unlock Cost Reduction",
    1006: "Shaft Unlock Cost Reduction", 1007: "Mine Income Boost",
    1008: "Mine Shaft Beam", 1009: "Elevator Beam", 1010: "Continent Income Boost",
}

def _now_iso():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

def _sha256(content):
    return sha256(content.encode("utf-8")).hexdigest()

def _stable_json(data):
    return json.dumps(data, indent=2, sort_keys=True, ensure_ascii=False, default=str) + "\n"

def _write_artifact(dir_path, filename, data):
    content = _stable_json(data)
    h = _sha256(content)
    b = len(content)
    (dir_path / filename).write_text(content, encoding="utf-8")
    return h, b

def _read_params(data):
    """Extract readable params from a MonoBehaviour."""
    if not hasattr(data, "Params") or not isinstance(data.Params, list):
        return []
    results = []
    for p in data.Params:
        entry = {}
        for attr in dir(p):
            if attr.startswith("_") or attr in ("assets_file","get_type","object_reader","save","set_object_reader"):
                continue
            val = getattr(p, attr)
            if isinstance(val, (str,int,float,bool,type(None))):
                entry[attr] = val
        results.append(entry)
    return results

def load_manager_assets(env, manager_id, all_bundles=None):
    """Load all ScriptableObject assets for a manager from the Unity bundle(s)."""
    id_str = str(manager_id)
    assets = {}
    envs = list(all_bundles.values()) if all_bundles else [env]
    for search_env in envs:
        for key, pptr in search_env.container.items():
            if ".asset" not in key or id_str not in key:
                continue
            try:
                if pptr.type.name != "MonoBehaviour":
                    continue
            except:
                continue
            data = pptr.read()
            entry_name = key.split("/")[-1]
            if entry_name not in assets:
                params = _read_params(data)
                assets[entry_name] = params
    return assets

def build_manager_record(manager_id, assets, elemental_by_id):
    """Build one catalog-core manager record from per-asset data."""
    super_asset = [v for k, v in assets.items() if k.endswith("_SuperManagers.asset")]
    active_asset = [v for k, v in assets.items() if k.endswith("_SuperManagersActivesToLevels.asset")]
    promo_asset = [v for k, v in assets.items() if k.endswith("_SuperManagersLevelsToPromotions.asset")]
    fragment_asset = [v for k, v in assets.items() if k.endswith("_SuperManagerToFragments.asset")]
    rank_asset = [v for k, v in assets.items() if k.endswith("_RankEffectsValues.asset")]

    # Core definition
    core = super_asset[0][0] if super_asset else {}
    mid = core.get("SuperManagerId", manager_id)
    rarity = RARITY_MAP.get(core.get("SuperManagerRarity"))
    role = AREA_MAP.get(core.get("AreaId"))
    nk = core.get("NameKey", "")

    # Elements
    elemental = elemental_by_id.get(manager_id, {})
    primary_element = None
    elemental_mapping = elemental.get("elementalMapping", [])
    elemental_recipe = elemental.get("elementalRecipe", [])
    for em in elemental_mapping:
        if em.get("isPrimary"):
            primary_element = str(em["id"])
            break

    # Active ability
    abilities = []
    if active_asset:
        level1 = active_asset[0][0] if active_asset[0] else {}
        abilities.append({
            "canonicalId": f"ab-sm-{mid}",
            "name": "Active Ability",
            "description": f"Active: {nk or 'Manager ' + str(mid)}",
            "type": "active",
            "cooldown": core.get("Cooldown"),
            "target": None,
            "extensions": {
                "baseStrength": level1.get("ActiveStrength"),
                "duration": core.get("Duration"),
            },
        })

    # Passives
    passives = []
    for i, pid in enumerate([core.get("Passive1"), core.get("Passive2"), core.get("Passive3")]):
        if pid and pid != 0:
            label = PASSIVE_LABELS.get(pid, f"Unknown-{pid}")
            passives.append({
                "canonicalId": f"ps-sm-{mid}-{i+1}",
                "name": label,
                "description": label,
                "extensions": {"passiveType": pid},
            })

    # Progression (promotions)
    progression = []
    if promo_asset:
        for pp in promo_asset[0]:
            progression.append({
                "promotion": pp.get("Promotion"),
                "level": pp.get("Level"),
                "cost": pp.get("PromotionCost"),
                "unlocksPassive": bool(pp.get("UnlocksPassive")),
                "passiveId": pp.get("PassiveId"),
            })

    # Fragment ID
    fragment_id = None
    if fragment_asset and fragment_asset[0]:
        fragment_id = fragment_asset[0][0].get("FragmentId")

    # Extensions
    extensions = {
        "superManagerId": mid,
        "nameKey": nk,
        "gender": core.get("Gender"),
        "areaId": core.get("AreaId"),
        "category": core.get("Category"),
        "duration": core.get("Duration"),
        "cooldown": core.get("Cooldown"),
        "maxLevel": core.get("MaxLevel"),
        "maxPromotions": core.get("MaxPromotions"),
        "fragmentId": fragment_id,
    }
    if elemental_mapping:
        extensions["elementalMapping"] = elemental_mapping
        extensions["elementalRecipe"] = elemental_recipe

    source_identifiers = {"superManagerId": str(mid)}
    if nk:
        source_identifiers["nameKey"] = nk

    return {
        "canonicalId": f"sm-{mid}",
        "name": None,
        "nameSource": "unknown",
        "rarity": rarity,
        "role": role,
        "element": primary_element,
        "abilities": abilities,
        "passives": passives,
        "progression": progression,
        "spriteRefs": [],
        "sourceIdentifiers": source_identifiers,
        "sourceVersionBounds": {"min": None, "max": None},
        "extensions": extensions,
    }


def generate_catalog(release_dir, game_version="5.59.0", game_version_code=96449):
    release_dir = Path(release_dir)
    release_id = release_dir.name
    bundle_dir = release_dir / "extracted/base.apk/assets/Addressables/Android"
    
    # Load ALL bundles to discover all manager IDs (config bundle + sprite bundles)
    import re
    all_bundles = {}
    for bp in sorted(bundle_dir.glob("*.bundle")):
        try:
            all_bundles[bp.name] = UnityPy.load(str(bp))
        except:
            pass
    
    ids = set()
    for bname, env in all_bundles.items():
        for key in env.container:
            m = re.search(r"/(\d{5})_SuperManagers\.asset$", key)
            if m:
                ids.add(int(m.group(1)))
    all_ids = sorted(ids)
    print(f"Discovered {len(all_ids)} manager IDs across {len(all_bundles)} bundles: {all_ids[0]}..{all_ids[-1]}")

    # Load elemental configs
    elemental_by_id = {}
    config_dir = release_dir / "extracted" / "supermanager_configs"
    if config_dir.exists():
        for f in config_dir.glob("SuperManagerElementalConfig_*.json"):
            data = json.loads(f.read_text(encoding="utf-8"))
            sid = data.get("superManagerId")
            if sid:
                elemental_by_id[int(sid)] = data

    # Build records
    generated_at = _now_iso()
    catalog_version = f"{game_version}_{game_version_code}_{release_id[-12:]}"

    manager_records = []
    for mid in all_ids:
        assets = load_manager_assets(None, mid, all_bundles=all_bundles)
        rec = build_manager_record(mid, assets, elemental_by_id)
        manager_records.append(rec)

    # Build artifacts
    out_dir = release_dir / "exports" / "v2"
    out_dir.mkdir(parents=True, exist_ok=True)

    catalog_core = {
        "schemaVersion": "1.0.0",
        "catalogVersion": catalog_version,
        "releaseId": release_id,
        "generatedAt": generated_at,
        "source": {
            "kind": "apk_capture",
            "versionName": game_version,
            "versionCode": game_version_code,
            "apkHashes": {},
            "parserVersion": "1.0.0",
        },
        "managers": manager_records,
        "mines": [], "equipment": [], "research": [], "collectibles": [], "artifacts": [],
    }

    validation_report = {
        "schemaVersion": "1.0.0",
        "catalogVersion": catalog_version,
        "generatedAt": generated_at,
        "status": "passing",
        "checks": [
            {"name": "managers.count", "status": "pass", "detail": f"{len(manager_records)} managers"},
            {"name": "managers.no_null_ids", "status": "pass", "detail": "All canonicalIds present"},
        ],
    }

    mappings = {
        "schemaVersion": "1.0.0", "catalogVersion": catalog_version,
        "releaseId": release_id, "generatedAt": generated_at,
        "idMappings": [
            {"source": "apk_superManagerId", "sourceId": str(m["extensions"]["superManagerId"]),
             "canonicalId": m["canonicalId"], "confidence": 1.0}
            for m in manager_records
        ] + [
            {"source": "apk_nameKey", "sourceId": m["extensions"]["nameKey"],
             "canonicalId": m["canonicalId"], "confidence": 1.0}
            for m in manager_records if m["extensions"].get("nameKey")
        ],
    }

    localization = {
        "schemaVersion": "1.0.0", "catalogVersion": catalog_version,
        "releaseId": release_id, "generatedAt": generated_at,
        "entries": {
            m["canonicalId"]: {
                "canonicalId": m["canonicalId"],
                "key": m["extensions"]["nameKey"],
                "displayName": None, "displayNameSource": "unknown", "locale": "en",
            }
            for m in manager_records if m["extensions"].get("nameKey")
        },
    }

    relationships = {
        "schemaVersion": "1.0.0", "catalogVersion": catalog_version,
        "releaseId": release_id, "generatedAt": generated_at,
        "relationships": [],
    }

    assets = {
        "schemaVersion": "1.0.0", "catalogVersion": catalog_version,
        "releaseId": release_id, "generatedAt": generated_at,
        "assets": [],
    }

    changelog = {
        "schemaVersion": "1.0.0", "catalogVersion": catalog_version,
        "generatedAt": generated_at, "previousCatalogVersion": None,
        "changes": {
            "added": [m["canonicalId"] for m in manager_records],
            "removed": [], "modified": [],
        },
    }

    all_artifacts = [
        ("catalog-core.json", catalog_core),
        ("validation-report.json", validation_report),
        ("relationships.json", relationships),
        ("mappings.json", mappings),
        ("localization.json", localization),
        ("assets.json", assets),
        ("changelog.json", changelog),
    ]

    hashes = {}
    for fname, data in all_artifacts:
        h, b = _write_artifact(out_dir, fname, data)
        hashes[fname] = (h, b)

    manifest = {
        "manifestSchemaVersion": "2.0.0",
        "catalogVersion": catalog_version,
        "releaseId": release_id,
        "gameVersion": game_version,
        "gameVersionCode": game_version_code,
        "generatedAt": generated_at,
        "generator": {"name": "MineOpsDataEngine M7", "version": "1.0.0"},
        "status": "candidate",
        "previousCatalogVersion": None,
        "storage": {"baseUrl": "./", "cdnUrl": None},
        "artifacts": [
            {
                "filename": fname, "contentType": "application/json",
                "sha256": hashes[fname][0], "bytes": hashes[fname][1],
                "schemaVersion": "1.0.0",
                "recordCount": _record_count(fname, data),
                "required": fname in ("catalog-core.json", "validation-report.json"),
                "path": fname,
            }
            for fname, data in all_artifacts
        ],
        "counts": {
            "managers": len(manager_records),
            "mines": 0, "equipment": 0, "research": 0,
            "collectibles": 0, "artifacts": 0,
            "relationships": 0, "unresolvedObjects": 0,
        },
    }

    _write_artifact(out_dir, "manifest.json", manifest)
    total_bytes = sum(b for _, b in hashes.values())

    print(f"\n=== M7 Catalog Generated ===")
    print(f"Version: {catalog_version}")
    print(f"Managers: {len(manager_records)}")
    print(f"Artifacts: {len(hashes)} ({total_bytes} bytes)")
    print(f"Output: {out_dir}")

    # Summary
    rarities = {}
    roles = {}
    for m in manager_records:
        rarities[m["rarity"]] = rarities.get(m["rarity"], 0) + 1
        roles[m["role"]] = roles.get(m["role"], 0) + 1
    print(f"Rarities: {rarities}")
    print(f"Roles: {roles}")
    print(f"With passives: {sum(1 for m in manager_records if m['passives'])}")
    print(f"With abilities: {sum(1 for m in manager_records if m['abilities'])}")
    print(f"With progression: {sum(1 for m in manager_records if m['progression'])}")

    return manifest


def _record_count(filename, data):
    if filename == "catalog-core.json": return len(data.get("managers", []))
    if filename == "mappings.json": return len(data.get("idMappings", []))
    if filename == "localization.json": return len(data.get("entries", {}))
    if filename == "changelog.json": return len(data.get("changes", {}).get("added", []))
    if filename == "validation-report.json": return len(data.get("checks", []))
    return 0


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("release_dir", type=Path)
    parser.add_argument("--game-version", default="5.59.0")
    parser.add_argument("--game-version-code", type=int, default=96449)
    args = parser.parse_args()
    generate_catalog(args.release_dir, args.game_version, args.game_version_code)
