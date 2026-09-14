# Capture workflow

UbuntuMac retains the three newest complete release directories locally. After a
successful or duplicate upload, the runner purges older or incomplete immediate
children of `~/mineops-data/releases/`; it never deletes files outside that
release root. PocketBase import history and the active catalog package are
separate server-side records and are not pruned by this local retention step.
The intended flow is Android emulator → local extraction → `mineops-ingest
validate` → HTTPS upload → staged catalog review → validation → explicit
activation. Capture payloads must be treated as untrusted input and retained
according to the server-guide backup policy.

Lossless strategy extraction writes a new candidate below the selected complete release; it never overwrites `exports/v3` or an existing candidate. A release is eligible only when every capture prerequisite exists and every safe, release-local APK filename recomputes to the SHA-256 recorded in `release.json`. That metadata supplies the release/game identity, domain files are written canonically with hashes, and `manifest.json` is written last. The repo-owned extractor modules under `ops/` are the reproducible source for the copies installed in `~/mineops-engine/src/mineops_data_engine/`. Candidate generation and publication are separate operations: creating or validating a candidate does not upload, publish, or activate it.

## Wiring UbuntuMac to MineOps PocketBase (next logical step)

Per V3 architecture, **PocketBase stays on MineOps infrastructure** (dev/prod server), not on `ubuntumac`.

`ubuntumac` is an outbound data engine only:

```text
ubuntumac capture/extraction
	-> capture-bridge upload
	-> MineOps PocketBase /api/capture/ingest
	-> raw_imports + catalog_versions
	-> MineOpsWeb More > UbuntuMac catalog bridge / import history
```

### 1) Configure capture-bridge on UbuntuMac

Set environment variables on UbuntuMac:

- `MINEOPS_CAPTURE_URL` (example: `https://<mineops-dev-host>/api/capture/ingest`)
- `MINEOPS_CAPTURE_TOKEN` (token whose SHA256 hash is stored in `capture_clients.tokenHash`)

### 2) Validate wiring before uploading a release

Run:

- `cd apps/capture-bridge`
- `npm run status`

Or from VS Code task runner:

- `UbuntuMac: Capture status`

Expected:

- `checks.health.ok = true`
- `checks.ingestAuth.ok = true` (non-401)
- `checks.catalogRead.ok = true` (if public read is enabled for `catalog_versions`)

### 3) Upload real payloads

Single payload:

- `npm run capture -- <release.json>`

Batch inbox:

- `npm run inbox -- <capture-folder>`

Or from VS Code task runner:

- `UbuntuMac: Check APK + upload latest release`

Dry run (no upload):

- `npm run capture -- <release.json> --dry-run`

### 4) Verify in PocketBase and app UI

After upload:

- `catalog_versions` gets a new row (release metadata)
- `raw_imports` stores raw payload JSON
- MineOpsWeb `More -> UbuntuMac catalog bridge` shows refreshed import history + latest-vs-previous deltas. Use the separate `More -> Catalog -> Refresh catalog` action to make the newly published package active in the browser.

The browser does not start the UbuntuMac upload. This is intentionally a second, outbound-only workflow: first sync player data from Kolibri in the client; separately run the UbuntuMac bridge task when a new catalog release is available. MineOpsWeb now exposes this boundary in **More → UbuntuMac catalog bridge** with a copyable SSH command and the exact post-upload refresh steps; it remains a manual Mac-side action, not a remote-execution endpoint.

### 5) Troubleshooting

- Online but object count is `0` usually means payload has `objects: []` (test fixture behavior).
- 401 from ingest probe means capture token mismatch/inactive client.
- If `catalog_versions` sort-by-created fails on dev PB, frontend now falls back gracefully to default ordering.
- The bridge panel reads the complete public `catalog_versions` collection and
  sorts by the release's embedded UTC capture timestamp when PocketBase omits
  `created`; this prevents an older first page from masking a newer UbuntuMac
  ingest. After a new ingest, use **Refresh bridge status** and then **Refresh
  catalog** in MineOpsWeb.
- If the scheduled runner reports a stale package and times out, inspect
  `/home/yancmo/mineops-data/logs/weekly-update.log`. On 2026-08-30 the
  emulator was on `5.60.0` while Google Play reported `5.61.1`, but the
  Play Store foreground activity was blocked by Android's `System UI isn't
  responding` dialog, so no `Update` control was available. A later live
  inspection also found the same emulator producing a `Pixel Launcher isn't
  responding` dialog. The deployed checker now dismisses either kind of
  Android nonresponsive prompt with `Wait`, opens the explicit HTTPS Play
  Store app page, and fails with a bounded page-readiness error if that page
  never appears. The checker writes a report-state handoff before cleanup, so
  the wrapper's separate `--report` process retains the real start time and
  observed versions instead of reporting `unknown`.

## VS Code manual tasks (local workstation)

Added in `.vscode/tasks.json`:

- `UbuntuMac: Capture status`
- `UbuntuMac: Check APK + upload latest release`

Both tasks call `scripts/ubuntumac/run-remote-check.sh`, which SSHes to UbuntuMac and runs:

- `~/mineops-data/bin/check-and-upload.sh --status`
- `~/mineops-data/bin/check-and-upload.sh` (start emulator if needed, acquire a fresh release, upload it, then stop only the emulator started by this run)

Remote runner source of truth in this repo:

- `scripts/ubuntumac/check-and-upload.remote.sh`

Deployed on UbuntuMac at:

- `~/mineops-data/bin/check-and-upload.sh`
- `~/mineops-data/.capture.env`

`MINEOPS_CAPTURE_TOKEN` in `~/.capture.env` must be replaced with a real capture client token before upload mode will send data.

Override SSH target/command without editing task files:

- `UBUNTUMAC_SSH_TARGET`
- `UBUNTUMAC_REMOTE_COMMAND`

The upload runner exports the Android SDK path before invoking `adb` or
`mineops-data-engine`, waits for `sys.boot_completed=1`, and refuses to upload
an older release when acquisition produces no new release. Exit code `14` means
“unchanged/already ingested” and is a clean no-op. For troubleshooting, use
`--no-start` to require an already-running emulator or `--keep-emulator` to
leave an emulator started by the run online.

The UbuntuMac scheduled runner is deployed at
`~/mineops-engine/scripts/weekly-mineops-update.sh`. Cron wakes it every Sunday,
but an epoch-week parity guard runs the pipeline only every 14 days. Before
processing, the runner discovers the current version from the Google Play
listing, opens the explicit app page in the emulator, recovers Android
nonresponsive prompts, taps `Update` when required, and waits for the installed
package to reach the observed version. If Play Store cannot update the
emulator, the run fails closed before acquisition. A failed run is recorded in
`/home/yancmo/mineops-data/logs/weekly-update-last-result` so the next Sunday
retries; successful runs remain on the 14-day cadence. After processing, it
uploads a compact release envelope; the full processed catalog is not sent
through the PocketBase capture payload-size limit. Manual checks and scheduled
runs send status email through the existing BingeBox Gmail settings
(`GMAIL_USER`, `GMAIL_PASS`, and `ADMIN_EMAIL`) without logging credentials.

Retention can also be run directly with
`~/mineops-data/bin/check-and-upload.sh --prune-releases`. It keeps the three
newest complete releases by capture time, with directory modification time as
the tie-breaker for derived revisions of the same capture. Re-running the
command converges to the same three directories.
