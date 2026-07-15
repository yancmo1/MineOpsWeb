# MineOpsWeb — Revised Codex Product Requirements Document

**Document type:** Corrective build PRD and implementation handoff  
**Project name:** MineOpsWeb  
**Status:** Authoritative replacement for prior MineOpsWeb instructions  
**Implementation model:** Complete start-to-finish conversion  
**Existing iOS source:** `/Users/yancyshepherd/Projects/mineops-companion`  
**New web project:** `/Users/yancyshepherd/Projects/MineOpsWeb`  
**Production target:** Oracle Ubuntu server at `mineops.shepswork.com`  
**Local capture target:** Android emulator on `ubuntumac`  
**Required deployment method:** Docker Compose  

---

# 1. Authoritative Directive

Convert the existing **MineOps Companion iOS application** into a responsive, installable web-based Progressive Web App named **MineOpsWeb**.

This is a conversion of a specific existing product. It is **not** an assignment to invent a generic offline-first application that happens to use the MineOps name.

The existing iOS application is the functional, domain, data, terminology, and visual reference. The new application must preserve its useful behavior and data while adapting it appropriately for browsers, desktop screens, iPhone, and iPad.

The current MineOpsWeb implementation has drifted into a generic manager CRUD and synchronization prototype. Correct that course before expanding it.

Do not continue building placeholder product screens on top of the current simplified data model.

The expected final result is a complete deployable application, not merely:

- A React scaffold.
- A Docker proof of concept.
- A working IndexedDB record.
- A generic sync queue.
- A FastAPI demonstration.
- A few placeholder manager records.
- A disabled Strategy tab.
- An architectural prototype.

Completion requires demonstrated parity with the existing iOS application plus the approved PWA, PocketBase, cross-device synchronization, and Ubuntu emulator ingestion capabilities defined below.

---

# 2. Workspace and Repository Context

Codex is running from a VS Code workspace containing both projects.

## 2.1 Existing iOS reference project

```text
/Users/yancyshepherd/Projects/mineops-companion
```

Treat this repository as **read-only reference material**.

Codex may:

- Inspect all source files.
- Inspect Git history.
- Run tests.
- Build the app.
- Launch previews or a simulator.
- Inspect JSON, images, models, services, and documentation.
- Create screenshots outside the repository when useful.

Codex must not:

- Rewrite or reorganize the iOS repository.
- Commit changes to it.
- Delete files from it.
- Archive it.
- Treat an incomplete web implementation as permission to alter the source application.

## 2.2 New web project

```text
/Users/yancyshepherd/Projects/MineOpsWeb
```

All new implementation, migration documentation, PocketBase configuration, Docker files, tests, and deployment instructions belong here.

## 2.3 Git repository

Use the existing MineOpsWeb Git repository:

```text
git@github.com:yancmo1/MineOpsWeb.git
```

Before major corrective changes, preserve the current prototype state:

```bash
cd /Users/yancyshepherd/Projects/MineOpsWeb
git status
git tag prototype-before-parity-reset
git switch -c parity-rebuild
```

Do not run destructive Git commands when uncommitted user work is present.

---

# 3. Product Vision

MineOpsWeb is a personal Idle Miner Tycoon operations companion.

It should help the user understand current game progress, validate imported data, compare managers and resources, identify upgrade opportunities, plan strategies, and access the same information reliably from multiple devices.

The application should answer questions such as:

1. Is my imported player data accurate and current?
2. What changed since the previous synchronization?
3. Which Super Managers are strongest for each area?
4. Which managers are close to an upgrade, rank-up, promotion, or useful breakpoint?
5. What equipment, research, artifacts, collectibles, crystals, currencies, and resources do I own?
6. Where should I spend time or resources for the best return?
7. What lineup or strategy should I use?
8. Can I use the same current data on iPhone, iPad, and desktop?
9. Can I recover from a bad import, parser change, or accidental overwrite?
10. Can the application continue to expand as more fields from the game save are understood?

This application should feel like MineOps—not a database administration screen and not a technology demonstration.

---

# 4. Confirmed Product Decisions

These are binding requirements unless Codex identifies a concrete technical blocker and documents it before deviating.

- Project name: `MineOpsWeb`.
- Existing iOS app remains untouched until the web application has been validated.
- Primary navigation:

```text
Today | Managers | Strategy | More
```

- The web implementation must use the real MineOps manager catalog, assets, terminology, calculations, and synchronized player data.
- Kolibri remains authoritative for the data it currently provides.
- The Ubuntu emulator may provide broader full-save data.
- OCR and screenshot recognition are excluded.
- Automatic sync on app launch is required.
- Manual **Sync Now** is required.
- Sync freshness options may be:

```text
Off | 1 hour | 6 hours | 12 hours | 24 hours
```

