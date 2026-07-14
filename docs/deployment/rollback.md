# Rollback

Keep the previous immutable frontend/API image tag and a verified pre-deployment database backup. If health checks fail after deployment, stop the new application containers, restore the previous tags, confirm API readiness, and only restore the database when the migration is not backward compatible. Preserve queued client changes by keeping the API compatible through the rollback window.
