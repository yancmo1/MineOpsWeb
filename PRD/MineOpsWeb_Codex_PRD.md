# MineOpsWeb — Codex Product Requirements Document

**Document type:** Build PRD and implementation handoff  
**Project name:** MineOpsWeb  
**Target repository:** New standalone Git repository  
**Primary delivery:** Responsive web application with installable PWA support  
**Deployment target:** Oracle-hosted Ubuntu server under the `shepswork.com` domain mineops.shepswork.com
**Local integration target:** Android emulator running on `ubuntumac`  
**Implementation style:** Complete start-to-finish conversion, not a prolonged phased migration

---

## 1. Executive Summary

Convert the existing MineOps iOS application into a new web-based Progressive Web App named **MineOpsWeb**.
- Local Folder for new project: `MineOpsWeb/`

The new application must preserve the useful workflows and data already present in the existing MineOps application while replacing the native iOS-only architecture with:

- A responsive browser-based interface.
- Installable PWA support for iPhone, iPad, Android, macOS, Windows, and Linux.
- Offline-capable local storage for normal application use.
- Server-backed synchronization between devices.
- A documented API for receiving Idle Miner Tycoon catalog data and future player-data imports.
- A local ingestion service that can receive data collected from an Android emulator running on `ubuntumac`.
- Docker-based development and production deployment.
- A new repository and working folder named `MineOpsWeb`.
- Deployment under a selected `shepswork.com` subdomain.

This is a replacement application, not a thin wrapper around the iOS app. The existing iOS project should be treated as a functional reference and source of business rules. Once MineOpsWeb is stable and validated, the iOS repository can be archived.

---

## 2. Project Goals

### 2.1 Primary Goals

1. Rebuild MineOps as a modern responsive web application.
2. Make the application installable as a PWA.
3. Preserve and validate existing MineOps data and calculations.
4. Support seamless device-to-device synchronization.
5. Support offline use and delayed synchronization.
6. Provide a stable API for catalog ingestion from the local Ubuntu emulator workflow.
7. Make production deployment reproducible with Docker Compose.
8. Create a maintainable foundation for additional MineOps features.
9. Keep the initial deployment simple enough for a single-user private application while avoiding architecture that blocks future multi-user support.

### 2.2 Secondary Goals

- Provide clear import/export tools.
- Track source, version, and timestamp for imported game data.
- Make catalog updates auditable and reversible.
- Support comparison between current app data and newly captured game data.
- Allow future expansion into a richer Idle Miner companion platform.
- Make the UI usable on a phone without feeling like a desktop page compressed onto a small screen.
- Support future background or scheduled ingestion without requiring a redesign.

---

## 3. Non-Goals

The initial complete build does not need to include:

- Public registration.
- Social features.
- A commercial multi-tenant SaaS billing system.
- App Store or Play Store publication.
- Native Swift or Kotlin wrappers.
- Real-time multiplayer functionality.
- Automated modification of the Idle Miner Tycoon application.
- Credential scraping from the emulator.
- OCR-based game data collection unless specifically reintroduced later.
- A complex Kubernetes deployment.
- A microservice architecture.
- Continuous polling of the emulator when no new data is available.

---

## 4. Core Architectural Decision

Use a conventional three-part architecture:

1. **MineOpsWeb frontend**
   - React
   - TypeScript
   - Vite
   - Responsive mobile-first UI
   - PWA service worker and web app manifest
   - IndexedDB for offline application data
   - TanStack Query or equivalent for server-state management

2. **MineOps API**
   - FastAPI with Python 3.12+
   - REST/JSON API
   - OpenAPI documentation
   - PostgreSQL database
   - SQLAlchemy 2.x and Alembic migrations
   - Background job support only where required

3. **Emulator ingestion bridge**
   - Lightweight Python service or command-line agent running on `ubuntumac`
   - Receives or reads captured game files
   - Validates and normalizes payloads
   - Sends catalog snapshots to the MineOps API
   - Uses a dedicated ingestion API token
   - Stores failed uploads locally for retry

