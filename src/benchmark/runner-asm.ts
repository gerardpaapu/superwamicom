import * as FS from "node:fs/promises";
import asc from "assemblyscript/asc";
import * as loader from "@assemblyscript/loader";
import type { _BinaryenModuleSetFieldName } from "types:assemblyscript/src/glue/binaryen";

const PHASE_1_ITERATIONS = 100;
const PHASE_2_ITERATIONS = 1_000;

const compile = async () => {
  const fs = new Map();
  const pixelSrc = await FS.readFile("./asm/asm-pixel.ts", "utf8");
  await asc.main(["pixel.ts", "--outFile", "pixel.wasm", "--optimize", "--stats"], {
    readFile: async (filename) => {
      if (filename.endsWith(".json")) {
        return JSON.stringify({});
      }
      return pixelSrc;
    },

    writeFile: async (filename, contents) => {
      fs.set(filename, contents);
    },

    listFiles: async () => {
      return ["pixel.ts"];
    },
  });

  const rom$ = fs.get("pixel.wasm");
  const rom = await loader.instantiate(rom$, {});
  const { run } = rom.exports;
  return run as () => number;
};

function time(run: (t: number, h: number) => number): void {
  let h = 0xdeadbeef;
  let time = 0;

  for (let i = 0; i < PHASE_1_ITERATIONS; i++) {
    time -= performance.now();
    h = run(i, h);
    time += performance.now();
  }
  console.log(
    `Phase 1: iterations = ${PHASE_1_ITERATIONS}, time = ${(time / 1000).toFixed(2).padStart(6, "0")}, h=${h}`,
  );

  for (let i = 0; i < PHASE_2_ITERATIONS; i++) {
    time -= performance.now();
    h = run(i, h);
    time += performance.now();
  }

  console.log(
    `Phase 2: iterations = ${PHASE_2_ITERATIONS}, time = ${(time / 1000).toFixed(2).padStart(6, "0")}, h=${h}`,
  );
}

export async function main() {
  const run = await compile();
  time(run);
}
