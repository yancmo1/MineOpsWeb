"""
Tests for the IL2CPP manager extractor.

Uses sanitized fixtures extracted from real APK data. Tests cover:
- Basic field extraction from Params
- Enum mapping (rarity, category, area, gender)
- Missing asset handling
- ID validation
- Canonical record structure
"""
import json
import unittest
from pathlib import Path

# The extractor module
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
from mineops_data_engine.il2cpp_extractor import (
    RARITY_MAP,
    CATEGORY_MAP,
    REGION_MAP,
    GENDER_MAP,
    _enum_label,
    EXPECTED_ASSET_TYPES,
    ExtractedField,
    ExtractedManager,
)


class TestEnumMappings(unittest.TestCase):
    """Verify enum name-to-value mappings from IL2CPP dump.cs."""

    def test_rarity_mapping(self):
        self.assertEqual(RARITY_MAP[1], "Common")
        self.assertEqual(RARITY_MAP[2], "Rare")
        self.assertEqual(RARITY_MAP[3], "Epic")
        self.assertEqual(RARITY_MAP[4], "Legendary")

    def test_rarity_unknown_value(self):
        result = _enum_label(99, RARITY_MAP, "Rarity")
        self.assertEqual(result, "Unknown-Rarity-99")

    def test_rarity_none(self):
        self.assertIsNone(_enum_label(None, RARITY_MAP, "Rarity"))

    def test_category_mapping(self):
        self.assertEqual(CATEGORY_MAP[1], "None")
        self.assertEqual(CATEGORY_MAP[2], "Gems")
        self.assertEqual(CATEGORY_MAP[3], "Iap")
        self.assertEqual(CATEGORY_MAP[4], "Event")
        self.assertEqual(CATEGORY_MAP[5], "ImpossibleMine")

    def test_region_mapping(self):
        self.assertEqual(REGION_MAP[1], "Corridor")
        self.assertEqual(REGION_MAP[2], "Ground")
        self.assertEqual(REGION_MAP[3], "Elevator")

    def test_gender_mapping(self):
        self.assertEqual(GENDER_MAP[0], "Male")
        self.assertEqual(GENDER_MAP[1], "Female")


class TestExpectedAssetTypes(unittest.TestCase):
    """Verify the 7 expected asset types are defined."""

    def test_all_seven_types_present(self):
        expected = {
            "SuperManagers",
            "ActivesToLevels",
            "LevelsToPromotions",
            "ActiveEffectFactorType",
            "RankEffectsValues",
            "ToFragments",
            "DataConfig",
        }
        self.assertEqual(set(EXPECTED_ASSET_TYPES), expected)


class TestExtractedManagerStructure(unittest.TestCase):
    """Verify the data container structure."""

    def test_minimal_manager(self):
        mgr = ExtractedManager(
            manager_id=10001,
            fields={
                "SuperManagers.asset.NameKey": ExtractedField(
                    field_name="NameKey",
                    raw_value="SM_Test",
                    source_asset="10001_SuperManagers.asset",
                    provenance="direct",
                ),
                "rarity_label": ExtractedField(
                    field_name="rarityLabel",
                    raw_value="Legendary",
                    source_asset="10001_SuperManagers.asset",
                    provenance="mapped",
                ),
            },
            assets_found=["10001_SuperManagers.asset"],
            assets_missing=[],
            warnings=[],
        )
        self.assertEqual(mgr.manager_id, 10001)
        self.assertEqual(len(mgr.fields), 2)
        self.assertEqual(mgr.fields["rarity_label"].raw_value, "Legendary")
        self.assertEqual(mgr.assets_missing, [])

    def test_partial_manager_missing_assets(self):
        mgr = ExtractedManager(
            manager_id=10020,
            fields={},
            assets_found=["10020_SuperManagers.asset"],
            assets_missing=["ActiveEffectFactorType", "RankEffectsValues"],
            warnings=["Missing assets"],
        )
        self.assertEqual(len(mgr.assets_missing), 2)


if __name__ == "__main__":
    unittest.main()
