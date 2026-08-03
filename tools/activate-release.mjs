#!/usr/bin/env node

console.error(
  "This hook-bypassing activation helper is retired. Use the reviewed, "
    + "role-authorized tools/validation/publish-release.mjs workflow after explicit production approval.",
);
process.exitCode = 2;
