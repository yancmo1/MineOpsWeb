# API overview

All application endpoints are versioned under `/api/v1`. The operational endpoints are `GET /health`, `GET /ready`, and `GET /api/v1/version`.

Implemented first-slice endpoints: `GET|POST /api/v1/sync/managers`, `POST /api/v1/ingestion/uploads`, `GET /api/v1/catalog/snapshots`, and `POST /api/v1/catalog/snapshots/{id}/activate`. Mutations require `Idempotency-Key`; stale revisions return `409` with the server record. Authentication endpoints are the next required security milestone and must gate all user data before deployment.
