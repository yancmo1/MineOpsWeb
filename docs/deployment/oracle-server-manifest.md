# Oracle Server Manifest — MineOpsWeb live state

Last updated: 2026-08-03

This document records changes made directly on the Oracle VM that must survive future deployments or be reapplied.

## Active service

- **Compose project:** `infra-new`
- **Service name:** `mineops-pocketbase`
- **Container:** `infra-new-mineops-pb-1`
- **Image:** `ghcr.io/shepswork/mineops-pocketbase:0.39.6`
- **Local bind:** `127.0.0.1:8091 -> 8090`
- **Public endpoint:** `https://mineops-pb.shepswork.com`

## Public MineOps frontend and catalog artifacts

- **Frontend:** `https://mineops.shepswork.com`
- **Frontend origin container:** `mineopsweb-web-1`, bound on Oracle at `127.0.0.1:8081 -> 80`
- **Frontend image:** `ghcr.io/yancmo1/mineopsweb-web:latest`, currently commit `e3c87b3`, multi-arch digest `sha256:c65393475f50eaf46ecced7e1e12672547ce423dc3adea1bf0dc5fa7d19008d3`
- **Frontend deployment:** GitHub Actions publishes the image; `mineopsweb-watchtower-1` polls GHCR every 60 seconds and recreates only containers whose image changed
- **Catalog artifact hook:** `/opt/infra-new/apps/mineopsweb/pb_hooks/catalog-artifacts.pb.js`
- **Catalog artifact root:** `/opt/infra-new/catalog-artifacts/`, mounted read-only at `/pb/catalog-artifacts`
- **Release packages:** `/opt/infra-new/catalog-artifacts/releases/<releaseId>/`
- **Catalog migration mount:** `/opt/infra-new/apps/mineopsweb/pb_migrations:/pb/pb_migrations:ro`
- **Artifact endpoint:** `https://mineops-pb.shepswork.com/api/catalog/artifacts?file=<filename>`

The public frontend and artifact endpoint are already reachable through the existing public route. No new Cloudflare hostname or DNS record is required for the current setup. Cloudflare tunnel/published-route configuration remains managed in Cloudflare One; treat the public URL checks below as the source-of-truth smoke test after future route or origin changes.

The currently published package verified on 2026-08-02 is release `5.59.0_96449_20260716T143539Z.lossless-v1`, with 118 managers, 11 manifest-listed artifacts, manifest SHA-256 `2ea925ea0c66b7f047d20b4e1be0784fe4a5d7a869769f2eb4dcde76f25fe1ee`, and validation-report SHA-256 `9be9525e33350102be3056aa285737011608be9e871387e19443012feb9aa3bd`. The prior release `5.59.0_96449_20260716T143539Z` is retained as the rollback target.

### Lossless strategy catalog publication

The active package includes `manager-domain.json`, `equipment-domain.json`, `strategy-configs.json`, and `unresolved-evidence.json` alongside the seven standard v2 catalog artifacts. The artifact hook resolves the exact active `releaseId + manifestSha256`, loads only that release directory, verifies the manifest hash and release identity, and serves only manifest-listed files. Review recomputes both package hashes from the server-mounted release; publication requires exactly one hash-bound latest approval and updates pointer/status/event state transactionally.

Production schema hardening is applied by `1700000008_catalog_control_plane_hardening.js`. Direct mutations are closed; `catalog_releases.releaseId` is unique, and only one `catalog_reviews.isLatest=true` row is allowed per release. The migration preserved historical conflicts under explicit `legacy-...` release identities. Do not remove those rows: they are audit history.

### Backup and recovery point

The authoritative post-rotation cold backup is `/opt/infra-new/backups/mineops-catalog/20260803T020855Z`; its archive SHA-256 is `73ba8dcb40734aaec38088b22f8455a1cceb5f58eb50755db4e2ef35f9b9accb`. It passed archive verification and SQLite integrity checking. Pre-deploy compose/hooks are under `predeploy-live-files/` inside that backup directory. Use this backup if the migration/control plane itself must be reverted; use the authenticated rollback endpoint for a catalog-only rollback.

## PB hooks mount (capture ingest)

Added to `/opt/infra-new/compose/docker-compose.yml` under `mineops-pocketbase` volumes:

```yaml
volumes:
  - mineops_pb_data:/pb/pb_data
  - /opt/infra-new/apps/mineopsweb/pb_hooks:/pb/pb_hooks:ro
  - /opt/infra-new/apps/mineopsweb/pb_migrations:/pb/pb_migrations:ro
  - /opt/infra-new/catalog-artifacts:/pb/catalog-artifacts:ro
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

# published catalog manifest and public frontend
curl -sS 'http://127.0.0.1:8091/api/catalog/artifacts?file=manifest.json'
curl -sS -I 'https://mineops-pb.shepswork.com/api/catalog/artifacts?file=manifest.json'
curl -sS -I 'https://mineops.shepswork.com/'
```

From local workstation:

```bash
# VS Code task: UbuntuMac: Capture status
# VS Code task: UbuntuMac: Check APK + upload latest release
# VS Code task: Oracle: Verify capture ingest
```

## Rollback

### Roll back the frontend

The previous known-good frontend is `ghcr.io/yancmo1/mineopsweb-web:sha-bc653e2` (manifest digest `sha256:43b59c088773da8afe2089aa6a52e494d373e74831264bdeee9626d2ce81734a`). Pin that immutable tag in the existing frontend compose definition and recreate only `mineopsweb-web-1`. Verify the public site, then confirm both PocketBase container image IDs and start times are unchanged. Restore `latest` only after its digest is known good.

### Hook mount breaks on compose redeploy

If a compose update removes the `pb_hooks` bind mount:

```bash
ssh oracle-vm
# restore the mount line in /opt/infra-new/compose/docker-compose.yml:
#   - /opt/infra-new/apps/mineopsweb/pb_hooks:/pb/pb_hooks:ro
#   - /opt/infra-new/apps/mineopsweb/pb_migrations:/pb/pb_migrations:ro
#   - /opt/infra-new/catalog-artifacts:/pb/catalog-artifacts:ro
cd /opt/infra-new/compose
docker compose -p infra-new up -d mineops-pocketbase
```

### Roll back the active catalog

Authenticate as a PocketBase superuser or catalog admin, then call `POST /api/catalog/rollback` with `targetReleaseId` set to `5.59.0_96449_20260716T143539Z`. The route was exercised successfully against the restored production backup. Verify the pointer, the old manifest SHA-256 `9feee2bde22c82fc3fbec74d60dbb2905bb6283b9aa5f4d5d6161e793a59f7be`, and the release statuses after rollback.

Do not restore a database backup merely to change the active catalog, and do not overwrite either release directory. For control-plane recovery, restore the verified cold backup and `predeploy-live-files/`, then recreate only `mineops-pocketbase` with `docker compose -p infra-new`.

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
