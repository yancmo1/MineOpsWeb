# ubuntumac capture bridge

The bridge is outbound-only: ADB reads the game save, hashes and validates the raw payload, queues failures locally, then uploads HTTPS to the PocketBase capture route with a dedicated token. It must never modify the save or use an admin token. Configure package name, ADB serial, production URL, capture client ID and token through environment variables; use dry-run before enabling watch mode. A systemd unit should run the one-shot/watch CLI under a dedicated user.
