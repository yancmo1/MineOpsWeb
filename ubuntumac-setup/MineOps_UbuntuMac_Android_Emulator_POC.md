# MineOps UbuntuMac Android Emulator POC

> **Goal:** Run an Android emulator on Ubuntu Server without installing Ubuntu Desktop, open its screen from a browser when needed, install Idle Miner Tycoon, and verify ADB access for later MineOps automation.
>
> **POC architecture:** Native Android Emulator + KVM + Xvfb + x11vnc/noVNC.
>
> **Expected host:** Ubuntu Server on an **x86_64 Intel or AMD machine** with hardware virtualization enabled.

---

## 0. Important assumptions

This guide assumes:

- You can SSH into `ubuntumac`.
- `ubuntumac` uses an Intel or AMD x86_64 processor.
- Intel VT-x or AMD-V is enabled in BIOS/UEFI.
- You have at least:
  - 4 CPU cores available
  - 8 GB RAM
  - 25–40 GB free disk space
- Port `6080` is reachable from your Mac on the local network.
- You are running these commands as your normal Linux user, not as `root`.

The emulator can remain on Ubuntu Server. A full GNOME/KDE desktop is not required.

---

# Phase 1 — Verify the host

SSH into the machine:

```bash
ssh yancmo@192.168.50.97
```

Check the architecture:

```bash
uname -m
```

Expected:

```text
x86_64
```

Check Ubuntu details:

```bash
cat /etc/os-release
```

Check CPU virtualization support:

```bash
egrep -c '(vmx|svm)' /proc/cpuinfo
```

Expected: a number greater than `0`.

Check whether KVM exists:

```bash
ls -l /dev/kvm
```

If `/dev/kvm` does not exist, first verify that virtualization is enabled in BIOS/UEFI.

---

# Phase 2 — Install required Ubuntu packages

Update Ubuntu:

```bash
sudo apt update
sudo apt upgrade -y
```

Install KVM, Android runtime dependencies, Xvfb, VNC, and noVNC:

```bash
sudo apt install -y \
  cpu-checker \
  qemu-kvm \
  libvirt-daemon-system \
  libvirt-clients \
  bridge-utils \
  unzip \
  wget \
  curl \
  ca-certificates \
  openjdk-17-jre-headless \
  xvfb \
  x11vnc \
  novnc \
  websockify \
  libgl1 \
  libglu1-mesa \
  libpulse0 \
  libnss3 \
  libx11-6 \
  libx11-xcb1 \
  libxcb1 \
  libxcomposite1 \
  libxcursor1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxi6 \
  libxkbcommon0 \
  libxrandr2 \
  libxrender1 \
  libxtst6
```

Check KVM acceleration:

```bash
kvm-ok
```

Expected:

```text
INFO: /dev/kvm exists
KVM acceleration can be used
```

Add your user to the KVM and libvirt groups:

```bash
sudo usermod -aG kvm,libvirt "$USER"
```

Apply the group change by logging out:

```bash
exit
```

SSH back in:

```bash
ssh yancmo@192.168.50.97
```

Confirm group membership:

```bash
groups
```

The output should include:

```text
kvm libvirt
```

Check KVM permissions:

```bash
test -r /dev/kvm && test -w /dev/kvm \
  && echo "KVM access is ready" \
  || echo "KVM access is NOT ready"
```

---

# Phase 3 — Install Android command-line tools

Create the SDK directories:

```bash
mkdir -p "$HOME/Android/Sdk/cmdline-tools"
cd /tmp
```

Download the current Linux Android command-line tools package used when this guide was written:

```bash
wget -O commandlinetools-linux.zip \
  https://dl.google.com/android/repository/commandlinetools-linux-14742923_latest.zip
```

Extract it:

```bash
rm -rf /tmp/android-command-line-tools
mkdir -p /tmp/android-command-line-tools
unzip -q commandlinetools-linux.zip -d /tmp/android-command-line-tools
```

Move it into the Android SDK's required `latest` directory layout:

```bash
rm -rf "$HOME/Android/Sdk/cmdline-tools/latest"
mkdir -p "$HOME/Android/Sdk/cmdline-tools/latest"
mv /tmp/android-command-line-tools/cmdline-tools/* \
  "$HOME/Android/Sdk/cmdline-tools/latest/"
```

Add Android tools to your shell environment:

```bash
cat >> "$HOME/.bashrc" <<'EOF'

# Android SDK
export ANDROID_HOME="$HOME/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin"
export PATH="$PATH:$ANDROID_HOME/platform-tools"
export PATH="$PATH:$ANDROID_HOME/emulator"
EOF
```

