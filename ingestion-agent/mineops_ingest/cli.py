import argparse, hashlib, json, os
from pathlib import Path
import httpx

DEFAULT_API = "http://localhost:8000/api/v1"

def payload_for(path: Path) -> dict:
    raw = path.read_bytes()
    try: data = json.loads(raw)
    except json.JSONDecodeError as error: raise SystemExit(f"Unsupported capture: expected JSON ({error})")
    return {"source_type": "emulator-capture", "source_version": None, "source_hash": hashlib.sha256(raw).hexdigest(), "game_version": data.get("game_version"), "payload": data}

def main() -> None:
    parser = argparse.ArgumentParser(prog="mineops-ingest")
    parser.add_argument("command", choices=["validate", "upload", "status"])
    parser.add_argument("path", nargs="?")
    parser.add_argument("--api", default=os.getenv("MINEOPS_API_URL", DEFAULT_API))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if args.command == "status": print("Agent ready; local outbox is not yet populated."); return
    if not args.path: parser.error("path is required for validate and upload")
    payload = payload_for(Path(args.path))
    if args.command == "validate" or args.dry_run: print(json.dumps({"valid": True, "source_hash": payload["source_hash"]}, indent=2)); return
    response = httpx.post(f"{args.api}/ingestion/uploads", json=payload, timeout=30)
    response.raise_for_status(); print(json.dumps(response.json(), indent=2))
