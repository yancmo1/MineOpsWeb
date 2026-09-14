#!/usr/bin/env bash
set -euo pipefail

LOG_DIR="/home/yancmo/mineops-data/logs"
LOG_FILE="$LOG_DIR/weekly-update.log"
ENGINE_DIR="/home/yancmo/mineops-engine"
CHECKER="/home/yancmo/mineops-data/bin/check-and-upload.sh"
REPORT_STATE_FILE="/home/yancmo/mineops-data/logs/weekly-check-state.json"
LAST_RESULT_FILE="$LOG_DIR/weekly-update-last-result"

# Cron wakes this wrapper every Sunday, but the pipeline runs only on
# alternating Unix weeks so the cadence remains stable across month ends.
# A failed run opts the next Sunday into a retry so one transient emulator or
# network failure cannot leave the bridge stale for another full interval.
if [[ $(( $(date +%s) / 604800 % 2 )) -ne 0 ]]; then
  last_result=""
  if [[ -f "$LAST_RESULT_FILE" ]]; then
    last_result="$(<"$LAST_RESULT_FILE")"
  fi
  [[ "$last_result" == "failed" ]] || exit 0
fi

mkdir -p "$LOG_DIR"
exec >>"$LOG_FILE" 2>&1
echo "==== $(date -Is) biweekly run START ===="

export PATH="$HOME/Android/Sdk/platform-tools:$PATH"
cd "$ENGINE_DIR"
if [[ ! -x .venv/bin/python ]]; then
  python3 -m venv .venv
fi
. .venv/bin/activate
pip install -e . >/dev/null 2>&1

cleanup() {
  local exit_code=$?
  local result_tmp
  result_tmp="$(mktemp "$LAST_RESULT_FILE.tmp.XXXXXX")"
  if [[ "$exit_code" == "0" ]]; then
    printf '%s\n' success >"$result_tmp"
  else
    printf '%s\n' failed >"$result_tmp"
  fi
  mv -f "$result_tmp" "$LAST_RESULT_FILE"
  echo "[$(date -Is)] stopping emulator"
  mineops-data-engine emulator stop || true
  MINEOPS_EMAIL_SUPPRESS=0 MINEOPS_REPORT_STATE_FILE="$REPORT_STATE_FILE" MINEOPS_REPORT_EXIT_CODE="$exit_code" MINEOPS_REPORT_MESSAGE="Biweekly pipeline completed with exit code $exit_code" \
    "$CHECKER" --report || true
  rm -f "$REPORT_STATE_FILE"
  exit "$exit_code"
}
trap cleanup EXIT

echo "[$(date -Is)] starting emulator"
mineops-data-engine emulator start

echo "[$(date -Is)] verifying Google Play freshness"
MINEOPS_EMAIL_SUPPRESS=1 MINEOPS_REPORT_STATE_FILE="$REPORT_STATE_FILE" "$CHECKER" --no-start --ensure-current

echo "[$(date -Is)] running process pipeline"
mineops-data-engine process

echo "[$(date -Is)] extracting managers"
LATEST_RELEASE=$(ls -t "$HOME/mineops-data/releases/" | head -1)
if [[ -n "$LATEST_RELEASE" ]]; then
  MINEOPS_DATA_ROOT="$HOME/mineops-data" mineops-data-engine extract-managers \
    --release-id "$LATEST_RELEASE" 2>&1 || echo "extract-managers: non-fatal error"
fi

echo "[$(date -Is)] generating v2 catalog"
LATEST=$(ls -t "$HOME/mineops-data/releases/" | head -1)
if [[ -n "$LATEST" ]]; then
  .venv/bin/python3 scripts/generate_catalog.py \
    "$HOME/mineops-data/releases/$LATEST" 2>&1 || echo "generate-catalog: non-fatal error"
fi
echo "[$(date -Is)] uploading latest processed release"
MINEOPS_EMAIL_SUPPRESS=1 MINEOPS_REPORT_STATE_FILE="$REPORT_STATE_FILE" "$CHECKER" --no-start --upload-latest
echo "==== $(date -Is) biweekly run END ===="