Load the updated environment:

```bash
source "$HOME/.bashrc"
```

Verify the tools:

```bash
sdkmanager --version
avdmanager --help | head
```

---

# Phase 4 — Install the emulator and Google Play system image

For the POC, use Android API 35 with the Google Play x86_64 image.

Install the emulator, platform tools, and system image:

```bash
sdkmanager \
  "platform-tools" \
  "emulator" \
  "platforms;android-35" \
  "system-images;android-35;google_apis_playstore;x86_64"
```

Accept the Android SDK licenses:

```bash
yes | sdkmanager --licenses
```

Update installed SDK packages:

```bash
sdkmanager --update
```

Verify that ADB and the emulator exist:

```bash
adb version
emulator -version
```

Verify emulator acceleration:

```bash
emulator -accel-check
```

Expected output should indicate that KVM is installed and usable.

---

# Phase 5 — Create the MineOps Android virtual device

List available Pixel device definitions:

```bash
avdmanager list device | grep -i -A 2 pixel
```

Create a Pixel 7 AVD named `mineops-poc`:

```bash
echo "no" | avdmanager create avd \
  --force \
  --name "mineops-poc" \
  --package "system-images;android-35;google_apis_playstore;x86_64" \
  --device "pixel_7"
```

Verify it exists:

```bash
emulator -list-avds
```

Expected:

```text
mineops-poc
```

Increase the virtual device's storage and set POC-friendly defaults:

```bash
cat >> "$HOME/.android/avd/mineops-poc.avd/config.ini" <<'EOF'
disk.dataPartition.size=16G
hw.cpu.ncore=4
hw.ramSize=4096
hw.keyboard=yes
hw.gpu.enabled=yes
hw.gpu.mode=swiftshader_indirect
showDeviceFrame=no
EOF
```

Remove duplicate settings while keeping the last value for each key:

```bash
awk -F= '!seen[$1]++ {order[++n]=$1} {value[$1]=$0} END {for(i=1;i<=n;i++) print value[order[i]]}' \
  "$HOME/.android/avd/mineops-poc.avd/config.ini" \
  > "$HOME/.android/avd/mineops-poc.avd/config.ini.tmp"

mv "$HOME/.android/avd/mineops-poc.avd/config.ini.tmp" \
  "$HOME/.android/avd/mineops-poc.avd/config.ini"
```

---

# Phase 6 — Create the POC startup script

Create a working directory:

```bash
mkdir -p "$HOME/mineops-emulator"
```

Create the startup script:

```bash
cat > "$HOME/mineops-emulator/start-poc.sh" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail

export ANDROID_HOME="$HOME/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin"
export PATH="$PATH:$ANDROID_HOME/platform-tools"
export PATH="$PATH:$ANDROID_HOME/emulator"

export DISPLAY=:99

WORK_DIR="$HOME/mineops-emulator"
LOG_DIR="$WORK_DIR/logs"
PID_DIR="$WORK_DIR/pids"

mkdir -p "$LOG_DIR" "$PID_DIR"

stop_if_running() {
  local pid_file="$1"

  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file")"

    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" || true
      sleep 1
    fi

    rm -f "$pid_file"
  fi
}

echo "Stopping old POC processes, if any..."

stop_if_running "$PID_DIR/novnc.pid"
stop_if_running "$PID_DIR/x11vnc.pid"
stop_if_running "$PID_DIR/emulator.pid"
stop_if_running "$PID_DIR/xvfb.pid"

pkill -f "emulator.*mineops-poc" 2>/dev/null || true
pkill -f "websockify.*6080" 2>/dev/null || true
pkill -f "x11vnc.*:99" 2>/dev/null || true
pkill -f "Xvfb :99" 2>/dev/null || true

rm -f /tmp/.X99-lock
rm -f /tmp/.X11-unix/X99

echo "Starting virtual display..."

nohup Xvfb :99 \
  -screen 0 1280x800x24 \
  -ac \
  +extension GLX \
  +render \
  -noreset \
  > "$LOG_DIR/xvfb.log" 2>&1 &

echo $! > "$PID_DIR/xvfb.pid"
sleep 2

echo "Starting Android emulator..."

nohup emulator @mineops-poc \
  -gpu swiftshader_indirect \
  -no-audio \
  -no-boot-anim \
  -no-snapshot \
  -netdelay none \
  -netspeed full \
  -feature -Vulkan \
  > "$LOG_DIR/emulator.log" 2>&1 &

echo $! > "$PID_DIR/emulator.pid"

echo "Starting VNC server..."

nohup x11vnc \
  -display :99 \
  -forever \
  -shared \
  -nopw \
  -rfbport 5900 \
  -listen 127.0.0.1 \
  > "$LOG_DIR/x11vnc.log" 2>&1 &

echo $! > "$PID_DIR/x11vnc.pid"

NOVNC_WEB="/usr/share/novnc"

if [[ ! -d "$NOVNC_WEB" ]]; then
  echo "ERROR: noVNC web directory not found at $NOVNC_WEB"
  exit 1
fi

echo "Starting noVNC on TCP port 6080..."

nohup websockify \
  --web="$NOVNC_WEB" \
  0.0.0.0:6080 \
  127.0.0.1:5900 \
  > "$LOG_DIR/novnc.log" 2>&1 &

echo $! > "$PID_DIR/novnc.pid"

echo "Waiting for the emulator to appear in ADB..."

timeout 180 adb wait-for-device

echo "Waiting for Android to finish booting..."

BOOT_COMPLETE=""

for attempt in $(seq 1 120); do
  BOOT_COMPLETE="$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)"

  if [[ "$BOOT_COMPLETE" == "1" ]]; then
    break
  fi

  sleep 2
done

if [[ "$BOOT_COMPLETE" != "1" ]]; then
  echo "ERROR: Android did not complete booting."
  echo "Review: $LOG_DIR/emulator.log"
  exit 1
fi

adb shell input keyevent 82 || true

HOST_IP="$(hostname -I | awk '{print $1}')"

echo
echo "MineOps emulator POC is running."
echo
echo "Browser:"
echo "  http://${HOST_IP}:6080/vnc.html?autoconnect=true&resize=scale"
echo
echo "ADB:"
adb devices
echo
echo "Logs:"
echo "  $LOG_DIR"
EOF
```

