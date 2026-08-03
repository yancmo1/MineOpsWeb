#!/usr/bin/env node

console.error(
  "This direct production storage mutation helper is retired. Update release storage through the reviewed, "
    + "environment-authenticated publication workflow.",
);
process.exitCode = 2;
