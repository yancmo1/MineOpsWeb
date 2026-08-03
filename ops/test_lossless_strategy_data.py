"""Focused fake-object tests for release-scoped lossless strategy inputs."""
import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

OPS = Path(__file__).resolve().parent
sys.path.insert(0, str(OPS))

from equipment_extractor import EquipmentCatalog, EquipmentItem, EquipmentBalancing, build_equipment_domain
from il2cpp_extractor import ExtractedManager, build_manager_domain, extract_manager
from strategy_data import canonical_json, named_records_from_env
from strategy_package import build_candidate


class FakeParam:
    def __init__(self, **attrs):
        self.__dict__.update(attrs)


class FakeObject:
    def __init__(self, params):
        self.Params = params


class FakePointer:
    def __init__(self, data, path_id=7, error=None, type_name="MonoBehaviour"):
        self._data = data
        self.path_id = path_id
        self._error = error
        self.type = type("FakeType", (), {"name": type_name})()

    def read(self):
        if self._error:
            raise self._error
        return self._data


class FakeEnvironment:
    def __init__(self, container):
        self.container = container


class TestLosslessStrategyInputs(unittest.TestCase):
    def test_named_records_keep_every_params_row_and_provenance(self):
        env = FakeEnvironment({
            "assets/config/Skill.asset": FakePointer(FakeObject([FakeParam(Level=1), FakeParam(Level=2)]), 42),
            "assets/config/Broken.asset": FakePointer(None, 43, ValueError("bad type tree")),
        })
        records, unresolved = named_records_from_env(env, "configfiles_assets_all_fake.bundle")
        self.assertEqual(records[0]["source"]["bundle"], "configfiles_assets_all_fake.bundle")
        self.assertEqual(records[0]["source"]["pathId"], 42)
        self.assertEqual([row["Level"] for row in records[0]["params"]], [1, 2])
        self.assertEqual(records[0]["semanticStatus"], "partial")
        evidence_id = records[0]["raw"]["serialized"]["unresolvedEvidenceId"]
        self.assertEqual(evidence_id, f"strategy-config-raw-bytes-{records[0]['recordId']}")
        self.assertTrue(any(row.get("evidenceId") == evidence_id for row in unresolved))
        self.assertEqual(unresolved[0]["kind"], "config_deserialization_failed")

    def test_manager_domain_preserves_all_rows_and_unresolved_join(self):
        manager = ExtractedManager(
            manager_id=10006, fields={}, assets_found=[], assets_missing=["ToFragments"], warnings=["source not found"],
            raw_asset_data={
                "10006_SuperManagersActivesToLevels.asset": {
                    "key": "assets/10006_SuperManagersActivesToLevels.asset", "sourceBundle": "sm.bundle",
                    "objectPathId": 101, "raw_type": "Fake", "params": [{"Level": 1}, {"Level": 2}],
                },
                "10006_SuperManagerToFragments.asset": {
                    "key": "assets/10006_SuperManagerToFragments.asset", "sourceBundle": "sm.bundle",
                    "objectPathId": 102, "raw_type": "Fake", "params": [{"FragmentId": 900006}],
                },
            },
        )
        domain = build_manager_domain([manager], "fixture-release")
        row = domain["managers"][0]
        self.assertEqual(row["canonicalId"], "sm-10006")
        self.assertEqual(len(row["activeLevels"][0]["params"]), 2)
        self.assertEqual(row["fragmentMappings"][0]["sourceObjectPathId"], 102)
        self.assertEqual(row["unresolvedEvidenceIds"][0], "manager-10006-missing-tofragments")
        raw_evidence_id = row["activeLevels"][0]["rawBytesUnresolvedEvidenceId"]
        self.assertIn(raw_evidence_id, row["unresolvedEvidenceIds"])
        self.assertTrue(any(item.get("evidenceId") == raw_evidence_id for item in domain["source"]["unresolved"]))

    def test_manager_extraction_does_not_match_id_substrings(self):
        env = FakeEnvironment({
            "assets/10006_SuperManagers.asset": FakePointer(FakeObject([FakeParam(SuperManagerId=10006)]), 1),
            "assets/110006_SuperManagers.asset": FakePointer(FakeObject([FakeParam(SuperManagerId=110006)]), 2),
        })
        result = extract_manager(env, 10006)
        self.assertEqual(result.assets_found, ["10006_SuperManagers.asset"])
        self.assertEqual(len(result.raw_asset_data), 1)

    def test_non_data_assets_are_not_strategy_config_records(self):
        env = FakeEnvironment({"assets/mine_texture.png": FakePointer(FakeObject([]), 5, type_name="Texture2D")})
        records, unresolved = named_records_from_env(env, "generalassets_assets_all_fake.bundle")
        self.assertEqual(records, [])
        self.assertEqual(unresolved, [])

    def test_canonical_json_represents_invalid_unicode_without_write_failure(self):
        encoded = canonical_json({"value": "bad\udc8btext"})
        self.assertEqual(json.loads(encoded)["value"], "bad\\udc8btext")

    def test_canonical_json_preserves_unsafe_integers_for_javascript(self):
        encoded = canonical_json({"pathId": 6247196878714893951, "wholeFloat": 1800.0, "largeFloat": 5.11e23})
        self.assertEqual(json.loads(encoded), {"pathId": "6247196878714893951", "wholeFloat": 1800, "largeFloat": "5.11e+23"})

    def test_equipment_domain_keeps_balancing_and_localization_rows(self):
        catalog = EquipmentCatalog(
            equipment=[EquipmentItem(11001, "SMEquipmentName01")], materials=[], loca_entries=[],
            balancing=[EquipmentBalancing(11001, 1, 1.5)], raw_records=[{"sourceBundle": "cf.bundle"}],
        )
        domain = build_equipment_domain(catalog, "fixture-release")
        self.assertEqual(domain["balancing"][0]["raw"]["value"], 1.5)
        self.assertEqual(domain["equipment"][0]["recordId"], "equipment:11001")
        self.assertEqual(domain["source"]["rawRecords"][0]["sourceBundle"], "cf.bundle")

    def test_equipment_domain_retains_dangling_rows_as_unresolved_evidence(self):
        catalog = EquipmentCatalog(
            equipment=[EquipmentItem(11001, "SMEquipmentName01")], materials=[], loca_entries=[],
            balancing=[EquipmentBalancing(12, 1, 1.5)], raw_records=[],
        )
        domain = build_equipment_domain(catalog, "fixture-release")
        self.assertEqual(domain["balancing"][0]["canonicalId"], "equipment:12")
        self.assertEqual(domain["source"]["unresolved"][0]["subjectId"], "equipment:12")

    def test_candidate_manifest_is_dynamic_canonical_and_written_last(self):
        with tempfile.TemporaryDirectory() as tmp:
            release = Path(tmp) / "1.2.3_456_capture"
            release.mkdir()
            (release / "release.json").write_text(json.dumps({
                "releaseId": release.name, "versionName": "1.2.3", "versionCode": 456,
                "capturedAt": "2026-08-02T00:00:00Z", "apkHashes": {"base.apk": "abc"},
            }))
            manager = ExtractedManager(1, {}, [], [], [], {"1_SuperManagers.asset": {"key": "x", "sourceBundle": "b", "objectPathId": 1, "raw_type": "Fake", "params": [{}]}})
            equipment = EquipmentCatalog([], [], [], [])
            configs = {"schemaVersion": "1.0.0", "catalogVersion": release.name, "releaseId": release.name, "generatedAt": "2026-08-02T00:00:00Z", "source": {"kind": "apk_capture", "unresolved": []}, "records": [{"recordId": "cfg-1", "domain": "configfiles", "semanticStatus": "partial", "source": {"bundle": "configfiles.bundle", "assetPath": "x.asset", "objectType": "MonoBehaviour", "pathId": 1}, "raw": {"serialized": {"rawEncoding": "base64", "rawBytes": "", "rawSha256": hashlib.sha256(b"").hexdigest(), "rawByteLength": 0}}}]}
            out = Path(tmp) / "candidate"
            with patch("strategy_package.run_batch", return_value=([manager], None)), patch("strategy_package.extract_equipment", return_value=equipment), patch("strategy_package.extract_strategy_configs", return_value=configs):
                build_candidate(release, out)
            manifest = json.loads((out / "manifest.json").read_text())
            self.assertEqual(manifest["gameVersion"], "1.2.3")
            self.assertEqual(manifest["gameVersionCode"], 456)
            artifact = next(row for row in manifest["artifacts"] if row["filename"] == "manager-domain.json")
            content = (out / artifact["filename"]).read_bytes()
            self.assertEqual(artifact["sha256"], hashlib.sha256(content).hexdigest())
            self.assertTrue(artifact["required"])
            self.assertTrue((out / "catalog-core.json").is_file())
            self.assertTrue((out / "validation-report.json").is_file())
            evidence = json.loads((out / "unresolved-evidence.json").read_text())
            self.assertEqual(evidence["entries"][-1]["evidenceId"], "strategy-config-cfg-1")
            self.assertFalse((release / "exports" / "v3" / "manifest.json").exists())
            validation = subprocess.run(
                ["node", "tools/validation/validate-catalog.mjs", str(out)],
                cwd=OPS.parent,
                capture_output=True,
                text=True,
            )
            self.assertEqual(validation.returncode, 0, validation.stdout + validation.stderr)


if __name__ == "__main__":
    unittest.main()
