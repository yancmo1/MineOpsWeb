"""
Equipment Data Extractor — Extracts Super Manager equipment from APK Unity bundles.

Equipment data lives in 6 MonoBehaviour configs inside the configfiles bundle:
  - SuperManagerEquipmentConfig        → equipment definitions & name keys
  - SuperManagerEquipmentBalancingConfig → balance tuning (id→level→value)
  - SuperManagerEquipmentEffectLocaConfig→ effect description localization keys
  - SuperManagerEquipmentMaterialConfig → crafting material definitions
  - SuperManagerEquipmentMaterialShopConfig → shop prices
  - SuperManagerEquipmentInfoPanelConfig→ UI panel colors (skip for data)

Also reads:
  - supermanagerequipment bundle       → material sprite icons
  - supermanagers element configs      → elemental mappings for equipment
"""
from __future__ import annotations

import json
import base64
import hashlib
import struct
import re
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


# ---------------------------------------------------------------------------
# Data containers
# ---------------------------------------------------------------------------

@dataclass
class EquipmentMaterial:
    material_id: int
    name_key: str
    source_tooltip_key: str | None

@dataclass
class EquipmentEffectLoca:
    equipment_id: int
    effect_type: int  # 0 = long, 1 = short
    loca_key_suffix: str

    @property
    def long_key(self) -> str:
        return f"SMEquipmentEffectDescription{self.loca_key_suffix}"

    @property
    def short_key(self) -> str:
        return f"SMEquipmentEffectDescriptionShort{self.loca_key_suffix}"

@dataclass
class EquipmentBalancing:
    equipment_id: int
    level: int
    value: float

@dataclass
class EquipmentItem:
    equipment_id: int
    name_key: str
    effects: list[dict] = field(default_factory=list)

@dataclass
class EquipmentCatalog:
    equipment: list[EquipmentItem]
    materials: list[EquipmentMaterial]
    loca_entries: list[EquipmentEffectLoca]
    balancing: list[EquipmentBalancing]
    raw_records: list[dict[str, Any]] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Unity MonoBehaviour binary reader
# ---------------------------------------------------------------------------

def _read_string(data: bytes, offset: int) -> tuple[str, int]:
    """Read a Unity string (int length + chars). Skip trailing nulls/padding."""
    slen = struct.unpack_from('<i', data, offset)[0]
    offset += 4
    s = data[offset:offset+slen].decode('utf-8', errors='replace')
    offset += slen
    # Skip any null bytes (null terminator + alignment padding)
    while offset < len(data) and data[offset] == 0:
        offset += 1
    return s, offset


def _read_aligned_string(data: bytes, offset: int) -> tuple[str, int]:
    """Read a length-prefixed Unity string and consume only its 4-byte padding.

    The effect-localization config places the next integer immediately after
    the aligned string. The older reader skipped every consecutive zero and
    could therefore consume the first bytes of that integer.
    """
    slen = struct.unpack_from('<i', data, offset)[0]
    offset += 4
    value = data[offset:offset+slen].decode('utf-8', errors='replace')
    offset += slen
    return value, (offset + 3) & ~3

def _read_header(data: bytes) -> tuple[str, int]:
    """Skip standard MonoBehaviour header fields. m_Enabled is 4 bytes in serialized format."""
    o = 12  # m_GameObject PPtr (int + SInt64)
    o += 4  # m_Enabled (serialized as int, 4 bytes)
    o += 12 # m_Script PPtr (int + SInt64)
    name, o = _read_string(data, o)
    return name, o


# ---------------------------------------------------------------------------
# Bundle readers
# ---------------------------------------------------------------------------

def load_bundle(release_dir: Path | str, glob_pattern: str):
    import UnityPy
    release_dir = Path(release_dir)
    bundle_dir = release_dir / "extracted/base.apk/assets/Addressables/Android"
    bundles = list(bundle_dir.glob(glob_pattern))
    if not bundles:
        raise FileNotFoundError(f"No bundle matching {glob_pattern} in {bundle_dir}")
    return UnityPy.load(str(bundles[0]))


