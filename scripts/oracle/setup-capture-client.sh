#!/usr/bin/env bash
set -euo pipefail

PB_URL="${PB_URL:-http://127.0.0.1:8091}"
CLIENT_NAME="${CLIENT_NAME:-ubuntumac}"
TOKEN_HASH="${TOKEN_HASH:?set TOKEN_HASH}"
ENV_FILE="${ENV_FILE:-/opt/infra-new/compose/.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[setup-capture-client] missing env file: $ENV_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

if [[ -z "${MINEOPS_PB_ADMIN_EMAIL:-}" || -z "${MINEOPS_PB_ADMIN_PASSWORD:-}" ]]; then
  echo "[setup-capture-client] missing MINEOPS_PB_ADMIN_EMAIL/PASSWORD in $ENV_FILE" >&2
  exit 1
fi

auth_resp="$(curl -sS -X POST "$PB_URL/api/collections/_superusers/auth-with-password" \
  -H 'Content-Type: application/json' \
  --data "{\"identity\":\"${MINEOPS_PB_ADMIN_EMAIL}\",\"password\":\"${MINEOPS_PB_ADMIN_PASSWORD}\"}")"

admin_token="$(python3 - <<'PY' "$auth_resp"
import json, sys
obj = json.loads(sys.argv[1])
print(obj.get("token", ""))
PY
)"

if [[ -z "$admin_token" ]]; then
  echo "[setup-capture-client] superuser auth failed" >&2
  echo "$auth_resp" >&2
  exit 1
fi

collection_code="$(curl -sS -o /tmp/capture_clients_collection.json -w '%{http_code}' \
  -H "Authorization: Bearer $admin_token" \
  "$PB_URL/api/collections/capture_clients")"

if [[ "$collection_code" == "404" ]]; then
  create_code="$(curl -sS -o /tmp/capture_clients_create_collection.json -w '%{http_code}' \
    -X POST "$PB_URL/api/collections" \
    -H "Authorization: Bearer $admin_token" \
    -H 'Content-Type: application/json' \
    --data '{
      "name": "capture_clients",
      "type": "base",
      "system": false,
      "schema": [
        {"name":"name","type":"text","required":true,"options":{"min":1,"max":200}},
        {"name":"tokenHash","type":"text","required":true,"options":{"min":64,"max":128}},
        {"name":"active","type":"bool","required":false,"options":{}},
        {"name":"lastUsedAt","type":"date","required":false,"options":{"min":"","max":""}}
      ],
      "listRule": null,
      "viewRule": null,
      "createRule": null,
      "updateRule": null,
      "deleteRule": null
    }')"
  if [[ "$create_code" != "200" ]]; then
    echo "[setup-capture-client] failed to create capture_clients collection (code=$create_code)" >&2
    cat /tmp/capture_clients_create_collection.json >&2
    exit 1
  fi
  echo "[setup-capture-client] created collection capture_clients"
fi

lookup_code="$(curl -sS -o /tmp/capture_clients_lookup.json -w '%{http_code}' \
  -H "Authorization: Bearer $admin_token" \
  "$PB_URL/api/collections/capture_clients/records?perPage=200")"

if [[ "$lookup_code" != "200" ]]; then
  echo "[setup-capture-client] failed lookup (code=$lookup_code)" >&2
  cat /tmp/capture_clients_lookup.json >&2
  exit 1
fi

client_id="$(python3 - <<'PY' /tmp/capture_clients_lookup.json "$CLIENT_NAME"
import json, sys
obj = json.load(open(sys.argv[1], 'r', encoding='utf-8'))
items = obj.get('items', [])
target = sys.argv[2]
for item in items:
  if str(item.get('name', '')) == target:
    print(item['id'])
    break
else:
  print('')
PY
)"

if [[ -n "$client_id" ]]; then
  update_code="$(curl -sS -o /tmp/capture_clients_update.json -w '%{http_code}' \
    -X PATCH "$PB_URL/api/collections/capture_clients/records/$client_id" \
    -H "Authorization: Bearer $admin_token" \
    -H 'Content-Type: application/json' \
    --data "{\"tokenHash\":\"$TOKEN_HASH\",\"active\":true}")"
  if [[ "$update_code" != "200" ]]; then
    echo "[setup-capture-client] failed to update client (code=$update_code)" >&2
    cat /tmp/capture_clients_update.json >&2
    exit 1
  fi
  echo "[setup-capture-client] updated client $CLIENT_NAME ($client_id)"
else
  create_client_code="$(curl -sS -o /tmp/capture_clients_create_client.json -w '%{http_code}' \
    -X POST "$PB_URL/api/collections/capture_clients/records" \
    -H "Authorization: Bearer $admin_token" \
    -H 'Content-Type: application/json' \
    --data "{\"name\":\"$CLIENT_NAME\",\"tokenHash\":\"$TOKEN_HASH\",\"active\":true}")"
  if [[ "$create_client_code" != "200" ]]; then
    echo "[setup-capture-client] failed to create client (code=$create_client_code)" >&2
    cat /tmp/capture_clients_create_client.json >&2
    exit 1
  fi
  echo "[setup-capture-client] created client $CLIENT_NAME"
fi

echo "[setup-capture-client] done"