- Local application state is stored in IndexedDB.
- PocketBase provides authentication, cloud persistence, cross-device synchronization, snapshots, imports, and server records.
- Docker Compose is required for local and production deployment.
- Production runs under `mineops.shepswork.com`.
- The Android emulator and capture bridge run on `ubuntumac`.
- The emulator bridge makes an authenticated outbound upload to the production backend.
- Unknown fields in captured save payloads must be preserved.
- Game catalog data, player state, and MineOps-created workspace data must remain separate.
- Secrets must never be committed.
- The work is a complete conversion, not a phased proof of concept that stops before parity.

---

# 5. Immediate Course Correction

The existing web implementation must not be treated as an accepted product foundation without review.

The current prototype appears to include concepts such as:

- Generic manager records.
- Placeholder names such as `manager 1` and `manager 2`.
- Free-text manager keys.
- Basic level/rank/fragments CRUD.
- A generic IndexedDB queue.
- FastAPI.
- PostgreSQL.
- A disabled Strategy tab.
- Dashboard copy describing offline architecture rather than MineOps recommendations.

These are evidence of scaffolding, not parity.

## 5.1 Stop conditions

Do not add more placeholder product features until the source audit is complete.

If the iOS repository cannot be read at:

```text
/Users/yancyshepherd/Projects/mineops-companion
```

stop and report the missing source as a blocking dependency.

Do not compensate for inaccessible source by inventing:

- Manager data.
- Screens.
- Calculations.
- Sync behavior.
- Settings.
- Strategy behavior.
- Product terminology.

## 5.2 Reusable prototype work

The following may be retained after review:

- React/Vite setup.
- TypeScript configuration.
- PWA registration.
- Basic responsive CSS infrastructure.
- Dexie dependency and generic IndexedDB utilities.
- Docker concepts that remain applicable.
- Testing infrastructure.
- Useful linting and formatting configuration.

The following should be replaced or substantially rewritten unless justified:

- Placeholder manager CRUD.
- Free-text manager creation.
- Current simplified manager domain model.
- Generic Today dashboard content.
- Disabled Strategy implementation.
- Custom username/password logic.
- FastAPI/PostgreSQL backend introduced contrary to the approved PocketBase direction.
- Catalog-only ingestion that does not represent the actual save-import pipeline.

---

# 6. Required Audit Before Further Product Implementation

Create the following documents in:

```text
/Users/yancyshepherd/Projects/MineOpsWeb/docs
```

These are required implementation artifacts, not optional planning exercises.

## 6.1 `MIGRATION_INVENTORY.md`

Inspect every relevant file in the iOS project.

For each file record:

- Relative path.
- Purpose.
- Major types or functions.
- Dependencies.
- Data read or written.
- User-visible behavior.
- Classification:
  - Reuse asset/data.
  - Port business logic.
  - Recreate UI.
  - Replace with web-native implementation.
  - Retire.
- Proposed MineOpsWeb destination.
- Tests required.
- Open questions.

At minimum inspect:

```text
Sources/MineOpsCompanionFeature/
├── ContentView.swift
├── App/
├── Data/
├── V2/
└── Resources/
```

Also inspect:

- All package manifests.
- Tests.
- JSON files.
- Images.
- Existing documentation.
- Export/import code.
- Sync and credential storage.
- Debug-ID handling.
- Historical or archived implementations that contain still-used logic.

## 6.2 `PARITY_MATRIX.md`

Create a screen and workflow parity table with these columns:

| iOS feature | Source files | Existing behavior | Web destination | Required data | Current web status | Acceptance criteria | Reference captured | Remaining work |
|---|---|---|---|---|---|---|---|---|

Include at minimum:

- Application launch.
- Today/dashboard.
- Managers list.
- Filtering and sorting.
- Manager detail.
- Progress display.
- Upgrade and rank information.
- Recommendation scoring.
- Strategy.
- More/settings.
- Kolibri sync.
- Full debug ID entry.
- Sync success and error states.
- Data freshness.
- Diagnostics.
- Import/export.
- Snapshot or rollback behavior.
- Any manager images and visual status indicators.
- Empty states.
- Loading states.
- Offline states.
- Phone navigation.
- Tablet/desktop layout.

## 6.3 `DATA_MIGRATION_MAP.md`

Document all existing and target structures.

Include:

- Current Swift models.
- Current JSON resources.
- Kolibri response structures.
- Debug ID representation.
- Manager ID/name mappings.
- Manager images.
- Master-data versioning.
- Player progress fields.
- Recommendation inputs and outputs.
- Strategy inputs and outputs.
- Settings.
- Sync metadata.
- Snapshots.
- Import metadata.
- Unknown raw fields.
- IndexedDB mapping.
- PocketBase mapping.
- Migration and schema-version strategy.

Clearly divide data into:

```text
Game catalog
Player state
MineOps workspace
Raw imported payloads
Operational sync metadata
```

## 6.4 `VISUAL_REFERENCE/`

Create a visual reference directory.

Capture every meaningful iOS screen and important state using:

- Existing screenshots.
- SwiftUI previews.
- Simulator.
- Documentation.
- Source inspection where rendering is not possible.

Include phone-sized references at minimum.

Where desktop does not exist in the native app, document the responsive adaptation rather than merely stretching the phone view.

