# System overview

MineOpsWeb has three independently deployable concerns: a React/TypeScript PWA, an Oracle-hosted PocketBase control plane, and the outbound UbuntuMac capture/data engine. The PWA reads IndexedDB first, queues player edits with stable UUIDs, and synchronizes them with revision checks, idempotency, and explicit conflict handling.

The catalog data plane is an immutable, versioned JSON release package. A package contains a manifest plus independently hashed artifacts such as catalog-core, relationships, mappings, localization, assets, validation, and changelog data. PocketBase stores release metadata, provenance, validation summaries, review decisions, manual overrides, audit history, and the active-release pointer; it does not mirror the full static catalog.

The PWA reads the active release pointer from PocketBase, verifies the manifest and every artifact hash, then atomically caches the verified package in IndexedDB. Player state remains independent from catalog versions and is never erased when catalog loading fails.
