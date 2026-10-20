import asc from "assemblyscript/asc";
import * as loader from "@assemblyscript/loader";
import type { _BinaryenModuleSetFieldName } from "types:assemblyscript/src/glue/binaryen";

export interface AsmRawModule {
  update_buffer(t: number): void;
  get_buffer(): number;
}

export interface AsmModule {
  update_buffer(t: number): void;
  get_buffer(): Uint8Array;
}

const LENGTH = 160 * 200;

export async function compile(src: string): Promise<AsmModule> {
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
      "--bindings esm",
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

  // const buffer: Buffer = (result.stderr as any).toBuffer();
  // const decoder = new TextDecoder();
  // console.error(decoder.decode(buffer));

  if (result.error) {
    const buffer = (result.stderr as any).toBuffer();
    const decoder = new TextDecoder();
    console.error(decoder.decode(buffer));
    throw new Error(`Failed to compile`);
  }

  const rom$ = fs.get("pixel.wasm");
  const rom = await loader.instantiate(rom$, {});
  const memory = rom.exports.memory;
  const exports = rom.exports as any as AsmRawModule;
  if (!memory) {
    throw new Error();
  }

  return {
    update_buffer(t: number) {
      exports.update_buffer(t);
    },
    get_buffer(): Uint8Array {
      let ptr = exports.get_buffer();
      return new Uint8Array(memory.buffer, ptr, LENGTH);
    },
  };
}