## 6.5 `CALCULATION_INVENTORY.md`

List each calculation, score, derived value, recommendation, or prioritization rule found in the iOS code.

For each calculation include:

- Source file and function.
- Inputs.
- Output.
- Edge cases.
- Existing test coverage.
- Example input/output pairs.
- Proposed shared TypeScript location.
- Characterization test requirement.

Do not rewrite formulas from memory. Port from verified source behavior.

---

# 7. Approved Target Architecture

## 7.1 System overview

```text
┌───────────────────────────────────────────────────────────────┐
│                       MineOpsWeb PWA                          │
│ React + TypeScript + Vite                                    │
│ Responsive UI + service worker + IndexedDB                   │
└───────────────────────┬───────────────────────────────────────┘
                        │ HTTPS
                        ▼
┌───────────────────────────────────────────────────────────────┐
│                     PocketBase Backend                        │
│ Authentication                                                │
│ User/profile records                                          │
│ Normalized current state                                      │
│ Raw imports                                                   │
│ Snapshots and sync history                                    │
│ MineOps planner/workspace data                                │
│ Capture-ingest route                                          │
└───────────────────────┬───────────────────────────────────────┘
                        │ persistent volume
                        ▼
                 PocketBase SQLite data
```

`ubuntumac`:

```text
┌───────────────────────────────────────────────────────────────┐
│ Android emulator + Idle Miner Tycoon                         │
│ ADB capture agent / MineOps capture bridge                   │
│ Detects or receives a new save                                │
│ Preserves raw payload                                         │
│ Authenticates and uploads outbound to PocketBase              │
└───────────────────────────────────────────────────────────────┘
```

## 7.2 Frontend stack

Use stable versions available at implementation time.

Required:

- React.
- TypeScript strict mode.
- Vite.
- React Router.
- TanStack Query.
- Dexie.
- Zod.
- Standards-based service worker/PWA plugin.
- Vitest.
- React Testing Library.
- Playwright.

Use a deliberate design system:

- Tailwind CSS with project tokens, or
- CSS modules with centralized tokens.

Do not create an unstructured collection of inline styles.

## 7.3 Backend stack

Use PocketBase.

Required:

- PocketBase executable/container.
- JavaScript migrations committed under `pb_migrations`.
- Custom hooks/routes under `pb_hooks` only where necessary.
- Official PocketBase JavaScript SDK in the PWA.
- Collection rules restricting user-owned records.
- Separate capture-ingest authentication.
- Persistent data volume.
- Automated backups.
- Health check.
- Version pinning.

Do not retain FastAPI/PostgreSQL as the primary backend.

A custom service may be added only when a documented requirement cannot be safely or reasonably implemented with PocketBase. Obtain approval before introducing it.

## 7.4 Capture bridge stack

Prefer Node.js with TypeScript when the bridge primarily:

- Calls ADB.
- Watches files.
- Hashes captures.
- Validates JSON.
- Uploads HTTPS requests.
- Stores retries.

Python is acceptable if existing capture tools already use Python and reuse materially reduces complexity.

The bridge must be:

- Headless.
- CLI-configurable.
- Logged.
- Testable.
- Idempotent.
- Able to queue failed uploads.
- Safe to run with systemd or Docker.
- Limited to outbound connections.

## 7.5 Repository structure

Use a monorepo or an equivalently clear structure:

```text
MineOpsWeb/
├── apps/
│   ├── web/
│   └── capture-bridge/
├── packages/
│   ├── domain/
│   ├── game-import/
│   ├── calculations/
│   └── ui/
├── pocketbase/
│   ├── pb_migrations/
│   ├── pb_hooks/
│   └── Dockerfile
├── deploy/
│   ├── docker-compose.yml
│   ├── docker-compose.dev.yml
│   ├── reverse-proxy/
│   ├── backup/
│   └── scripts/
├── docs/
├── AGENTS.md
├── README.md
├── package.json
└── lockfile
```

Codex may migrate the current repository gradually rather than performing a reckless wholesale move, but the final boundaries must be clear.

---

# 8. Data Architecture

## 8.1 Game catalog

Game definitions that are not specific to the player:

- Super Manager definitions.
- Stable manager identifiers.
- Names.
- Rarity.
- Department/area.
- Images.
- Active abilities.
- Passive abilities.
- Upgrade tables.
- Rank requirements.
- Equipment definitions.
- Research nodes.
- Artifacts.
- Collectibles.
- Mine/continent definitions.
- Crystal costs.
- Static game constants.
- Known game ID mappings.
- Catalog version and source.

The catalog must be migrated from verified existing data before inventing new records.

## 8.2 Player state

Imported facts describing the user’s account:

- Owned/unlocked managers.
- Manager level.
- Rank.
- Promotion.
- Fragments.
- Equipment ownership and assignments.
- Research progress.
- Artifacts.
- Collectibles.
- Crystals.
- Currencies and resources.
- Mine progression.
- Imported loadouts where available.
- Save timestamp.
- Import source.
- Parser version.
- Schema version.