### 4.1 Why This Architecture

This approach avoids coupling the long-term application to PocketBase or another application-specific backend product that may later be retired. It uses standard components, keeps Docker deployment straightforward, and provides a clean separation between:

- User-facing application data.
- Server synchronization.
- Game-data ingestion.
- Local emulator automation.

PocketBase may be used as a reference for prior sync behavior, but it should not be a required dependency for MineOpsWeb.

---

## 5. Repository and Working Folder

Use existing working foler `MineOpsWeb/` for the new repository.:

```text
MineOpsWeb/
```

New Git repository inside that directory located at: git@github.com:yancmo1/MineOpsWeb.git

Recommended structure:

```text
MineOpsWeb/
├── AGENTS.md
├── README.md
├── PRD.md
├── .env.example
├── .gitignore
├── docker-compose.yml
├── docker-compose.dev.yml
├── Makefile
├── docs/
│   ├── architecture/
│   ├── api/
│   ├── deployment/
│   ├── development/
│   ├── emulator-ingestion/
│   ├── migration/
│   └── validation/
├── frontend/
│   ├── src/
│   ├── public/
│   ├── tests/
│   ├── Dockerfile
│   └── package.json
├── backend/
│   ├── app/
│   ├── migrations/
│   ├── tests/
│   ├── Dockerfile
│   └── pyproject.toml
├── ingestion-agent/
│   ├── mineops_ingest/
│   ├── scripts/
│   ├── tests/
│   ├── Dockerfile
│   └── pyproject.toml
├── infrastructure/
│   ├── nginx/
│   ├── scripts/
│   ├── backup/
│   └── systemd/
├── shared/
│   ├── schemas/
│   └── fixtures/
└── tools/
    ├── migration/
    ├── validation/
    └── seed/
```

### 5.1 Server Guide Symlink

The user has symlinked an existing server guide into docs/server-guide. The guide contains server-specific conventions, reverse proxy setup, directory locations, backups, secrets, and deployment procedures.

Also inclded in the docs folder are Oracle-specific deployment instructions that you can refer to for oracle deployment. 

Codex must:

1. Check for a server-guide symlink before making deployment-specific assumptions.
2. Read and follow the server guide when present.
3. Never overwrite the external guide.
4. Avoid committing the external target.
5. Add the expected symlink path to documentation and `.gitignore` if needed.

Recommended path:

```text
docs/server-guide
```

Below is the current symlink command for the local development environment. Adjust as needed for the actual server guide location.

```bash
# Symlink Server_Master_Guide From any app repo on the server
ln -sf /Users/yancyshepherd/Projects/ubuntumac-server/SERVER_MASTER_GUIDE.md

```

If `docs/server-guide` is present, treat it as the authoritative source for server-specific conventions, reverse proxy setup, directory locations, backups, secrets, and deployment procedures.

---

## 6. Functional Requirements

## 6.1 Existing MineOps Feature Preservation

Codex must inspect the existing MineOps iOS project and create a feature inventory before implementing the replacement.

For each existing feature, document:

- Screen or workflow name.
- Purpose.
- Data dependencies.
- Business rules.
- Calculations.
- Import/export behavior.
- Current limitations.
- Whether it is preserved, redesigned, merged, or intentionally removed.

The web application must preserve all confirmed useful workflows unless the PRD or repository documentation explicitly states otherwise.

The iOS application should be treated as the current behavioral specification where formal documentation does not exist.

---

## 6.2 Responsive Application Shell

The application must provide:

- Mobile-first navigation.
- Desktop navigation that takes advantage of larger screens.
- Installable PWA behavior.
- Safe-area support for iPhone screens.
- Touch-friendly controls.
- Keyboard accessibility.
- Loading, empty, offline, sync, warning, and error states.
- A clear indication of local changes that have not synchronized.
- A global “last synchronized” status.
- A settings or “More” area for sync, imports, exports, diagnostics, and application information.

