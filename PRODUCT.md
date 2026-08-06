# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Existing React, TypeScript, and Vite Progressive Web App in `frontend/`, with IndexedDB/Dexie for local state and PocketBase for server control-plane data.

## Users

The primary user is the owner/developer of this project, using it as a personal strategy tool while playing Idle Miner Tycoon.

## Product Purpose

MineOpsWeb helps the user understand their current game state and decide which managers, upgrades, equipment, resources, lineups, and event choices are most useful for progressing in Idle Miner Tycoon.

## Positioning

MineOpsWeb is inspired by the ideas and strategy tools on [idle-miners.com](https://idle-miners.com/), but its recommendations are calculated from the user's own captured and verified game data rather than from the reference site's data.

## Operating Context

The user imports game data, reviews synchronization and catalog freshness, explores manager and resource details, and uses the Strategy area to plan investments and lineups across phone, tablet, and desktop web sessions. The existing iOS project at `../mineops-companion` is the behavioral and domain reference until documented parity is reached.

## Capabilities and Constraints

- Use real MineOps manager catalog data, assets, terminology, calculations, and synchronized player data.
- Preserve verified APK/catalog values and clearly label or manually request values that are not available from the captured data.
- Keep game catalog data, player state, and MineOps-created workspace data separate.
- Store primary browser state in IndexedDB/Dexie and preserve offline-first behavior, queued mutations, stable IDs, idempotency, revision checks, and explicit conflict handling.
- Support catalog versioning, import provenance, snapshots, and cross-device synchronization through the dedicated MineOps PocketBase infrastructure.
- Remain useful when the UbuntuMac capture/extraction host is unavailable.
- Maintain a mobile-first, keyboard-accessible, installable PWA.
- Do not fabricate game mechanics, values, user data, testimonials, or strategy claims.
- The exact Kolibri fragment field remains an open data-integration question; omitted fragments must not be treated as zero.

## Brand Commitments

The product name is `MineOpsWeb`. It should feel like a personal MineOps strategy companion, not a generic database administration screen or infrastructure demo.

## Evidence on Hand

- V3 requirements: `PRD/MineOpsWeb_Codex_PRD_V3.md`
- Behavioral/domain reference: `../mineops-companion`
- Current strategy and catalog implementation: `frontend/src/pages/StrategyPage.tsx`, `frontend/src/lib/strategy.ts`, and related strategy tests
- Idle-miners.com reverse-engineering and port status: `docs/reference/idle-miners.com.md`
- Verified data and sync constraints: `docs/architecture/data-model.md` and `docs/architecture/sync-model.md`
- No external reference-site dataset is treated as MineOps product data.

## Product Principles

1. Make recommendations useful for the user's actual roster and progression.
2. Prefer verified evidence and transparent uncertainty over invented completeness.
3. Preserve player data safely across imports, catalog releases, devices, and offline edits.
4. Keep strategy decisions understandable and actionable, not merely computationally sophisticated.
5. Maintain behavioral parity with the iOS companion while adapting the experience to the web.

## Accessibility & Inclusion

The PWA must remain mobile-first and keyboard-accessible, with clear labels, usable focus states, and responsive behavior across phone, tablet, and desktop layouts.
