# MineOps Data Engine — Architecture Decision Log

**Document version:** 1.1  
**Status:** Architect Approved (reply received)  
**Project:** MineOpsDataEngine (UbuntuMac)  
**Source design:** `MineOps_Data_Engine_UbuntuMac_Engineering_Design.md`

**Engineer review note (2026-07-16):** Proceed authorized. Implementation should follow the architect reply section in this file unless a superseding approved decision is recorded.

---

## How to use this log

1. Data Architect fills **Decision** for each question.
2. Engineer marks **Implementation impact** and **Milestone**.
3. Keep one row per decision; do not overwrite history.
4. If a decision changes, add a new row with a new Decision ID and cross-reference the old one.

---

## Decision status values

- `Open`
- `Answered`
- `Approved`
- `Implemented`
- `Superseded`

---

## Decision register

| Decision ID | Question | Decision | Rationale | Owner | Date | Status | Milestone | Implementation impact (files/modules) |
|---|---|---|---|---|---|---|---|---|
| D-001 | What is the authoritative schema ownership boundary between MineOpsDataEngine and MineOpsWeb for shared contracts (export manifest, canonical object, relationships, mappings)? |  |  |  |  | Open | M1-M7 |  |
| D-002 | What is the schema versioning policy: semver with backward compatibility guarantees, or strict breaking changes requiring explicit migration gates? |  |  |  |  | Open | M1-M7 |  |
| D-003 | For canonical IDs (UUID v5), what is the exact namespace UUID we must use in production? |  |  |  |  | Open | M5 |  |
| D-004 | Is the UUID v5 input key contract exactly `<objectType>:<gameId>` and fallback `<objectType>:<sourceAsset>:<unityPathId>` with no additional normalization? |  |  |  |  | Open | M5 |  |
| D-005 | For `gameId` collisions across object types, should they remain distinct records or be merged under one canonical object? |  |  |  |  | Open | M5 |  |
| D-006 | What is the minimum required field set for a canonical game object to be considered valid for staging upload? |  |  |  |  | Open | M5-M7 |  |
| D-007 | What fields are mandatory in `release.json` vs optional but recommended? |  |  |  |  | Open | M2 |  |
| D-008 | Do we require a globally unique `releaseId` across all environments, or only unique per host/project? |  |  |  |  | Open | M2 |  |
| D-009 | Should `versionCode` be treated as integer-only, and how do we handle malformed or missing version metadata from `dumpsys`? |  |  |  |  | Open | M2 |  |
| D-010 | For split APK handling, do we always publish split metadata records even when splits are not used downstream by MineOpsWeb? |  |  |  |  | Open | M2-M7 |  |
| D-011 | What exact confidence threshold should block `ready_for_review` status: `<0.90` globally, or type-specific thresholds? |  |  |  |  | Open | M5-M7 |  |
| D-012 | Which object types are considered “required-to-resolve” versus allowed to remain unresolved indefinitely? |  |  |  |  | Open | M5-M6 |  |
| D-013 | For unresolved records, what is the required lifecycle/status taxonomy (`unresolved`, `needs_review`, `ignored`, etc.)? |  |  |  |  | Open | M5-M7 |  |
| D-014 | When localization keys conflict across files/languages, what is the deterministic precedence rule? |  |  |  |  | Open | M5 |  |
| D-015 | Do we need locale fallback rules beyond English default (e.g., en-US → en), and where should fallback logic live (engine vs web)? |  |  |  |  | Open | M5 |  |
| D-016 | What relationship types are strictly required for MVP completeness before a release can pass validation? |  |  |  |  | Open | M5-M6 |  |
| D-017 | Should relationship records be directionally canonical, and do we enforce inverse relationships explicitly or derive them? |  |  |  |  | Open | M5 |  |
| D-018 | What constitutes a validation failure that should hard-stop publish to staging vs soft warning only? |  |  |  |  | Open | M6-M7 |  |
| D-019 | Should `exit code 14` (unchanged release) create a run record in PocketBase staging, or remain local-only telemetry? |  |  |  |  | Open | M7 |  |
| D-020 | What is the expected retention policy by layer (`raw`, `extracted`, `normalized`, `exports`) in days or count-based windows? |  |  |  |  | Open | M8 |  |
| D-021 | Do we require cryptographic signing of export packages in addition to SHA256 manifest hashing? |  |  |  |  | Open | M7-M8 |  |
| D-022 | For artifact API exposure, should raw APK endpoints be completely disabled or role-gated for internal consumers only? |  |  |  |  | Open | M7 |  |
| D-023 | What is the approved auth model for artifact API: static bearer token, rotating token, mTLS, or Tailscale-only + token? |  |  |  |  | Open | M7-M8 |  |
| D-024 | What is the PocketBase staging contract for idempotent upserts (primary key strategy and conflict behavior) for each staging collection? |  |  |  |  | Open | M7 |  |
| D-025 | Which PocketBase collections are append-only vs mutable-by-reprocess? |  |  |  |  | Open | M7 |  |
| D-026 | What is the authoritative definition of `published` state transition, and which system is allowed to set it (engine vs MineOpsWeb only)? |  |  |  |  | Open | M7 |  |
| D-027 | For reprocessing archived releases, do we preserve original normalized outputs and emit a new processing revision, or replace in place with revision metadata? |  |  |  |  | Open | M6-M7 |  |
| D-028 | Should `current`/`previous` symlink advancement happen before or after PocketBase staging upload success? |  |  |  |  | Open | M7 |  |
| D-029 | Do we need a formal “quarantine” state for releases with extraction success but validation ambiguity? |  |  |  |  | Open | M6-M7 |  |
| D-030 | What SLOs should we target for daily processing (max runtime, acceptable failure rate, max retries)? |  |  |  |  | Open | M8 |  |
| D-031 | What are the minimum auditability requirements (run-level provenance fields, actor identity, config hash, tool versions) for compliance? |  |  |  |  | Open | M6-M8 |  |
| D-032 | Do we need legal/compliance constraints documented for storing APK binaries and extracted assets (retention, access controls, redistribution limits)? |  |  |  |  | Open | M8 |  |
| D-033 | What is the rollback policy if a staged release is later deemed invalid: soft-supersede only, or hard withdrawal from staging collections? |  |  |  |  | Open | M7-M8 |  |
| D-034 | What are the “must-pass” acceptance criteria for Milestone 2 before moving to Milestone 3 (exact test list and evidence format)? |  |  |  |  | Open | M2 |  |
| D-035 | Do you want a formal data contract test suite (consumer-driven contract tests) between MineOpsDataEngine exports and MineOpsWeb ingestion before Milestone 7? |  |  |  |  | Open | M6-M7 |  |

