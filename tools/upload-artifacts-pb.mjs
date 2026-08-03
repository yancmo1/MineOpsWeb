#!/usr/bin/env node

/**
 * Retired uploader.
 *
 * Catalog artifacts are served byte-for-byte from the Oracle read-only
 * artifact mount. Uploading JSON into PocketBase file records is not part of
 * the supported immutable publication path and previously encouraged direct
 * production mutations.
 *
 * Use the documented staged copy, validation, review, and publication-pointer
 * workflow after explicit production approval. Credentials must come from the
 * environment and must never be embedded in repository scripts.
 */

console.error(
  "This direct PocketBase file uploader is retired. "
    + "Use the immutable artifact-mount workflow documented in "
    + "docs/deployment/oracle-server-manifest.md.",
);
process.exitCode = 2;
