"""Schema-valid, candidate-only strategy catalog package construction."""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from equipment_extractor import build_equipment_domain, extract_equipment
from il2cpp_extractor import RARITY_MAP, build_manager_domain, run_batch
from strategy_data import extract_strategy_configs, write_canonical_json
from strategy_semantics import build_semantic_domains
from passive_extractor import build_passive_domain


DOMAIN_FILES = ("manager-domain.json", "equipment-domain.json", "passive-domain.json", "strategy-configs.json", "unresolved-evidence.json", "research-domain.json", "mine-economy-domain.json", "frontier-domain.json", "power-score-domain.json")
STANDARD_FILES = ("catalog-core.json", "validation-report.json", "relationships.json", "mappings.json", "localization.json", "assets.json", "changelog.json")
STRATEGY_ROLE_MAP = {1: "Mine Shaft", 2: "Warehouse", 3: "Elevator"}


def release_metadata(release_dir: Path) -> dict[str, Any]:
    release_file = release_dir / "release.json"
    if not release_file.is_file():
        raise FileNotFoundError(f"Missing release metadata: {release_file}")
    data = json.loads(release_file.read_text(encoding="utf-8"))
    required = ("releaseId", "versionName", "versionCode")
    missing = [name for name in required if data.get(name) in (None, "")]
    if missing:
        raise ValueError(f"release.json missing required metadata: {', '.join(missing)}")
    if data["releaseId"] != release_dir.name:
        raise ValueError("release.json releaseId does not match release directory name")
    return data


def _generated_at(metadata: dict[str, Any]) -> str:
    value = metadata.get("capturedAt")
    if isinstance(value, str) and value:
        return value
    return datetime.now(timezone.utc).isoformat()


def _source(metadata: dict[str, Any]) -> dict[str, Any]:
    hashes = {name: value for name, value in metadata.get("apkHashes", {}).items() if isinstance(value, str) and re.fullmatch(r"[a-f0-9]{64}", value)}
    return {"kind": "apk_capture", "versionName": metadata["versionName"], "versionCode": metadata["versionCode"], "apkHashes": hashes, "parserVersion": "1.0.0"}


def _ledger_entry(raw: dict[str, Any], index: int) -> dict[str, Any]:
    if "evidenceId" in raw:
        return raw
    entry = {
        "evidenceId": f"evidence-{index}",
        "domain": raw.get("domain", "strategy_config"),
        "subjectId": raw.get("subjectId"),
        "fieldPath": raw.get("fieldPath"),
        "status": raw.get("status", "partial"),
        "severity": raw.get("severity", "warning"),
        "reason": raw.get("reason", raw.get("kind", "Source record could not be fully interpreted.")),
        "rawValue": raw,
    }
    if isinstance(raw.get("source"), dict):
        entry["source"] = raw["source"]
    return entry


def _unresolved_evidence(metadata: dict[str, Any], generated_at: str, manager_domain: dict[str, Any], equipment_domain: dict[str, Any], passive_domain: dict[str, Any], configs: dict[str, Any]) -> dict[str, Any]:
    raw_entries = []
    raw_entries.extend(manager_domain.get("source", {}).get("unresolved", []))
    raw_entries.extend(equipment_domain.get("source", {}).get("unresolved", []))
    raw_entries.extend(passive_domain.get("source", {}).get("unresolved", []))
    raw_entries.extend(configs.get("source", {}).get("unresolved", []))
    entries = [_ledger_entry(item, index) for index, item in enumerate(raw_entries)]
    # Every raw config has intentionally conservative semantics.  The ledger
    # makes that review obligation visible without copying the raw payload.
    for record in configs.get("records", []):
        if record.get("semanticStatus") in {"partial", "unresolved"}:
            entries.append({
                "evidenceId": f"strategy-config-{record['recordId']}",
                "domain": record.get("domain", "strategy_config"),
                "subjectId": record["recordId"],
                "fieldPath": None,
                "status": record["semanticStatus"],
                "severity": "info",
                "reason": "Source record was preserved, but gameplay semantics have not been normalized.",
                "source": record["source"],
            })
    return {"schemaVersion": "1.0.0", "catalogVersion": metadata["releaseId"], "releaseId": metadata["releaseId"], "generatedAt": generated_at,
            "source": {"kind": "apk_capture", "artifact": "lossless-source-evidence"}, "entries": entries}


def _definition_params(manager: dict[str, Any]) -> dict[str, Any]:
    definition = manager.get("definition")
    if isinstance(definition, dict):
        params = definition.get("params", [])
        if params and isinstance(params[0], dict):
            return params[0]
    return {}


