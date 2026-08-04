"""Conservative semantic lift from lossless strategy-config records.

Turns the intentionally-raw ``strategy-configs.json`` records into typed,
evidence-based domain artifacts WITHOUT fabricating effect semantics:

- ``research-domain.json``  — research / skill-node identities: name,
  DescriptionKey (game localization key), operating region, continent type.
- ``mine-economy-domain.json`` — continent identity map and prestige / region
  unlock skill configs (names + keys + ContinentType only).
- ``frontier-domain.json`` — event / battle-pass / frontier static configs
  that UnityPy already parsed into structured fields (e.g. MazeEventKeyConfig
  entries) plus frontier/barrier evidence pointers.
- ``power-score-domain.json`` — the SuperManagerPowerScoreSettings record as
  evidence with an opaque decoded integer payload; field names are NOT asserted
  because the game class definition is unavailable.

Every emitted object keeps its source provenance (bundle/assetPath/pathId/
recordId/rawSha256). Numeric effect magnitudes are never invented: where a
value exists only inside raw serialized bytes, it stays unresolved with an
explicit marker.
"""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any

# Evidence-derived enums. Continent names come from the *ContinentIncome /
# *ContinentSkillNode asset names that declare each ContinentType. Region
# values come from *Manager*SkillNodeConfig assets (Corridor=shaft, Ground=
# warehouse, Elevator) and match strategy_package.STRATEGY_ROLE_MAP.
CONTINENT_TYPES: dict[int, str] = {
    0: "Start",
    1: "Ice",
    2: "Fire",
    3: "Dawn",
    4: "Dusk",
    5: "Ancient",
    6: "Lost Desert",
    7: "Underwater",
    3000: "Impossible Island",
}
REGIONS: dict[int, str] = {1: "Mine Shaft", 2: "Warehouse", 3: "Elevator"}

RESEARCH_NAME_PATTERNS = re.compile(r"(SkillNodeConfig|SkillConfig)", re.IGNORECASE)
CONTINENT_NAME_PATTERNS = re.compile(r"(Continent|Region|Prestige)", re.IGNORECASE)
FRONTIER_NAME_PATTERNS = re.compile(
    r"(EventSeasonBundle|MazeEvent|Frontier|BarrierReward|BattlePass|EventHub)", re.IGNORECASE
)


def _record_identity(record: dict[str, Any]) -> dict[str, Any]:
    source = record.get("source") or {}
    raw = record.get("raw") or {}
    serialized = raw.get("serialized") or {}
    return {
        "recordId": record.get("recordId"),
        "name": record.get("name"),
        "semanticStatus": record.get("semanticStatus", "partial"),
        "source": {
            "bundle": source.get("bundle"),
            "assetPath": source.get("assetPath"),
            "objectType": source.get("objectType"),
            "pathId": source.get("pathId"),
        },
        "rawSha256": serialized.get("rawSha256")
        or (raw.get("rawSha256") if isinstance(raw.get("value"), dict) else None),
    }


def _lifted_fields(record: dict[str, Any]) -> dict[str, Any]:
    """Return only fields we can interpret without guessing."""
    fields = record.get("fields") or {}
    lifted: dict[str, Any] = {}
    for key in ("DescriptionKey", "ContinentType", "region", "m_Name"):
        if key in fields:
            lifted[key] = fields[key]
    entries = fields.get("entries")
    if isinstance(entries, list) and entries:
        lifted["entries"] = entries
    return lifted


def research_domain(records: list[dict[str, Any]]) -> dict[str, Any]:
    """Skill-node / skill-config identities with region + continent evidence."""
    nodes = []
    for record in records:
        name = record.get("name", "")
        if not RESEARCH_NAME_PATTERNS.search(name):
            continue
        fields = _lifted_fields(record)
        if not fields:
            continue
        entry = _record_identity(record)
        entry["fields"] = fields
        region = fields.get("region")
        if isinstance(region, int):
            entry["region"] = region
            entry["regionName"] = REGIONS.get(region)
        continent = fields.get("ContinentType")
        if isinstance(continent, int):
            entry["continentType"] = continent
            entry["continentName"] = CONTINENT_TYPES.get(continent)
        nodes.append(entry)
    return {
        "schemaVersion": "1.0.0",
        "domain": "research",
        "count": len(nodes),
        "records": sorted(nodes, key=lambda item: str(item.get("recordId"))),
        "note": "Identity-level evidence only. Effect magnitudes live in raw serialized bytes and remain unresolved until the game class definition or a validated cross-check names them.",
    }


