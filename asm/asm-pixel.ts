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

const PI_K = u32(Mathf.PI * 1_000);
const SIN_K = new StaticArray<f32>(PI_K);

for (let i: u32 = 0; i < PI_K; i++) {
  SIN_K[i] = Mathf.sin(f32(i) / 1000);
}

const INV_HEIGHT = 0.005;
const INV_WIDTH_2 = 0.00625;

function calculatePixel(x: u32, y: u32, t: u32): u8 {
  const theta = u32(f32(PI_K * 10 * y) * INV_HEIGHT);
  const jitter = SIN_K[theta % PI_K] * f32(y) * 50 * INV_HEIGHT * INV_WIDTH_2;
  const scaled_x = f32(PI_K * x) * INV_WIDTH_2;
  const theta2 = u32(scaled_x + jitter + f32(t) * 0.03);
  const height = SIN_K[theta2 % PI_K] * 0.5;

  return min<u8>(15, u8(16 * (y * INV_HEIGHT - height)));
}

const SCREEN_WIDTH: u32 = 320;
const SCREEN_HEIGHT: u32 = 200;
const HALF_SCREEN_WIDTH: u32 = 160;
const PHASE_2_ITERATIONS = 1_000;

const wamicom_buffer = new StaticArray<u8>(SCREEN_HEIGHT * HALF_SCREEN_WIDTH);
const output = new StaticArray<u8>(SCREEN_HEIGHT * SCREEN_WIDTH * 4);

export function get_buffer(): StaticArray<u8> {
  return wamicom_buffer;
}

export function update_buffer(t: u32): void {
  for (let y: u32 = 0; y < SCREEN_HEIGHT; y++) {
    for (let xh: u32 = 0; xh < HALF_SCREEN_WIDTH; xh++) {
      const i: u32 = y * HALF_SCREEN_WIDTH + xh;
      const p1 = calculatePixel(xh * 2 + 0, y, t) & 0xf;
      const p2 = calculatePixel(xh * 2 + 1, y, t) & 0xf;
      wamicom_buffer[i] = (p1 << 4) | p2;
    }
  }
}

export function run(t: u32, h: i32): i32 {
  for (let y: u32 = 0; y < SCREEN_HEIGHT; y++) {
    for (let xh: u32 = 0; xh < HALF_SCREEN_WIDTH; xh++) {
      const i: u32 = y * HALF_SCREEN_WIDTH + xh;
      const p1 = calculatePixel(xh * 2 + 0, y, t) & 0xf;
      const p2 = calculatePixel(xh * 2 + 1, y, t) & 0xf;
      wamicom_buffer[i] = (p1 << 4) | p2;
    }
  }

  decodeNibbles();
  return check(h);
}

function check(n: i32 = 0xdeadbeef): i32 {
  for (let i = 0; i < output.length; i++) {
    n = n * 31 + output[i];
  }
  return n;
}

function decodeNibbles(): void {
  for (let y: u32 = 0; y < SCREEN_HEIGHT; y++) {
    for (let xh: u32 = 0; xh < HALF_SCREEN_WIDTH; xh++) {
      const x = xh * 2;
      const j = y * HALF_SCREEN_WIDTH + xh;
      const i = (y * SCREEN_WIDTH + x) * 4;

      const highNibble = wamicom_buffer[j] >>> 4;
      const lowNibble = wamicom_buffer[j] & 0xf;

      const color_1 = BEACH_DAY_PALETTE[highNibble];
      const color_2 = BEACH_DAY_PALETTE[lowNibble];

      output[i + 0] = u8(color_1 >>> 16);
      output[i + 1] = u8(color_1 >>> 8);
      output[i + 2] = u8(color_1 >>> 0);
      output[i + 3] = 0xff; // alpha

      output[i + 4] = u8(color_2 >>> 16);
      output[i + 5] = u8(color_2 >>> 8);
      output[i + 6] = u8(color_2 >>> 0);
      output[i + 7] = 0xff; // alpha
    }
  }
}

export function time(): i32 {
  let h: i32 = 0xdeadbeef;
  // let time: f64 = 0;

  // for (let i = 0; i < PHASE_1_ITERATIONS; i++) {
  //   h = run(i, h);
  // }
  // console.log(
  //   `Phase 1: iterations = ${PHASE_1_ITERATIONS}, time = ${(time / 1000).toFixed(2).padStart(6, "0")}, h=${h}`,
  // );

  for (let i = 0; i < PHASE_2_ITERATIONS; i++) {
    // time -= performance.now();
    h = run(i, h);
    // time += performance.now();
  }

  // console.log(
  //   `Phase 2: iterations = ${PHASE_2_ITERATIONS}, time = ${(time / 1000).toFixed(2).padStart(6, "0")}, h=${h}`,
  // );

  return h;
}