def _progression(manager: dict[str, Any]) -> list[dict[str, Any]]:
    rows = []
    for asset in manager.get("activeLevels", []):
        for value in asset.get("params", []) if isinstance(asset, dict) else []:
            if not isinstance(value, dict) or not isinstance(value.get("Level"), int):
                continue
            active = value.get("ActiveStrength")
            rows.append({"level": value["Level"], "value": active if isinstance(active, (int, float)) else None, "cost": None, "extensions": {"source": value}})
    return rows


def _core_manager(manager: dict[str, Any]) -> dict[str, Any]:
    definition = _definition_params(manager)
    rarity_value = definition.get("SuperManagerRarity", definition.get("Rarity"))
    area_value = definition.get("AreaId")
    passives = []
    promotion_rows = [
        row
        for asset in manager.get("promotionMilestones", [])
        for row in (asset.get("params", []) if isinstance(asset, dict) else [])
        if isinstance(row, dict)
    ]
    for index in range(1, 4):
        passive_id = definition.get(f"Passive{index}")
        if passive_id not in (None, 0):
            unlock = next((row for row in promotion_rows if row.get("PassiveId") == passive_id and row.get("UnlocksPassive")), None)
            passives.append({"canonicalId": f"passive:{passive_id}", "name": None, "description": None, "extensions": {
                "sourcePassiveId": passive_id,
                "slot": index,
                "unlockLevel": unlock.get("Level") if unlock else None,
                "promoReq": unlock.get("Promotion") if unlock else None,
            }})
    cooldown = definition.get("Cooldown")
    ability = {"canonicalId": f"{manager['canonicalId']}:active", "name": None, "description": None, "type": None, "target": None,
               "cooldown": cooldown if isinstance(cooldown, (int, float)) else None, "extensions": {"definition": definition, "effectFactors": manager.get("effectFactors", [])}}
    return {"canonicalId": manager["canonicalId"], "name": None, "nameSource": "unknown",
            "rarity": RARITY_MAP[rarity_value].lower() if rarity_value in RARITY_MAP else None,
            "role": STRATEGY_ROLE_MAP.get(area_value), "element": None, "abilities": [ability], "passives": passives, "progression": _progression(manager),
            "sourceIdentifiers": {"superManagerId": str(manager["sourceManagerId"]), "nameKey": str(definition["NameKey"]) if definition.get("NameKey") is not None else None},
            "extensions": {"losslessDomain": "manager-domain.json", "definition": definition}}


def _minimal_core(metadata: dict[str, Any], generated_at: str, manager_domain: dict[str, Any], equipment_domain: dict[str, Any]) -> dict[str, Any]:
    managers = [_core_manager(item) for item in manager_domain["managers"]]
    equipment = [{"canonicalId": row["canonicalId"], "name": None, "nameSource": "unknown", "sourceIdentifiers": {"equipmentId": row["recordId"].split(":", 1)[1]}, "extensions": {"losslessDomain": "equipment-domain.json"}} for row in equipment_domain["equipment"]]
    return {"schemaVersion": "1.0.0", "catalogVersion": metadata["releaseId"], "releaseId": metadata["releaseId"], "generatedAt": generated_at,
            "source": _source(metadata), "managers": managers, "mines": [], "equipment": equipment, "research": [], "collectibles": [], "artifacts": []}


def _standard_artifacts(metadata: dict[str, Any], generated_at: str, manager_domain: dict[str, Any], equipment_domain: dict[str, Any], unresolved: dict[str, Any]) -> dict[str, dict[str, Any]]:
    core = _minimal_core(metadata, generated_at, manager_domain, equipment_domain)
    mappings = [{"canonicalId": row["canonicalId"], "kind": "apk_superManagerId", "sourceValue": str(row["sourceManagerId"]), "confidence": "verified"} for row in manager_domain["managers"]]
    unresolved_count = len(unresolved["entries"])
    changelog_unresolved = [{"canonicalId": row["subjectId"], "entityType": "manager", "reason": row["reason"], "severity": row["severity"]} for row in unresolved["entries"] if row.get("domain") == "manager" and row.get("subjectId")]
    return {
        "catalog-core.json": core,
        "relationships.json": {"schemaVersion": "1.0.0", "catalogVersion": metadata["releaseId"], "releaseId": metadata["releaseId"], "generatedAt": generated_at, "relationships": []},
        "mappings.json": {"schemaVersion": "1.0.0", "catalogVersion": metadata["releaseId"], "releaseId": metadata["releaseId"], "generatedAt": generated_at, "idMappings": mappings, "aliases": []},
        "localization.json": {"schemaVersion": "1.0.0", "catalogVersion": metadata["releaseId"], "releaseId": metadata["releaseId"], "generatedAt": generated_at, "locale": "en", "entries": {}},
        "assets.json": {"schemaVersion": "1.0.0", "catalogVersion": metadata["releaseId"], "releaseId": metadata["releaseId"], "generatedAt": generated_at, "assets": []},
        "changelog.json": {"schemaVersion": "1.0.0", "catalogVersion": metadata["releaseId"], "previousCatalogVersion": None, "generatedAt": generated_at,
            "summary": {"managersAdded": len(core["managers"]), "managersRemoved": 0, "managersChanged": 0, "identifiersChanged": 0, "spritesChanged": 0, "abilitiesChanged": 0, "unresolvedObjects": unresolved_count, "warnings": unresolved_count},
            "changes": {"added": ([{"canonicalId": row["canonicalId"], "entityType": "manager", "name": None, "severity": "info"} for row in core["managers"]] + [{"canonicalId": row["canonicalId"], "entityType": "equipment", "name": None, "severity": "info"} for row in core["equipment"]]), "removed": [], "changed": [], "unresolved": changelog_unresolved}},
        "validation-report.json": {"validationSchemaVersion": "1.0.0", "catalogVersion": metadata["releaseId"], "validatedAt": generated_at,
            "status": "review_required" if unresolved_count else "passed", "checks": [{"code": "LOSSLESS_DOMAIN_PRESENT", "severity": "info", "passed": True, "message": "Lossless strategy domain artifacts were written to the candidate."}],
            "blockingIssues": [], "warnings": ([{"code": "UNRESOLVED_SOURCE_EVIDENCE", "message": f"{unresolved_count} unresolved source evidence entries require review."}] if unresolved_count else []),
            "counts": {"errors": 0, "warnings": unresolved_count, "unresolved": unresolved_count}},
    }


