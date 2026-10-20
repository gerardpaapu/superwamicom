import palette from "../palette/beach-day.ts";

const SCREEN_WIDTH = 320;
const SCREEN_HEIGHT = 200;
const HALF_SCREEN_WIDTH = 160;
const PHASE_1_ITERATIONS = 100;
const PHASE_2_ITERATIONS = 1_000;

const time = () => {
  // the wamicom buffer is in nibbles/pixel
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
};

function run(t: number, h: number): number {
  const wamicom_buffer = new Uint8ClampedArray(SCREEN_HEIGHT * HALF_SCREEN_WIDTH);

  for (let y = 0; y < SCREEN_HEIGHT; y++) {
    for (let xh = 0; xh < HALF_SCREEN_WIDTH; xh++) {
      const i = y * HALF_SCREEN_WIDTH + xh;
      const p1 = calculatePixel(xh * 2 + 0, y, t) & 0xf;
      const p2 = calculatePixel(xh * 2 + 1, y, t) & 0xf;
      wamicom_buffer[i] = (p1 << 4) | p2;
    }
  }

  const output = new Uint8ClampedArray(SCREEN_HEIGHT * SCREEN_WIDTH * 4);
  decodeNibbles(wamicom_buffer, output);

  return check(output, h);
}

// I just want to make sure we're "using" the memory so a compiler can't delete all the code
function check(img: Uint8ClampedArray, n = 0xdeadbeef): number {
  for (let i = 0; i < img.length; i++) {
    n = (Math.imul(n, 31) + img[i]) >>> 0;
  }
  return n;
}

function decodeNibbles(wamicom_buffer: Uint8ClampedArray, output: Uint8ClampedArray): void {
  for (let y = 0; y < SCREEN_HEIGHT; y++) {
    for (let xh = 0; xh < HALF_SCREEN_WIDTH; xh++) {
      const x = xh * 2;
      const j = y * HALF_SCREEN_WIDTH + xh;
      const i = (y * SCREEN_WIDTH + x) * 4;

      const highNibble = wamicom_buffer[j] >>> 4;
      const lowNibble = wamicom_buffer[j] & 0xf;
      const color_1 = palette[highNibble] as number;
      const color_2 = palette[lowNibble] as number;

      output[i + 0] = (color_1 >>> 16) & 0xff;
      output[i + 1] = (color_1 >>> 8) & 0xff;
      output[i + 2] = (color_2 >>> 0) & 0xff;
      output[i + 3] = 0xff; // alpha

      output[i + 4] = (color_2 >>> 16) & 0xff;
      output[i + 5] = (color_2 >>> 8) & 0xff;
      output[i + 6] = (color_2 >>> 0) & 0xff;
      output[i + 7] = 0xff; // alpha
    }
  }
}

const clamp = (a: number, n: number, x: number) => Math.min(Math.max(a, n), x);
const toColor = (x: number) => clamp(Math.floor(x), 0, 15);
function calculatePixel(x: number, y: number, t: number): number {
  const scaled_y = y / 200;
  const jitter = Math.sin(Math.PI * 10 * scaled_y) * 50 * scaled_y;
  const scaled_x = (Math.PI * x + jitter) / 160;

  const height = (Math.sin(scaled_x + t * 0.03) + 1) * 0.5;

  return toColor(16 * (scaled_y - height));
}
export async function main() {
  time();
}