---

## Milestone mapping reference

- **M1** Foundation
- **M2** Acquisition
- **M3** Extraction
- **M4** Unity
- **M5** Normalization
- **M6** Quality
- **M7** Delivery
- **M8** Hardening

---

## Change log

| Date | Author | Change |
|---|---|---|
| 2026-07-16 | Copilot | Initial decision log scaffold created from architect-question set |





REPLY:
# MineOps Data Engine — Architecture Decision Log

**Document version:** 1.1  
**Status:** Architect Approved  
**Architect:** ChatGPT (MineOps Platform)  
**Date:** 2026-07-16

---

# Architecture Decisions

| ID | Decision |
|----|----------|
| D-001 | **MineOpsDataEngine owns every schema related to extraction, normalization, mappings, relationships, exports, manifests and release metadata. MineOpsWeb consumes those schemas and owns only UI, player state and publication workflows.** |
| D-002 | **Schema versions use Semantic Versioning. Minor versions must remain backward compatible. Major versions require explicit migration scripts. Game versions and schema versions are completely independent.** |
| D-003 | **Use a fixed UUIDv5 namespace generated once during project initialization and committed to the repository as a constant (`UUID_NAMESPACE`). It never changes.** |
| D-004 | **UUID contract is fixed:** `<objectType>:<gameId>`.<br>If `gameId` is unavailable use `<objectType>:<sourceAsset>:<unityPathId>`. No additional normalization beyond lowercase objectType and trimmed values. |
| D-005 | **Game ID collisions are never merged. ObjectType is part of identity.** |
| D-006 | **Minimum required canonical fields:**<br>`id`<br>`gameId` (nullable if unavailable)<br>`objectType`<br>`displayName` (or Unknown)<br>`releaseId`<br>`sourceFile`<br>`rawPayload`<br>`status`<br>`confidence` |
| D-007 | **release.json required fields:**<br>releaseId<br>versionName<br>versionCode<br>capturedAt<br>engineVersion<br>schemaVersion<br>apkHashes<br>status<br><br>Optional:<br>notes<br>duration<br>statistics |
| D-008 | **releaseId must be globally unique.** Format:<br>`versionName_versionCode_UTCtimestamp` |
| D-009 | **versionCode is always treated as integer. Missing or malformed metadata immediately fails acquisition.** |
| D-010 | **Every APK split is preserved, hashed, inventoried and exported even if MineOpsWeb never consumes it.** |
| D-011 | **Publish threshold is 0.90 globally. Individual object types may increase the requirement but never lower it.** |
| D-012 | **Required object types:**<br>Managers<br>Mines<br>Mine Shafts<br>Research<br>Equipment<br>Artifacts<br>Collectibles<br>Events<br>Localization<br>Relationships<br><br>Everything else may remain unresolved. |
| D-013 | **Lifecycle:**<br>`new`<br>`resolved`<br>`needs_review`<br>`manual_override`<br>`ignored`<br>`deprecated` |
| D-014 | **Localization precedence:**<br>Manual Override → English Base → English Regional → Game Default → First Found |
| D-015 | **Fallback lives entirely inside MineOpsWeb. Engine stores raw localization only.** |
| D-016 | **Minimum relationships for MVP:**<br>Mine→Continent<br>Shaft→Mine<br>Manager→Effect<br>Equipment→Target<br>Research→Target<br>Localization→Object |
| D-017 | **Relationships are directional only. Inverse relationships are derived at runtime.** |
| D-018 | **Fatal validation failures stop publication. Warnings never stop publication.** |
| D-019 | **Exit Code 14 (No Change) remains local only. No PocketBase write occurs.** |
| D-020 | **Retention Policy:**<br><br>Raw APKs → Forever<br>Release Metadata → Forever<br>Normalized Objects → Forever<br>Mappings → Forever<br>Validation Reports → Forever<br>Diff Reports → Forever<br>Export Packages → Forever<br><br>Work Directory → Delete after successful run<br>Cache → 30 days<br>Temporary Files → Delete immediately<br>Verbose Logs → 90 days<br>Runtime Logs → 1 year |
| D-021 | **SHA256 is sufficient for v1. Digital signing deferred to v2.** |
| D-022 | **Raw APK downloads are disabled externally by default. Internal administrator role only.** |
| D-023 | **Authentication:**<br>Tailscale network + Bearer Token.<br>No public anonymous access. |
| D-024 | **PocketBase uses deterministic UUID as primary key. Upserts overwrite matching UUIDs only. No duplicate canonical objects.** |
| D-025 | **Append-only:**<br>raw_imports<br>catalog_versions<br>extraction_runs<br><br>Mutable:<br>staging collections<br>validation reports<br>mappings |
| D-026 | **Only MineOpsWeb may transition a release to Published. UbuntuMac may never publish directly to production.** |
| D-027 | **Reprocessing creates a new Processing Revision while preserving the original extraction forever.** |
| D-028 | **current/previous symlinks advance only after successful validation and successful PocketBase staging upload.** |
| D-029 | **Quarantine state is required.** Releases may be:<br>Detected<br>Acquired<br>Extracted<br>Normalized<br>Quarantined<br>Validated<br>ReadyForReview<br>Published |
| D-030 | **SLO:**<br>Maximum runtime: 30 minutes<br>Success Rate: 99%<br>Maximum retries: 3<br>Daily schedule |
| D-031 | **Every run records:**<br>Run ID<br>Release ID<br>Schema Version<br>Engine Version<br>Git Commit<br>Host Name<br>User<br>UTC Timestamp<br>Configuration Hash<br>Processing Duration |
| D-032 | **APK binaries remain private. Extracted assets remain private. Public distribution is limited to normalized data produced by MineOpsDataEngine.** |
| D-033 | **Rollback policy:**<br>Never delete.<br>Mark release Superseded.<br>Previous published catalog remains active. |
| D-034 | **Milestone 2 Acceptance:**<br>✓ Emulator starts<br>✓ Package detected<br>✓ All APKs pulled<br>✓ SHA256 generated<br>✓ release.json generated<br>✓ Immutable archive created<br>✓ Recovery tested |
| D-035 | **YES. Contract tests between MineOpsDataEngine exports and MineOpsWeb are mandatory before Delivery milestone.** |

