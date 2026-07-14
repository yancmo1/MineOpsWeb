# Oracle VM Setup Reference (Shared Server Baseline)

Last verified: 2026-03-23

This document captures the **current live Oracle VM setup** used by `coc-discord-bot` and `clan-map`, so another workspace/agent can reuse the same server pattern for a different project.

## Host baseline

- Hostname: `instance-20260203-0833`
- OS: `Ubuntu 22.04.5 LTS`
- Kernel: `6.8.0-1042-oracle`
- Virtualization: `kvm`
- CPU arch: `aarch64` (ARM64)
- Docker Engine: `29.2.1`

> Important: this server is ARM64. Any deployed image must support `linux/arm64`.

## Core directories and files

- Compose stack path: `/opt/infra-new/compose`
- Active compose file: `/opt/infra-new/compose/docker-compose.yml`
- Compose env file: `/opt/infra-new/compose/.env`
- Docker registry auth (GHCR): `/home/ubuntu/.docker/config.json`

## Running containers (current)

- `infra-new-traefik-1` → `traefik:v3.3`
- `infra-new-cocstack-db-1` → `postgres:15`
- `infra-new-coc-bot-1` → `ghcr.io/yancmo1/coc-discord-bot:latest`
- `infra-new-clan-map-1` → `ghcr.io/yancmo1/clan-map:latest`
- `watchtower-coc-bot` → `containrrr/watchtower:latest`
- `portainer_agent` → `portainer/agent:latest`

## Docker networks

Two shared external networks are used by services:

- `edge` (bridge)
  - Subnet: `172.18.0.0/16`
  - Gateway: `172.18.0.1`
- `backend` (bridge)
  - Subnet: `172.19.0.0/16`
  - Gateway: `172.19.0.1`

Pattern:
- Public ingress services (Traefik + web apps) attach to `edge`
- Internal app/database traffic uses `backend`

## Active compose stack design

### Traefik (`infra-new-traefik-1`)

- Ports exposed: `80`, `443`, `8080`
- Docker provider enabled
- ACME TLS challenge enabled
- Cert storage volume: `traefik-letsencrypt:/letsencrypt`
- Docker socket mounted read-only
- Env includes `DOCKER_API_VERSION=1.44`

### Postgres (`infra-new-cocstack-db-1`)

- Image: `postgres:15`
- Port exposed: `5432`
- Persistent volume: `postgres_data:/var/lib/postgresql/data`
- Healthcheck: `pg_isready -U ${POSTGRES_USER}`

### coc-discord-bot (`infra-new-coc-bot-1`)

- Image: `ghcr.io/yancmo1/coc-discord-bot:latest`
- Restart policy: `unless-stopped`
- Uses env vars from compose `.env` (Discord token, DB creds, API token, etc.)
- Persistent mounts:
  - `/opt/apps/logs/coc-bot:/app/logs`
  - `/opt/apps/data/coc-bot:/app/data`

**Critical deployment rule:**
- Do **not** mount project source code onto `/app` for image-based deploy flow.
- A prior mount (`/opt/apps/apps/coc-discord-bot:/app:ro`) caused stale code and blocked image updates.

### clan-map (`infra-new-clan-map-1`)

- Image: `ghcr.io/yancmo1/clan-map:latest`
- Port exposed: `5552`
- Traefik labels route `clashmap.${DOMAIN}` to container port `5552`
- Mounts:
  - `/opt/apps/apps/clan-map/clan_data.json:/app/clan_data.json:ro`
  - `/opt/apps/apps/clan-map/static:/app/static`

## Watchtower auto-deploy (current production behavior)

Container: `watchtower-coc-bot`

- Image: `containrrr/watchtower:latest`
- Env:
  - `DOCKER_API_VERSION=1.44`
- Command args:
  - `--interval 300`
  - `--cleanup`
  - `--rolling-restart`
  - `infra-new-coc-bot-1`

Meaning:
- Polls every 5 minutes
- Watches only `infra-new-coc-bot-1`
- Pulls newer image tag and restarts container when digest changes

## Portainer agent

Container: `portainer_agent`

- Image: `portainer/agent:latest`
- Port: `9001` exposed
- Used for remote management from Portainer UI

## GHCR + CI/CD assumptions

- Target image tags are in GHCR (private)
- Server must be logged in to GHCR
  - Auth file: `/home/ubuntu/.docker/config.json`
- CI must build multi-arch images including `linux/arm64`

Recommended build platforms for this host:

- `linux/amd64,linux/arm64`

## Reusable pattern for a new app on this same VM

1. Add a new service in `/opt/infra-new/compose/docker-compose.yml`
2. Use image from GHCR (avoid bind-mounting source code to app path)
3. Attach service to `backend`; add `edge` + Traefik labels if public HTTP app
4. Add required env vars to `/opt/infra-new/compose/.env`
5. If auto-deploy needed, either:
   - extend current Watchtower scope/target list, or
   - run a second Watchtower container scoped to the new service
6. Ensure CI publishes `arm64` image variant

## Known pitfalls and fixes

### 1) `exec /usr/local/bin/python: exec format error`

Cause:
- ARM64 server pulled amd64-only image

Fix:
- Build/push multi-arch image with `linux/arm64`
- Re-pull image and recreate container

### 2) New image pulled but old code still running

Cause:
- Source bind mount over `/app` masks image contents

Fix:
- Remove source-code bind mount from compose
- Recreate container

### 3) GHCR unauthorized on pull

Cause:
- Missing/expired docker login on VM

Fix:
- Re-authenticate to GHCR as server user (`ubuntu`)
- Confirm `/home/ubuntu/.docker/config.json` exists

## Quick validation checklist after changes

- `docker ps` shows service `Up`
- Container logs show clean startup (no crash loop)
- Correct image architecture resolves on host (`linux/arm64`)
- App endpoints/bot login verify functional behavior
- Watchtower logs show normal scan/update cycles

---

If you reuse this VM pattern for another repo, copy this file and only replace:
- service name
- image name
- env vars
- ports/Traefik labels
- persistent volume paths