## 8.3 MineOps workspace

Data created inside MineOps:

- Favorites.
- Notes.
- Saved strategies.
- Upgrade targets.
- Planned lineups.
- What-if scenarios.
- Dismissed recommendations.
- User preferences.
- Dashboard configuration.
- Manual annotations.
- Custom tags.
- Historical comparisons.

## 8.4 Raw imports

Every external import must preserve:

- Original raw payload.
- Content hash.
- Source.
- Source timestamp when known.
- Received timestamp.
- Parser version.
- Validation result.
- Normalization warnings.
- Unknown fields.
- Activation status.
- Associated normalized snapshot.
- Previous active snapshot.

Never discard unknown fields merely because the current parser does not understand them.

## 8.5 Operational metadata

Store separately:

- Device installation ID.
- Last local edit revision.
- Last server revision.
- Last successful sync.
- Pending operation count.
- Import status.
- Capture bridge status.
- Error summaries.
- Conflict state.

---

# 9. PocketBase Collection Design

Codex must refine this design after completing the data audit.

Suggested collections:

```text
users
profiles
devices
catalog_versions
raw_imports
player_snapshots
player_state
workspace_records
saved_strategies
sync_events
capture_clients
```

For a single-user initial deployment, do not over-normalize purely for theoretical scale. However, do not place all data permanently into one unversioned opaque blob.

## 9.1 Ownership rules

Every user-owned collection must enforce ownership through PocketBase rules.

Examples conceptually:

```text
owner = @request.auth.id
```

Capture-client credentials must not provide access to normal user data.

The capture bridge may only:

- Create an import.
- Read its own upload acknowledgement/status when required.
- Not list profiles.
- Not read planner data.
- Not act as a user.

## 9.2 Snapshot strategy

Before applying a new external player-state import:

1. Validate raw structure.
2. Save the raw import.
3. Normalize into a candidate snapshot.
4. Run validation.
5. Compare with current active snapshot.
6. Create a human-readable change summary.
7. Preserve the previous active snapshot.
8. Activate automatically only when policy permits.
9. Otherwise require user review.
10. Keep rollback available.

## 9.3 Sync strategy

MineOps is local-first, but PocketBase is the cross-device authority.

On application launch:

1. Open IndexedDB immediately.
2. Render cached state.
3. Restore PocketBase authentication.
4. Pull server revisions.
5. Push pending MineOps workspace changes.
6. Import newer server state.
7. Resolve conflicts safely.
8. Update sync status.
9. Avoid blocking normal app launch on network availability.

Use record-level sync for MineOps workspace records when practical.

Use versioned snapshots for authoritative external player-state imports.

Do not silently field-merge two competing authoritative player snapshots.

---

# 10. Authentication

The initial application is private and primarily single-user.

Implement a simple PocketBase account flow.

Required:

- Sign in.
- Persistent session.
- Sign out.
- Session-expired handling.
- Protected routes.
- No public registration by default.
- Initial admin/user bootstrap documented.
- Password reset only if configured safely for the deployment.

Do not build a custom FastAPI username/password stack.

Do not store passwords, admin tokens, or ingestion tokens in frontend source.

---

# 11. PWA Requirements

The application must be installable and useful on iOS.

Required:

- Valid web app manifest.
- Application name and short name.
- Icons at required sizes.
- Standalone display mode.
- Theme and background colors.
- Service worker.
- Offline application-shell startup.
- Cached static catalog/assets.
- IndexedDB persistence.
- Update-available notification.
- Graceful offline state.
- Safe retry when connectivity returns.
- iOS installation guidance in More/Help.
- Responsive viewport and safe-area handling.
- Bottom navigation suitable for installed iPhone use.
- No dependence on unsupported background execution.

Sync should primarily occur:

- On launch.
- On resume/focus.
- When the user selects Sync Now.
- At the selected freshness interval while the application is open.

Do not assume iOS will reliably run arbitrary background jobs while the PWA is closed.

---

# 12. Product Navigation and Screen Requirements

## 12.1 Global shell

Primary navigation:

```text
Today | Managers | Strategy | More
```

Phone/PWA:

- Bottom navigation.
- Safe-area padding.
- Thumb-friendly targets.
- Persistent active state.

Tablet/desktop:

- Adapt the same information architecture.
- A sidebar or wider top-level layout is acceptable.
- Do not merely center a narrow phone column in a large empty page.
- Use available width for summaries, comparisons, tables, and detail panes.

Global shell must include a subtle sync/data freshness indicator without turning the app into a sync dashboard.

## 12.2 Today

The Today page must help the user play the game.

It should not lead with copy such as:

> Local-first progress is available offline.

That belongs under diagnostics or help.

Use real player/catalog data to display useful content such as:

- Last successful player-data import.
- Data source.
- Data freshness.
- Current focus.
- Best upgrade opportunity.
- Managers near rank-up or promotion.
- High-value fragment opportunities.
- Resource bottlenecks.
- Recommended manager or lineup action.
- Recent changes since previous import.
- Data validation warnings.
- Quick navigation to relevant manager or strategy.

