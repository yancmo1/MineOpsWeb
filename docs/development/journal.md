# Development journal

## 2026-07-14 — Initial replacement foundation

- Added a Dockerized React PWA, FastAPI API, PostgreSQL service, and local emulator ingestion CLI.
- Used revisioned player-manager records, a client IndexedDB queue, idempotency keys, and HTTP 409 conflicts as the first end-to-end parity domain.
- Risk: authentication, Alembic migrations, richer iOS data migration, catalog validation, and the remaining product workflows still need implementation before production use.

## 2026-07-14 — Docker hot-reload development stack

- Added explicit development targets to the frontend and backend Dockerfiles plus `docker-compose.dev.yml` bind mounts.
- `make dev-up` starts Vite HMR on port 8080, Uvicorn API reload on port 8000, and PostgreSQL; source changes refresh without rebuilding images.
- Production Compose continues to use production targets. CI/CD is deliberately deferred until the application has authentication, migrations, and a production-readiness review.

## 2026-07-16 — Immutable catalog capture provenance

- Added additive catalog-ingestion persistence for immutable `catalog_raw_imports` and `catalog_validation_runs`, plus stable `release_id`, `raw_import_id`, and `validation_run_id` links on `catalog_snapshots`.
- Uploads now persist capture schema and engine versions, configuration hash, input hashes, object counts, payload size, validation summary, and manifest-only evidence for large artifact fields instead of inline APK blobs.
- Follow-up review changes now reject `release_id` reuse when the incoming `source_hash` differs, derive validation acceptance server-side from the recorded error list, and constrain snapshot state changes to the reviewed/publish/superseded workflow.
- The backend applies this as an additive startup migration for existing databases and backfills missing provenance links for older snapshots. Backup before rollout with `sqlite3 backend/mineops.db ".backup mineops-pre-provenance.db"` (or `pg_dump` in PostgreSQL); rollback by restoring that backup and removing the new `catalog_raw_imports`, `catalog_validation_runs`, and additive snapshot-link columns from the target environment.
