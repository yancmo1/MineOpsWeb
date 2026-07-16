# MineOps Android Emulator Handoff (UbuntuMac)

Last updated: 2026-07-15
Owner: `yancmo`
Host: `ubuntumac` (`100.105.31.42`, LAN `192.168.50.97`)

## Goal
Run a headless Android emulator on Ubuntu Server (no desktop), access it via browser (noVNC), and support MineOps workflows (Play install, ADB inspection, APK handling).

## Current status
- ✅ KVM acceleration usable (`emulator -accel-check` reports KVM usable)
- ✅ Headless stack running (`Xvfb`, emulator, `x11vnc`, `websockify`)
- ✅ noVNC reachable on LAN and Tailscale
- ✅ ADB target online: `emulator-5556`
- ✅ Play Store + Play Services present
- ✅ Idle Miner Tycoon installed (`com.fluffyfairygames.idleminertycoon`)
- ✅ Extracted APK set includes both files required for this install:
   - `base.apk`
   - `split_config.arm64_v8a.apk`

## What was fixed on 2026-07-15
Phase 7 failures were caused by ADB device ambiguity (`adb: more than one device/emulator`) due stale/offline emulator entries.

### Server-side script fixes applied
Patched files on server:
- `~/mineops-emulator/start-poc.sh`
- `~/mineops-emulator/stop-poc.sh`

Backups created:
- `~/mineops-emulator/start-poc.sh.bak.20260715-1400`
- `~/mineops-emulator/stop-poc.sh.bak.20260715-1400`

Key changes:
1. Fixed emulator port to `5556` (`-port 5556`)
2. Added explicit ADB serial targeting (`emulator-5556`) throughout
3. Reset ADB server on startup (`adb kill-server`/`adb start-server`)
4. Boot/wait logic now targets the known serial only
5. Startup output now prints both LAN and Tailscale noVNC URLs

## Access
- LAN: `http://192.168.50.97:6080/vnc.html?autoconnect=true&resize=scale`
- Tailscale: `http://100.105.31.42:6080/vnc.html?autoconnect=true&resize=scale`

## Runbook
### Start
`~/mineops-emulator/start-poc.sh`

### Stop
`~/mineops-emulator/stop-poc.sh`

### Check stack processes
`ps -ef | grep -E 'qemu-system-x86_64 .*@mineops-poc|Xvfb :99|x11vnc -display :99|websockify --web=/usr/share/novnc' | grep -v grep`

### Check noVNC endpoint
`curl -I http://127.0.0.1:6080/vnc.html`

### Always use explicit ADB serial
`adb -s emulator-5556 devices`

Examples:
- `adb -s emulator-5556 shell getprop sys.boot_completed`
- `adb -s emulator-5556 shell pm list packages | grep -i fluffyfairygames`
- `adb -s emulator-5556 exec-out screencap -p > ~/mineops-emulator/captures/screen.png`

## Validation from this session
- `adb -s emulator-5556 shell getprop sys.boot_completed` → `1`
- `curl -I http://127.0.0.1:6080/vnc.html` → `HTTP/1.1 200 OK`
- `curl -I http://192.168.50.97:6080/vnc.html` → `HTTP/1.1 200 OK`
- `curl -I http://100.105.31.42:6080/vnc.html` → `HTTP/1.1 200 OK`
- `adb -s emulator-5556 shell pm list packages | grep -E 'com.android.vending|com.google.android.gms'` → present

## Known quirk
You may still see `emulator-5554 offline` in `adb devices` occasionally. This is non-blocking as long as all commands target `-s emulator-5556`.

## Remaining manual steps to complete POC
1. Open noVNC URL from Mac.
2. Complete Android welcome flow.
3. Sign into Google account in emulator.
4. Verify install:
   - `adb -s emulator-5556 shell pm list packages | grep -i fluffyfairygames`
5. Capture screenshot and diagnostics for MineOps handoff.

## APK extraction workflow (for MineOpsWeb)

After the app is installed on `emulator-5556`, use:

1. Find package and APK path:
   - `adb -s emulator-5556 shell pm list packages | grep -i fluffyfairygames`
   - `adb -s emulator-5556 shell pm path com.fluffyfairygames.idleminertycoon`

