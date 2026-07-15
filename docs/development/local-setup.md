# Local setup

Use Docker Compose for the supported stack. Create a private `.env` from `.env.example`, choose non-default development passwords, then run `make dev-up`. The web app is on port 8080 and the API on port 8000. Do not commit the `.env` file.

`make dev-up` uses `docker-compose.dev.yml`: Vite serves the frontend with Hot Module Replacement and the FastAPI process runs Uvicorn reload against `backend/app`. Source changes are bind-mounted; dependencies stay in a named Docker volume. Use `make dev-logs` to watch both services and `make dev-down` to stop the local stack without deleting PostgreSQL data.

Production defaults remain in `docker-compose.yml`; the development override is intentionally required for hot reload. The CI/CD workflow will build the production targets, tag immutable images, run checks, and deploy only after a future explicit production-readiness decision.

For rapid frontend work, run `npm install && npm run dev` in `frontend`; point `VITE_API_BASE_URL` at the API only through an uncommitted local environment.
## Local PocketBase

The development Compose file starts PocketBase at `http://localhost:8090`, applies the committed MineOps migrations, and bootstraps the first superuser from `PB_ADMIN_EMAIL` / `PB_ADMIN_PASSWORD` in the uncommitted root `.env`. The local dashboard is `http://localhost:8090/_/`. After changing `.env`, recreate the web container because `VITE_*` values are embedded when Vite starts:

```bash
docker compose -f docker-compose.dev.yml up -d --build --force-recreate web
```

## Local Kolibri sync

Copy `.env.example` to an uncommitted `.env` and set `VITE_KOLIBRI_ID`, `VITE_KOLIBRI_AUTH_TOKEN`, and `VITE_KOLIBRI_SAVE_GAME_KEY=0`, then restart Vite. Alternatively open **More → Kolibri sync** and enter the values for the current browser session. The Vite dev server proxies `/kolibri` to the Capsule endpoint and `/master` to the idle-miners catalog endpoint. A successful sync decodes the `U58U`/base64/gzip payload, applies valid manager progress automatically, and shows diagnostics; no review step is currently required for local development.
