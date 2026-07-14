# MineOpsWeb

MineOpsWeb is the offline-first PWA replacement for MineOps Companion. It currently provides a running FastAPI/PostgreSQL foundation, browser IndexedDB manager-progress storage, queued synchronization, idempotent server writes, and staged catalog snapshot ingestion.

## Run locally

Copy `.env.example` to a local, uncommitted `.env`, set safe values, then run `docker compose up --build`. Open `http://localhost:8080`; API health is at `http://localhost:8000/health`.

Read [PRD.md](PRD.md), [local setup](docs/development/local-setup.md), and the architecture documents before contributing. Deployment must follow `docs/server-guide` when installed locally.
