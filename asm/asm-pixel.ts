const BEACH_DAY_PALETTE = StaticArray.fromArray<u32>([
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
]);

function calculatePixel(x: u32, y: u32, t: u32): u8 {
  return u8(x * y * y * t) % 16;
}

const SCREEN_WIDTH: u32 = 320;
const SCREEN_HEIGHT: u32 = 200;
const HALF_SCREEN_WIDTH: u32 = 160;

const wamicom_buffer = new StaticArray<u8>(SCREEN_HEIGHT * HALF_SCREEN_WIDTH);
const output = new StaticArray<u8>(SCREEN_HEIGHT * SCREEN_WIDTH * 4);

export function run(t: u32, h: u32): u32 {
  for (let y: u32 = 0; y < SCREEN_HEIGHT; y++) {
    for (let xh: u32 = 0; xh < HALF_SCREEN_WIDTH; xh++) {
      const i: u32 = y * HALF_SCREEN_WIDTH + xh;
      const p1 = calculatePixel(xh * 2 + 0, y, t) & 0xf;
      const p2 = calculatePixel(xh * 2 + 1, y, t) & 0xf;
      unchecked((wamicom_buffer[i] = (p1 << 4) | p2));
    }
  }

  decodeNibbles();
  return check(h);
}

function check(n: u32 = 0xdeadbeef): u32 {
  for (let i = 0; i < output.length; i++) {
    n = n * 31 + unchecked(output[i]);
  }
  return n;
}

function decodeNibbles(): void {
  for (let y: u32 = 0; y < SCREEN_HEIGHT; y++) {
    for (let xh: u32 = 0; xh < HALF_SCREEN_WIDTH; xh++) {
      const x = xh * 2;
      const j = y * HALF_SCREEN_WIDTH + xh;
      const i = (y * SCREEN_WIDTH + x) * 4;

      const highNibble = unchecked(wamicom_buffer[j] >>> 4);
      const lowNibble = unchecked(wamicom_buffer[j] & 0xf);

      const color_1 = unchecked(BEACH_DAY_PALETTE[highNibble]);
      const color_2 = unchecked(BEACH_DAY_PALETTE[lowNibble]);

      unchecked((output[i + 0] = u8(color_1 >>> 16)));
      unchecked((output[i + 1] = u8(color_1 >>> 8)));
      unchecked((output[i + 2] = u8(color_1 >>> 0)));
      unchecked((output[i + 3] = 0xff)); // alpha

      unchecked((output[i + 4] = u8(color_2 >>> 16)));
      unchecked((output[i + 5] = u8(color_2 >>> 8)));
      unchecked((output[i + 6] = u8(color_2 >>> 0)));
      unchecked((output[i + 7] = 0xff)); // alpha
    }
  }
}
