# MineOps DeepSeek Agent Powerhouse Setup PRD

**Status:** Proposed
**Date:** 2026-07-18
**Audience:** DeepSeek coding agent / repository maintainer
**Scope:** Agent skills, MCP integrations, guardrails, and verification workflow

## 1. Objective

Configure the DeepSeek agent to work effectively and safely on MineOpsWeb across:

- React/TypeScript PWA development
- IndexedDB-first player state and conflict-aware synchronization
- immutable catalog packages and APK/Unity extraction
- PocketBase control-plane operations
- UbuntuMac capture and data-engine pipeline
- Oracle VM deployment and production diagnostics
- behavioral parity with `../mineops-companion`

The result should be a domain-aware agent that can implement, test, document, and verify MineOps changes without fabricating game data or making unsafe infrastructure changes.

## 2. Non-goals

- Do not grant unrestricted production SSH, Docker, or database access.
- Do not allow the agent to invent catalog values, manager abilities, localization, or mappings.
- Do not automatically publish catalog releases or deploy production changes.
- Do not replace the existing `AGENTS.md`, PRD, architecture docs, or journal as sources of truth.
- Do not install collaboration integrations unless the project actually uses them.

## 3. Required persistent agent instructions

Create a MineOps project skill or equivalent persistent instruction named `mineops-maintainer`.

Before any implementation, it must read, in order:

1. `docs/development/journal.md`
2. `PRD.md` and the relevant document under `PRD/`
3. `AGENTS.md`
4. `docs/architecture/*.md`
5. Relevant validation, deployment, operations, parity, and emulator-ingestion documents

The agent must:

- classify claims as **verified**, **inferred**, or **unresolved**;
- preserve IndexedDB-first behavior, stable UUIDs, queued mutations, idempotency, and explicit conflict handling;
- treat the iOS project as the behavioral reference until parity is documented;
- never use display names as canonical identity;
- preserve unknown source fields in extensions or unresolved-object records;
- update `docs/development/journal.md` for every implementation, test, configuration, workflow, or deployment task;
- update pertinent documentation in the same change set;
- never create, commit, or expose secrets or `.env` files;
- run relevant lint, type, unit, integration, catalog, and build checks before handoff;
- report limitations separately from completed work.

## 4. Agent skills to create or enable

### 4.1 MineOps Maintainer

Responsibilities:

- repository orientation and documentation-first changes;
- scope checks against the V3 PRD;
- required journal and documentation updates;
- test selection and handoff reporting;
- detection of stale or conflicting architecture instructions.

### 4.2 Catalog Release Validator

Responsibilities:

- validate catalog schemas and deterministic serialization;
- verify manifest hashes and byte counts;
- inspect release lineage, mappings, unresolved objects, and evidence;
- distinguish candidate, review-required, ready, active, superseded, and rejected states;
- run the existing catalog validation, review, and publish checks;
- never activate or publish without explicit user approval.

### 4.3 Sync and Offline QA

Responsibilities:

- test offline edits, reconnect queues, revision conflicts, retries, and idempotency;
- verify local state remains authoritative when PocketBase is unavailable;
- verify catalog failure never deletes player progress;
- inspect snapshot interpretation metadata and catalog-version isolation;
- test PWA update and recovery behavior.

### 4.4 iOS Parity QA

Responsibilities:

- compare web behavior with `../mineops-companion`;
- use `docs/PARITY_MATRIX.md` as the tracking artifact;
- identify behavior gaps without copying unverified implementation details;
- update the parity matrix when parity changes.

### 4.5 MineOps Operations

Responsibilities:

- understand `oracle-vm`, `ubuntumac`, and the shared `infra-new` Compose project;
- default to read-only health checks and log inspection;
- require explicit approval for migrations, rebuilds, restarts, deploys, or publication;
- verify backups, health, representative workflows, and rollback readiness;
- enforce ARM64-compatible deployment artifacts.

### 4.6 Capture and Extraction QA

Responsibilities:

- validate capture envelopes and contract fixtures;
- inspect APK extraction evidence and unresolved fields;
- verify parser output against schemas and source evidence;
- investigate Kolibri field-name uncertainty through real captured responses;
- never infer missing game facts from names or neighboring records.

