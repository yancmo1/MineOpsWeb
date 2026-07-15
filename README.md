# MineOpsWeb

MineOpsWeb is the responsive, installable web conversion of MineOps Companion. The iOS project at `/Users/yancyshepherd/Projects/mineops-companion` remains the read-only behavioral reference. The web app now uses the verified catalog resource (31 records in the bundled snapshot), catalog-backed progress, Today/Managers/Strategy/More navigation, Dexie cached state and a PocketBase deployment boundary.

## Run locally

```bash
cp .env.example .env # never commit this file
docker compose -f docker-compose.dev.yml up --build
```

Open `http://localhost:8080`. Build checks: `cd frontend && npm run build && npm run test`.

## Documentation

- [Revised PRD](PRD/MineOpsWeb_Codex_PRD_REVISED.md)
- [Migration inventory](docs/MIGRATION_INVENTORY.md)
- [Parity matrix](docs/PARITY_MATRIX.md)
- [Data migration map](docs/DATA_MIGRATION_MAP.md)
- [Calculation inventory](docs/CALCULATION_INVENTORY.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Security](docs/SECURITY.md)

Remaining integration work is tracked explicitly in the parity matrix: authenticated PocketBase SDK flows, Kolibri import activation/rollback UI, capture bridge upload route, and Playwright evidence.
