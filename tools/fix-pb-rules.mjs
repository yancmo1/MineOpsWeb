#!/usr/bin/env node

console.error(
  "This direct PocketBase rule mutation helper is retired. Apply additive reviewed migrations through the "
    + "documented infra-new deployment workflow.",
);
process.exitCode = 2;
