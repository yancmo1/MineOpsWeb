# Backup and restore

Back up PostgreSQL plus ingestion/upload storage before upgrades and imports. Target retention is daily 14 days, weekly 8 weeks, and monthly 12 months unless the server guide replaces it. A restore test must use a clean environment, verify schema/version, log the outcome, and retain the source backup unchanged.
