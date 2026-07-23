#!/usr/bin/env bash
set -euo pipefail

# Oracle VM: pull latest GHCR images + restart MineOpsWeb services.
#
# SSHs to oracle-vm and runs oracle-deploy.sh,
# which pulls new images from GHCR and restarts containers.
#
# Usage:
#   scripts/oracle/deploy-update.sh

SSH_TARGET="oracle-vm"
APP_DIR="/opt/infra-new/apps/mineopsweb"

echo "=== Pulling latest images + restarting ==="
ssh -o BatchMode=yes -o ConnectTimeout=15 "$SSH_TARGET" \
  "APP_DIR=${APP_DIR} bash ${APP_DIR}/oracle-deploy.sh"
