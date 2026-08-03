#!/usr/bin/env node

console.error(
  "This direct production hash mutation helper is retired. Manifest hashes are immutable; generate and "
    + "review a replacement candidate instead.",
);
process.exitCode = 2;