def read_equipment_config(config_bytes: bytes) -> list[EquipmentItem]:
    """
    Parse SuperManagerEquipmentConfig.asset binary.
    Contains sprite class path + asset path + name key entries.
    """
    name, o = _read_header(config_bytes)
    items = []
    classpath, o = _read_string(config_bytes, o)
    assetpath, o = _read_string(config_bytes, o)

    name_key_map = {}
    # Read entry count first
    entry_count = struct.unpack_from('<i', config_bytes, o)[0]; o += 4
    
    for _ in range(entry_count):
        if o + 12 > len(config_bytes):
            break
        eid = struct.unpack_from('<i', config_bytes, o)[0]; o += 4
        typ_val = struct.unpack_from('<i', config_bytes, o)[0]; o += 4
        # Read null-terminated string
        s_start = o
        while o < len(config_bytes) and config_bytes[o] != 0:
            o += 1
        text = config_bytes[s_start:o].decode('utf-8', errors='replace')
        o += 1  # skip null
        # Skip padding nulls to 4-byte boundary
        while o < len(config_bytes) and config_bytes[o] == 0:
            o += 1
        if text.startswith('SMEquipment'):
            name_key_map[eid] = text

    for eid, nk in sorted(name_key_map.items()):
        items.append(EquipmentItem(equipment_id=eid, name_key=nk))
    return items


def read_balancing_config(config_bytes: bytes) -> list[EquipmentBalancing]:
    """Parse SuperManagerEquipmentBalancingConfig.asset binary."""
    _, o = _read_header(config_bytes)
    entries = []
    while o + 16 <= len(config_bytes):
        eid = struct.unpack_from('<i', config_bytes, o)[0]; o += 4
        level = struct.unpack_from('<i', config_bytes, o)[0]; o += 4
        value = struct.unpack_from('<d', config_bytes, o)[0]; o += 8
        entries.append(EquipmentBalancing(equipment_id=eid, level=level, value=value))
    return entries


def read_loca_config(config_bytes: bytes) -> list[EquipmentEffectLoca]:
    """Parse SuperManagerEquipmentEffectLocaConfig.asset binary."""
    _read_header(config_bytes)
    entries = []
    # The header reader intentionally skips legacy null padding, but this
    # config has three strings followed by packed integer records. Locate the
    # stable string labels first, then align once at the first record. This
    # avoids treating a padding zero as part of the next integer.
    prefix = b"SMEquipmentEffectDescription"
    prefix_at = config_bytes.find(prefix)
    long_at = config_bytes.find(b"Long", prefix_at + len(prefix))
    short_at = config_bytes.find(b"Short", long_at + 4)
    if min(prefix_at, long_at, short_at) < 0:
        return entries
    o = (short_at + len(b"Short") + 3) & ~3
    if o + 4 > len(config_bytes):
        return entries
    entry_count = struct.unpack_from('<i', config_bytes, o)[0]
    o += 4
    for _ in range(max(0, entry_count)):
        if o + 8 > len(config_bytes):
            break
        eid = struct.unpack_from('<i', config_bytes, o)[0]; o += 4
        etype = struct.unpack_from('<i', config_bytes, o)[0]; o += 4
        end = config_bytes.find(b'\x00', o)
        if end < 0:
            break
        suffix = config_bytes[o:end].decode('utf-8', errors='replace')
        o = (end + 1 + 3) & ~3
        entries.append(EquipmentEffectLoca(equipment_id=eid, effect_type=etype, loca_key_suffix=suffix))
    return entries


def read_material_config(config_bytes: bytes) -> list[EquipmentMaterial]:
    """Parse SuperManagerEquipmentMaterialConfig.asset binary."""
    _, o = _read_header(config_bytes)
    materials = []
    _, o = _read_string(config_bytes, o)  # classpath (length-prefixed)
    _, o = _read_string(config_bytes, o)  # assetpath (length-prefixed)
    material_count = struct.unpack_from('<i', config_bytes, o)[0]; o += 4
    for _ in range(material_count):
        if o + 8 > len(config_bytes):
            break
        mid = struct.unpack_from('<i', config_bytes, o)[0]; o += 4
        typ_val = struct.unpack_from('<i', config_bytes, o)[0]; o += 4
        # Name: null-terminated with 4-byte alignment
        s_start = o
        while o < len(config_bytes) and config_bytes[o] != 0:
            o += 1
        name_text = config_bytes[s_start:o].decode('utf-8', errors='replace')
        o += 1  # skip null
        # Align to 4 bytes
        o = (o + 3) & ~3
        # Tooltip: length-prefixed string with alignment
        if o + 4 < len(config_bytes):
            tt_len = struct.unpack_from('<i', config_bytes, o)[0]
            if 1 <= tt_len <= 100 and o + 4 + tt_len <= len(config_bytes):
                o += 4
                tooltip = config_bytes[o:o+tt_len].decode('utf-8', errors='replace')
                o += tt_len + 1  # skip chars + null terminator
                o = (o + 3) & ~3  # align to 4 bytes
            else:
                tooltip = None
        else:
            tooltip = None
        materials.append(EquipmentMaterial(material_id=mid, name_key=name_text, source_tooltip_key=tooltip))
    return materials


