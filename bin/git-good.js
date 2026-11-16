#!/usr/bin/env node

const program = require("../src/index.js");

program.parseAsync(process.argv).catch((error) => {
  console.error(`Unable to start git-good: ${error.message}`);
  process.exitCode = 1;
});