2. Pull APK files to server (copy exact paths returned by `pm path`):
   - `mkdir -p ~/mineops-emulator/apks`
   - `adb -s emulator-5556 pull '/data/app/~~o15wKnB0FBEYnRAQZKNq7w==/com.fluffyfairygames.idleminertycoon-Zb4nCWyj6PyOJBeWmMdM4A==/base.apk' ~/mineops-emulator/apks/idle-miner-base.apk`
   - `adb -s emulator-5556 pull '/data/app/~~o15wKnB0FBEYnRAQZKNq7w==/com.fluffyfairygames.idleminertycoon-Zb4nCWyj6PyOJBeWmMdM4A==/split_config.arm64_v8a.apk' ~/mineops-emulator/apks/idle-miner-split-arm64.apk`

3. Copy APKs to Mac/workspace:
   - `scp 'yancmo@100.105.31.42:~/mineops-emulator/apks/*' ./`
   - Alternative (no remote glob): `scp yancmo@100.105.31.42:~/mineops-emulator/apks/idle-miner-base.apk ./`
   - Verify local files: `ls -lh ./idle-miner*`

4. Keep a canonical “current” folder and add version metadata:
   - `PACKAGE="com.fluffyfairygames.idleminertycoon"`
   - `APK_DIR="$HOME/mineops-emulator/apks/current"`
   - `mkdir -p "$APK_DIR"`
   - `cp ~/mineops-emulator/apks/idle-miner-base.apk "$APK_DIR/base.apk"`
   - `cp ~/mineops-emulator/apks/idle-miner-split-arm64.apk "$APK_DIR/split_config.arm64_v8a.apk"`
   - `adb -s emulator-5556 shell dumpsys package "$PACKAGE" | grep -E 'versionName=|versionCode=' | sed 's/^[[:space:]]*//' | tee "$APK_DIR/version.txt"`
   - `adb -s emulator-5556 shell dumpsys package "$PACKAGE" > "$APK_DIR/package-info.txt"`

5. Generate checksums for update/change detection:
   - `cd "$APK_DIR"`
   - `sha256sum base.apk split_config.arm64_v8a.apk | tee SHA256SUMS`

6. Create dated immutable snapshot archive:
   - `VERSION_NAME="$(adb -s emulator-5556 shell dumpsys package "$PACKAGE" | sed -n 's/.*versionName=//p' | head -1 | tr -d '\r')"`
   - `STAMP="$(date +%Y-%m-%d_%H-%M-%S)"`
   - `SNAPSHOT_DIR="$HOME/mineops-emulator/apks/archive/${VERSION_NAME:-unknown}_$STAMP"`
   - `mkdir -p "$SNAPSHOT_DIR"`
   - `cp "$APK_DIR/base.apk" "$APK_DIR/split_config.arm64_v8a.apk" "$APK_DIR/version.txt" "$APK_DIR/package-info.txt" "$APK_DIR/SHA256SUMS" "$SNAPSHOT_DIR/"`
   - `find "$SNAPSHOT_DIR" -maxdepth 1 -type f -printf '%f  %s bytes\n'`

7. Reinstall command for this split package set:
   - `adb -s emulator-5556 install-multiple "$APK_DIR/base.apk" "$APK_DIR/split_config.arm64_v8a.apk"`

Notes:
- Do **not** use placeholder text like `<resolved-path>` in shell commands.
- In zsh, quote the remote `scp` path when using `*`, or zsh will try to expand it locally and fail with `no matches found`.
- Ensure there is no space after the colon in `user@host:remote-path`.
- On modern Android builds, split APKs may exist. Keep the full installed set together.
- For this app on this emulator, the split includes `arm64_v8a` native libs. That suggests ARM64 app binaries are in use (native ARM image or translation layer). This is acceptable for the POC, though potentially slower than pure x86_64.
- Always target the explicit emulator serial (`-s emulator-5556`) to avoid stale device conflicts.

## Proven POC pipeline

```text
Google Play
   ↓
Idle Miner installed in emulator
   ↓
ADB detects the package
   ↓
Complete APK set extracted (base + split)
   ↓
MineOps can inspect, hash, archive, and compare releases
```

## Next technical step

Automate extraction into versioned archives and trigger only when either changes:
- `versionCode`
- APK checksums (`SHA256SUMS`)

## Handoff artifact on server
Generated status file:
- `~/mineops-emulator/HANDOFF_STATUS_2026-07-15_1402.md`