# ---------------------------------------------------------------------------
# Main extraction
# ---------------------------------------------------------------------------

def _config_raw_records(env: Any, serialized_file: Any, bundle_name: str) -> list[dict[str, Any]]:
    """Preserve every named equipment configuration object byte-for-byte.

    Binary layouts evolve more often than the handful of layouts we currently
    understand.  Keeping the original bytes and object provenance means a
    later parser can be added without recapturing an APK.
    """
    records: list[dict[str, Any]] = []
    for key, pptr in env.container.items():
        asset_name = key.rsplit("/", 1)[-1]
        if "SuperManagerEquipment" not in asset_name:
            continue
        obj = serialized_file.objects.get(pptr.path_id)
        if obj is None:
            continue
        raw = obj.get_raw_data()
        records.append({
            "sourceBundle": bundle_name,
            "sourceAssetPath": key,
            "sourceObjectPathId": getattr(pptr, "path_id", None),
            "assetName": asset_name,
            "rawEncoding": "base64",
            "rawBytes": base64.b64encode(raw).decode("ascii"),
            "rawSha256": hashlib.sha256(raw).hexdigest(),
            "rawByteLength": len(raw),
        })
    return sorted(records, key=lambda record: (record["sourceAssetPath"], record["sourceObjectPathId"] or -1))


def extract_equipment(release_dir: Path | str) -> EquipmentCatalog:
    """Extract all equipment data from a release directory."""
    import UnityPy
    release_dir = Path(release_dir)
    bundle_dir = release_dir / "extracted/base.apk/assets/Addressables/Android"
    config_bundles = list(bundle_dir.glob("configfiles_assets_all_*.bundle"))
    if not config_bundles:
        raise FileNotFoundError(f"No configfiles bundle in {bundle_dir}")
    cf_env = UnityPy.load(str(config_bundles[0]))
    cf_sf = cf_env.assets[0]

    def get_raw(key_sub: str) -> bytes | None:
        for key, pptr in cf_env.container.items():
            if key_sub in key:
                robj = cf_sf.objects.get(pptr.path_id)
                if robj:
                    return robj.get_raw_data()
        return None

    equip_raw = get_raw("SuperManagerEquipmentConfig.asset")
    balancing_raw = get_raw("SuperManagerEquipmentBalancingConfig.asset")
    loca_raw = get_raw("SuperManagerEquipmentEffectLocaConfig.asset")
    material_raw = get_raw("SuperManagerEquipmentMaterialConfig.asset")

    equipment = read_equipment_config(equip_raw) if equip_raw else []
    balancing = read_balancing_config(balancing_raw) if balancing_raw else []
    loca_entries = read_loca_config(loca_raw) if loca_raw else []
    materials = read_material_config(material_raw) if material_raw else []

    bal_by_id: dict[int, list[EquipmentBalancing]] = {}
    for b in balancing:
        bal_by_id.setdefault(b.equipment_id, []).append(b)
    for item in equipment:
        item.effects = [{"level": b.level, "value": b.value} for b in bal_by_id.get(item.equipment_id, [])]

    return EquipmentCatalog(
        equipment=equipment,
        materials=materials,
        loca_entries=loca_entries,
        balancing=balancing,
        raw_records=_config_raw_records(cf_env, cf_sf, config_bundles[0].name),
    )


def serialize_equipment(catalog: EquipmentCatalog) -> dict:
    """Serialize equipment catalog to a JSON-compatible dict."""
    loca_by_id: dict[int, list[EquipmentEffectLoca]] = {}
    for row in catalog.loca_entries:
        loca_by_id.setdefault(row.equipment_id, []).append(row)
    items = [{
        "equipmentId": item.equipment_id,
        "nameKey": item.name_key,
        "effects": item.effects,
        "effectLocalization": [{
            "effectType": row.effect_type,
            "locaKeySuffix": row.loca_key_suffix,
            "longKey": row.long_key,
            "shortKey": row.short_key,
        } for row in loca_by_id.get(item.equipment_id, [])],
        "effectLocalizationCandidates": [{
            "compactEffectId": row.equipment_id,
            "effectType": row.effect_type,
            "locaKeySuffix": row.loca_key_suffix,
            "longKey": row.long_key,
            "shortKey": row.short_key,
            "joinStatus": "candidate_name_suffix_only",
        } for row in catalog.loca_entries if item.name_key.removeprefix("SMEquipmentName") == row.loca_key_suffix],
    } for item in catalog.equipment]
    materials_out = [{"materialId": mat.material_id, "nameKey": mat.name_key, "sourceTooltipKey": mat.source_tooltip_key} for mat in catalog.materials]
    return {
        "equipment": items,
        "materials": materials_out,
        "localization": [
            {"equipmentId": row.equipment_id, "effectType": row.effect_type, "locaKeySuffix": row.loca_key_suffix,
             "longKey": row.long_key, "shortKey": row.short_key}
            for row in catalog.loca_entries
        ],
        "balancing": [
            {"equipmentId": row.equipment_id, "level": row.level, "value": row.value}
            for row in catalog.balancing
        ],
        "sourceRecords": catalog.raw_records,
    }


