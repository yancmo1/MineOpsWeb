#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="$HOME/mineops-data/.capture.env"
RELEASE_ROOT="$HOME/mineops-data/releases"
EMULATOR_SERIAL="${EMULATOR_SERIAL:-emulator-5556}"
PACKAGE_NAME="${PACKAGE_NAME:-com.fluffyfairygames.idleminertycoon}"
ENGINE="${MINEOPS_DATA_ENGINE:-$HOME/mineops-env/bin/mineops-data-engine}"
BOOT_TIMEOUT_SECONDS="${EMULATOR_BOOT_TIMEOUT_SECONDS:-180}"
UI_READY_TIMEOUT_SECONDS="${EMULATOR_UI_READY_TIMEOUT_SECONDS:-120}"
PLAY_STORE_SETTLE_SECONDS="${EMULATOR_PLAY_STORE_SETTLE_SECONDS:-20}"
PLAY_STORE_READY_TIMEOUT_SECONDS="${EMULATOR_PLAY_STORE_READY_TIMEOUT_SECONDS:-90}"
UPDATE_TIMEOUT_SECONDS="${EMULATOR_UPDATE_TIMEOUT_SECONDS:-900}"
STARTED_EMULATOR=0
RUN_STARTED_AT="$(date -Is)"
CURRENT_INSTALLED=""
CURRENT_LATEST=""
REPORT_MODE="run"
RELEASE_RETENTION_COUNT="${MINEOPS_RELEASE_RETENTION_COUNT:-3}"

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
REPORT_STATE_FILE="${MINEOPS_REPORT_STATE_FILE:-$HOME/mineops-data/logs/check-report-state.json}"

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

emulator_state() {
  if ! command -v adb >/dev/null 2>&1; then
    echo "missing"
    return 0
  fi
  adb -s "$EMULATOR_SERIAL" get-state 2>/dev/null || true
}

start_emulator_if_needed() {
  local state
  state="$(emulator_state)"
  if [[ "$state" == "device" ]]; then
    echo "[ubuntu-check] emulator $EMULATOR_SERIAL already online; leaving it running"
    return 0
  fi

  if [[ "${NO_EMULATOR_START:-0}" == "1" ]]; then
    echo "[ubuntu-check] emulator $EMULATOR_SERIAL is offline and automatic startup is disabled"
    return 1
  fi

  if [[ ! -x "$ENGINE" ]]; then
    echo "[ubuntu-check] data engine not found: $ENGINE"
    return 1
  fi

  echo "[ubuntu-check] starting emulator $EMULATOR_SERIAL"
  "$ENGINE" emulator start
  STARTED_EMULATOR=1

  local elapsed=0
  while (( elapsed < BOOT_TIMEOUT_SECONDS )); do
    if [[ "$(emulator_state)" == "device" ]] && [[ "$(adb -s "$EMULATOR_SERIAL" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]]; then
      echo "[ubuntu-check] emulator $EMULATOR_SERIAL booted"
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done

  echo "[ubuntu-check] emulator $EMULATOR_SERIAL did not finish booting within ${BOOT_TIMEOUT_SECONDS}s"
  return 1
}

stop_started_emulator() {
  if [[ "$STARTED_EMULATOR" != "1" || "${KEEP_EMULATOR_RUNNING:-0}" == "1" ]]; then
    return 0
  fi
  echo "[ubuntu-check] stopping emulator $EMULATOR_SERIAL started by this run"
  "$ENGINE" emulator stop || echo "[ubuntu-check] warning: emulator stop failed" >&2
}

cleanup() {
  local exit_code=$?
  write_report_state "$exit_code" || true
  send_status_email "$exit_code" || true
  stop_started_emulator
  exit "$exit_code"
}

write_report_state() {
  local exit_code="$1"
  local state_dir state_tmp
  state_dir="$(dirname "$REPORT_STATE_FILE")"
  mkdir -p "$state_dir"
  state_tmp="$(mktemp "$REPORT_STATE_FILE.tmp.XXXXXX")"
  python3 - "$state_tmp" "$REPORT_STATE_FILE" "$exit_code" "$RUN_STARTED_AT" "$REPORT_MODE" \
    "$CURRENT_INSTALLED" "$CURRENT_LATEST" "${MINEOPS_REPORT_MESSAGE:-}" <<'PY'
import json
import os
import sys

temporary, destination, exit_code, started_at, mode, installed, latest, message = sys.argv[1:]
state = {
    "exitCode": int(exit_code),
    "startedAt": started_at,
    "mode": mode,
    "installedVersion": installed,
    "latestPlayVersion": latest,
    "message": message,
}
with open(temporary, "w", encoding="utf-8") as handle:
    json.dump(state, handle, separators=(",", ":"))
    handle.write("\n")
os.replace(temporary, destination)
PY
}

load_report_state() {
  [[ -f "$REPORT_STATE_FILE" ]] || return 0
  while IFS=$'\t' read -r key value; do
    case "$key" in
      startedAt) RUN_STARTED_AT="$value" ;;
      mode) REPORT_MODE="$value" ;;
      installedVersion) CURRENT_INSTALLED="$value" ;;
      latestPlayVersion) CURRENT_LATEST="$value" ;;
      message)
        if [[ -n "$value" ]]; then
          MINEOPS_REPORT_MESSAGE="$value"
        fi
        ;;
    esac
  done < <(python3 - "$REPORT_STATE_FILE" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    state = json.load(handle)
for key in ("startedAt", "mode", "installedVersion", "latestPlayVersion", "message"):
    print(f"{key}\t{state.get(key, '')}")
PY
  )
}

