#!/usr/bin/env python3
"""Upload catalog artifacts to PocketBase, register release, and activate."""
import json, hashlib, os
from pathlib import Path

PB_BASE = "https://mineops-pb.shepswork.com/api"
AUTH_URL = f"{PB_BASE}/collections/_superusers/auth-with-password"
CREDS = {"identity": "admin@mineops.yancmo.xyz", "password": "mineops-pb-dev-admin-2026"}
CANDIDATE_DIR = Path("catalogs/production/5.59.0_96449_20260716T143539Z.candidate")

import urllib.request, urllib.error

def api(method, path, body=None, token=None):
    url = f"{PB_BASE}{path}"
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json", "User-Agent": "MineOpsWeb/1.0"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read()), resp.status
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            return json.loads(body), e.code
        except:
            return {"error": body}, e.code

def upload_file(path, filename, token):
    """Upload a file using multipart form data."""
    import http.client
    from urllib.parse import urlparse
    
    boundary = "----FormBoundary" + os.urandom(16).hex()
    content = path.read_bytes()
    content_type = "application/json"
    
    body = b""
    body += f"--{boundary}\r\n".encode()
    body += f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode()
    body += f"Content-Type: {content_type}\r\n\r\n".encode()
    body += content
    body += f"\r\n--{boundary}\r\n".encode()
    body += f'Content-Disposition: form-data; name="releaseId"\r\n\r\n'.encode()
    body += b"5.59.0_96449_20260716T143539Z"
    body += f"\r\n--{boundary}\r\n".encode()
    body += f'Content-Disposition: form-data; name="artifactName"\r\n\r\n'.encode()
    body += filename.encode()
    body += f"\r\n--{boundary}\r\n".encode()
    body += f'Content-Disposition: form-data; name="sha256"\r\n\r\n'.encode()
    body += hashlib.sha256(content).hexdigest().encode()
    body += f"\r\n--{boundary}--\r\n".encode()
    
    url = f"{PB_BASE}/collections/catalog_artifacts/records"
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read()), resp.status
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            return json.loads(body), e.code
        except:
            return {"error": body}, e.code

# --- Main ---
print("=== Auth ===")
auth, status = api("POST", "/collections/_superusers/auth-with-password", CREDS)
if status != 200:
    print(f"Auth failed: {status} {auth}")
    exit(1)
token = auth["token"]
print(f"Authenticated as {auth.get('record',{}).get('email','?')}")

# Load manifest
with open(CANDIDATE_DIR / "manifest.json") as f:
    manifest = json.load(f)
manifest_json = json.dumps(manifest)
manifest_sha = hashlib.sha256(manifest_json.encode()).hexdigest()
print(f"\nManifest SHA256: {manifest_sha[:16]}...")
print(f"Artifacts: {len(manifest['artifacts'])}")
print(f"Equipment: {manifest['counts'].get('equipment', 0)}")
print(f"Materials: {manifest['counts'].get('materials', 0)}")

# Upload artifacts
print("\n=== Uploading artifacts ===")
for a in manifest["artifacts"]:
    fn = a["filename"]
    fp = CANDIDATE_DIR / fn
    if not fp.exists():
        print(f"  SKIP {fn} (missing)")
        continue
    content = fp.read_bytes()
    h = hashlib.sha256(content).hexdigest()
    print(f"  Uploading {fn} ({a['bytes']}b, sha256={h[:12]}...)")
    result, status = upload_file(fp, fn, token)
    if status == 200:
        print(f"    OK: {result.get('id', '?')}")
    else:
        print(f"    {status}: {str(result)[:200]}")

# Register release
print("\n=== Registering release ===")
counts = manifest["counts"]
release_body = {
    "releaseId": manifest["releaseId"],
    "catalogVersion": manifest["catalogVersion"],
    "gameVersion": manifest["gameVersion"],
    "gameVersionCode": manifest["gameVersionCode"],
    "status": "candidate",
    "manifestSha256": manifest_sha,
    "artifactCount": len(manifest["artifacts"]),
    "counts": counts,
    "storageBaseUrl": "https://mineops-pb.shepswork.com/api/catalog/artifacts/",
    "publishedAt": None,
}
result, status = api("POST", "/collections/catalog_releases/records", release_body, token)
print(f"  Register: {status} {str(result.get('id',''))[:50]}")

# Activate - update publication pointer
print("\n=== Activating ===")
pub_check, _ = api("GET", "/collections/catalog_publication/records?perPage=1", token=token)
pub_items = pub_check.get("items", [])
pub_body = {
    "activeReleaseId": manifest["releaseId"],
    "manifestSha256": manifest_sha,
    "activatedAt": "2026-07-24T00:00:00.000Z",
    "notes": "APK catalog with 118 managers, 36 equipment, 15 materials",
}
if pub_items:
    pub_id = pub_items[0]["id"]
    result, status = api("PATCH", f"/collections/catalog_publication/records/{pub_id}", pub_body, token)
    print(f"  Updated publication: {status}")
else:
    result, status = api("POST", "/collections/catalog_publication/records", pub_body, token)
    print(f"  Created publication: {status}")

print(f"\n=== DONE ===")
print(f"Release: {manifest['releaseId']}")
print(f"Refresh the app and you should see equipment data!")