def _source_for(catalog: EquipmentCatalog, token: str) -> dict[str, Any] | None:
    for record in catalog.raw_records:
        if token in str(record.get("assetName", "")):
            return {
                "bundle": record.get("sourceBundle"),
                "assetPath": record.get("sourceAssetPath"),
                "objectType": "MonoBehaviour",
                "pathId": record.get("sourceObjectPathId"),
            }
    return None


def _record(record_id: str, canonical_id: str, item: dict[str, Any], source: dict[str, Any] | None) -> dict[str, Any]:
    value = {"recordId": record_id, "canonicalId": canonical_id, "name": None, "sourceFields": item, "raw": item}
    if source is not None:
        value["source"] = source
    return value


def build_equipment_domain(
    catalog: EquipmentCatalog,
    release_id: str,
    *,
    catalog_version: str | None = None,
    generated_at: str | None = None,
    source: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Return the lossless equipment packaging input without semantic guesses."""
    serialized = serialize_equipment(catalog)
    equipment_source = _source_for(catalog, "SuperManagerEquipmentConfig")
    material_source = _source_for(catalog, "SuperManagerEquipmentMaterialConfig")
    balancing_source = _source_for(catalog, "SuperManagerEquipmentBalancingConfig")
    localization_source = _source_for(catalog, "SuperManagerEquipmentEffectLocaConfig")
    equipment_rows = [_record(f"equipment:{item['equipmentId']}", f"equipment:{item['equipmentId']}", item, equipment_source) for item in serialized["equipment"]]
    balancing_rows = [_record(f"balancing:{item['equipmentId']}:{item['level']}:{index}", f"equipment:{item['equipmentId']}", item, balancing_source) for index, item in enumerate(serialized["balancing"])]
    localization_rows = [_record(f"localization:{item['equipmentId']}:{item['effectType']}:{index}", f"equipment:{item['equipmentId']}", item, localization_source) for index, item in enumerate(serialized["localization"])]
    known_equipment = {row["canonicalId"] for row in equipment_rows}
    unresolved = []
    for group, rows in (("balancing", balancing_rows), ("localization", localization_rows)):
        for row in rows:
            if row["canonicalId"] not in known_equipment:
                unresolved.append({
                    "evidenceId": f"equipment-dangling-{row['recordId']}",
                    "domain": "equipment",
                    "subjectId": row["canonicalId"],
                    "fieldPath": group,
                    "status": "partial",
                    "severity": "warning",
                    "reason": f"Parsed {group} row references an equipment ID not present in the parsed equipment definition table.",
                    "rawValue": row["raw"],
                })
    return {
        "schemaVersion": "1.0.0",
        "catalogVersion": catalog_version or release_id,
        "releaseId": release_id,
        "generatedAt": generated_at or datetime.now(timezone.utc).isoformat(),
        "source": {**(source or {"kind": "apk_capture", "extraction": "equipment binary configs"}), "rawRecords": serialized["sourceRecords"], "unresolved": unresolved},
        "equipment": equipment_rows,
        "materials": [_record(f"material:{item['materialId']}", f"material:{item['materialId']}", item, material_source) for item in serialized["materials"]],
        "balancing": balancing_rows,
        "localization": localization_rows,
    }


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Extract equipment data from APK")
    parser.add_argument("release_dir", type=Path, help="Release directory path")
    parser.add_argument("--output", type=Path, default=None, help="Output JSON file")
    args = parser.parse_args()
    catalog = extract_equipment(args.release_dir)
    result = serialize_equipment(catalog)
    output_path = args.output or (args.release_dir / "exports/extracted_equipment/equipment.json")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Extracted {len(catalog.equipment)} equipment items, {len(catalog.materials)} materials")
    print(f"Saved to {output_path}")


if __name__ == "__main__":
    main()