send_status_email() {
  [[ "${MINEOPS_EMAIL_SUPPRESS:-0}" == "1" ]] && return 0
  [[ "${MINEOPS_EMAIL_DISABLED:-0}" == "1" ]] && return 0
  local email_env="${MINEOPS_EMAIL_ENV_FILE:-$HOME/apps/bingebox/.env}"
  [[ -f "$email_env" ]] || return 0

  local gmail_user gmail_pass admin_email subject body
  gmail_user="$(sed -n 's/^GMAIL_USER=//p' "$email_env" | tail -n 1 | sed 's/^"//;s/"$//')"
  gmail_pass="$(sed -n 's/^GMAIL_PASS=//p' "$email_env" | tail -n 1 | sed 's/^"//;s/"$//')"
  admin_email="$(sed -n 's/^ADMIN_EMAIL=//p' "$email_env" | tail -n 1 | sed 's/^"//;s/"$//')"
  [[ -n "$gmail_user" && -n "$gmail_pass" ]] || return 0
  admin_email="${admin_email:-$gmail_user}"

  if [[ "$1" == "0" ]]; then subject="MineOps UbuntuMac check succeeded"; else subject="MineOps UbuntuMac check FAILED"; fi
  body="MineOps UbuntuMac check report\n\nStarted: $RUN_STARTED_AT\nFinished: $(date -Is)\nHost: $(hostname)\nMode: ${REPORT_MODE:-run}\nExit code: $1\nInstalled version: ${CURRENT_INSTALLED:-unknown}\nLatest Google Play version observed: ${CURRENT_LATEST:-unknown}\nLatest local release: $(latest_release_json || true)\nMessage: ${MINEOPS_REPORT_MESSAGE:-}\n\nA failure is fail-closed: no stale release was uploaded."

  GMAIL_USER="$gmail_user" GMAIL_PASS="$gmail_pass" ADMIN_EMAIL="$admin_email" \
    python3 - "$subject" "$body" <<'PY'
import os, smtplib, sys
from email.mime.text import MIMEText
msg = MIMEText(sys.argv[2])
msg["Subject"] = sys.argv[1]
msg["From"] = os.environ["GMAIL_USER"]
msg["To"] = os.environ["ADMIN_EMAIL"]
with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=30) as server:
    server.login(os.environ["GMAIL_USER"], os.environ["GMAIL_PASS"])
    server.sendmail(os.environ["GMAIL_USER"], [os.environ["ADMIN_EMAIL"]], msg.as_string())