Recommended navigation:

- Dashboard
- Mines
- Managers
- Collectibles
- Research
- Planning
- Tools
- More

The final navigation should be based on the current MineOps feature inventory rather than blindly copying this list.

---

## 6.3 PWA Requirements

The PWA must include:

- Valid web app manifest.
- Application icons for required sizes.
- Standalone display mode.
- Theme and background colors.
- Service worker.
- Offline application shell.
- Offline access to previously synchronized user data.
- Version detection and update prompt.
- Recovery path if a service-worker update fails.
- Install guidance where browser support allows it.
- iOS home-screen metadata and safe-area handling.

The application must not silently discard unsynchronized changes during an update.

---

## 6.4 Offline-First Data Behavior

The frontend must use IndexedDB rather than localStorage for primary application data.

Required behavior:

1. Load the application from local data immediately.
2. Attempt server synchronization after startup.
3. Queue user changes while offline.
4. Synchronize queued changes when connectivity returns.
5. Show pending-change count.
6. Avoid duplicate records during retries.
7. Detect conflicts.
8. Provide understandable conflict resolution.
9. Preserve a local export path if the server is unavailable.
10. Never overwrite newer user data merely because a stale device reconnects.

Use stable UUIDs generated by the client for user-created records.

---

## 6.5 Synchronization Model

Use a server-authoritative revision model with client-side offline queues.

Each synchronizable record should include, where applicable:

```text
id
created_at
updated_at
deleted_at
revision
device_id
last_modified_by
```

Each mutation request must include:

- Record ID.
- Client-known revision.
- Idempotency key.
- Client timestamp.
- Device ID.

The API must:

- Reject stale conflicting writes with HTTP 409.
- Return the current server record for conflict handling.
- Accept retried operations without creating duplicates.
- Support soft deletion where appropriate.
- Expose incremental synchronization using a cursor or timestamp.
- Keep catalog/reference data separate from user-owned data.

### 6.5.1 Conflict Policy

Default behavior:

- Non-overlapping field changes may be merged automatically.
- Same-field conflicts must be surfaced to the user.
- Catalog data is server-authoritative.
- User preferences use last-write-wins only for low-risk settings.
- Planning and progression data must not use silent last-write-wins.

---

## 6.6 Authentication and Access

Initial production use is expected to be private and primarily single-user.

Implement authentication in a way that is simple now but can expand later.

Required:

- No public registration.
- Bootstrap admin account created through a secure command or environment-assisted setup.
- Password hashing using Argon2id or an equivalent current standard.
- Secure session cookies.
- CSRF protection where applicable.
- Login rate limiting.
- Session expiration.
- Logout from all devices.
- Optional trusted-device naming.
- API token support for the ingestion agent.
- Separate token scope for catalog ingestion.
- Token rotation and revocation.

Do not store production secrets in the repository.

---

## 6.7 User Data Import and Export

Provide an import/export center.

Supported exports:

- Full MineOps backup.
- User progression data.
- Planning data.
- Settings.
- Diagnostics metadata.
- Catalog snapshot metadata.
- Optional CSV export for appropriate tables.

Preferred full-backup format:

```json
{
  "format": "mineops-backup",
  "version": 1,
  "exportedAt": "...",
  "appVersion": "...",
  "data": {}
}
```

Import requirements:

- Validate schema before writing.
- Preview import summary.
- Report additions, updates, conflicts, and skipped records.
- Support dry-run validation.
- Create a pre-import backup.
- Allow restoration after a failed import.
- Never silently ignore malformed records.

---

## 6.8 Existing iOS Data Migration

Create a migration tool for current MineOps data.

Codex must inspect the existing export format and determine:

- Data entities.
- Field names.
- IDs.
- Relationships.
- Null/default behavior.
- Date formats.
- Enum values.
- Calculation dependencies.
- Any data embedded directly in code.

The migration flow must:

