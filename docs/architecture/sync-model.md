# Sync model

The browser stores primary user data in IndexedDB. An offline edit is written locally and added to the mutation queue in one logical client action. On reconnect, the queue is sent with a client device ID, stable record IDs, known revisions, and an `Idempotency-Key` header. The server accepts a retry only once and rejects a stale revision with HTTP 409 plus the current record. The UI must retain queued data until a successful response; it must never silently use last-write-wins for progression fields.
