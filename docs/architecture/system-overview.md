# System overview

MineOpsWeb has three independently deployable parts: a React/TypeScript PWA, a FastAPI/PostgreSQL API, and a local Python ingestion agent. The PWA reads IndexedDB first, queues edits with stable UUIDs, then synchronizes them through revision-checked, idempotent API requests. The API owns user and catalog state; the agent has a separate catalog-ingestion-only path.

The first implemented vertical slice is Super Manager progression, chosen because it is the active iOS workflow and has authoritative Kolibri imports. Catalog snapshots are staged and immutable by source hash.
