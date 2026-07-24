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
    _, o = _read_header(config_bytes)
    entries = []
    _, o = _read_string(config_bytes, o)  # loca key prefix ("SMEquipmentEffectDescription")
    _, o = _read_string(config_bytes, o)  # long type name ("Long")
    _, o = _read_string(config_bytes, o)  # short type name ("Short")
    while o + 12 <= len(config_bytes):
        eid = struct.unpack_from('<i', config_bytes, o)[0]; o += 4
        etype = struct.unpack_from('<i', config_bytes, o)[0]; o += 4
        suffix, o = _read_string(config_bytes, o)
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

    return EquipmentCatalog(equipment=equipment, materials=materials, loca_entries=loca_entries, balancing=balancing)


def serialize_equipment(catalog: EquipmentCatalog) -> dict:
    """Serialize equipment catalog to a JSON-compatible dict."""
    items = [{"equipmentId": item.equipment_id, "nameKey": item.name_key, "effects": item.effects} for item in catalog.equipment]
    materials_out = [{"materialId": mat.material_id, "nameKey": mat.name_key, "sourceTooltipKey": mat.source_tooltip_key} for mat in catalog.materials]
    return {"equipment": items, "materials": materials_out}


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