Exact cards and ranking logic should be derived from the existing iOS behavior first, then extended carefully.

Required states:

- First run.
- No imported player data.
- Syncing.
- Current.
- Stale.
- Offline.
- Import validation warning.
- Import available for review.
- Error with actionable recovery.

## 12.3 Managers

Use the real manager catalog.

Required:

- Manager images.
- Correct names.
- Stable IDs.
- Rarity.
- Department/area.
- Ownership/unlocked state.
- Level.
- Rank.
- Promotion.
- Fragments.
- Upgrade status.
- Existing score or recommendation output.
- Search.
- Filter.
- Sort.
- Useful grouping.
- Manager detail navigation.

Do not require users to type free-text manager keys.

Manual edits, when permitted, should use catalog-backed selectors and validated fields.

Potential filters, subject to iOS parity:

- Owned.
- Unowned.
- Rarity.
- Area.
- Upgrade-ready.
- Rank-ready.
- Promotion-ready.
- Favorite.
- Recommended.
- Missing data.

## 12.4 Manager detail

Required:

- Image and identity.
- Ownership status.
- Current progress.
- Abilities.
- Rank/promotion information.
- Fragments and next threshold.
- Equipment where available.
- Existing recommendation/scoring explanation.
- Related strategy usage.
- Import source and freshness where useful.
- Notes/favorite/planning controls that belong to MineOps workspace.
- Clear distinction between imported facts and MineOps annotations.

## 12.5 Strategy

Strategy must not remain disabled.

Port the existing iOS strategy functionality and provider behavior.

Required:

- Current lineup or strategy recommendations.
- Relevant manager options.
- Constraints based on owned managers.
- Existing score/reasoning output.
- Saved strategy support if present or specified.
- Clear empty state when player data is unavailable.
- No fabricated AI content.

The product direction is calculation/rules-first. AI is optional future enhancement, not a dependency for useful results.

## 12.6 More

Move technical and infrequent functions here.

Suggested sections:

```text
Sync & Data
Kolibri
Imports
Snapshots & Rollback
Capture Status
Data Validation
Export / Import
Settings
Diagnostics
PWA Installation
About
```

Required functions:

- Full debug ID entry and validation.
- Sync Now.
- Last sync details.
- Selected freshness interval.
- Kolibri credential/status management.
- Import history.
- Raw import metadata.
- Snapshot comparison.
- Rollback.
- JSON export.
- JSON import with validation.
- Device information.
- PocketBase connection status.
- Capture bridge status.
- Parser/catalog versions.
- Error log suitable for copying.
- Reset local cache without deleting server data.
- Sign out.

---

# 13. Kolibri Integration

Inspect and port the existing iOS Kolibri implementation.

Do not redesign it from assumptions.

Required:

- Full debug ID input.
- Existing validation behavior.
- Secure local credential storage appropriate for a browser.
- PocketBase or local storage only as required; do not expose credentials unnecessarily.
- Existing request construction.
- Existing response parsing.
- Normalization into the shared player-state model.
- Sync on launch.
- Manual Sync Now.
- Useful error messages.
- Last successful sync.
- Last attempted sync.
- Import/source metadata.
- Snapshot before activation.
- Tests based on sanitized fixtures.

If Kolibri credentials cannot safely be stored server-side, keep them local and document the tradeoff.

Never commit real debug IDs or tokens.

---

# 14. Ubuntu Emulator Capture Bridge

The Android emulator runs locally on `ubuntumac`.

The production server must not need inbound access to the home network.

Use an outbound upload model:

```text
Android emulator
      ↓
ADB/local capture
      ↓
MineOps capture bridge on ubuntumac
      ↓ HTTPS with dedicated token
mineops.shepswork.com
      ↓
PocketBase raw import
```

## 14.1 Bridge responsibilities

- Confirm ADB availability.
- Locate the target package.
- Detect a new candidate save/capture.
- Copy or receive the payload.
- Preserve the original bytes where permitted.
- Compute a hash.
- Avoid duplicate upload.
- Validate basic structure.
- Attach metadata.
- Queue when offline.
- Retry safely.
- Upload using a dedicated capture credential.
- Log success/failure.
- Never modify the game save.
- Never expose PocketBase admin credentials.

## 14.2 Import metadata

Include:

- Capture client ID.
- Emulator/device ID.
- Package name.
- Capture timestamp.
- File timestamp.
- Payload hash.
- Payload size.
- Bridge version.
- Parser version if parsing locally.
- Source type.
- Duplicate status.

## 14.3 Service operation

Provide:

- CLI command.
- `.env.example`.
- Dry-run mode.
- One-shot capture command.
- Watch/poll mode.
- systemd service example.
- Docker option where practical.
- Log location.
- Health/status command.
- Troubleshooting guide.

Do not require a desktop GUI on Ubuntu.

---

# 15. Import Validation and Data Safety

Player-data correctness is a primary product goal.

Every import pipeline must produce a validation report.

