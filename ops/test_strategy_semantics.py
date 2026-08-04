"""Regression tests for ops/strategy_semantics.py (conservative semantic lift)."""
import json
import unittest
from pathlib import Path

import strategy_semantics as sem


def make_record(name, domain="configfiles", fields=None, path_id="123", raw_b64="", raw_sha="abc"):
    return {
        "recordId": f"rec-{name}",
        "name": name,
        "domain": domain,
        "semanticStatus": "partial",
        "source": {"bundle": "configfiles_assets_all_x.bundle", "assetPath": f"Assets/x/{name}", "objectType": "MonoBehaviour", "pathId": path_id},
        "fields": fields or {},
        "raw": {"serialized": {"rawBytes": raw_b64, "rawSha256": raw_sha, "rawByteLength": 0}},
    }


class ResearchDomainTest(unittest.TestCase):
    def test_skill_nodes_lift_region_and_continent(self):
        records = [
            make_record("ElevatorManagerCooldownSkillNodeConfig.asset", fields={"DescriptionKey": "ElevatorManagerCooldownSkill", "region": 3, "m_Name": "ElevatorManagerCooldownSkillNodeConfig"}),
            make_record("FireContinentPrestigeCostReductionSkillConfig.asset", fields={"ContinentType": 2, "DescriptionKey": "SkillPrestigeCostContinental", "m_Name": "FireContinentPrestigeCostReductionSkillConfig"}),
            make_record("SuperManager047_Atlas.asset", domain="generalassets", fields={"m_Name": "SuperManager047_Atlas"}),
        ]
        doc = sem.research_domain(records)
        self.assertEqual(doc["count"], 2)
        elevator = next(r for r in doc["records"] if "Elevator" in r["name"])
        self.assertEqual(elevator["region"], 3)
        self.assertEqual(elevator["regionName"], "Elevator")
        fire = next(r for r in doc["records"] if "FireContinent" in r["name"])
        self.assertEqual(fire["continentType"], 2)
        self.assertEqual(fire["continentName"], "Fire")
        self.assertEqual(fire["fields"]["DescriptionKey"], "SkillPrestigeCostContinental")

    def test_visual_assets_excluded(self):
        records = [make_record("SuperManager047_Atlas.asset", domain="generalassets", fields={"m_Name": "SuperManager047_Atlas"})]
        self.assertEqual(sem.research_domain(records)["count"], 0)


class MineEconomyDomainTest(unittest.TestCase):
    def test_continent_identity_map(self):
        records = [
            make_record("IceContinentIncome.asset", fields={"ContinentType": 1, "DescriptionKey": "AncientSkillContinentIncome", "m_Name": "IceContinentIncome"}),
            make_record("ImpossibleIslandContinentIncome.asset", fields={"ContinentType": 3000, "DescriptionKey": "AncientSkillContinentIncome", "m_Name": "ImpossibleIslandContinentIncome"}),
        ]
        doc = sem.mine_economy_domain(records)
        types = {c["continentType"]: c["name"] for c in doc["continents"]}
        self.assertEqual(types[1], "Ice")
        self.assertEqual(types[3000], "Impossible Island")
        self.assertEqual(doc["configRecords"][0]["fields"]["ContinentType"], 1)


class FrontierDomainTest(unittest.TestCase):
    def test_parsed_entries_preserved(self):
        entries = [{"ConsumableId": 300011, "KeyId": 1, "KeyLocaKey": "MazeKeyRed"}]
        records = [make_record("MazeEventKeyConfig.asset", fields={"entries": entries, "m_Name": "MazeEventKeyConfig"})]
        doc = sem.frontier_event_domain(records)
        self.assertEqual(doc["count"], 1)
        self.assertEqual(doc["records"][0]["fields"]["entries"], entries)


class PowerScoreDomainTest(unittest.TestCase):
    def test_opaque_payload_no_field_names(self):
        import base64
        import struct
        payload = struct.pack("<5i", 1, 2, 3, 4, 5)
        records = [make_record("SuperManagerPowerScoreSettings.asset", domain="supermanagerpowerscore", fields={"m_Enabled": 1, "m_Name": "SuperManagerPowerScoreSettings"}, raw_b64=base64.b64encode(payload).decode("ascii"))]
        doc = sem.power_score_domain(records)
        self.assertEqual(doc["count"], 1)
        decoded = doc["records"][0]["decoded"]
        self.assertEqual(decoded["int32Payload"], [1, 2, 3, 4, 5])
        self.assertTrue(decoded["fieldNamesUnverified"])

    def test_missing_record(self):
        self.assertEqual(sem.power_score_domain([])["count"], 0)


class BuildDomainsTest(unittest.TestCase):
    def test_builds_all_four(self):
        records = [
            make_record("ElevatorManagerCooldownSkillNodeConfig.asset", fields={"region": 3, "DescriptionKey": "x"}),
            make_record("SuperManagerPowerScoreSettings.asset", domain="supermanagerpowerscore", fields={"m_Name": "SuperManagerPowerScoreSettings"}),
        ]
        docs = sem.build_semantic_domains({"records": records})
        self.assertEqual(set(docs), {"research-domain.json", "mine-economy-domain.json", "frontier-domain.json", "power-score-domain.json"})
        self.assertEqual(docs["research-domain.json"]["count"], 1)
        self.assertEqual(docs["power-score-domain.json"]["count"], 1)

    def test_write_domains_is_deterministic(self):
        records = [make_record("ElevatorManagerCooldownSkillNodeConfig.asset", fields={"region": 3, "DescriptionKey": "x"})]
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            first = sem.write_domains(Path(tmp), {"records": records})
            second = sem.write_domains(Path(tmp), {"records": records})
        self.assertEqual(first, second)


if __name__ == "__main__":
    unittest.main()