---

# Additional Architect Decisions

## A-001 — Immutable Philosophy

Nothing is ever deleted.

If data changes:

- New release
- New revision
- New mapping
- New validation

Never overwrite history.

---

## A-002 — Layer Separation

The platform always consists of four completely independent layers.

```
Raw

↓

Normalized

↓

PocketBase Staging

↓

PocketBase Published
```

A layer may only consume from the layer directly above it.

---

## A-003 — Never Lose Unknown Data

Unknown IDs.

Unknown files.

Unknown relationships.

Unknown Unity objects.

Unknown JSON.

Unknown localization.

Everything is preserved.

Today's unknown object is tomorrow's feature.

---

## A-004 — Data First

MineOps is no longer an application.

MineOps is a **data platform**.

Everything else consumes the platform.

---

## A-005 — UbuntuMac Responsibilities

UbuntuMac owns:

- Acquisition
- Extraction
- Inventory
- Mapping
- Validation
- Export

UbuntuMac does **NOT** own:

- UI
- Dashboards
- Strategy
- Analytics
- Player Workspace
- Publishing

---

## A-006 — MineOpsWeb Responsibilities

MineOpsWeb owns:

- PocketBase
- User Accounts
- Workspaces
- Player Data
- Review Screens
- Catalog Publishing
- Dashboards
- Analytics
- Planning

