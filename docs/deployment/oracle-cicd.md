# Oracle CI/CD (main -> GHCR -> Oracle VM)

This repository now includes `.github/workflows/main-deploy-oracle.yml`.

## Flow

1. Push to `main` (or run manually via workflow dispatch).
2. Verify job runs frontend tests, typecheck, and production build.
3. Build and push multi-arch images to GHCR:
   - `ghcr.io/yancmo1/mineopsweb-web:latest`
   - `ghcr.io/yancmo1/mineopsweb-pocketbase:latest`
   - plus immutable `sha-*` tags
4. Deploy job SSHes to Oracle VM, writes deployment files and `.env`, pulls images, restarts services, and runs health checks.

## Required GitHub secrets

- `ORACLE_VM_HOST` — Oracle host/IP
- `ORACLE_VM_USER` — SSH user (e.g., `ubuntu`)
- `ORACLE_VM_SSH_KEY` — private SSH key for deploy user
- `ORACLE_APP_DIR` — optional app path on VM (defaults to `/opt/infra-new/apps/mineopsweb`)
- `GHCR_USERNAME` — GHCR username for server-side image pull
- `GHCR_TOKEN` — GHCR token for server-side image pull (`read:packages`)
- `MINEOPS_PROD_ENV` — full multiline production env file content

### Example `MINEOPS_PROD_ENV`

```dotenv
WEB_IMAGE_TAG=latest
PB_IMAGE_TAG=latest
PB_ADMIN_EMAIL=replace-me@example.com
PB_ADMIN_PASSWORD=replace-with-strong-password
```

## Oracle host files used

- `${ORACLE_APP_DIR}/docker-compose.prod.yml`
- `${ORACLE_APP_DIR}/oracle-deploy.sh`
- `${ORACLE_APP_DIR}/.env`

## Safety recommendation

## Server-side state (manual changes)

The CI/CD pipeline deploys container images. Some server-side configuration was applied manually and must be preserved across redeploys. See:

- `docs/deployment/oracle-server-manifest.md` — full live state record

Key items that must survive redeployment:

- PB hooks bind mount in compose (`/opt/infra-new/apps/mineopsweb/pb_hooks:/pb/pb_hooks:ro`)
- `capture_clients` collection + `ubuntumac` client record
- Re-run `scripts/oracle/setup-capture-client.sh` after fresh image deploy if needed

Use GitHub **Environment protection rules** for `production` (required reviewers) so pushes to `main` build automatically but deploy only after approval.

## Rollback

On Oracle, pin image tags in `.env` to previous `sha-*` tags and rerun deploy script:

```bash
APP_DIR=/opt/infra-new/apps/mineopsweb /opt/infra-new/apps/mineopsweb/oracle-deploy.sh
```
