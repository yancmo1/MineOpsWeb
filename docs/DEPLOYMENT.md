# Deployment

Production uses Docker Compose with PocketBase and the static PWA. Copy `.env.example` to a server-only `.env`, set strong admin/capture values, then run:

```bash
docker compose up -d --build
curl -f http://127.0.0.1:8080/
curl -f http://127.0.0.1:8090/api/health
```

Put TLS/reverse proxy for `mineops.shepswork.com` in front of port 8080. Keep port 8090 private. Back up the `pocketbase_data` volume before upgrades; restore by stopping Compose, replacing the volume from a verified backup, and starting the pinned image again.