---

## A-007 — Processing Rule

Every processing stage must be independently rerunnable.

If normalization fails...

Normalization reruns.

APK acquisition does not.

If mapping fails...

Mapping reruns.

Unity extraction does not.

---

## A-008 — Zero Manual Processing

The goal is eventually:

```
Timer

↓

Wake Emulator

↓

Update Game

↓

Acquire APKs

↓

Extract

↓

Normalize

↓

Validate

↓

Upload Staging

↓

Notify MineOpsWeb

↓

Shutdown Emulator
```

No human interaction.

---

## A-009 — Future AI

AI never becomes the source of truth.

AI consumes the canonical database.

It may explain.

It may recommend.

It may infer.

It may never invent data.

---

## A-010 — Canonical Rule

If two systems disagree:

```
MineOpsDataEngine wins.
```

If two releases disagree:

```
Newest validated release wins.
```

If a human override exists:

```
Human override wins.
```

---

# Final Architecture Statement

MineOpsDataEngine is the canonical source of all Idle Miner game data.

MineOpsWeb is a consumer of that data.

UbuntuMac acquires and validates information.

MineOpsWeb presents and analyzes it.

The architecture intentionally separates acquisition, processing, validation, publication, and presentation to ensure that no game update, parser defect, or extraction failure can corrupt production data or interrupt normal application operation.