Make it executable:

```bash
chmod +x "$HOME/mineops-emulator/start-poc.sh"
```

Create a stop script:

```bash
cat > "$HOME/mineops-emulator/stop-poc.sh" <<'EOF'
#!/usr/bin/env bash
set -u

WORK_DIR="$HOME/mineops-emulator"
PID_DIR="$WORK_DIR/pids"

adb emu kill 2>/dev/null || true
sleep 2

for name in novnc x11vnc emulator xvfb; do
  pid_file="$PID_DIR/$name.pid"

  if [[ -f "$pid_file" ]]; then
    pid="$(cat "$pid_file")"
    kill "$pid" 2>/dev/null || true
    rm -f "$pid_file"
  fi
done

pkill -f "emulator.*mineops-poc" 2>/dev/null || true
pkill -f "websockify.*6080" 2>/dev/null || true
pkill -f "x11vnc.*:99" 2>/dev/null || true
pkill -f "Xvfb :99" 2>/dev/null || true

echo "MineOps emulator POC stopped."
EOF
```

Make it executable:

```bash
chmod +x "$HOME/mineops-emulator/stop-poc.sh"
```

---

# Phase 7 — Start the emulator

Run:

```bash
"$HOME/mineops-emulator/start-poc.sh"
```

The first Android boot can take longer than later boots.

When the script finishes, it will print a URL similar to:

```text
http://192.168.1.50:6080/vnc.html?autoconnect=true&resize=scale
```

Open that URL from your Mac.

Because this is a private-network POC, the VNC session initially has no password. Do **not** expose port `6080` directly to the public internet.

---

# Phase 8 — If Ubuntu's firewall is enabled

Check UFW:

```bash
sudo ufw status
```

If UFW is active, allow noVNC only from your local network.

Example for a `192.168.1.0/24` LAN:

```bash
sudo ufw allow from 192.168.1.0/24 to any port 6080 proto tcp
```

Replace `192.168.1.0/24` with your actual LAN subnet.

Do not use this for a public-facing server:

```bash
# Avoid this unless the network is otherwise protected:
# sudo ufw allow 6080/tcp
```

---

# Phase 9 — Complete Android setup

From the noVNC browser screen:

1. Complete the Android welcome screens.
2. Connect the emulator to your Google account.
3. Open Google Play.
4. Install **Idle Miner Tycoon**.
5. Launch the game.
6. Complete any game login or cloud-save setup needed for the test account.

The AVD stores its writable state under:

```text
~/.android/avd/mineops-poc.avd/
```

Do not use `-wipe-data` after configuring the game unless you intend to reset everything.

---

# Phase 10 — Verify Idle Miner through ADB

Check connected devices:

```bash
adb devices
```

Expected:

```text
List of devices attached
emulator-5554    device
```

Verify Android boot state:

```bash
adb shell getprop sys.boot_completed
```

Expected:

```text
1
```

List packages containing `idle`:

```bash
adb shell pm list packages | grep -i idle
```

Expected package:

```text
package:com.fluffyfairygames.idleminertycoon
```

Check the package path:

```bash
adb shell pm path com.fluffyfairygames.idleminertycoon
```

Launch Idle Miner from the CLI:

```bash
adb shell monkey \
  -p com.fluffyfairygames.idleminertycoon \
  -c android.intent.category.LAUNCHER \
  1
```

Force-stop the game:

```bash
adb shell am force-stop com.fluffyfairygames.idleminertycoon
```

Take a screenshot from the CLI:

```bash
mkdir -p "$HOME/mineops-emulator/captures"

adb exec-out screencap -p \
  > "$HOME/mineops-emulator/captures/idle-miner.png"
```

Copy the screenshot to your Mac:

```bash
scp YOUR_USERNAME@ubuntumac:~/mineops-emulator/captures/idle-miner.png .
```

---

# Phase 11 — Inspect the app for the MineOps POC

Record basic package details:

```bash
adb shell dumpsys package com.fluffyfairygames.idleminertycoon \
  > "$HOME/mineops-emulator/idle-miner-package.txt"
```

Record the current foreground activity:

```bash
adb shell dumpsys activity activities \
  | grep -m 1 "mResumedActivity"
```

Inspect accessible external storage:

```bash
adb shell find /sdcard/Android/data/com.fluffyfairygames.idleminertycoon \
  -maxdepth 3 \
  -type f \
  2>/dev/null \
  | head -100
```

Create a general diagnostic bundle:

```bash
mkdir -p "$HOME/mineops-emulator/diagnostics"

adb shell getprop \
  > "$HOME/mineops-emulator/diagnostics/getprop.txt"

adb shell dumpsys package com.fluffyfairygames.idleminertycoon \
  > "$HOME/mineops-emulator/diagnostics/package.txt"

adb shell pm path com.fluffyfairygames.idleminertycoon \
  > "$HOME/mineops-emulator/diagnostics/package-path.txt"

adb logcat -d \
  > "$HOME/mineops-emulator/diagnostics/logcat.txt"

tar -czf "$HOME/mineops-emulator/mineops-poc-diagnostics.tar.gz" \
  -C "$HOME/mineops-emulator" diagnostics
```

Copy the diagnostic archive to your Mac:

```bash
scp YOUR_USERNAME@ubuntumac:~/mineops-emulator/mineops-poc-diagnostics.tar.gz .
```

> Android sandbox restrictions may prevent direct access to the app's private `/data/data/...` directory on a standard Google Play image. The POC's first objective is to prove emulator operation, game installation, repeatable launching, screenshots, package inspection, and whatever export/sync interfaces remain accessible without rooting the emulator.

---

# Phase 12 — Useful operating commands

## Start

```bash
"$HOME/mineops-emulator/start-poc.sh"
```

## Stop

```bash
"$HOME/mineops-emulator/stop-poc.sh"
```

## Check processes

```bash
ps aux | grep -E 'emulator|Xvfb|x11vnc|websockify' | grep -v grep
```

## Check ADB

```bash
adb devices
```

## Follow emulator logs

```bash
tail -f "$HOME/mineops-emulator/logs/emulator.log"
```

## Follow noVNC logs

```bash
tail -f "$HOME/mineops-emulator/logs/novnc.log"
```

## Find the host's LAN IP

```bash
hostname -I
```

## Reboot Android

```bash
adb reboot
```

## Gracefully stop only the emulator

```bash
adb emu kill
```

---

# Phase 13 — Troubleshooting

## `KVM acceleration can NOT be used`

Run:

```bash
kvm-ok
ls -l /dev/kvm
groups
```

Common causes:

- Virtualization is disabled in BIOS/UEFI.
- Your account is not in the `kvm` group.
- You did not log out and back in after adding the group.
- Ubuntu itself is running inside a VM without nested virtualization.
- Another hypervisor has exclusive control of virtualization.

---

## `Permission denied: /dev/kvm`

Run:

```bash
sudo usermod -aG kvm "$USER"
```

Then fully log out and back in.

Temporary diagnostic only:

```bash
sudo chown root:kvm /dev/kvm
sudo chmod 660 /dev/kvm
```

Do not use `chmod 666 /dev/kvm` as the permanent solution.

---

## Emulator exits immediately

Check:

