import importlib.util
from pathlib import Path

SPEC = importlib.util.spec_from_file_location("passive_extractor", Path(__file__).with_name("passive_extractor.py"))
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def test_build_passive_domain_preserves_ids_unlocks_rank_effects_and_gap():
    manager_domain = {"managers": [{
        "canonicalId": "sm-10003",
        "sourceManagerId": 10003,
        "definition": {"params": [{"Passive1": 5, "Passive2": 1010, "Passive3": 1008}]},
        "promotionMilestones": [{"params": [{"PassiveId": 1010, "Level": 30, "Promotion": 3, "UnlocksPassive": 1}]}],
        "rankEffects": [{"params": [{"Rank": 3, "PassiveIncrease": 0.33}]}],
    }]}
    result = MODULE.build_passive_domain(manager_domain, {"records": []}, "release", "now")
    steiner = next(row for row in result["passives"] if row["passiveId"] == 1010)
    assert steiner["unlockMilestones"][0]["level"] == 30
    assert steiner["rankEffects"][0]["passiveIncrease"] == 0.33
    assert steiner["valueTableStatus"] == "not_found"
    assert any(entry["subjectId"] == "passive:1010" for entry in result["source"]["unresolved"])
