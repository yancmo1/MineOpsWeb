import hashlib
import json
import sys
from pathlib import Path

cand = Path(sys.argv[1])
manifest = json.loads((cand / "manifest.json").read_text())
failures = []
checked = 0
for art in manifest["artifacts"]:
    path = cand / art["path"]
    if not path.is_file():
        failures.append(f"MISSING {art['path']}")
        continue
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    checked += 1
    if digest != art["sha256"]:
        failures.append(f"HASH MISMATCH {art['path']}: got {digest} want {art['sha256']}")
    if path.stat().st_size != art["bytes"]:
        failures.append(f"SIZE MISMATCH {art['path']}: {path.stat().st_size} != {art['bytes']}")
manifest_digest = hashlib.sha256((cand / "manifest.json").read_bytes()).hexdigest()
print("artifacts checked:", checked, "| manifest sha256:", manifest_digest[:16])
print("RESULT:", "FAIL" if failures else "ALL ARTIFACTS MATCH MANIFEST")
for f in failures[:10]:
    print(" ", f)
sys.exit(1 if failures else 0)