def _record_count(value: dict[str, Any]) -> int:
    for key in ("managers", "equipment", "materials", "balancing", "localization", "records", "entries", "relationships", "idMappings", "assets"):
        if isinstance(value.get(key), list):
            return len(value[key])
    return 0


def _validate(domains: dict[str, dict[str, Any]]) -> None:
    evidence_ids = {row["evidenceId"] for row in domains["unresolved-evidence.json"]["entries"]}

    def validate_raw_bytes(raw: dict[str, Any], label: str, unresolved_key: str = "unresolvedEvidenceId") -> None:
        evidence_id = raw.get(unresolved_key)
        if evidence_id is not None:
            if set(raw) != {unresolved_key} or evidence_id not in evidence_ids:
                raise ValueError(f"{label} has invalid unresolved raw-byte evidence")
            return
        required = {"rawEncoding", "rawBytes", "rawSha256", "rawByteLength"}
        if not required.issubset(raw) or raw.get("rawEncoding") != "base64":
            raise ValueError(f"{label} is missing serialized bytes or linked unresolved evidence")
        try:
            value = base64.b64decode(raw["rawBytes"], validate=True)
        except (ValueError, TypeError) as error:
            raise ValueError(f"{label} contains invalid base64 bytes") from error
        if len(value) != raw["rawByteLength"] or hashlib.sha256(value).hexdigest() != raw["rawSha256"]:
            raise ValueError(f"{label} serialized byte metadata does not match its bytes")

    managers = domains["manager-domain.json"]["managers"]
    if len({row["canonicalId"] for row in managers}) != len(managers):
        raise ValueError("manager-domain contains duplicate canonical IDs")
    for manager in managers:
        for index, asset in enumerate(manager["raw"]["assets"]):
            if "rawBytesUnresolvedEvidenceId" in asset:
                validate_raw_bytes(
                    {"unresolvedEvidenceId": asset["rawBytesUnresolvedEvidenceId"]},
                    f"manager {manager['canonicalId']} asset {index}",
                )
            else:
                validate_raw_bytes(asset, f"manager {manager['canonicalId']} asset {index}")
    equipment = domains["equipment-domain.json"]
    for index, record in enumerate(equipment.get("source", {}).get("rawRecords", [])):
        validate_raw_bytes(record, f"equipment raw record {index}")
    ids = {row["recordId"] for row in equipment["equipment"]}
    unresolved_subjects = {row.get("subjectId") for row in equipment.get("source", {}).get("unresolved", [])}
    for row in equipment["balancing"] + equipment["localization"]:
        canonical = row.get("canonicalId")
        if canonical and canonical not in {f"equipment:{value.split(':', 1)[1]}" for value in ids} and canonical not in unresolved_subjects:
            raise ValueError("equipment-domain has an unknown equipment reference without unresolved evidence")
    configs = domains["strategy-configs.json"]["records"]
    if any(not row["source"].get("bundle") or not row["source"].get("assetPath") for row in configs):
        raise ValueError("strategy-configs contains a record without source provenance")
    for record in configs:
        serialized = record.get("raw", {}).get("serialized")
        if serialized is not None:
            validate_raw_bytes(serialized, f"strategy config {record['recordId']}")
    # Semantic-lift artifacts must be internally consistent with the raw configs.
    config_ids = {row["recordId"] for row in configs}
    for filename in ("research-domain.json", "mine-economy-domain.json", "frontier-domain.json"):
        for record in domains[filename].get("records", []) or domains[filename].get("configRecords", []):
            if record.get("recordId") not in config_ids:
                raise ValueError(f"{filename} references a recordId absent from strategy-configs")
    for entry in domains["research-domain.json"]["records"]:
        if entry.get("region") is not None and entry["region"] not in {1, 2, 3}:
            raise ValueError("research-domain has an out-of-range region")
        if entry.get("continentType") is not None and entry["continentType"] not in domains["mine-economy-domain.json"].get("continents", []) and not any(
            c["continentType"] == entry["continentType"] for c in domains["mine-economy-domain.json"].get("continents", [])
        ):
            raise ValueError("research-domain references an unknown continent type")
    if domains["power-score-domain.json"]["count"] > 1:
        raise ValueError("power-score-domain must contain at most one settings record")


