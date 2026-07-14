# Local setup

Use Docker Compose for the supported stack. Create a private `.env` from `.env.example`, choose non-default development passwords, then run `make dev-up`. The web app is on port 8080 and the API on port 8000. Do not commit the `.env` file.

`make dev-up` uses `docker-compose.dev.yml`: Vite serves the frontend with Hot Module Replacement and the FastAPI process runs Uvicorn reload against `backend/app`. Source changes are bind-mounted; dependencies stay in a named Docker volume. Use `make dev-logs` to watch both services and `make dev-down` to stop the local stack without deleting PostgreSQL data.

Production defaults remain in `docker-compose.yml`; the development override is intentionally required for hot reload. The CI/CD workflow will build the production targets, tag immutable images, run checks, and deploy only after a future explicit production-readiness decision.

For rapid frontend work, run `npm install && npm run dev` in `frontend`; point `VITE_API_BASE_URL` at the API only through an uncommitted local environment.