1. Accept the latest iOS export.
2. Validate it.
3. Convert it to the MineOpsWeb schema.
4. Produce a detailed migration report.
5. Import through the same backend service layer used by normal application operations.
6. Be repeatable in dry-run mode.
7. Avoid duplicate imports.
8. Preserve the original source file unchanged.

---

## 6.9 Game Catalog Data

The application must support versioned Idle Miner Tycoon catalog/reference data.

Examples include:

- Continents.
- Mines.
- Mine types.
- Managers.
- Super Managers.
- Manager attributes.
- Manager levels and ranks.
- Upgrade requirements.
- Equipment.
- Collectibles.
- Research nodes.
- Artifacts.
- Crystals.
- Currency and resource definitions.
- Event or special-mine metadata.
- Any other static or semi-static data recovered from the game package or emulator.

Every catalog import must create a catalog snapshot with:

```text
snapshot_id
source_type
source_version
source_hash
game_version
captured_at
received_at
import_status
schema_version
record_counts
validation_summary
notes
```

Catalog imports must be immutable after activation. Corrections should create a new snapshot.

The system must support:

- Current active catalog.
- Previous catalog history.
- Diff between snapshots.
- Validation warnings.
- Rollback to a previous active snapshot.
- Source-file retention policy.
- Data provenance by field or entity when practical.

---

## 6.10 Catalog Validation

A major purpose of MineOpsWeb is to determine whether existing MineOps data is correct.

Create a validation subsystem that compares:

- Existing application seed data.
- Current production catalog.
- Newly captured game catalog.
- User-imported reference files where applicable.

Validation output must identify:

- Added entities.
- Removed entities.
- Changed values.
- Duplicate identifiers.
- Missing relationships.
- Invalid enum values.
- Unexpected null values.
- Range violations.
- Calculation mismatches.
- Orphaned records.
- Schema changes.
- Records requiring manual review.

The UI must provide:

- Validation summary.
- Filterable issue list.
- Before/after comparison.
- Severity.
- Source.
- Resolution status.
- Notes.
- Exportable validation report.

---

## 6.11 Emulator Ingestion Workflow

The Android emulator will run locally on `ubuntumac`.

The ingestion system must not assume that the emulator can directly reach a private Docker network on the Oracle server.

Preferred flow:

```text
Android emulator
    ↓
Local capture/extraction process on ubuntumac
    ↓
MineOps ingestion agent
    ↓ HTTPS
MineOps API on Oracle server
    ↓
Staging and validation
    ↓
Catalog review and activation
```

### 6.11.1 Ingestion Agent Responsibilities

The local agent must:

- Watch one or more configured folders.
- Optionally accept a direct file path from a command.
- Detect supported capture packages.
- Calculate a source hash.
- Avoid re-uploading identical captures.
- Validate basic structure locally.
- Compress large payloads.
- Upload over HTTPS.
- Authenticate with an ingestion-only API token.
- Retry transient failures.
- Store a local outbox.
- Keep logs.
- Support a `--dry-run` mode.
- Support a `--status` command.
- Support manual upload.
- Never delete source files automatically.
- Redact configured sensitive fields before upload.
- Report the returned snapshot/import ID.

Recommended commands:

```bash
mineops-ingest upload /path/to/capture
mineops-ingest watch
mineops-ingest validate /path/to/capture
mineops-ingest status
mineops-ingest retry
```

### 6.11.2 API Endpoints for Ingestion

Minimum endpoints:

```text
POST /api/v1/ingestion/uploads
GET  /api/v1/ingestion/uploads/{upload_id}
POST /api/v1/ingestion/uploads/{upload_id}/process
GET  /api/v1/catalog/snapshots
GET  /api/v1/catalog/snapshots/{snapshot_id}
GET  /api/v1/catalog/snapshots/{snapshot_id}/diff
POST /api/v1/catalog/snapshots/{snapshot_id}/activate
POST /api/v1/catalog/snapshots/{snapshot_id}/reject
```