def build_candidate(release_dir: Path | str, output_dir: Path | str | None = None) -> Path:
    release_dir = Path(release_dir).resolve()
    metadata = release_metadata(release_dir)
    candidate_dir = Path(output_dir).resolve() if output_dir else release_dir / "exports" / "strategy-candidates" / f"{metadata['releaseId']}.candidate"
    if candidate_dir == release_dir / "exports" / "v3":
        raise ValueError("candidate output must not be the active v3 package directory")
    if candidate_dir.exists():
        raise FileExistsError(f"Candidate output already exists: {candidate_dir}")
    generated_at = _generated_at(metadata)
    artifact_source = {"kind": "apk_capture", "releaseMetadata": "release.json"}
    managers, _ = run_batch(release_dir)
    manager_domain = build_manager_domain(managers, metadata["releaseId"], catalog_version=metadata["releaseId"], generated_at=generated_at, source=artifact_source)
    equipment_domain = build_equipment_domain(extract_equipment(release_dir), metadata["releaseId"], catalog_version=metadata["releaseId"], generated_at=generated_at, source=artifact_source)
    configs = extract_strategy_configs(release_dir, catalog_version=metadata["releaseId"], generated_at=generated_at, source=artifact_source)
    passive_domain = build_passive_domain(manager_domain, configs, metadata["releaseId"], generated_at, artifact_source)
    semantic_domains = build_semantic_domains(configs)
    unresolved = _unresolved_evidence(metadata, generated_at, manager_domain, equipment_domain, passive_domain, configs)
    domains = {"manager-domain.json": manager_domain, "equipment-domain.json": equipment_domain, "passive-domain.json": passive_domain, "strategy-configs.json": configs, "unresolved-evidence.json": unresolved, **semantic_domains}
    _validate(domains)
    artifacts = {**_standard_artifacts(metadata, generated_at, manager_domain, equipment_domain, unresolved), **domains}
    candidate_dir.mkdir(parents=True, exist_ok=False)
    entries = []
    for filename in (*STANDARD_FILES, *DOMAIN_FILES):
        digest, byte_count = write_canonical_json(candidate_dir / filename, artifacts[filename])
        entries.append({"filename": filename, "path": filename, "contentType": "application/json", "sha256": digest, "bytes": byte_count,
                        "schemaVersion": "1.0.0", "recordCount": _record_count(artifacts[filename]), "required": filename in {"catalog-core.json", "validation-report.json", "manager-domain.json"}})
    core = artifacts["catalog-core.json"]
    research_count = len(artifacts["research-domain.json"]["records"])
    continent_count = len(artifacts["mine-economy-domain.json"]["continents"])
    manifest = {"manifestSchemaVersion": "2.0.0", "catalogVersion": metadata["releaseId"], "releaseId": metadata["releaseId"], "gameVersion": metadata["versionName"], "gameVersionCode": metadata["versionCode"],
                "generatedAt": generated_at, "generator": {"name": "MineOpsWeb lossless-strategy-package", "version": "1.0.0"}, "status": "review_required" if unresolved["entries"] else "candidate",
                "artifacts": entries, "counts": {"managers": len(core["managers"]), "mines": continent_count, "equipment": len(core["equipment"]), "research": research_count, "collectibles": 0, "artifacts": 0, "relationships": 0, "unresolvedObjects": len(unresolved["entries"])}, "previousCatalogVersion": None, "storage": {"baseUrl": "./", "cdnUrl": None}}
    # Manifest intentionally follows every artifact so it only ever describes complete content.
    write_canonical_json(candidate_dir / "manifest.json", manifest)
    return candidate_dir


def main() -> None:
    parser = argparse.ArgumentParser(description="Build a lossless strategy data candidate package")
    parser.add_argument("release_dir", type=Path)
    parser.add_argument("--output-dir", type=Path)
    args = parser.parse_args()
    print(build_candidate(args.release_dir, args.output_dir))


if __name__ == "__main__":
    main()