Validate where possible:

- Required identifiers.
- Duplicate manager IDs.
- Unknown manager IDs.
- Impossible negative values.
- Rank/level ranges.
- Fragment totals.
- Timestamp sanity.
- Catalog compatibility.
- Abrupt suspicious reductions.
- Missing previously known records.
- Parser warnings.
- Unknown fields.
- Schema compatibility.

Classify findings:

```text
Information
Warning
Blocking error
```

Do not activate imports with blocking errors.

Potentially destructive changes should require review, including:

- Large manager-count reduction.
- Previously owned manager disappearing.
- Major resource values resetting unexpectedly.
- Incompatible schema version.
- Invalid catalog reference.

Provide a comparison view:

```text
Previous value | Imported value | Difference | Severity
```

Rollback must restore the previous active normalized snapshot without deleting the raw import history.

---

# 16. Offline and Cross-Device Behavior

## 16.1 Local-first behavior

The app must:

- Open from IndexedDB.
- Show real cached data immediately.
- Allow MineOps workspace edits offline.
- Queue pending workspace writes.
- Clearly mark data as cached/stale when appropriate.
- Retry after connectivity returns.
- Avoid losing user-entered notes, favorites, or plans.

## 16.2 Conflict handling

When the same MineOps workspace record changes independently on two devices:

- Detect the revision conflict.
- Do not silently overwrite.
- Show enough information to choose.
- Allow keeping local, keeping server, or preserving both where sensible.
- Log the resolution.

External authoritative player snapshots are not collaborative documents. Prefer explicit snapshot selection over field-level merges.

## 16.3 Device synchronization

Track devices with a non-secret installation ID.

Display:

- Device label.
- Last seen.
- Last sync.
- Pending changes.
- Current local revision.

Allow device labels such as:

```text
Yancy’s iPhone
MacBook
Surface
```

---

# 17. Visual and UX Direction

The iOS application is the primary visual reference.

The web app should preserve:

- Information hierarchy.
- Terminology.
- Manager imagery.
- Status meaning.
- Useful colors.
- Navigation logic.
- Card/detail relationships.
- Friendly MineOps identity.

It does not need to be a pixel-for-pixel SwiftUI clone.

It must be adapted intentionally:

- Mobile should feel app-like.
- Desktop should use the screen effectively.
- Large empty areas are not acceptable when useful information exists.
- Technical sync wording should not dominate the Today page.
- Forms should not expose internal IDs when a human-readable selector exists.
- Loading and error states should be polished.
- Accessibility and readability are required.

Create centralized tokens for:

- Typography.
- Spacing.
- Radius.
- Elevation.
- Semantic colors.
- Status colors.
- Breakpoints.
- Safe-area behavior.

---

# 18. Business Logic Porting

Port existing calculations into shared TypeScript packages.

Suggested structure:

```text
packages/calculations/
├── managerScore.ts
├── upgradeReadiness.ts
├── strategyRanking.ts
├── recommendations.ts
└── resourceAnalysis.ts
```

For every ported function:

1. Record source Swift file/function.
2. Create characterization fixtures from the current behavior.
3. Port without changing the formula.
4. Run Swift-side examples where practical.
5. Write TypeScript unit tests.
6. Document intentional differences.
7. Avoid silent “cleanup” that changes results.

Do not replace deterministic calculations with AI.

---

# 19. Testing Requirements

## 19.1 Unit tests

Required coverage for:

- Import validation.
- Normalization.
- Manager ID mapping.
- Existing calculations.
- Recommendations.
- Snapshot comparison.
- Revision/conflict logic.
- Sync queue.
- Schema migrations.
- Unknown field preservation.

## 19.2 Component tests

Test:

- Today cards.
- Manager filtering.
- Manager detail.
- Strategy states.
- Sync status.
- Import warnings.
- Rollback confirmation.
- Offline indicators.
- Settings.
- Debug ID validation.

## 19.3 End-to-end tests

Playwright must cover:

1. Sign in.
2. First launch.
3. Load cached state.
4. Sync current data.
5. Browse real manager catalog.
6. Open manager detail.
7. Use Strategy.
8. Make an offline workspace edit.
9. Reconnect and synchronize.
10. Import a player snapshot.
11. Review validation warnings.
12. Activate import.
13. Roll back.
14. Export backup.
15. Import backup.
16. Installability checks where automatable.
17. Responsive phone and desktop layouts.

## 19.4 Parity tests

For critical iOS calculations and transformations, use shared sanitized fixtures and document:

```text
iOS output == MineOpsWeb output
```

## 19.5 No-placeholder gate

Production builds must fail or tests must fail when known placeholder data is shipped, including:

- `manager 1`
- `manager 2`
- Sample free-text manager keys
- Generic lorem ipsum
- Disabled primary navigation routes
- Test accounts or tokens

---

# 20. Docker and Local Development

Docker Compose remains the preferred deployment method.

## 20.1 Development services

At minimum:

```text
web
pocketbase
```

The capture bridge may run separately on `ubuntumac` because it needs ADB access.

