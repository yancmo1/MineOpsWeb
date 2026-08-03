#!/usr/bin/env node

console.error(
  "This direct collection-creation helper is retired. Apply additive, reviewed PocketBase migrations "
    + "through the documented infra-new deployment workflow.",
);
process.exitCode = 2;