PY
  echo "[ubuntu-check] status email sent to $admin_email"
}

prune_local_releases() {
  if [[ ! "$RELEASE_RETENTION_COUNT" =~ ^[1-9][0-9]*$ ]]; then
    echo "[ubuntu-check] invalid MINEOPS_RELEASE_RETENTION_COUNT: $RELEASE_RETENTION_COUNT" >&2
    return 2
  fi
  if [[ ! -d "$RELEASE_ROOT" ]]; then
    echo "[ubuntu-check] release root does not exist; nothing to prune: $RELEASE_ROOT"
    return 0
  fi

  local release_root_real inventory_file
  release_root_real="$(cd "$RELEASE_ROOT" && pwd -P)"
  inventory_file="$(mktemp)"
  if ! python3 - "$RELEASE_ROOT" >"$inventory_file" <<'PY'
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

root = Path(sys.argv[1]).resolve()
timestamp_pattern = re.compile(r"_(\d{8}T\d{6}Z)(?:$|[._])", re.IGNORECASE)
required = (
    "release.json",
    "apk/APK_PATHS.json",
    "apk/APK_SET.json",
    "apk/SHA256SUMS",
    "manifests/package-dumpsys.txt",
)

def event_time(payload, directory):
    captured_at = payload.get("capturedAt")
    if isinstance(captured_at, str) and captured_at:
        try:
            value = datetime.fromisoformat(captured_at.replace("Z", "+00:00"))
            if value.tzinfo is None:
                value = value.replace(tzinfo=timezone.utc)
            return value.timestamp()
        except ValueError:
            pass
    release_id = payload.get("releaseId")
    if isinstance(release_id, str):
        match = timestamp_pattern.search(release_id)
        if match:
            try:
                return datetime.strptime(match.group(1), "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc).timestamp()
            except ValueError:
                pass
    return directory.stat().st_mtime

for directory in sorted(root.iterdir(), key=lambda item: item.name):
    if directory.is_symlink() or not directory.is_dir():
        continue
    payload = {}
    release_file = directory / "release.json"
    try:
        payload = json.loads(release_file.read_text(encoding="utf-8"))
    except (FileNotFoundError, OSError, json.JSONDecodeError):
        pass

    complete = (
        isinstance(payload, dict)
        and payload.get("releaseId") == directory.name
        and all((directory / relative).is_file() for relative in required)
    )
    priority = 1 if complete else 0
    print(f"{priority}\t{event_time(payload, directory):.6f}\t{directory.stat().st_mtime_ns}\t{directory}")
PY
  then
    rm -f "$inventory_file"
    echo "[ubuntu-check] could not inventory release directories; nothing was removed" >&2
    return 1
  fi

  local kept_count=0
  local deleted_count=0
  local priority event_time modified_at release_dir keep
  local -a keep_paths=()
  while IFS=$'\t' read -r priority event_time modified_at release_dir; do
    [[ -n "$release_dir" ]] || continue
    if [[ "$priority" == "1" && "$kept_count" -lt "$RELEASE_RETENTION_COUNT" ]]; then
      keep_paths+=("$release_dir")
      kept_count=$((kept_count + 1))
    fi
  done < <(sort -t $'\t' -k1,1nr -k2,2nr -k3,3nr "$inventory_file")

  while IFS=$'\t' read -r priority event_time modified_at release_dir; do
    [[ -n "$release_dir" ]] || continue
    keep=0
    for kept_path in "${keep_paths[@]}"; do
      if [[ "$release_dir" == "$kept_path" ]]; then
        keep=1
        break
      fi
    done
    if [[ "$keep" == "1" ]]; then
      continue
    fi
    if [[ "$(dirname "$release_dir")" != "$release_root_real" || ! -d "$release_dir" ]]; then
      echo "[ubuntu-check] refusing unsafe release prune target: $release_dir" >&2
      rm -f "$inventory_file"
      return 1
    fi
    echo "[ubuntu-check] purging old/incomplete release: $(basename "$release_dir")"
    rm -rf -- "$release_dir"
    deleted_count=$((deleted_count + 1))
  done < "$inventory_file"

  rm -f "$inventory_file"
  echo "[ubuntu-check] release retention complete: kept $kept_count, purged $deleted_count"
  return 0
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

ui_dump() {
  local xml
  xml="$(adb -s "$EMULATOR_SERIAL" shell uiautomator dump /sdcard/window.xml >/dev/null 2>&1 \
    && adb -s "$EMULATOR_SERIAL" shell cat /sdcard/window.xml 2>/dev/null | tr -d '\r')" || true
  printf '%s' "$xml"
}

ui_text_bounds() {
  local text="$1" xml="${2:-}"
  if [[ -z "$xml" ]]; then
    xml="$(ui_dump)"
  fi
  python3 - "$text" "$xml" <<'PY'
import re
import sys

needle, xml = sys.argv[1:]
for node in re.findall(r"<node[^>]+>", xml):
    if re.search(rf'(?:text|content-desc)="{re.escape(needle)}"', node, re.I):
        match = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', node)
        if match:
            x1, y1, x2, y2 = map(int, match.groups())
            print((x1 + x2) // 2, (y1 + y2) // 2)
            break
PY
}

recover_system_ui_prompt() {
  local elapsed=0 xml bounds x y
  while (( elapsed < UI_READY_TIMEOUT_SECONDS )); do
    xml="$(ui_dump)"
    if [[ "$xml" != *"isn't responding"* ]]; then
      return 0
    fi

    bounds="$(ui_text_bounds "Wait" "$xml" || true)"
    if [[ "$bounds" =~ ^([0-9]+)[[:space:]]+([0-9]+)$ ]]; then
      x="${BASH_REMATCH[1]}"; y="${BASH_REMATCH[2]}"
      echo "[ubuntu-check] recovering Android nonresponsive prompt by tapping Wait"
      adb -s "$EMULATOR_SERIAL" shell input tap "$x" "$y" >/dev/null 2>&1 || true
    else
      echo "[ubuntu-check] Android nonresponsive prompt has no visible Wait control" >&2
    fi
    sleep 3
    elapsed=$((elapsed + 3))
  done

  echo "[ubuntu-check] ERROR: Android nonresponsive prompt did not clear" >&2
  return 1
}

installed_version_name() {
  adb -s "$EMULATOR_SERIAL" shell dumpsys package "$PACKAGE_NAME" 2>/dev/null \
    | sed -n 's/.*versionName=\([^[:space:]]*\).*/\1/p' | head -n 1 | tr -d '\r'
}

latest_play_version() {
  if [[ -n "${MINEOPS_LATEST_VERSION_NAME:-}" ]]; then
    printf '%s\n' "$MINEOPS_LATEST_VERSION_NAME"
    return 0
  fi

  local play_url="https://play.google.com/store/apps/details?id=${PACKAGE_NAME}&hl=en_US&gl=US"
  curl -LfsS --max-time 30 "$play_url" | python3 -c '
import re, sys
from packaging.version import Version

html = sys.stdin.read()
versions = set(re.findall(r"\[\[\"([0-9]+\.[0-9]+\.[0-9]+)\"\]\]", html))
if not versions:
    versions = {v for v in re.findall(r"(?<![0-9])([0-9]+\.[0-9]+\.[0-9]+)(?![0-9])", html) if v.startswith("5.")}
if not versions:
    raise SystemExit("no semantic app version found in Google Play listing")
print(max(versions, key=Version))
'
}

version_at_least() {
  python3 - "$1" "$2" <<'PY'
from packaging.version import Version
import sys
print("1" if Version(sys.argv[1]) >= Version(sys.argv[2]) else "0")
PY
}

wait_for_play_store_page() {
  local elapsed=0 xml
  while (( elapsed < PLAY_STORE_READY_TIMEOUT_SECONDS )); do
    xml="$(ui_dump)"
    if [[ "$xml" == *"isn't responding"* ]]; then
      recover_system_ui_prompt || return 1
      xml="$(ui_dump)"
    fi
    if [[ "$xml" == *"Idle Miner Tycoon"* ]] && [[ "$xml" == *"Update"* || "$xml" == *"Uninstall"* || "$xml" == *"Open"* ]]; then
      return 0
    fi
    sleep 3
    elapsed=$((elapsed + 3))
  done

  echo "[ubuntu-check] ERROR: Google Play did not open the MineOps app page within ${PLAY_STORE_READY_TIMEOUT_SECONDS}s" >&2
  return 1
}

ensure_play_current() {
  local installed latest
  installed="$(installed_version_name)"
  latest="$(latest_play_version)"
  CURRENT_INSTALLED="$installed"
  CURRENT_LATEST="$latest"
  if [[ -z "$installed" || -z "$latest" ]]; then
    echo "[ubuntu-check] ERROR: unable to determine installed or Google Play version" >&2
    return 1
  fi

  echo "[ubuntu-check] installed version: $installed"
  echo "[ubuntu-check] Google Play version: $latest"
  if [[ "$(version_at_least "$installed" "$latest")" == "1" ]]; then
    return 0
  fi

  echo "[ubuntu-check] installed package is stale; requesting Google Play update"
  recover_system_ui_prompt
  local play_store_url="https://play.google.com/store/apps/details?id=${PACKAGE_NAME}&hl=en_US&gl=US"
  adb -s "$EMULATOR_SERIAL" shell am start -W -a android.intent.action.VIEW \
    -d "$play_store_url" >/dev/null

  echo "[ubuntu-check] waiting ${PLAY_STORE_SETTLE_SECONDS}s for Play Store and pending support updates to settle"
  sleep "$PLAY_STORE_SETTLE_SECONDS"
  wait_for_play_store_page

  local elapsed=0 bounds x y now xml
  while (( elapsed < UPDATE_TIMEOUT_SECONDS )); do
    now="$(installed_version_name)"
    CURRENT_INSTALLED="$now"
    if [[ -n "$now" ]] && [[ "$(version_at_least "$now" "$latest")" == "1" ]]; then
      echo "[ubuntu-check] Google Play update verified: $now"
      return 0
    fi
    xml="$(ui_dump)"
    if [[ "$xml" == *"isn't responding"* ]]; then
      recover_system_ui_prompt || return 1
      xml="$(ui_dump)"
    fi
    bounds="$(ui_text_bounds "Update" "$xml" || true)"
    if [[ "$bounds" =~ ^([0-9]+)[[:space:]]+([0-9]+)$ ]]; then
      x="${BASH_REMATCH[1]}"; y="${BASH_REMATCH[2]}"
      adb -s "$EMULATOR_SERIAL" shell input tap "$x" "$y" >/dev/null 2>&1 || true
    fi
    sleep 5
    elapsed=$((elapsed + 5))
  done

  now="$(installed_version_name)"
  CURRENT_INSTALLED="$now"
  echo "[ubuntu-check] ERROR: emulator package is stale; Google Play update did not complete" >&2
  echo "[ubuntu-check] installed: ${now:-unknown}" >&2
  echo "[ubuntu-check] latest observed: $latest" >&2
  return 1
}

acquire_release() {
  if [[ ! -x "$ENGINE" ]]; then
    echo "[ubuntu-check] data engine not found: $ENGINE"
    return 1
  fi

  echo "[ubuntu-check] acquiring current APK/data release"
  set +e
  "$ENGINE" acquire
  local acquire_code=$?
  set -e

  # The engine uses 14 for an unchanged release. That is a successful
  # no-op, but there is nothing new to send to PocketBase.
  if [[ "$acquire_code" == "14" ]]; then
    echo "[ubuntu-check] release is unchanged; nothing to upload"
    prune_local_releases || return 1
    return 14
  fi
  if [[ "$acquire_code" != "0" ]]; then
    echo "[ubuntu-check] acquisition failed with exit code $acquire_code"
    return "$acquire_code"
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

minimal_upload_payload() {
  local source="$1" destination="$2"
  python3 - "$source" "$destination" <<'PY'
import json, sys
source, destination = sys.argv[1:]
with open(source, encoding="utf-8") as f:
    release = json.load(f)
allowed = ("releaseId", "versionName", "versionCode", "capturedAt", "engineVersion", "schemaVersion", "apkHashes", "status")
payload = {key: release[key] for key in allowed if key in release}
with open(destination, "w", encoding="utf-8") as f:
    json.dump(payload, f, separators=(",", ":"))
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

  if [[ "$http_code" == "200" ]]; then
    return 0
  fi
  if [[ "$http_code" == "409" ]]; then
    echo "[ubuntu-check] release was already ingested; no new upload performed"
    return 14
  fi
  return 1
}

MODE="${1:-run}"
if [[ "$MODE" == "status" || "$MODE" == "--status" ]]; then
  show_status
  exit $?
fi
if [[ "$MODE" == "--prune-releases" ]]; then
  prune_local_releases
  exit $?
fi

if [[ "$MODE" == "--no-start" ]]; then
  export NO_EMULATOR_START=1
fi
if [[ "$MODE" == "--keep-emulator" ]]; then
  export KEEP_EMULATOR_RUNNING=1
fi
if [[ "$MODE" == "--report" ]]; then
  load_report_state
  trap cleanup EXIT
  exit "${MINEOPS_REPORT_EXIT_CODE:-0}"
fi
REPORT_MODE="$MODE"
UPLOAD_ONLY=0
if [[ "$MODE" == "--upload-latest" || "${2:-}" == "--upload-latest" ]]; then
  UPLOAD_ONLY=1
fi
ENSURE_ONLY=0
if [[ "$MODE" == "--ensure-current" ]]; then
  ENSURE_ONLY=1
fi
if [[ "${2:-}" == "--ensure-current" ]]; then
  ENSURE_ONLY=1
fi

trap cleanup EXIT

start_emulator_if_needed
ensure_play_current
if [[ "$ENSURE_ONLY" == "1" ]]; then
  prune_local_releases
  exit 0
fi
if [[ "$UPLOAD_ONLY" == "1" ]]; then
  release_json="$(latest_release_json || true)"
  if [[ -z "$release_json" ]]; then
    echo "[ubuntu-check] no local release.json exists to upload" >&2
    exit 1
  fi
  upload_json="$(mktemp)"
  minimal_upload_payload "$release_json" "$upload_json"
  echo "[ubuntu-check] uploading latest release envelope: $release_json"
  set +e
  upload_release "$upload_json"
  upload_code=$?
  set -e
  rm -f "$upload_json"
  if [[ "$upload_code" == "14" ]]; then
    echo "[ubuntu-check] latest release was already uploaded"
    prune_local_releases
    exit 0
  fi
  if [[ "$upload_code" == "0" ]]; then
    prune_local_releases
  fi
  exit "$upload_code"
fi
print_apk_version

before_release_json="$(latest_release_json || true)"
set +e
acquire_release
acquire_code=$?
set -e
if [[ "$acquire_code" != "0" ]]; then
  exit "$acquire_code"
fi

release_json="$(latest_release_json || true)"
if [[ -z "$release_json" ]]; then
  echo "[ubuntu-check] Acquisition completed without producing release.json"
  exit 1
fi

if [[ "$release_json" == "$before_release_json" ]]; then
  echo "[ubuntu-check] acquisition did not produce a new release; refusing stale upload"
  exit 14
fi

echo "[ubuntu-check] Latest release payload: $release_json"
enrich_payload "$release_json"
set +e
upload_release "$release_json"
upload_code=$?
set -e
if [[ "$upload_code" == "0" || "$upload_code" == "14" ]]; then
  prune_local_releases
fi
exit "$upload_code"