Provide:

```bash
docker compose -f deploy/docker-compose.dev.yml up --build
```

Support normal local frontend development with hot reload.

## 20.2 Production services

At minimum:

```text
web
pocketbase
```

Include:

- Restart policies.
- Health checks.
- Persistent volumes.
- Version pinning.
- Non-root frontend container where practical.
- Environment-based configuration.
- Reverse-proxy labels/configuration consistent with the server guide.
- Log rotation guidance.
- Backup scripts.

## 20.3 Environment files

Commit:

```text
.env.example
```

Do not commit:

```text
.env
PocketBase admin credentials
capture tokens
Kolibri debug IDs
real user credentials
production backup secrets
```

---

# 21. Production Deployment

Production target:

```text
https://mineops.shepswork.com
```

Codex must inspect any existing server guide symlink before making assumptions.

Expected local guide location:

```text
/Users/yancyshepherd/Projects/MineOpsWeb/docs/server-guide
```

Follow established Oracle/server conventions for:

- Application directory.
- Docker network.
- Reverse proxy.
- TLS.
- Firewall.
- Backups.
- Logging.
- Updates.
- GHCR if used.
- Deployment scripts.

Provide `docs/DEPLOYMENT.md` with copy/paste commands.

Include:

- DNS prerequisite.
- Server directory creation.
- Environment setup.
- Initial PocketBase bootstrap.
- Docker startup.
- Reverse proxy.
- TLS verification.
- Health verification.
- Backup verification.
- Upgrade procedure.
- Rollback procedure.

---

# 22. Backup and Recovery

At minimum:

- Nightly PocketBase backup.
- Weekly off-server copy.
- Backup before PocketBase upgrades.
- Backup before schema migration.
- Snapshot before player import activation.
- User-triggered JSON export.
- Tested restore procedure.

Do not rely solely on copying a live SQLite file without using a safe PocketBase-supported backup method.

Document:

- Backup location.
- Retention.
- Encryption where applicable.
- Restore command.
- Verification command.
- Disaster recovery steps.

---

# 23. Documentation Deliverables

Required:

```text
README.md
AGENTS.md
docs/PRD.md
docs/ARCHITECTURE.md
docs/MIGRATION_INVENTORY.md
docs/PARITY_MATRIX.md
docs/DATA_MIGRATION_MAP.md
docs/CALCULATION_INVENTORY.md
docs/DEPLOYMENT.md
docs/UBUNTUMAC_CAPTURE_SETUP.md
docs/SECURITY.md
docs/TEST_PLAN.md
docs/OPERATIONS.md
docs/USER_GUIDE.md
docs/VISUAL_REFERENCE/
```

`README.md` must include:

- Product overview.
- Workspace paths.
- Prerequisites.
- Local startup.
- Tests.
- Production build.
- Documentation links.
- Current implementation status.
- No misleading claim of parity until parity is demonstrated.

`AGENTS.md` must explicitly tell future coding agents:

- The iOS project is the behavioral reference.
- Its absolute path.
- It is read-only.
- Placeholder product data is prohibited.
- PocketBase is the approved backend.
- Parity matrix must be maintained.
- Tests must accompany logic ports.
- Do not declare completion based only on infrastructure.

---

# 24. Implementation Sequence

This is one continuous implementation effort. The sequence controls correctness; it is not permission to stop after an early milestone.

## Step 1 — Preserve and audit

- Tag current prototype.
- Confirm both workspace paths.
- Run current tests.
- Inventory current MineOpsWeb code.
- Complete all migration/parity/data/calculation documents.
- Capture visual references.

## Step 2 — Correct architecture

- Add PocketBase.
- Define migrations and rules.
- Remove or isolate FastAPI/PostgreSQL.
- Establish shared domain packages.
- Define IndexedDB schema.
- Implement auth and local boot.

## Step 3 — Migrate real catalog and assets

- Port manager catalog.
- Port images.
- Port mappings.
- Add schema validation.
- Add versioning.
- Remove placeholder records.

## Step 4 — Port Kolibri/player import

- Port debug ID workflow.
- Port requests.
- Port decoders.
- Normalize player state.
- Preserve raw fixtures.
- Add validation and snapshots.

## Step 5 — Recreate application shell

- Mobile app shell.
- Responsive desktop shell.
- Today/Managers/Strategy/More routes.
- Loading/error/offline states.
- PWA behavior.

## Step 6 — Recreate Today

- Port existing dashboard behavior.
- Add real actionable summaries.
- Add data freshness and recent changes.
- Remove architecture-demo content.

## Step 7 — Recreate Managers

- Real catalog.
- Player progress.
- Images.
- Filtering.
- Sorting.
- Manager detail.
- Upgrade readiness.
- Recommendations.

## Step 8 — Port calculations and Strategy

- Characterization tests.
- Shared TypeScript implementations.
- Strategy screen.
- Saved plans where required.
- Explainable deterministic results.

## Step 9 — Recreate More and diagnostics

