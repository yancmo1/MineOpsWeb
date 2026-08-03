#!/usr/bin/env node

console.error(
  "This production exercise helper is retired. Exercise the review/publish state machine with local tests, "
    + "then use the env-authenticated reviewed workflow after explicit production approval.",
);
process.exitCode = 2;
