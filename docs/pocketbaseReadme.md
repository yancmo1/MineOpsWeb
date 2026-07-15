# PocketBase — connection & deployment notes

This document describes how the project's PocketBase sync service is deployed, how other apps should connect to it, and quick troubleshooting / verification steps you can share with other agents.

## Quick summary
- Public URL (intended): https://slotpull-pb.yancmo.xyz
- Local container bind on host/VM: `127.0.0.1:8090`
- Repo docker-compose: `infra/pocketbase/docker-compose.yml`
- App env var used by the frontend: `VITE_POCKETBASE_URL`

Set `VITE_POCKETBASE_URL` to the base URL (include protocol + host + port) for apps that need to talk to PocketBase. Example:

```
VITE_POCKETBASE_URL=https://slotpull-pb.yancmo.xyz
```

Or for local development (bring PocketBase up with the repo compose):

```
VITE_POCKETBASE_URL=http://localhost:8090
```

## What other apps need
1. Point at the PocketBase base URL via an env var (as above). SDK clients expect the base URL (not the `/api` path).
2. If doing server-to-server automation, create a scoped API key in the PocketBase Admin UI (Admin UI → Settings → API Keys) with only the permissions required by the client.
3. For collection-level access, prefer collection rules or collection-scoped API keys rather than sharing admin credentials.

## Required collections (app-side expectations)
The frontend expects these collections (create via Admin UI or migration scripts). Use custom IDs as listed so the client code maps predictably:

- `events` — fields for event metadata (name, date, location, etc.)
- `participants` — participant details (name, email, payment status, etc.)
- `spin_round_entries` — entries for spin rounds
- `event_sessions` — per-event session records

Recommended rule for all collections (server-side):

```
@request.auth.id != ""
```

This requires an authenticated user or an appropriate API key to access records.

## Deployment details (where it runs)
- VM: Oracle VM running Ubuntu (Tailscale IP in repo notes: `100.81.231.58`).
- Compose dir on VM: `/opt/infra-new/apps/pocketbase`
- Compose file: writes the same content as `infra/pocketbase/docker-compose.yml` in this repo.
- Data volume: Docker named volume `pb_data` (mapped into `/pb/pb_data` inside the container).

GitHub Actions workflow that deploys the compose is `.github/workflows/deploy-pocketbase.yml`. It requires these secrets:

- `ORACLE_VM_SSH_KEY` — private SSH key for the deploy user
- `ORACLE_VM_HOST` — host/Tailscale IP or hostname
- `ORACLE_VM_USER` — user to SSH as
- `VITE_POCKETBASE_URL` — used when building the frontend
- `TAILSCALE_AUTHKEY` — to join the Tailscale network from the runner

## How to verify / health checks

From your machine (public tunnel active):

```
curl -v https://slotpull-pb.yancmo.xyz/api/health

# admin UI (web):
# https://slotpull-pb.yancmo.xyz/_/
```

On the PocketBase VM (SSH):

```
# inspect compose folder
ls -l /opt/infra-new/apps/pocketbase
cat /opt/infra-new/apps/pocketbase/docker-compose.yml

cd /opt/infra-new/apps/pocketbase
docker compose ps
docker compose logs --tail=200 pocketbase
curl -sf http://localhost:8090/api/health && echo "healthy" || echo "unhealthy"

# check port binding
ss -lntp | grep 8090 || ss -lnt | grep 8090
```

## How to deploy / restart manually (VM)

SSH to the VM (use your private key / SSH user):

```
ssh -i /path/to/key user@<VM_IP_or_host>
cd /opt/infra-new/apps/pocketbase
docker compose pull
docker compose up -d
```

## Cloudflare Tunnel note
The public hostname `slotpull-pb.yancmo.xyz` is served via a Cloudflare Tunnel that forwards to `localhost:8090` on the VM. If the tunnel is not running, the public hostname will 404 or time out — check `cloudflared` service logs on the VM:

```
sudo systemctl status cloudflared
sudo journalctl -u cloudflared -n 200 --no-pager
```

## Troubleshooting checklist
- If admin UI is unreachable: verify `cloudflared` is running and has an ingress for the hostname.
- If health check fails: check `docker compose logs pocketbase` for errors and ensure the `pb_data` volume is writable and not corrupted.
- If container restarts repeatedly: check disk space (`df -h`) and `docker compose logs` for stack traces.
- If you changed ports or binding: `infra/pocketbase/docker-compose.yml` currently maps to `127.0.0.1:8090` on the host. To expose to the LAN change the ports mapping to `"8090:8090"` and restart the stack (beware security implications).

## Creating admin account & collections
1. Visit the admin UI (`/_/`) on the public hostname or locally via `http://localhost:8090/_/`.
2. Create an admin user when prompted (first visit) or sign in if one exists.
3. Create the collections listed above and set the collection rules and field schemas.

## Shareable checklist for other agents
1. Ensure `VITE_POCKETBASE_URL` is set for the app build/runtime to the correct base URL.
2. Use collection-scoped API keys where possible for programmatic access.
3. Confirm health via `/api/health` and admin UI `/_/`.
4. If deploying changes to `infra/pocketbase/**`, trigger the `.github/workflows/deploy-pocketbase.yml` workflow or apply the compose on the VM.

---
File created to help other agents connect to and maintain PocketBase for cross-device sync.
