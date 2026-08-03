#!/usr/bin/env node

console.error(
  "This direct production hash updater is retired. A manifest hash is immutable; generate a replacement "
    + "candidate and publish it only through the reviewed workflow.",
);
process.exitCode = 2;
