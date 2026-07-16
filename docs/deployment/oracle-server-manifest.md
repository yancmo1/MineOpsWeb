# Oracle Server Manifest — MineOpsWeb live state

Last updated: 2026-07-16

This document records changes made directly on the Oracle VM that must survive future deployments or be reapplied.

## Active service

- **Compose project:** `infra-new`
- **Service name:** `mineops-pocketbase`
- **Container:** `infra-new-mineops-pb-1`
- **Image:** `ghcr.io/shepswork/mineops-pocketbase:0.39.6`
- **Local bind:** `127.0.0.1:8091 -> 8090`
- **Public endpoint:** `https://mineops-pb.shepswork.com`

## PB hooks mount (capture ingest)

Added to `/opt/infra-new/compose/docker-compose.yml` under `mineops-pocketbase` volumes:

```yaml
volumes:
  - mineops_pb_data:/pb/pb_data
  - /opt/infra-new/apps/mineopsweb/pb_hooks:/pb/pb_hooks:ro
```

Hook file deployed at:

```
/opt/infra-new/apps/mineopsweb/pb_hooks/capture-ingest.pb.js
```

**Backup:** compose file was backed up before modification (timestamped `.bak` file in same directory).

## Capture clients collection

Created directly via PocketBase admin API:

- Collection: `capture_clients`
- Fields: `name`, `tokenHash`, `active`, `lastUsedAt`
- No public rules (superuser-only management)

Active capture client:

- `name: ubuntumac`
- `tokenHash: <SHA256 of token in ~/mineops-data/.capture.token on UbuntuMac>`
- `active: true`

## Re-apply after redeploy

If the mineops-pocketbase container is recreated from a fresh image:

1. Ensure `pb_hooks` directory and `capture-ingest.pb.js` exist on host
2. Ensure the volume mount line is present in compose
3. Re-run `scripts/oracle/setup-capture-client.sh` with the current `TOKEN_HASH`

## Verification commands

From Oracle VM:

```bash
# health
curl -sS http://127.0.0.1:8091/api/health

# ingest route present (expect 401, not 404)
curl -sS -w '%{http_code}\n' -X POST http://127.0.0.1:8091/api/capture/ingest \
  -H 'Content-Type: application/json' --data '{}'

# catalog versions
curl -sS 'http://127.0.0.1:8091/api/collections/catalog_versions/records?perPage=5'
```

From local workstation:

```bash
# VS Code task: UbuntuMac: Capture status
# VS Code task: UbuntuMac: Check APK + upload latest release
# VS Code task: Oracle: Verify capture ingest
```

## Rollback

### Hook mount breaks on compose redeploy

If a compose update removes the `pb_hooks` bind mount:

```bash
ssh oracle-vm
# restore the mount line in /opt/infra-new/compose/docker-compose.yml:
#   - /opt/infra-new/apps/mineopsweb/pb_hooks:/pb/pb_hooks:ro
cd /opt/infra-new/compose
docker compose -p infra-new up -d mineops-pocketbase
```

### Capture token is lost on UbuntuMac

```bash
ssh yancmo@100.105.31.42
# Backup exists as ~/mineops-data/.capture.token.bak.*
# Or re-run: scripts/oracle/setup-capture-client.sh with a new TOKEN_HASH
```

### capture_clients collection missing after fresh PB deploy

```bash
# From repo root:
scp scripts/oracle/setup-capture-client.sh oracle-vm:/tmp/
ssh oracle-vm 'TOKEN_HASH=<current_hash> /tmp/setup-capture-client.sh'
```

### Restore previous capture token (from backup)

```bash
ssh yancmo@100.105.31.42
ls ~/mineops-data/.capture.token.bak.*
# Pick the newest backup and restore:
cp ~/mineops-data/.capture.token.bak.YYYYMMDD-HHMMSS ~/mineops-data/.capture.token
# Compute hash and reseed on Oracle
```
