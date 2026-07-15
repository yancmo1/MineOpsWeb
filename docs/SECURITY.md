# Security

Secrets are environment-only. PocketBase owns authentication and user-owned collection rules. Capture credentials are separate from user sessions and may only create raw imports. Kolibri credentials stay local to the browser; debug IDs and tokens are never committed or rendered unmasked. Production must terminate HTTPS and keep PocketBase admin/API ports private.
