#!/usr/bin/env bash
set -euo pipefail

# Manual UbuntuMac trigger for capture wiring.
#
# Usage:
#   scripts/ubuntumac/run-remote-check.sh           # acquire, upload, and clean up emulator
#   scripts/ubuntumac/run-remote-check.sh --status  # health/catalog status only
#   scripts/ubuntumac/run-remote-check.sh --no-start       # require an already-running emulator
#   scripts/ubuntumac/run-remote-check.sh --keep-emulator  # leave an emulator started by the run online
#
# Optional overrides:
#   UBUNTUMAC_SSH_TARGET=yancmo@100.105.31.42
#   UBUNTUMAC_REMOTE_COMMAND=~/mineops-data/bin/check-and-upload.sh

SSH_TARGET="${UBUNTUMAC_SSH_TARGET:-yancmo@100.105.31.42}"
REMOTE_COMMAND="${UBUNTUMAC_REMOTE_COMMAND:-~/mineops-data/bin/check-and-upload.sh}"
MODE="${1:-run}"

if [[ "$MODE" == "--status" || "$MODE" == "status" ]]; then
  exec ssh -o BatchMode=yes -o ConnectTimeout=10 "$SSH_TARGET" "$REMOTE_COMMAND --status"
fi

exec ssh -o BatchMode=yes -o ConnectTimeout=10 "$SSH_TARGET" "$REMOTE_COMMAND $MODE"
