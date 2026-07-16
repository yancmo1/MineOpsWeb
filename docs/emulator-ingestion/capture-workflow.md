# Capture workflow

Capture files stay on `ubuntumac`; the agent never deletes source files. The intended flow is Android emulator → local extraction → `mineops-ingest validate` → HTTPS upload → staged catalog review → validation → explicit activation. Capture payloads must be treated as untrusted input and retained according to the server-guide backup policy.

## Wiring UbuntuMac to MineOps PocketBase (next logical step)

Per V3 architecture, **PocketBase stays on MineOps infrastructure** (dev/prod server), not on `ubuntumac`.

`ubuntumac` is an outbound data engine only:

```text
ubuntumac capture/extraction
	-> capture-bridge upload
	-> MineOps PocketBase /api/capture/ingest
	-> raw_imports + catalog_versions
	-> MineOpsWeb More > Capture Status / Import history
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
- MineOpsWeb `More -> Capture Status` shows refreshed import history + latest-vs-previous deltas

### 5) Troubleshooting

- Online but object count is `0` usually means payload has `objects: []` (test fixture behavior).
- 401 from ingest probe means capture token mismatch/inactive client.
- If `catalog_versions` sort-by-created fails on dev PB, frontend now falls back gracefully to default ordering.

## VS Code manual tasks (local workstation)

Added in `.vscode/tasks.json`:

- `UbuntuMac: Capture status`
- `UbuntuMac: Check APK + upload latest release`

Both tasks call `scripts/ubuntumac/run-remote-check.sh`, which SSHes to UbuntuMac and runs:

- `~/mineops-data/bin/check-and-upload.sh --status`
- `~/mineops-data/bin/check-and-upload.sh`

Remote runner source of truth in this repo:

- `scripts/ubuntumac/check-and-upload.remote.sh`

Deployed on UbuntuMac at:

- `~/mineops-data/bin/check-and-upload.sh`
- `~/mineops-data/.capture.env`

`MINEOPS_CAPTURE_TOKEN` in `~/.capture.env` must be replaced with a real capture client token before upload mode will send data.

Override SSH target/command without editing task files:

- `UBUNTUMAC_SSH_TARGET`
- `UBUNTUMAC_REMOTE_COMMAND`
