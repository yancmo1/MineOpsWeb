# Production deployment

Follow `docs/server-guide` for the Oracle host’s Traefik networks, DNS/TLS, paths, backups, and secret handling. Deploy the Compose services with PostgreSQL only on the internal backend network; expose the frontend/API through the existing reverse proxy. Use immutable image tags, take a backup before migrations, run migrations, then verify `/health`, `/ready`, login, and a browser PWA update. Do not deploy the currently unauthenticated vertical slice.
