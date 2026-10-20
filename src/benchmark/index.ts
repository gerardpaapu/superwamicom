import { main as runAsm } from "./runner-asm.ts";
import { main as runJs } from "./runner-js.ts";

export async function main() {
  console.log(`ASM calculatePixel`);
  await runAsm();
  console.log(`JS  calculatePixel`);
  await runJs();
}
