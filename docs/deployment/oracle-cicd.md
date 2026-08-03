# Oracle CI/CD (GitHub Actions → GHCR → Watchtower)

The frontend deployment workflow is `.github/workflows/main-deploy-oracle.yml`. GitHub Actions verifies and publishes multi-architecture images; it does not SSH to Oracle. Oracle's `mineopsweb-watchtower-1` container polls GHCR every 60 seconds and recreates a watched container only when its image digest changes.

## Automatic flow

1. A push to `main` starts the workflow.
2. The verify job runs frontend tests, TypeScript checking, and a production Vite build.
3. The build job publishes `linux/amd64` and `linux/arm64` images to GHCR:
   - `ghcr.io/yancmo1/mineopsweb-web:latest`
   - `ghcr.io/yancmo1/mineopsweb-web:sha-<commit>`
   - the corresponding legacy `mineopsweb-pocketbase` tags unless a manual web-only run is requested
4. Watchtower detects changed watched images and performs a rolling restart. The public Cloudflare route continues to target the existing local origin.

The active production catalog API is the separate `infra-new-mineops-pb-1` service. A frontend deployment must not recreate it, alter its data, or rotate its credentials.

## Manual web-only deployment

Use the `web_only` workflow-dispatch input when publishing a frontend change without publishing the legacy PocketBase image:

```bash
gh workflow run main-deploy-oracle.yml --ref <branch-or-commit> -f web_only=true
```

Confirm the completed run reports both **Docker metadata (pocketbase)** and **Build and push pocketbase image** as skipped. The workflow's default remains unchanged for pushes to `main`.

## Required GitHub permissions

The workflow grants its GitHub token `contents: read` and `packages: write`. No Oracle SSH or production environment secret is required for the build-and-publish path. Oracle already has read access to the private GHCR images used by its compose project.

## Post-deploy verification

After the build completes, allow one Watchtower polling interval, then verify:

```bash
ssh oracle-vm "docker inspect mineopsweb-web-1 --format '{{.Image}} {{.State.StartedAt}}'"
ssh oracle-vm "docker logs --since 5m mineopsweb-watchtower-1"
curl -fsS -I https://mineops.shepswork.com/
curl -fsS https://mineops-pb.shepswork.com/api/health
```

Record the frontend digest and start time. For a web-only deployment, also compare the image IDs and start times of `infra-new-mineops-pb-1` and `mineopsweb-pocketbase-1` with their pre-deploy values. They must remain unchanged.

## Rollback

Every successful build publishes an immutable `sha-<commit>` tag. Pin the frontend service to the last known-good immutable tag, then recreate only the web service using its existing compose project. Do not run `docker compose down`, recreate PocketBase, or change the `infra-new` project as part of a frontend rollback.

After rollback, repeat the public HTTP, container image/start-time, and PocketBase health checks. See `docs/deployment/oracle-server-manifest.md` for the current live digest and rollback target.
