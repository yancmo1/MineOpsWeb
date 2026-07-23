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

### The Golden Rule: Watchtower auto-deploy, not CI SSH

**Do NOT try to SSH from GitHub Actions into the Oracle VM.** The VM is on Tailscale (`100.81.231.58`) which isn't reachable from public CI runners. Every project that's tried CI→SSH has burned hours on Tailscale auth keys, port conflicts, and network debugging.

Instead, use the pattern that already works for `cruisecast-api`, `coc-discord-bot`, and `mineopsweb`:

```
CI (GitHub Actions)          Oracle VM
─────────────────          ─────────
build + push to GHCR  ──→  Watchtower polls GHCR
                           every 60s, pulls new
                           images, restarts containers
```

### Step-by-step: deploy a new app to the Oracle VM

#### 1. Create a standalone `docker-compose.prod.yml` for the app

Use `ghcr.io` images (never bind-mount source code to `/app`):

```yaml
services:
  my-app:
    image: ghcr.io/yancmo1/my-app:latest
    restart: unless-stopped
    ports:
      - "127.0.0.1:<choose-a-port>:<container-port>"
    environment:
      - KEY=${VALUE}
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:<port>/api/health"]
      interval: 15s
      timeout: 5s
      retries: 5

  # Standard Watchtower — copy this verbatim, just change the container names
  watchtower:
    image: containrrr/watchtower:latest
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    command:
      - --interval=60
      - --cleanup
      - --rolling-restart
      - my-app-container-name-1
    environment:
      - DOCKER_API_VERSION=1.53
```

#### 2. Choose a port that isn't already taken

| Port | Used by |
|------|---------|
| 80, 443, 8080 | Traefik (reverse proxy) |
| 8090 | mineopsweb-pocketbase |
| 8091 | infra-new-mineops-pb-1 |
| 8081 | mineopsweb-web |
| 3000 | gin-rummy-server |
| 5432 | PostgreSQL |
| 9001 | Portainer agent |

Check before deploying: `ssh oracle-vm "docker ps --format '{{.Ports}}'"`

#### 3. CI workflow: build + push only

```yaml
# .github/workflows/build-and-push.yml
name: Build and Push (main → GHCR)

on:
  push:
    branches: ["main"]

permissions:
  contents: read
  packages: write

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-qemu-action@v3
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: true
          tags: ghcr.io/yancmo1/my-app:latest
          cache-from: type=gha,scope=my-app
          cache-to: type=gha,mode=max,scope=my-app
```

- **Always** build for both `linux/amd64,linux/arm64` — the Oracle VM is ARM64.
- **Always** add `cache-from`/`cache-to` with `type=gha` — warm builds take ~45s instead of 4min.

#### 4. One-time manual deploy to kick things off

```bash
ssh oracle-vm "mkdir -p /opt/infra-new/apps/my-app"

# Push compose + .env
scp docker-compose.prod.yml oracle-vm:/opt/infra-new/apps/my-app/
# Write your .env file somehow (manual copy, CI secret, etc.)

# Start the stack
ssh oracle-vm "cd /opt/infra-new/apps/my-app && \
  docker login ghcr.io -u yancmo1 --password-stdin <<< \$GHCR_TOKEN && \
  docker compose -f docker-compose.prod.yml pull && \
  docker compose -f docker-compose.prod.yml up -d"
```

From this point on, Watchtower handles updates automatically — just push to main.

#### 5. If the app needs public HTTP access

Use **Cloudflare Tunnel** (already running on the VM) to route a domain → localhost port. Add a public hostname in the Cloudflare Zero Trust dashboard pointing to `http://localhost:<your-port>`.

Alternatively, attach to Traefik with labels:
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.my-app.rule=Host(\`my-app.yancmo.xyz\`)"
  - "traefik.http.routers.my-app.entrypoints=websecure"
  - "traefik.http.routers.my-app.tls=true"
```

### Common pitfalls

| Pitfall | Symptom | Fix |
|---|---|---|
| CI tries to SSH via Tailscale | `ssh-keyscan` timeout, exit 1 | Don't SSH from CI. Use Watchtower. |
| Port already allocated | `Bind for 0.0.0.0:PORT failed` | Check `docker ps --format '{{.Ports}}'`, pick a free port |
| PB 0.39.x migration fails | `fields: (N: (values: cannot be blank.))` | Change `type: "select"` → `type: "text"` in migration files |
| PB `fields.add()` fails | `could not convert [object Object] to core.Field` | Don't modify collection fields in later migrations; put all fields in the initial migration |
| Pull fails with "unauthorized" | `Error response from daemon: pull access denied` | `docker login ghcr.io` on the VM as user `ubuntu` |
| Wrong arch image | `exec format error` | Build with `platforms: linux/amd64,linux/arm64` |

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
