#!/usr/bin/env node

console.error(
  "This direct production CORS mutation helper is retired. Apply reviewed server configuration through "
    + "the documented infra-new deployment workflow with environment-provided credentials.",
);
process.exitCode = 2;
