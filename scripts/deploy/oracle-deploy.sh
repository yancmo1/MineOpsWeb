#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/infra-new/apps/mineopsweb}"
COMPOSE_FILE="${APP_DIR}/docker-compose.prod.yml"
ENV_FILE="${APP_DIR}/.env"

echo "[deploy] app dir: ${APP_DIR}"
mkdir -p "${APP_DIR}"

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "[deploy] missing compose file: ${COMPOSE_FILE}" >&2
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "[deploy] missing env file: ${ENV_FILE}" >&2
  exit 1
fi

cd "${APP_DIR}"

echo "[deploy] pull images"
docker compose --env-file .env -f docker-compose.prod.yml pull

echo "[deploy] stop existing containers (free up ports)"
# slotpull-pocketbase holds port 8090 — stop it if running
docker stop slotpull-pocketbase 2>/dev/null && docker rm slotpull-pocketbase 2>/dev/null || true
docker compose --env-file .env -f docker-compose.prod.yml down --remove-orphans 2>/dev/null || true

echo "[deploy] start services"
docker compose --env-file .env -f docker-compose.prod.yml up -d --remove-orphans

echo "[deploy] health checks"
curl -fsS http://127.0.0.1:8080/ >/dev/null
curl -fsS http://127.0.0.1:8090/api/health >/dev/null

echo "[deploy] success"
