# Capture workflow

Capture files stay on `ubuntumac`; the agent never deletes source files. The intended flow is Android emulator → local extraction → `mineops-ingest validate` → HTTPS upload → staged catalog review → validation → explicit activation. Capture payloads must be treated as untrusted input and retained according to the server-guide backup policy.