def mine_economy_domain(records: list[dict[str, Any]]) -> dict[str, Any]:
    """Continent identity map + prestige / region-unlock skill evidence."""
    continents: dict[int, dict[str, Any]] = {}
    configs = []
    for record in records:
        name = record.get("name", "")
        fields = _lifted_fields(record)
        if not CONTINENT_NAME_PATTERNS.search(name):
            continue
        continent = fields.get("ContinentType")
        if isinstance(continent, int) and continent in CONTINENT_TYPES:
            continents.setdefault(continent, {
                "continentType": continent,
                "name": CONTINENT_TYPES[continent],
                "evidence": [],
            })["evidence"].append({
                "name": name,
                "recordId": record.get("recordId"),
                "rawSha256": (_record_identity(record).get("rawSha256")),
            })
        if fields:
            configs.append({**_record_identity(record), "fields": fields})
    return {
        "schemaVersion": "1.0.0",
        "domain": "mine-economy",
        "continents": sorted(continents.values(), key=lambda item: item["continentType"]),
        "configRecords": sorted(configs, key=lambda item: str(item.get("recordId"))),
        "note": "Continent identity is evidence-derived from asset names declaring ContinentType. Mine balancing magnitudes remain in raw bytes (unresolved).",
    }


def frontier_event_domain(records: list[dict[str, Any]]) -> dict[str, Any]:
    """Frontier / event / battle-pass configs with parsed structured fields."""
    configs = []
    for record in records:
        name = record.get("name", "")
        if not FRONTIER_NAME_PATTERNS.search(name):
            continue
        fields = _lifted_fields(record)
        if not fields:
            continue
        configs.append({**_record_identity(record), "fields": fields})
    return {
        "schemaVersion": "1.0.0",
        "domain": "frontier-event",
        "count": len(configs),
        "records": sorted(configs, key=lambda item: str(item.get("recordId"))),
        "note": "Static event/season/frontier configs with parsed fields only. Player-specific state (Sparks, current barrier, live cost) is not static APK data.",
    }


def power_score_domain(records: list[dict[str, Any]]) -> dict[str, Any]:
    """Power-score settings evidence with an opaque decoded integer payload.

    The serialized MonoBehaviour exposes only m_Name/m_Enabled via UnityPy. The
    remaining bytes are reported as an integer array WITHOUT field names: the
    game class definition is unavailable, so naming them would be fabrication.
    Phase-2 power-score parity work validates these numbers against the
    cross-check reference before any field is named.
    """
    import base64
    import struct

    for record in records:
        name = record.get("name", "")
        if "PowerScoreSettings" not in name:
            continue
        raw = (record.get("raw") or {}).get("serialized") or {}
        payload = base64.b64decode(raw.get("rawBytes", "")) if raw.get("rawBytes") else b""
        decoded: dict[str, Any] = {"unavailableReason": "raw_bytes_missing"} if not payload else {}
        if payload:
            ints = list(struct.unpack("<%di" % (len(payload) // 4), payload[: len(payload) // 4 * 4]))
            tail = payload[len(payload) // 4 * 4 :]
            decoded = {
                "int32Payload": ints,
                "trailingBytes": len(tail),
                "fieldNamesUnverified": True,
            }
        return {
            "schemaVersion": "1.0.0",
            "domain": "power-score",
            "count": 1,
            "records": [{**_record_identity(record), "decoded": decoded}],
            "note": "Opaque decoded integer payload; field names unverified (no game class definition). Must be cross-checked before influencing scoring.",
        }
    return {"schemaVersion": "1.0.0", "domain": "power-score", "count": 0, "records": [], "note": "No PowerScoreSettings record found."}


def build_semantic_domains(configs_doc: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Build all four domain artifacts from a strategy-configs document."""
    records = configs_doc.get("records") or (configs_doc if isinstance(configs_doc, list) else [])
    return {
        "research-domain.json": research_domain(records),
        "mine-economy-domain.json": mine_economy_domain(records),
        "frontier-domain.json": frontier_event_domain(records),
        "power-score-domain.json": power_score_domain(records),
    }


def write_domains(out_dir: Path, configs_doc: dict[str, Any]) -> dict[str, str]:
    out_dir.mkdir(parents=True, exist_ok=True)
    hashes: dict[str, str] = {}
    for filename, doc in build_semantic_domains(configs_doc).items():
        content = json.dumps(doc, ensure_ascii=False, sort_keys=True, indent=2) + "\n"
        path = out_dir / filename
        path.write_text(content, encoding="utf-8")
        hashes[filename] = hashlib.sha256(content.encode("utf-8")).hexdigest()
    return hashes
