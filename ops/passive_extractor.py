"""Build a conservative passive-data artifact from an APK candidate.

The APK currently exposes passive identities, unlock milestones, and rank
increase factors.  It does not expose the value table used by the game UI to
turn (passive, rarity, rank, promotion) into values such as 1.95x.  This
module keeps the available evidence together and records that missing join so
future captures can be compared without silently filling it from community
data.
"""
from __future__ import annotations

from typing import Any


def _rows(asset: Any) -> list[dict[str, Any]]:
    if not isinstance(asset, dict) or not isinstance(asset.get("params"), list):
        return []
    return [row for row in asset["params"] if isinstance(row, dict)]


def build_passive_domain(manager_domain: dict[str, Any], configs: dict[str, Any], release_id: str, generated_at: str, source: dict[str, Any] | None = None) -> dict[str, Any]:
    passives: dict[int, dict[str, Any]] = {}
    for manager in manager_domain.get("managers", []):
        definition = manager.get("definition") if isinstance(manager, dict) else None
        definition_rows = _rows(definition)
        definition_row = definition_rows[0] if definition_rows else {}
        for slot in range(1, 4):
            passive_id = definition_row.get(f"Passive{slot}")
            if not isinstance(passive_id, int) or passive_id == 0:
                continue
            entry = passives.setdefault(passive_id, {
                "canonicalId": f"passive:{passive_id}",
                "passiveId": passive_id,
                "managerIds": [],
                "unlockMilestones": [],
                "rankEffects": [],
                "valueTables": [],
                "valueTableStatus": "not_found",
            })
            manager_id = manager.get("sourceManagerId")
            if manager_id not in entry["managerIds"]:
                entry["managerIds"].append(manager_id)
            for asset in manager.get("promotionMilestones", []):
                for row in _rows(asset):
                    if row.get("PassiveId") == passive_id and row.get("UnlocksPassive"):
                        entry["unlockMilestones"].append({
                            "managerId": manager_id,
                            "level": row.get("Level"),
                            "promotion": row.get("Promotion"),
                            "source": asset.get("source"),
                        })
            for asset in manager.get("rankEffects", []):
                for row in _rows(asset):
                    entry["rankEffects"].append({
                        "managerId": manager_id,
                        "rank": row.get("Rank"),
                        "passiveIncrease": row.get("PassiveIncrease"),
                        "source": asset.get("source"),
                    })

    candidates = []
    for record in configs.get("records", []):
        name = str(record.get("name", ""))
        keys = set()
        for row in record.get("params", []) if isinstance(record.get("params"), list) else []:
            if isinstance(row, dict):
                keys.update(row)
        if "passive" in name.lower() or any("passive" in str(key).lower() for key in keys):
            candidates.append({"recordId": record.get("recordId"), "name": name, "source": record.get("source"), "keys": sorted(str(key) for key in keys)})

    unresolved = []
    for passive in passives.values():
        unresolved.append({
            "evidenceId": f"passive-scaling-missing-{passive['passiveId']}",
            "domain": "passive",
            "subjectId": passive["canonicalId"],
            "fieldPath": "valueTables",
            "status": "blocked",
            "severity": "warning",
            "reason": "APK capture contains passive identity/unlock/rank evidence but no passive value table keyed by rarity, rank, and promotion.",
        })
    return {
        "schemaVersion": "1.0.0",
        "catalogVersion": release_id,
        "releaseId": release_id,
        "generatedAt": generated_at,
        "source": {**(source or {"kind": "apk_capture"}), "unresolved": unresolved},
        "passives": sorted(passives.values(), key=lambda item: item["passiveId"]),
        "candidateSourceRecords": sorted(candidates, key=lambda item: str(item.get("recordId"))),
    }
