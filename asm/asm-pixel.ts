const BEACH_DAY_PALETTE = [
  0x201127, // 0  - Deep Eggplant / Shadow
  0x331e38, // 1  - Dark Purple
  0x703d50, // 2  - Plum / Rose
  0xa0585a, // 3  - Dusty Rust
  0xd67b6b, // 4  - Coral / Terracotta
  0xe89d7d, // 5  - Warm Peach
  0xf7c49b, // 6  - Sandy Ochre
  0xfbe8be, // 7  - Soft Cream / Highlights
  0x1d202d, // 8  - Dark Navy
  0x283d52, // 9  - Slate Blue
  0x3e6677, // 10 - Muted Teal
  0x5c989b, // 11 - Seafoam Green
  0x8bc2a8, // 12 - Soft Sage
  0xc4e3b1, // 13 - Pale Lime
  0x72506e, // 14 - Muted Mauve
  0xf18985, // 15 - Bright Salmon
] as u32[];

function clamp(a: u8, n: u8, x: u8): u8 {
  return a > n ? n : a < x ? x : a;
}

function toColor(x: u8): u8 {
  return clamp(Math.floor(x) as u8, 0, 15);
}

function calculatePixel(x: u32, y: u32, t: u32): u8 {
  const scaled_y = y / 200;
  const jitter = Math.sin(Math.PI * 10 * scaled_y) * 50 * scaled_y;
  const scaled_x = (Math.PI * x + jitter) / 160;

  const height = (Math.sin(scaled_x + t * 0.03) + 1) * 0.5;

  return toColor((16 * (scaled_y - height)) as u8);
}

const SCREEN_WIDTH: u32 = 320;
const SCREEN_HEIGHT: u32 = 200;
const HALF_SCREEN_WIDTH: u32 = 160;

export function run(t: u32, h: u32): u32 {
  const wamicom_buffer = new Uint8ClampedArray(SCREEN_HEIGHT * HALF_SCREEN_WIDTH);
  for (let y: u32 = 0; y < SCREEN_HEIGHT; y++) {
    for (let xh: u32 = 0; xh < HALF_SCREEN_WIDTH; xh++) {
      const i: u32 = y * HALF_SCREEN_WIDTH + xh;
      const p1 = calculatePixel((xh * 2 + 0) as u32, y, t) & 0xf;
      const p2 = calculatePixel((xh * 2 + 1) as u32, y, t) & 0xf;
      wamicom_buffer[i] = (p1 << 4) | p2;
    }
  }

  const output = new Uint8ClampedArray(SCREEN_HEIGHT * SCREEN_WIDTH * 4);
  decodeNibbles(wamicom_buffer, output);
  return check(output, h);
}

// I just want to make sure we're "using" the memory so a compiler can't delete all the code
function check(img: Uint8ClampedArray, n: u32 = 0xdeadbeef): u32 {
  for (let i = 0; i < img.length; i++) {
    n = n * 31 + img[i];
  }
  return n;
}

function decodeNibbles(
  wamicom_buffer: Uint8ClampedArray,
  destination_buffer: Uint8ClampedArray,
): void {
  for (let y: u32 = 0; y < SCREEN_HEIGHT; y++) {
    for (let xh: u32 = 0; xh < HALF_SCREEN_WIDTH; xh++) {
      const x = xh * 2;
      const j = y * HALF_SCREEN_WIDTH + xh;
      const i = (y * SCREEN_WIDTH + x) * 4;

      const highNibble = wamicom_buffer[j] >>> 4;
      const lowNibble = wamicom_buffer[j] & 0xf;
      const color_1 = BEACH_DAY_PALETTE[highNibble] as u32;
      const color_2 = BEACH_DAY_PALETTE[lowNibble] as u32;

      destination_buffer[i + 0] = (color_1 >>> 16) & 0xff;
      destination_buffer[i + 1] = (color_1 >>> 8) & 0xff;
      destination_buffer[i + 2] = (color_2 >>> 0) & 0xff;
      destination_buffer[i + 3] = 0xff; // alpha

      destination_buffer[i + 4] = (color_2 >>> 16) & 0xff;
      destination_buffer[i + 5] = (color_2 >>> 8) & 0xff;
      destination_buffer[i + 6] = (color_2 >>> 0) & 0xff;
      destination_buffer[i + 7] = 0xff; // alpha
    }
  }
}
