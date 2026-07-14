# MineOpsWeb Agent Guide

Before material changes, read `PRD.md`, this file, the architecture docs, and `docs/server-guide` when it exists. The iOS project at `../mineops-companion` is the behavioral reference until the parity report says otherwise.

- Never create or commit `.env` files or secrets; update `.env.example` and documentation only.
- Keep migrations additive and document a backup/rollback path for destructive changes.
- Preserve stable client UUIDs, IndexedDB-first behavior, queued mutations, idempotency, and explicit conflict resolution.
- Maintain mobile-first, keyboard-accessible UI and PWA update safety.
- Keep Docker development and production paths working; follow the server guide for deployment details.
- Run relevant lint, type, unit, and integration checks before handing off.
- Update documentation and `docs/development/journal.md` for material architecture, data, auth, or workflow decisions.
