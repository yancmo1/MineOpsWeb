# Catalog validation

Every ingestion payload produces an immutable staged snapshot keyed by its source hash. Snapshot activation is explicit. The next milestone adds schema checks, duplicate and orphan detection, field-by-field diffs, severity and resolution tracking, and rollback through activation history. Never mutate an active snapshot to correct it—ingest a replacement.

The current API persists validation outcomes separately from the raw-import provenance row. That means a snapshot can move from `staged` to `reviewed` to `published` without mutating the underlying capture evidence, and duplicate release IDs can safely return the existing staged version.