Large uploads should use streaming or multipart upload.

---

## 6.12 API Requirements

The backend must expose versioned REST endpoints under:

```text
/api/v1/
```

Required API categories:

- Authentication.
- Current user.
- Device registration.
- Synchronization.
- User progression.
- Planning.
- Settings.
- Imports.
- Exports.
- Catalog.
- Validation.
- Ingestion.
- Diagnostics.
- Health and readiness.

Minimum operational endpoints:

```text
GET /health
GET /ready
GET /api/v1/version
```

OpenAPI documentation should be enabled in development and restricted or disabled in production unless authenticated.

---

## 6.13 Dashboard

The dashboard should become the operational starting point.

It should summarize:

- Current active catalog version.
- Catalog validation status.
- Last player-data import.
- Last device sync.
- Pending offline changes.
- Current progression summary.
- Immediate recommended actions.
- Planning shortcuts.
- Data warnings.
- Available application update.

The dashboard must avoid becoming a wall of cards. Prioritize the information needed to decide what to do next.

---

## 6.14 Diagnostics

Provide a diagnostics panel with:

- Application version.
- Frontend build hash.
- API version.
- Database migration version.
- PWA/service-worker version.
- Device ID.
- Last successful sync.
- Pending operation count.
- Last catalog snapshot.
- Network status.
- Storage usage estimate.
- Recent non-sensitive errors.
- Copyable diagnostics bundle.

Do not expose passwords, tokens, raw cookies, or sensitive server paths.

---

## 7. Data Model

The exact schema must be derived from the existing MineOps application and captured catalog files, but the backend should distinguish these domains.

### 7.1 Identity and Sync

```text
users
sessions
devices
api_tokens
sync_cursors
mutation_log
audit_log
```

### 7.2 User-Owned Data

```text
player_profiles
player_mines
player_managers
player_collectibles
player_research
player_artifacts
player_equipment
player_resources
player_goals
plans
plan_items
user_settings
saved_views
notes
```

### 7.3 Catalog Data

```text
catalog_snapshots
catalog_sources
catalog_entities
catalog_relationships
catalog_validation_runs
catalog_validation_issues
catalog_activation_history
```

For performance and integrity, strongly typed tables should be used for stable known entities. A generic raw entity table may be retained for source preservation and unknown future fields.

### 7.4 Import and Export

```text
imports
import_files
import_results
exports
ingestion_uploads
ingestion_attempts
```

---

## 8. UI and UX Requirements

### 8.1 Design Direction

The UI should be:

- Clean.
- Data-rich without being cramped.
- Friendly but not childish.
- Fast on mobile.
- Easy to scan.
- Consistent across sections.
- Comfortable for repeated daily use.

### 8.2 Mobile Behavior

- Primary actions reachable with one hand where practical.
- Bottom navigation or another appropriate mobile navigation pattern.
- No horizontal scrolling for core workflows.
- Tables convert to cards or responsive rows.
- Sticky action bars only where they materially improve usability.
- Dialogs must fit small screens.
- Form inputs must not trigger accidental iOS zoom.
- Support portrait orientation as the primary mode.

### 8.3 Desktop Behavior

- Persistent navigation is acceptable.
- Use additional width for comparison views, planning panels, and catalog diffs.
- Do not merely stretch mobile cards across the screen.
- Support keyboard shortcuts for common power-user actions where helpful.

### 8.4 Accessibility

Target WCAG 2.2 AA for:

- Color contrast.
- Keyboard navigation.
- Focus visibility.
- Semantic markup.
- Form labeling.
- Error identification.
- Screen-reader announcements for sync and offline state.
- Reduced motion preferences.

---

## 9. Docker and Local Development

Use Docker Compose for the complete local stack.

Recommended services:

```text
frontend
backend
postgres
redis        # only if needed for background jobs or rate limiting
worker       # only if jobs are introduced
nginx        # production profile
```

Development should support:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Provide a Makefile or task runner with:

```bash
make dev
make test
make lint
make format
make migrate
make seed
make backup
make restore
make build
make up
make down
make logs
```

Avoid unnecessary development complexity. The frontend and backend may run outside Docker for faster hot reload, but the Docker path must remain fully supported.

---

## 10. Production Deployment

Target:

- Oracle-hosted Ubuntu server.
- Docker Engine.
- Docker Compose plugin.
- Reverse proxy.
- HTTPS.
- `shepswork.com` subdomain.
- Persistent PostgreSQL volume.
- Persistent upload/storage volume.
- Automated or scripted backups.

The exact subdomain should remain configurable. Suggested examples:

```text
mineops.shepswork.com
mineopsweb.shepswork.com
```

Preferred public path:

```text
https://mineops.shepswork.com
```

### 10.1 Production Containers

Recommended production services:

```text
mineops-frontend
mineops-api
mineops-postgres
mineops-worker       # only if required
mineops-nginx        # omit if server-wide reverse proxy already exists
```

### 10.2 Deployment Requirements

Provide:

- Production `docker-compose.yml`.
- Versioned image tags.
- Health checks.
- Restart policies.
- Deployment script.
- Database migration step.
- Pre-deployment backup.
- Post-deployment health verification.
- Rollback procedure.
- Log viewing commands.
- Secret setup instructions.
- Initial admin bootstrap instructions.

Do not depend exclusively on the `latest` image tag.

Example image naming:

```text
ghcr.io/<owner>/mineopsweb-frontend:<version>
ghcr.io/<owner>/mineopsweb-api:<version>
```

### 10.3 Reverse Proxy

Respect the server guide when present.

The application must correctly handle:

- HTTPS termination.
- Forwarded headers.
- WebSocket upgrade only if later needed.
- Upload size limits.
- API routing.
- PWA cache headers.
- Immutable asset caching.
- No-cache behavior for `index.html`.
- Security headers.

---

## 11. Security Requirements

Required baseline controls:

- HTTPS only in production.
- Secure and HTTP-only cookies.
- SameSite cookie policy.
- Password hashing.
- Rate limiting.
- Request size limits.
- File-type and archive validation.
- Zip-bomb protection.
- Path traversal protection.
- SQL injection protection through parameterized ORM access.
- Content Security Policy.
- CORS restricted to known origins.
- Secrets from environment or mounted secret files.
- Audit log for authentication, imports, catalog activation, and destructive actions.
- API tokens stored hashed at rest.
- Database not publicly exposed.
- PostgreSQL bound only to the internal Docker network.
- Automated dependency and image vulnerability scanning in CI.
- Backup encryption or secure filesystem protection where supported.

The ingestion API must not have permission to modify user-owned progression data.

---

## 12. Backups and Recovery

Provide scripts and documentation for:

- PostgreSQL backup.
- Upload/source-file backup.
- Configuration backup.
- Restore to a clean environment.
- Verification of backup integrity.
- Retention policy.
- Pre-upgrade backup.
- Pre-import backup.

Recommended database retention:

- Daily backups for 14 days.
- Weekly backups for 8 weeks.
- Monthly backups for 12 months.

Adjust to the server guide if it defines another standard.

A restore test must be documented and performed before the iOS app is archived.

---

## 13. Testing Requirements

### 13.1 Backend

- Unit tests for business rules.
- API tests.
- Migration tests.
- Import validation tests.
- Sync conflict tests.
- Idempotency tests.
- Authentication tests.
- Catalog snapshot tests.
- Catalog diff tests.
- Ingestion security tests.

### 13.2 Frontend

- Unit tests for calculations and state logic.
- Component tests for critical forms.
- Offline queue tests.
- Sync status tests.
- Import preview tests.
- Conflict-resolution tests.
- PWA update tests.
- Responsive viewport tests.

### 13.3 End-to-End

Use Playwright or equivalent.

Required flows:

1. Login.
2. Initial synchronization.
3. Use app offline.
4. Create or edit data offline.
5. Reconnect and synchronize.
6. Resolve a conflict.
7. Export a backup.
8. Validate an import.
9. Import iOS data.
10. Upload a catalog capture.
11. Review validation results.
12. Activate a catalog snapshot.
13. Install or launch the PWA.
14. Upgrade the PWA without losing queued changes.

### 13.4 Cross-Browser Targets

At minimum:

- Safari on current iOS.
- Safari on macOS.
- Chrome on Android.
- Chrome or Chromium on desktop.
- Edge on Windows.

---

## 14. Continuous Integration

Create GitHub Actions workflows for:

- Frontend lint.
- Frontend type check.
- Frontend tests.
- Backend lint.
- Backend type check.
- Backend tests.
- Migration validation.
- Docker image builds.
- Dependency vulnerability scan.
- Container vulnerability scan.
- Optional GHCR publishing on tagged releases.

Production deployment may remain manually triggered if preferred.

The repository must be usable without GitHub Actions. CI should validate and package the project, not hide essential deployment logic.

---

## 15. Implementation Order

This is one complete implementation effort rather than a sequence of partial production releases.

Codex should work in the following order while keeping the repository runnable:

1. Inspect the existing iOS project and current data/export formats.
2. Produce the feature and data inventory.
3. Establish the new repository structure.
4. Create the backend foundation and database migrations.
5. Create authentication and secure bootstrap.
6. Implement catalog snapshot and ingestion foundations.
7. Implement user-data models and API services.
8. Implement the iOS migration tool.
9. Implement the responsive frontend shell.
10. Rebuild existing MineOps workflows.
11. Add IndexedDB and offline mutation queue.
12. Add synchronization and conflict handling.
13. Add PWA installation and update behavior.
14. Implement the emulator ingestion agent.
15. Add validation and catalog comparison UI.
16. Add imports, exports, backups, and diagnostics.
17. Add automated tests.
18. Add Docker production deployment.
19. Validate against the current iOS application.
20. Perform production readiness review.
21. Deploy under the selected `shepswork.com` subdomain.
22. Verify backups and restore.
23. Document iOS archive criteria.

Do not leave core architecture as stubs with TODO comments. Finish each required workflow to an operational state.

---

## 16. Data Validation and Parity Review

Before the web application is considered complete, create a parity report.

The report must compare:

- Existing iOS features.
- MineOpsWeb features.
- Existing iOS calculations.
- MineOpsWeb calculations.
- Existing seed/reference data.
- Latest captured catalog.
- Existing import/export behavior.
- New import/export behavior.

For each difference, state:

- Intentional or unintentional.
- User impact.
- Resolution.
- Test coverage.

Critical calculations should use shared fixtures to prove that the iOS behavior and web behavior produce the same result where parity is intended.

---

## 17. Completion Criteria

MineOpsWeb is complete when:

- It runs locally through Docker Compose.
- It runs in production through Docker Compose.
- It is available under the selected `shepswork.com` subdomain.
- It can be installed as a PWA on iPhone.
- It works offline with previously synchronized data.
- Offline changes synchronize after reconnecting.
- Conflicts are not silently overwritten.
- Existing MineOps data can be migrated.
- Existing useful MineOps workflows are present.
- Current calculations have been validated.
- Emulator captures can be uploaded through the ingestion agent.
- Catalog snapshots can be reviewed, compared, and activated.
- Full backup and restore have been tested.
- Automated tests pass.
- Production health checks pass.
- Documentation is complete.
- The iOS app is no longer required for normal MineOps use.

---

## 18. Documentation Deliverables

Codex must create and maintain:

```text
README.md
AGENTS.md
PRD.md
docs/architecture/system-overview.md
docs/architecture/data-model.md
docs/architecture/sync-model.md
docs/api/api-overview.md
docs/development/local-setup.md
docs/development/testing.md
docs/deployment/production-deployment.md
docs/deployment/rollback.md
docs/deployment/backup-and-restore.md
docs/emulator-ingestion/agent-setup.md
docs/emulator-ingestion/capture-workflow.md
docs/migration/ios-data-migration.md
docs/validation/catalog-validation.md
docs/validation/ios-parity-report.md
```

