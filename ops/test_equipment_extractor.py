import importlib.util
from pathlib import Path
import sys

SPEC = importlib.util.spec_from_file_location("equipment_extractor", Path(__file__).with_name("equipment_extractor.py"))
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def test_serialize_preserves_unresolved_name_suffix_candidate():
    catalog = MODULE.EquipmentCatalog(
        equipment=[MODULE.EquipmentItem(equipment_id=11031, name_key="SMEquipmentName03")],
        materials=[],
        loca_entries=[MODULE.EquipmentEffectLoca(equipment_id=21, effect_type=2, loca_key_suffix="03")],
        balancing=[],
    )
    item = MODULE.serialize_equipment(catalog)["equipment"][0]
    assert item["effects"] == []
    assert item["effectLocalizationCandidates"][0]["compactEffectId"] == 21
    assert item["effectLocalizationCandidates"][0]["joinStatus"] == "candidate_name_suffix_only"
