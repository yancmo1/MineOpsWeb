#!/usr/bin/env bash
set -euo pipefail

PB_URL="${PB_URL:-http://127.0.0.1:8091}"
ENV_FILE="${ENV_FILE:-/opt/infra-new/compose/.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[fix-capture-clients] missing env file: $ENV_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

if [[ -z "${MINEOPS_PB_ADMIN_EMAIL:-}" || -z "${MINEOPS_PB_ADMIN_PASSWORD:-}" ]]; then
  echo "[fix-capture-clients] missing admin env vars in $ENV_FILE" >&2
  exit 1
fi

auth_resp="$(curl -sS -X POST "$PB_URL/api/collections/_superusers/auth-with-password" \
  -H 'Content-Type: application/json' \
  --data "{\"identity\":\"${MINEOPS_PB_ADMIN_EMAIL}\",\"password\":\"${MINEOPS_PB_ADMIN_PASSWORD}\"}")"

admin_token="$(python3 - <<'PY' "$auth_resp"
import json, sys
obj = json.loads(sys.argv[1])
print(obj.get('token', ''))
PY
)"

if [[ -z "$admin_token" ]]; then
  echo "[fix-capture-clients] admin auth failed" >&2
  echo "$auth_resp" >&2
  exit 1
fi

patch_code="$(curl -sS -o /tmp/capture_clients_fix_patch.json -w '%{http_code}' \
  -X PATCH "$PB_URL/api/collections/capture_clients" \
  -H "Authorization: Bearer $admin_token" \
  -H 'Content-Type: application/json' \
  --data '{
    "fields": [
      {"name":"name","type":"text","required":true,"options":{"min":1,"max":200,"pattern":""}},
      {"name":"tokenHash","type":"text","required":true,"options":{"min":64,"max":128,"pattern":""}},
      {"name":"active","type":"bool","required":false,"options":{}},
      {"name":"lastUsedAt","type":"date","required":false,"options":{"min":"","max":""}}
    ]
  }')"

if [[ "$patch_code" != "200" ]]; then
  echo "[fix-capture-clients] patch failed (code=$patch_code)" >&2
  cat /tmp/capture_clients_fix_patch.json >&2
  exit 1
fi

echo "[fix-capture-clients] collection patched"
curl -sS -H "Authorization: Bearer $admin_token" "$PB_URL/api/collections/capture_clients" | python3 -m json.tool