Documentation must be updated as implementation changes. Do not defer all documentation until the end.

---

## 19. AGENTS.md Requirements

Create a repository-level `AGENTS.md` that instructs Codex and other coding agents to:

- Read `PRD.md` before material changes.
- Inspect `docs/server-guide` when present.
- Preserve migration compatibility.
- Never commit secrets.
- Run relevant tests before completing work.
- Update documentation with architecture changes.
- Add or update database migrations properly.
- Avoid destructive database changes without a documented migration and backup path.
- Maintain mobile-first behavior.
- Preserve offline and synchronization guarantees.
- Record completed work in the project development journal if one is added.
- Avoid replacing working functionality with placeholders.
- Keep Docker development and production paths operational.
- Provide a completion summary listing changed files, migrations, tests, and remaining risks.

---

## 20. Initial Codex Assignment

Codex should begin with the following concrete assignment:

1. Create the `MineOpsWeb` repository structure.
2. Copy this PRD into `PRD.md`.
3. Create `AGENTS.md`.
4. Inspect the existing MineOps iOS repository and available captured catalog package.
5. Produce:
   - Existing feature inventory.
   - Existing data model inventory.
   - Export/import format inventory.
   - Calculation inventory.
   - Catalog-source inventory.
   - Migration risks.
6. Write the proposed final database schema.
7. Write the proposed API contract.
8. Scaffold the frontend, backend, PostgreSQL, and Docker Compose stack.
9. Ensure the stack starts successfully.
10. Implement a vertical proof covering:
    - Admin login.
    - Health endpoint.
    - One user-data entity.
    - IndexedDB storage.
    - Offline edit queue.
    - Server synchronization.
    - One catalog snapshot upload.
    - Catalog snapshot display.
11. Continue directly into the full implementation after the vertical proof is working.
12. Do not stop at the scaffold unless blocked by missing source data or an actual external credential.

---

## 21. Environment Variables

Create `.env.example` with documented values similar to:

```dotenv
APP_ENV=development
APP_NAME=MineOpsWeb
APP_BASE_URL=http://localhost:8080
API_BASE_URL=http://localhost:8000
FRONTEND_ORIGIN=http://localhost:8080

POSTGRES_DB=mineops
POSTGRES_USER=mineops
POSTGRES_PASSWORD=change-me
DATABASE_URL=postgresql+psycopg://mineops:change-me@postgres:5432/mineops

SESSION_SECRET=change-me
TOKEN_HASH_SECRET=change-me
INITIAL_ADMIN_EMAIL=
INITIAL_ADMIN_PASSWORD=

INGESTION_STORAGE_PATH=/data/ingestion
EXPORT_STORAGE_PATH=/data/exports
BACKUP_STORAGE_PATH=/data/backups

LOG_LEVEL=INFO
SENTRY_DSN=
```

Production secrets must be supplied through the server’s established secret-management pattern described in the server guide.

---

## 22. Final Direction to Codex

Build MineOpsWeb as the full replacement for the current MineOps iOS application.

Favor:

- Standard, maintainable components.
- Explicit data ownership.
- Reliable offline use.
- Safe synchronization.
- Versioned game-data ingestion.
- Clear validation.
- Reproducible Docker deployment.
- Strong documentation.
- Complete working workflows.

Avoid:

- A long-lived hybrid between the old and new applications.
- Unnecessary platform-specific code.
- Temporary sync mechanisms that become permanent.
- Silent data loss.
- Hidden business rules.
- Over-engineered infrastructure.
- Production dependencies on abandoned or uncertain backend projects.

The final result should feel like a first-class MineOps application that happens to run everywhere, not a desktop website squeezed onto a phone.
