const INV_HEIGHT: f32 = 0.005;
const INV_WIDTH_2: f32 = 0.00625;

function calculatePixel(x: u32, y: u32, t: u32): u8 {
  const scaled_x = f32(x) * INV_WIDTH_2;
  const scaled_y = f32(y) * INV_HEIGHT;

  // Mathf.sin operates on f32 values
  const xx = Mathf.sin(2 * Mathf.PI * scaled_x + f32(t) * 0.007) * 0.5 + 0.5;
  return u8(16 * (xx - scaled_y)) % 16;
}

const SCREEN_HEIGHT: u32 = 200;
const HALF_SCREEN_WIDTH: u32 = 160;

// Each pixel in superwamicom is a nibble so the video buffer
// size is HEIGHT x WIDTH x 4 bits.
const vBuffer = new StaticArray<u8>(SCREEN_HEIGHT * HALF_SCREEN_WIDTH);

export function get_buffer(): StaticArray<u8> {
  return vBuffer;
}

export function update_buffer(t: u32): void {
  for (let y: u32 = 0; y < SCREEN_HEIGHT; y++) {
    for (let xh: u32 = 0; xh < HALF_SCREEN_WIDTH; xh++) {
      const i: u32 = y * HALF_SCREEN_WIDTH + xh;
      const p1 = calculatePixel(xh * 2 + 0, y, t) & 0xf;
      const p2 = calculatePixel(xh * 2 + 1, y, t) & 0xf;

      // superwamicom expects two pixels per byte
      vBuffer[i] = (p1 << 4) | p2;
    }
  }
}
