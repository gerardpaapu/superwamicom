#!/usr/bin/env -S node --experimental-strip-types
import { main } from "./src/benchmark/index.ts";

main().catch((e) => {
  console.error(e);
  process.exitCode = 0;
});
