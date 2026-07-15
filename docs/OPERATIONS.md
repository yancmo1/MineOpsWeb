# Operations

Monitor `/api/health`, Docker health, PocketBase logs, disk usage and capture queue age. Take a nightly PocketBase backup plus a weekly off-server copy. Before schema or image upgrades, stop writes, take a backup, apply migrations, verify health and test a representative login/import. Roll back to the prior image and volume backup if validation fails.
