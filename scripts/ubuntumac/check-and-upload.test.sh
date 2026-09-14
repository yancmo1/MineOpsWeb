#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
CHECKER="$ROOT_DIR/scripts/ubuntumac/check-and-upload.remote.sh"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/mineops-ubuntu-check.XXXXXX")"
trap 'rm -rf "$TEST_ROOT"' EXIT

mkdir -p "$TEST_ROOT/bin" "$TEST_ROOT/home/mineops-data/logs"
cat >"$TEST_ROOT/bin/date" <<'SH'
#!/usr/bin/env bash
if [[ "${1:-}" == "-Is" ]]; then
  echo "2026-09-14T00:00:00-05:00"
else
  exec /bin/date "$@"
fi
SH
chmod +x "$TEST_ROOT/bin/date"

cat >"$TEST_ROOT/bin/adb" <<'SH'
#!/usr/bin/env bash
set -euo pipefail

state_file="$FAKE_ADB_STATE_FILE"
log_file="$FAKE_ADB_LOG"
echo "$*" >>"$log_file"

case "$*" in
  *"get-state")
    echo device
    ;;
  *"dumpsys package"*)
    echo "    versionCode=96765"
    echo "    versionName=5.60.0"
    ;;
  *"uiautomator dump"*)
    ;;
  *"cat /sdcard/window.xml"*)
    if [[ -f "$state_file" ]] && [[ "$(<"$state_file")" == "wait-dismissed" || "$(<"$state_file")" == "wait-dismissed-after-update" ]]; then
      echo '<hierarchy><node text="Idle Miner Tycoon: Gold Games" bounds="[0,100][1080,180]" /><node text="Update" content-desc="Update" bounds="[555,624][1017,729]" /></hierarchy>'
    elif [[ -f "$state_file" ]] && [[ "$(<"$state_file")" == "update-tapped" ]]; then
      echo '<hierarchy><node text="Pixel Launcher isn'"'"'t responding" bounds="[28,979][1052,1493]" /><node text="Wait" bounds="[70,1304][1010,1430]" /></hierarchy>'
    else
      echo '<hierarchy><node text="System UI isn'"'"'t responding" bounds="[28,979][1052,1493]" /><node text="Wait" bounds="[70,1304][1010,1430]" /></hierarchy>'
    fi
    ;;
  *"input tap 540 1367")
    if [[ -f "$state_file" ]] && [[ "$(<"$state_file")" == "update-tapped" ]]; then
      echo wait-dismissed-after-update >"$state_file"
    else
      echo wait-dismissed >"$state_file"
    fi
    ;;
  *"input tap 786 676")
    echo update-tapped >"$state_file"
    ;;
  *"am start"*)
    ;;
esac
SH
chmod +x "$TEST_ROOT/bin/adb"

STATE_FILE="$TEST_ROOT/home/mineops-data/logs/report-state.json"
FAKE_ADB_STATE_FILE="$TEST_ROOT/adb-state"
FAKE_ADB_LOG="$TEST_ROOT/adb.log"
export HOME="$TEST_ROOT/home"
export PATH="$TEST_ROOT/bin:$PATH"
export FAKE_ADB_STATE_FILE FAKE_ADB_LOG
export MINEOPS_EMAIL_SUPPRESS=1
export MINEOPS_LATEST_VERSION_NAME=5.62.1
export EMULATOR_PLAY_STORE_SETTLE_SECONDS=0
export EMULATOR_PLAY_STORE_READY_TIMEOUT_SECONDS=6
export EMULATOR_UPDATE_TIMEOUT_SECONDS=10
export EMULATOR_UI_READY_TIMEOUT_SECONDS=6
export MINEOPS_REPORT_STATE_FILE="$STATE_FILE"
export MINEOPS_REPORT_MESSAGE="regression test"

set +e
bash "$CHECKER" --no-start --ensure-current
check_code=$?
set -e
[[ "$check_code" == "1" ]] || { echo "expected stale check to exit 1, got $check_code" >&2; exit 1; }

grep -Fq 'shell input tap 540 1367' "$FAKE_ADB_LOG"
grep -Fq 'shell input tap 786 676' "$FAKE_ADB_LOG"
grep -Fq 'https://play.google.com/store/apps/details?id=com.fluffyfairygames.idleminertycoon' "$FAKE_ADB_LOG"

python3 - "$STATE_FILE" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    state = json.load(handle)
assert state["installedVersion"] == "5.60.0", state
assert state["latestPlayVersion"] == "5.62.1", state
assert state["message"] == "regression test", state
assert state["exitCode"] == 1, state
PY

set +e
MINEOPS_REPORT_EXIT_CODE=1 bash "$CHECKER" --report
report_code=$?
set -e
[[ "$report_code" == "1" ]] || { echo "expected report to exit 1, got $report_code" >&2; exit 1; }

python3 - "$STATE_FILE" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    state = json.load(handle)
assert state["installedVersion"] == "5.60.0", state
assert state["latestPlayVersion"] == "5.62.1", state
assert state["startedAt"], state
PY

python3 - "$STATE_FILE" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    state = json.load(handle)
state["message"] = ""
with open(sys.argv[1], "w", encoding="utf-8") as handle:
    json.dump(state, handle)
PY

set +e
MINEOPS_REPORT_MESSAGE= MINEOPS_REPORT_EXIT_CODE=0 bash "$CHECKER" --report
empty_message_report_code=$?
set -e
[[ "$empty_message_report_code" == "0" ]] || { echo "expected empty-message report to exit 0, got $empty_message_report_code" >&2; exit 1; }

release_root="$HOME/mineops-data/releases"
make_release() {
  local release_id="$1"
  local captured_at="$2"
  local release_dir="$release_root/$release_id"
  mkdir -p "$release_dir/apk" "$release_dir/manifests"
  printf '{"releaseId":"%s","capturedAt":"%s"}\n' "$release_id" "$captured_at" >"$release_dir/release.json"
  : >"$release_dir/apk/APK_PATHS.json"
  : >"$release_dir/apk/APK_SET.json"
  : >"$release_dir/apk/SHA256SUMS"
  : >"$release_dir/manifests/package-dumpsys.txt"
}

make_release "5.60.0_96765_20260814T121627Z" "2026-08-14T12:16:27Z"
make_release "5.61.0_97000_20260828T121627Z" "2026-08-28T12:16:27Z"
make_release "5.62.0_97200_20260907T121627Z" "2026-09-07T12:16:27Z"
make_release "5.63.0_97356_20260914T134142Z" "2026-09-14T13:41:42Z"
mkdir -p "$release_root/incomplete_capture"

bash "$CHECKER" --prune-releases
[[ -d "$release_root/5.63.0_97356_20260914T134142Z" ]]
[[ -d "$release_root/5.62.0_97200_20260907T121627Z" ]]
[[ -d "$release_root/5.61.0_97000_20260828T121627Z" ]]
[[ ! -e "$release_root/5.60.0_96765_20260814T121627Z" ]]
[[ ! -e "$release_root/incomplete_capture" ]]

# Re-running retention is a no-op and leaves the same three directories.
bash "$CHECKER" --prune-releases
[[ "$(find "$release_root" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" == "3" ]]

echo "UbuntuMac checker regression test passed"
