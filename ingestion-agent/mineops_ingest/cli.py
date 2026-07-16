import argparse
import hashlib
import json
import os
from pathlib import Path
import httpx

DEFAULT_API = "http://localhost:8000/api/v1"
CAPTURE_SCHEMA_VERSION = "1"
CAPTURE_ENGINE_VERSION = "mineops-ingest/0.1.0"


def _canonical_json_bytes(value: dict) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8")


def _object_counts(payload: dict) -> dict[str, int]:
    return {
        key: len(value) if isinstance(value, list) else 1
        for key, value in payload.items()
    }


def _payload_manifest(source_hash: str, payload_size_bytes: int) -> dict:
    return {
        "inline_payload": {
            "bytes": payload_size_bytes,
            "sha256": source_hash,
            "storage": "inline",
        }
    }

def payload_for(path: Path) -> dict:
    raw = path.read_bytes()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as error:
        raise SystemExit(f"Unsupported capture: expected JSON ({error})")
    source_hash = hashlib.sha256(raw).hexdigest()
    payload_size_bytes = len(_canonical_json_bytes(data))
    object_counts = _object_counts(data)
    release_id = data.get("release_id") or f"{data.get('game_version', 'unknown')}:{source_hash}"
    config_hash = hashlib.sha256(
        _canonical_json_bytes(
            {
                "source_type": "emulator-capture",
                "capture_schema_version": CAPTURE_SCHEMA_VERSION,
            }
        )
    ).hexdigest()
    return {
        "source_type": "emulator-capture",
        "source_version": None,
        "source_hash": source_hash,
        "release_id": release_id,
        "game_version": data.get("game_version"),
        "capture_schema_version": CAPTURE_SCHEMA_VERSION,
        "capture_engine_version": CAPTURE_ENGINE_VERSION,
        "validation_schema_version": CAPTURE_SCHEMA_VERSION,
        "validation_engine_version": CAPTURE_ENGINE_VERSION,
        "configuration_hash": config_hash,
        "input_hashes": {"capture_payload": source_hash},
        "object_counts": object_counts,
        "validation_summary": {
            "accepted": True,
            "errors": [],
            "warnings": [],
            "object_counts": object_counts,
            "payload_size_bytes": payload_size_bytes,
        },
        "artifact_manifest": {},
        "raw_metadata": {"capture_path": path.name},
        "payload_size_bytes": payload_size_bytes,
        "payload": data,
    }

def main() -> None:
    parser = argparse.ArgumentParser(prog="mineops-ingest")
    parser.add_argument("command", choices=["validate", "upload", "status"])
    parser.add_argument("path", nargs="?")
    parser.add_argument("--api", default=os.getenv("MINEOPS_API_URL", DEFAULT_API))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if args.command == "status":
        print("Agent ready; local outbox is not yet populated.")
        return
    if not args.path:
        parser.error("path is required for validate and upload")
    payload = payload_for(Path(args.path))
    if args.command == "validate" or args.dry_run:
        print(
            json.dumps(
                {
                    "valid": True,
                    "source_hash": payload["source_hash"],
                    "release_id": payload["release_id"],
                    "object_counts": payload["object_counts"],
                    "payload_manifest": _payload_manifest(
                        payload["source_hash"],
                        payload["payload_size_bytes"],
                    ),
                },
                indent=2,
            )
        )
        return
    response = httpx.post(f"{args.api}/ingestion/uploads", json=payload, timeout=30)
    response.raise_for_status()
    print(json.dumps(response.json(), indent=2))
