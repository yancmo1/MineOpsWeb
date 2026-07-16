# Branching and deployment policy

`dev` is the active development branch and the only branch used for local feature work. It does not deploy to Oracle. `main` is reserved for reviewed, production-ready changes.

Automated deployment is now defined in `.github/workflows/main-deploy-oracle.yml`:

- Pushes to `main` run frontend verification (tests + typecheck + build).
- On success, multi-arch Docker images are pushed to GHCR (`linux/amd64,linux/arm64`).
- The workflow deploys to Oracle VM over SSH using `deploy/oracle/docker-compose.prod.yml`.

Do not merge to `main` merely to test development work. Keep feature and integration testing on `dev`, then merge to `main` when changes are intentionally production-bound.