## 5. MCP integrations

Implement or connect the following MCP capabilities, in priority order.

### Priority 1 — required

1. **Repository/filesystem**
   - read and edit only the MineOps workspace;
   - expose file search, patching, diff, and test execution;
   - prevent access to unrelated directories by default.

2. **GitHub**
   - inspect issues, pull requests, review comments, Actions checks, and branches;
   - support issue-to-change traceability;
   - never merge or push without explicit approval.

3. **Browser/Playwright**
   - test local and production web flows;
   - support mobile viewport, offline mode, console/network inspection, and screenshots;
   - cover sign-in, catalog loading, Kolibri import, Strategy, More, and recovery flows.

4. **Safe remote operations**
   - read-only SSH commands for `oracle-vm` and `ubuntumac`;
   - health, logs, disk, Docker status, capture queue, and deployment verification;
   - write operations exposed as separate approval-gated tools.

### Priority 2 — strongly recommended

5. **PocketBase**
   - inspect collections, migrations, release records, publication state, reviews, and audit history;
   - provide schema-diff and migration-status checks;
   - block destructive collection operations.

6. **Docker/Compose**
   - inspect merged configuration, health, image architecture, logs, and service status;
   - require approval for `up`, rebuild, restart, migration, or volume changes;
   - always preserve the `infra-new` project convention.

7. **ADB/emulator**
   - capture save-game artifacts, check APK releases, inspect emulator state, and run ingestion checks;
   - redact tokens and private paths in output.

### Priority 3 — optional

8. **IndexedDB/local-state inspection** for sync queue and catalog cache debugging.
9. **Fastlane/Xcode integration** when iOS parity or TestFlight becomes an active workflow.
10. **GitHub Actions monitoring** if the repository gains a larger CI matrix.

Avoid adding Slack, Teams, Notion, Drive, Calendar, or email integrations unless MineOps work is actually managed there.

## 6. Recommended domain tools

If custom MCP tools are needed, prefer narrow MineOps operations over unrestricted shell access:

- `validate_catalog_package`
- `review_catalog_release`
- `inspect_sync_state`
- `check_capture_pipeline`
- `check_oracle_health`
- `compare_parity_matrix`
- `run_production_smoke_test`
- `verify_deployment_architecture`

Each tool should return structured results containing `status`, `evidence`, `warnings`, `requested_approval`, and `next_action`.

## 7. Approval and safety model

The agent may perform read-only inspection and local development changes within the repository.

The agent must request approval before:

- production deploys, restarts, migrations, or publication;
- modifying remote PocketBase data;
- changing Docker volumes or backups;
- pushing branches, merging PRs, or releasing builds;
- accessing credentials or printing token-like values.

All remote operations must identify the exact host, project, service, and intended effect before execution.

## 8. Standard task workflow

1. Orient from the journal, PRD, architecture, and relevant operational documents.
2. State the requested outcome, assumptions, affected surfaces, and risk.
3. Inspect existing code, tests, schemas, and current production limitations.
4. Implement the smallest coherent change.
5. Run relevant checks, including catalog or browser checks when applicable.
6. Update the journal and pertinent documentation.
7. Report changed files, verification, evidence status, remaining limitations, and any approval needed.

## 9. Acceptance criteria

This setup is complete when:

- the MineOps Maintainer skill or equivalent persistent instruction is active;
- catalog, sync/parity, operations, and extraction workflows are represented by reusable skills;
- repository, GitHub, browser, and safe remote-operation MCPs are available;
- production-changing tools are approval-gated;
- the agent can run a catalog validation and frontend test task end-to-end;
- the agent updates the journal during a test implementation task;
- no secrets are introduced;
- a sample handoff clearly separates verified results, unresolved issues, and requested approvals.

## 10. Suggested implementation order

1. Create `mineops-maintainer`.
2. Add catalog validation and sync/parity skills.
3. Add browser and GitHub integrations.
4. Add read-only Oracle/UbuntuMac diagnostics.
5. Add PocketBase, Docker, and ADB integrations.
6. Add approval gates and redact sensitive output.
7. Run a sample task against the existing catalog validation and frontend test suites.