```bash
tail -200 "$HOME/mineops-emulator/logs/emulator.log"
```

Try starting it manually:

```bash
export DISPLAY=:99

emulator @mineops-poc \
  -gpu swiftshader_indirect \
  -no-audio \
  -no-boot-anim \
  -no-snapshot \
  -feature -Vulkan \
  -verbose
```

---

## Browser cannot reach noVNC

Confirm the service is listening:

```bash
ss -lntp | grep 6080
```

Check the host IP:

```bash
hostname -I
```

Check UFW:

```bash
sudo ufw status
```

Check logs:

```bash
cat "$HOME/mineops-emulator/logs/novnc.log"
```

Try both paths:

```text
http://UBUNTUMAC_IP:6080/vnc.html
http://UBUNTUMAC_IP:6080/vnc_lite.html
```

---

## Browser shows only a black screen

Check all display components:

```bash
ps aux | grep -E 'Xvfb|x11vnc|emulator' | grep -v grep
```

Check the Xvfb log:

```bash
cat "$HOME/mineops-emulator/logs/xvfb.log"
```

Check the emulator log:

```bash
tail -200 "$HOME/mineops-emulator/logs/emulator.log"
```

Restart the complete stack:

```bash
"$HOME/mineops-emulator/stop-poc.sh"
"$HOME/mineops-emulator/start-poc.sh"
```

---

## `adb` reports `offline`

Restart ADB:

```bash
adb kill-server
adb start-server
adb devices
```

Then restart the emulator if necessary:

```bash
"$HOME/mineops-emulator/stop-poc.sh"
"$HOME/mineops-emulator/start-poc.sh"
```

---

## The emulator is very slow

Confirm KVM:

```bash
emulator -accel-check
```

Check host resources:

```bash
free -h
nproc
df -h
```

Check whether the emulator has KVM open:

```bash
sudo lsof /dev/kvm
```

For the initial POC, software GPU rendering is intentional:

```text
-gpu swiftshader_indirect
```

This avoids depending on a physical desktop GPU but may reduce graphics performance. Once the POC works, GPU configuration can be optimized separately.

---

## `pixel_7` is not a valid device

List exact device IDs:

```bash
avdmanager list device
```

Then create the AVD using an available Pixel ID:

```bash
echo "no" | avdmanager create avd \
  --force \
  --name "mineops-poc" \
  --package "system-images;android-35;google_apis_playstore;x86_64" \
  --device "AVAILABLE_DEVICE_ID"
```

---

## The Google Play image is not listed

Refresh package metadata:

```bash
sdkmanager --update
sdkmanager --list | grep -i "google_apis_playstore.*x86_64"
```

Choose a listed API level and replace `android-35` consistently in the install and AVD creation commands.

---

# POC success checklist

The proof of concept is successful when all of these are true:

- [ ] Ubuntu Server remains headless; no full desktop is installed.
- [ ] `kvm-ok` says KVM acceleration is available.
- [ ] `emulator -accel-check` reports usable acceleration.
- [ ] `adb devices` shows the emulator as `device`.
- [ ] The emulator screen opens from your Mac through noVNC.
- [ ] Google Play opens.
- [ ] Idle Miner Tycoon installs and launches.
- [ ] ADB finds `com.fluffyfairygames.idleminertycoon`.
- [ ] CLI screenshots work.
- [ ] The emulator retains the installed game after a stop/start.
- [ ] We can identify the exact data acquisition or sync route MineOps will automate.

---

# What comes after the POC

Do not automate this yet. First prove that the game runs reliably.

After the checklist passes, the productionized version should add:

1. A dedicated Linux service account.
2. Password-protected or SSH-tunneled noVNC.
3. A `systemd` service for the emulator stack.
4. Health checks and automatic recovery.
5. Persistent structured logs.
6. A MineOps capture/sync worker.
7. An authenticated API between UbuntuMac and MineOpsWeb.
8. A scheduled catalog/version check.
9. Backup of the AVD state before upgrades.
10. Docker only for the MineOps API/worker components where it improves deployment; keep the emulator native unless testing proves containerization is beneficial.

---

# Official references

- Android command-line tools download:
  https://developer.android.com/studio
- `sdkmanager`:
  https://developer.android.com/tools/sdkmanager
- `avdmanager`:
  https://developer.android.com/tools/avdmanager
- Android Emulator command line:
  https://developer.android.com/studio/run/emulator-commandline
- Emulator acceleration and KVM:
  https://developer.android.com/studio/run/emulator-acceleration
- Ubuntu KVM installation background:
  https://help.ubuntu.com/community/KVM/Installation
