# Capture workflow

Capture files stay on `ubuntumac`; the agent never deletes source files. The intended flow is Android emulator → local extraction → `mineops-ingest validate` → HTTPS upload → staged catalog review → validation → explicit activation. Capture payloads must be treated as untrusted input and retained according to the server-guide backup policy.

Accepted uploads now persist immutable provenance rows with release ID, schema and engine versions, configuration hash, input hashes, object counts, payload size, and validation summary. Inline artifact fields larger than 256 KiB are converted to manifest-only evidence so the staged catalog snapshot keeps the extracted data without storing binary APK blobs in the API database.
