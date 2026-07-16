# MineOps Data Engine — Implementation Plan (Post-Architect Reply)

**Date:** 2026-07-16  
**Status:** Ready to execute  
**Source of truth:**
- `MineOps_Data_Engine_UbuntuMac_Engineering_Design.md`
- `docs/MINEOPS_DATA_ENGINE_DECISION_LOG.md` (Architect Reply section)

---

## Readiness verdict

✅ **Proceed approved.** The architect reply resolves core contract and governance blockers.

Key unblockers confirmed:
- D-001 ownership boundary (Engine owns extraction/normalization contracts)
- D-003/D-004 deterministic UUID policy
- D-007/D-008 release metadata + global release ID format
- D-009 strict `versionCode` handling
- D-018 validation blocking model
- D-026 publication authority (MineOpsWeb only)
- D-028 symlink advancement ordering
- D-034 Milestone 2 acceptance criteria

---

## Execution mode

- Follow the engineering design strictly.
- No deviations unless a hard implementation contradiction appears.
- Preserve immutability and layer separation at all times.

---

## Milestone 1 (Foundation) — execution checklist

## Goals
- Scaffold `MineOpsDataEngine` repo and Python package.
- Implement config loading + env validation.
- Implement structured logging and locking.
- Implement emulator wrapper using fixed serial `emulator-5556`.

## Deliverables
- Repository skeleton per spec section 6.
- CLI stub with commands declared (even if some are no-op placeholders).
- Locking utility (`flock` based).
- `verify-host`, `emulator start|stop|status` commands.
- JSONL logging base.

## Exit gate
- `mineops-data-engine verify-host` passes on UbuntuMac.
- `mineops-data-engine emulator status` confirms running + `sys.boot_completed=1`.
- Any ADB command without `-s emulator-5556` is blocked in code paths.

---

## Milestone 2 (Acquisition) — execution checklist

## Goals
- Detect installed package version metadata.
- Discover all APK paths dynamically.
- Pull full APK set (base + all splits).
- Generate SHA256 + release metadata.
- Write immutable release archive.

## Deliverables
- `detect` command (metadata parse from `dumpsys package`).
- `acquire` command (dynamic `pm path` pull for all APK lines).
- `release.json` with required fields from D-007.
- `APK_SET.json`, `APK_PATHS.json`, `SHA256SUMS`.
- Immutable archive operation (`chmod -R a-w`) after completion.

## Exit gate (D-034)
- Emulator starts.
- Package detected.
- All APKs pulled.
- SHA256 generated.
- `release.json` generated.
- Immutable archive created.
- Recovery path tested.

---

## Architecture constraints to enforce in code from day one

1. **Deterministic identity**
   - UUIDv5 with fixed namespace constant.
   - Contract: `<objectType>:<gameId>` fallback `<objectType>:<sourceAsset>:<unityPathId>`.

2. **No-change handling**
   - Exit code `14` on unchanged release.
   - No PocketBase write for no-change runs (D-019).

3. **Immutability**
   - Never mutate completed release content.
   - Reprocessing creates revision records (D-027).

4. **Publication governance**
   - UbuntuMac stages only, never publishes production (D-026).

5. **Security defaults**
   - APK binaries private.
   - Artifact API: Tailscale + bearer token (D-023), raw APK external access disabled by default (D-022).

---

## Proposed implementation sequence (first 10 tasks)

1. Create `MineOpsDataEngine` repository scaffold.
2. Add `pyproject.toml`, CLI entrypoint, and package skeleton.
3. Implement env/config loader and schema validation for config.
4. Implement structured logger + run IDs.
5. Implement lock manager and stale-lock verification.
6. Implement ADB client wrapper (serial enforced).
7. Implement emulator lifecycle wrapper.
8. Implement package metadata parser from `dumpsys package`.
9. Implement APK path discovery parser from `pm path`.
10. Implement acquisition + hashing + release archive write.

---

## Copy-paste engineering kickoff commands

```bash
# 1) Create new repo workspace (example path)
mkdir -p ~/Projects && cd ~/Projects
mkdir MineOpsDataEngine && cd MineOpsDataEngine

# 2) Initialize git
git init

# 3) Create runtime dirs on server (outside repo)
mkdir -p ~/mineops-data/{incoming,work,releases,staging,cache,locks,logs,backups,state,overrides}

# 4) Confirm emulator path and serial contract
adb -s emulator-5556 shell getprop sys.boot_completed
adb -s emulator-5556 shell pm path com.fluffyfairygames.idleminertycoon
```

---

## Risks to watch immediately

- `adb devices` may show stale offline entries; serial pinning must prevent ambiguity.
- `versionCode` parse failures should stop acquisition immediately (D-009).
- Remote split names can vary; discovery must be dynamic and split-agnostic.
- Do not let symlinks (`current`/`previous`) advance before full validation+staging success (D-028).

---

## Definition of “ready for Milestone 3”

Only proceed when Milestone 2 artifacts are reproducible across at least two runs:
- Run A: first acquisition creates a release.
- Run B: no-change returns exit `14` with no new release.
- Run C: forced/acquired updated APK set creates new release with new hashes.

---

## Operator note

The architect reply in `docs/MINEOPS_DATA_ENGINE_DECISION_LOG.md` is accepted as binding for implementation unless superseded by a new approved decision row.