- Sync settings.
- Kolibri.
- Full debug ID.
- Import history.
- Validation.
- Snapshots.
- Rollback.
- Export/import.
- Capture status.
- Diagnostics.
- PWA install help.

## Step 10 — Capture bridge

- ADB integration.
- Raw capture.
- Duplicate detection.
- Authenticated upload.
- Retry queue.
- systemd/Docker setup.
- Operational documentation.

## Step 11 — Deployment and recovery

- Production Compose.
- Reverse proxy.
- HTTPS.
- Backups.
- Health checks.
- Restore test.
- Upgrade/rollback scripts.

## Step 12 — Final parity validation

- Complete parity matrix.
- Side-by-side screenshots.
- Run all tests.
- Remove placeholders.
- Verify iPhone PWA.
- Verify desktop behavior.
- Verify offline launch.
- Verify cross-device sync.
- Verify emulator upload.
- Verify rollback and restore.

---

# 25. Acceptance Criteria

MineOpsWeb is complete only when all applicable criteria pass.

## 25.1 Source parity

- The existing iOS source has been audited.
- Every meaningful screen/workflow appears in the parity matrix.
- Real manager catalog and assets are present.
- Existing calculations are ported and tested.
- Kolibri behavior is ported.
- Strategy is implemented.
- More/settings/diagnostics are implemented.
- Intentional differences are documented.

## 25.2 Product quality

- Today presents real MineOps guidance.
- Manager records are real and catalog-backed.
- No user-facing free-text manager IDs.
- No placeholder manager names.
- No disabled primary tab.
- Desktop layout uses available space.
- Mobile layout feels installable and app-like.
- Error states are actionable.

## 25.3 Data correctness

- Raw imports are preserved.
- Normalized imports are validated.
- Unknown fields are retained.
- Import changes can be reviewed.
- Bad imports do not replace good state.
- Rollback works.
- Export/import works.
- Catalog and player data remain separate.

## 25.4 Synchronization

- App opens from local data.
- Launch sync works.
- Manual sync works.
- Offline workspace edits survive.
- Reconnection sync works.
- Conflicts are not silently overwritten.
- Two devices converge correctly.
- Sync history is available.

## 25.5 PWA

- Installable on iOS.
- Standalone mode works.
- Offline application shell loads.
- Cached user data displays.
- Update handling works.
- Safe-area navigation works.
- Icons and manifest validate.

## 25.6 Backend and security

- PocketBase is used as approved.
- Collection rules are tested.
- Public registration is disabled by default.
- Capture token is scoped.
- Secrets are absent from Git.
- Admin endpoints are not exposed unnecessarily.
- HTTPS is enforced.

## 25.7 Emulator bridge

- Works from `ubuntumac`.
- Uses outbound HTTPS.
- Detects duplicates.
- Queues failed uploads.
- Preserves raw data.
- Reports useful status.
- Does not modify the game save.

## 25.8 Operations

- Docker Compose starts production.
- Health checks pass.
- Backup job runs.
- Restore has been tested.
- Upgrade and rollback are documented.
- Deployment instructions are reproducible.

---

# 26. Completion Evidence

At final handoff, provide:

- Final `PARITY_MATRIX.md`.
- Final migration inventory.
- Side-by-side iOS and web screenshots.
- Test summary.
- Calculation parity evidence.
- Real catalog record counts.
- Import validation example.
- Sync demonstration on two clients.
- Offline demonstration.
- PWA installation evidence.
- PocketBase collection/rule summary.
- Capture bridge demonstration.
- Docker deployment verification.
- Backup and restore verification.
- List of intentional differences.
- List of remaining non-blocking enhancements.

Do not use phrases such as “foundation complete” or “PWA scaffold complete” as substitutes for product completion.

---

# 27. Explicit Prohibitions

Do not:

- Build from assumptions without inspecting the iOS source.
- Treat the current prototype as feature parity.
- Ship `manager 1` or `manager 2`.
- Ask users to type internal manager IDs.
- Leave Strategy disabled.
- Replace real product content with sync-architecture explanations.
- Use FastAPI/PostgreSQL as the main backend without approval.
- Create a custom authentication service when PocketBase already provides it.
- Discard unknown save fields.
- Silently overwrite conflicting data.
- Commit secrets.
- Modify the iOS repository.
- Declare completion because Docker starts.
- Declare completion because one record syncs.
- Stop after documentation or scaffolding.
- Add AI as a dependency for core recommendations.
- Reintroduce OCR.

---

# 28. First Codex Response Expected

After reading this document, Codex should not immediately begin inventing new screens.

Its first response should briefly report:

1. Confirmation that both workspace paths are accessible.
2. Current branch and working-tree status in MineOpsWeb.
3. Whether the iOS app builds/tests.
4. Which iOS source areas were found.
5. Which current MineOpsWeb portions appear reusable.
6. Which current portions conflict with this PRD.
7. The immediate audit files it will create.
8. Any true blocker.

Then Codex should proceed with the audit and complete implementation without waiting for repeated restatement of the assignment.
