#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="$HOME/mineops-data/.capture.env"
RELEASE_ROOT="$HOME/mineops-data/releases"
EMULATOR_SERIAL="${EMULATOR_SERIAL:-emulator-5556}"
PACKAGE_NAME="${PACKAGE_NAME:-com.fluffyfairygames.idleminertycoon}"

# Make adb/emulator available in non-interactive SSH sessions.
if [[ -d "$HOME/Android/Sdk/platform-tools" ]]; then
  export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
  export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"
  export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin"
fi

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

CAPTURE_URL="${MINEOPS_CAPTURE_URL:-${CAPTURE_URL:-}}"
CAPTURE_TOKEN="${MINEOPS_CAPTURE_TOKEN:-${CAPTURE_TOKEN:-}}"

base_url_from_ingest() {
  python3 - "$1" <<'PY'
import sys
from urllib.parse import urlparse
u = urlparse(sys.argv[1])
print(f"{u.scheme}://{u.netloc}")
PY
}

show_status() {
  if [[ -z "${CAPTURE_URL:-}" ]]; then
    echo "[ubuntu-check] MINEOPS_CAPTURE_URL is not configured in $ENV_FILE"
    return 2
  fi

  local base
  base="$(base_url_from_ingest "$CAPTURE_URL")"

  echo "[ubuntu-check] PocketBase: $base"
  curl -fsS "$base/api/health" | python3 -m json.tool || true
  echo
  echo "[ubuntu-check] latest catalog_versions"
  curl -fsS "$base/api/collections/catalog_versions/records?perPage=3" | python3 -m json.tool || true
}

latest_release_json() {
  find "$RELEASE_ROOT" -type f -name release.json -print0 2>/dev/null | xargs -0 ls -1t 2>/dev/null | head -n 1
}

print_apk_version() {
  if command -v adb >/dev/null 2>&1; then
    if adb -s "$EMULATOR_SERIAL" get-state >/dev/null 2>&1; then
      echo "[ubuntu-check] emulator $EMULATOR_SERIAL online"
      adb -s "$EMULATOR_SERIAL" shell dumpsys package "$PACKAGE_NAME" 2>/dev/null | grep -E "versionName=|versionCode=" | sed "s/^[[:space:]]*//" || true
    else
      echo "[ubuntu-check] emulator $EMULATOR_SERIAL not online; skipping live package check"
    fi
  else
    echo "[ubuntu-check] adb not found; skipping emulator check"
  fi
}

release_id_from_json() {
  python3 - "$1" <<'PY'
import json
import sys
with open(sys.argv[1], 'r', encoding='utf-8') as f:
    data = json.load(f)
print(data.get('releaseId', ''))
PY
}

enrich_payload() {
  local release_json="$1"
  local release_dir
  release_dir="$(dirname "$release_json")"

  local catalog_json="${release_dir}/exports/catalog.json"
  if [[ ! -f "$catalog_json" ]]; then
    echo "[ubuntu-check] no catalog.json found, skipping payload enrichment"
    return 0
  fi

  python3 - "$release_json" "$catalog_json" <<'PY'
import json, sys
from collections import Counter

release_path = sys.argv[1]
catalog_path = sys.argv[2]

with open(release_path, 'r', encoding='utf-8') as f:
    release = json.load(f)
with open(catalog_path, 'r', encoding='utf-8') as f:
    catalog = json.load(f)

existing = release.get('objects', [])
if isinstance(existing, list) and len(existing) > 0:
    print(f"[ubuntu-check] payload already has {len(existing)} objects, skipping enrichment")
    sys.exit(0)

assets = catalog.get('assets', [])
if not assets:
    print("[ubuntu-check] no assets in catalog, skipping enrichment")
    sys.exit(0)

# Create lightweight summary objects (type + count) to keep payload small
type_counts = Counter(a.get('assetType', 'unknown') for a in assets)
objects = []
for asset_type, count in sorted(type_counts.items()):
    objects.append({'type': asset_type, 'count': count})

merged = dict(release)
merged['objects'] = objects
merged['objectSummary'] = {
    'totalAssets': len(assets),
    'typeCount': len(type_counts),
    'generatedFrom': 'exports/catalog.json',
}

with open(release_path, 'w', encoding='utf-8') as f:
    json.dump(merged, f, indent=2)

print(f"[ubuntu-check] enriched payload with {len(objects)} object types ({len(assets)} total assets)")
PY
}

upload_release() {
  local release_json="$1"
  if [[ -z "${CAPTURE_URL:-}" || -z "${CAPTURE_TOKEN:-}" || "$CAPTURE_TOKEN" == "replace_me" ]]; then
    echo "[ubuntu-check] Missing capture wiring. Set MINEOPS_CAPTURE_URL and MINEOPS_CAPTURE_TOKEN in $ENV_FILE"
    return 2
  fi

  local release_id
  release_id="$(release_id_from_json "$release_json")"
  echo "[ubuntu-check] Uploading release: ${release_id:-unknown}"

  local body_file
  body_file="$(mktemp)"

  local http_code
  http_code="$(curl -sS -o "$body_file" -w '%{http_code}' \
    -X POST "$CAPTURE_URL" \
    -H "Authorization: Bearer $CAPTURE_TOKEN" \
    -H 'Content-Type: application/json' \
    --data-binary "@$release_json")"

  echo "[ubuntu-check] ingest HTTP $http_code"
  cat "$body_file"
  echo
  rm -f "$body_file"

  if [[ "$http_code" == "200" || "$http_code" == "409" ]]; then
    return 0
  fi
  return 1
}

MODE="${1:-run}"
if [[ "$MODE" == "status" || "$MODE" == "--status" ]]; then
  show_status
  exit $?
fi

print_apk_version

release_json="$(latest_release_json || true)"
if [[ -z "$release_json" ]]; then
  echo "[ubuntu-check] No release.json found under $RELEASE_ROOT"
  exit 1
fi

echo "[ubuntu-check] Latest release payload: $release_json"
enrich_payload "$release_json"
upload_release "$release_json"
