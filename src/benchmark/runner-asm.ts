import * as FS from "node:fs/promises";
import asc from "assemblyscript/asc";
import * as loader from "@assemblyscript/loader";
import type { _BinaryenModuleSetFieldName } from "types:assemblyscript/src/glue/binaryen";

// const PHASE_1_ITERATIONS = 100;
// const PHASE_2_ITERATIONS = 1_000;

const compile = async () => {
  const fs = new Map();
  const pixelSrc = await FS.readFile("./asm/asm-pixel.ts", "utf8");
  const result = await asc.main(
    [
      "pixel.ts",
      "--outFile",
      "pixel.wasm",
      "-Ospeed",
      "--optimizeLevel=3",
      "--converge",
      "--noAssert",
      "--uncheckedBehavior=always",
    ],
    {
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
    },
  );

  const buffer: Buffer = (result.stderr as any).toBuffer();
  const decoder = new TextDecoder();
  console.error(decoder.decode(buffer));

  if (result.error) {
    throw new Error(`Failed to compile`);
  }

  const rom$ = fs.get("pixel.wasm");
  const rom = await loader.instantiate(rom$, {});
  return rom.exports as any as {
    time: () => number;
  };
};

// function time(run: (t: number, h: number) => number): void {
//   let h = 0xdeadbeef;
//   let time = 0;

//   for (let i = 0; i < PHASE_1_ITERATIONS; i++) {
//     time -= performance.now();
//     h = run(i, h);
//     time += performance.now();
//   }
//   console.log(
//     `Phase 1: iterations = ${PHASE_1_ITERATIONS}, time = ${(time / 1000).toFixed(2).padStart(6, "0")}, h=${h}`,
//   );

//   for (let i = 0; i < PHASE_2_ITERATIONS; i++) {
//     time -= performance.now();
//     h = run(i, h);
//     time += performance.now();
//   }

//   console.log(
//     `Phase 2: iterations = ${PHASE_2_ITERATIONS}, time = ${(time / 1000).toFixed(2).padStart(6, "0")}, h=${h}`,
//   );
// }

export async function main() {
  const { time } = await compile();
  console.time("running ASM");
  time();
  console.timeEnd("running ASM");
}
