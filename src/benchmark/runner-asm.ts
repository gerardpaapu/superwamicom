import * as FS from "node:fs/promises";
import asc from "assemblyscript/asc";
import * as loader from "@assemblyscript/loader";
import type { _BinaryenModuleSetFieldName } from "types:assemblyscript/src/glue/binaryen";

const compile = async (src: string) => {
  const fs = new Map();
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
      "--enable=simd",
      "--enable=relaxed-simd",
      "--runtime=stub",
    ],
    {
      readFile: async (filename) => {
        if (filename.endsWith(".json")) {
          return JSON.stringify({});
        }
        return src;
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

export async function main() {
  const pixelSrc = await FS.readFile("./asm/asm-pixel.ts", "utf8");
  const { time } = await compile(pixelSrc);
  console.time("running ASM");
  let h = time();
  console.timeEnd("running ASM");
  console.log(h);
}
