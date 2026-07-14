# Catalog validation

Every ingestion payload produces an immutable staged snapshot keyed by its source hash. Snapshot activation is explicit. The next milestone adds schema checks, duplicate and orphan detection, field-by-field diffs, severity and resolution tracking, and rollback through activation history. Never mutate an active snapshot to correct it—ingest a replacement.
