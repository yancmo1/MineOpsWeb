# Development journal

## 2026-07-14 — Initial replacement foundation

- Added a Dockerized React PWA, FastAPI API, PostgreSQL service, and local emulator ingestion CLI.
- Used revisioned player-manager records, a client IndexedDB queue, idempotency keys, and HTTP 409 conflicts as the first end-to-end parity domain.
- Risk: authentication, Alembic migrations, richer iOS data migration, catalog validation, and the remaining product workflows still need implementation before production use.

## 2026-07-14 — Docker hot-reload development stack

- Added explicit development targets to the frontend and backend Dockerfiles plus `docker-compose.dev.yml` bind mounts.
- `make dev-up` starts Vite HMR on port 8080, Uvicorn API reload on port 8000, and PostgreSQL; source changes refresh without rebuilding images.
- Production Compose continues to use production targets. CI/CD is deliberately deferred until the application has authentication, migrations, and a production-readiness review.
