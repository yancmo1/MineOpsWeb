# ubuntumac capture bridge

The bridge is outbound-only: ADB reads the game save, hashes and validates the raw payload, queues failures locally, then uploads HTTPS to the PocketBase capture route with a dedicated token. It must never modify the save or use an admin token. Configure package name, ADB serial, production URL, capture client ID and token through environment variables; use dry-run before enabling watch mode. A systemd unit should run the one-shot/watch CLI under a dedicated user.

For the APK catalog refresh, UbuntuMac runs the biweekly MineOps wrapper from
`~/mineops-engine/scripts/weekly-mineops-update.sh`. It performs a fail-closed
Google Play freshness check before the existing acquisition pipeline and sends
success/failure email using the existing BingeBox Gmail configuration. The
checker recovers Android `isn't responding` dialogs, opens the explicit Play
Store app page, waits for the page to be ready, and taps `Update` when needed.
A stale or un-updatable emulator is never acquired or uploaded. If a biweekly
run fails, the following Sunday is automatically used as a retry window.
