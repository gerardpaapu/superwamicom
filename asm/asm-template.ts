const SCREEN_HEIGHT: i16 = 200;
const HALF_SCREEN_WIDTH: i16 = 160;
const SCREEN_WIDTH_DIV_32: i16 = 10;
const FIVE_ELEVENx8 = i16x8.splat(511);
const TWO_FIVE_SIXx8 = i16x8.splat(256);

// So first, you have to convince yourself that a parabola in the
// region centered on (0, 0) can basically look like a sine wave.
//
// The correct version of this would be something like this:
//
//   function sine(theta: number): number {
//     return (4 * theta / Math.PI) - (4 * theta * Math.abs(theta)) / (Math.PI ** 2);
//   }
//
// See it on desmos: https://www.desmos.com/calculator/cfkqimmgkz
//
// I want to do what I can in integers so:
//   1. We can't use PI, it's not an integer
//   2. We can only divide by powers of 2 (so they're bitshifts)
//
// That leads us to this shape: https://www.desmos.com/calculator/9s4tr5ixfi
//
//   function sine(theta: number): number {
//     return theta - (theta * Math.abs(theta)) / 256;
//   }
//
// Like I mentioned above we want our divisions to be bit shifts. If we just
// use a divide by 256 that would emit a bit shift just fine, but if we
// multiply theta by Math.abs(theta) we will often overflow so we split the
// division over two shifts: https://www.desmos.com/calculator/oflhlpehxo
//
//   function sine(theta: number): number {
//     return theta - ((theta >> 1) * Math.abs(theta)) >> 7;
//   }
//
// the final function is a straightforward translation of this to simd methods

// this is a parabola with that runs over 8 values and it sort of
// approximates sine but it's like 64 * sin(pi * x/256)
// it's all integer math so it's pretty fast
function approximatelySine(theta_x8: v128): v128 {
  const rhs = i16x8.shr_s(i16x8.mul(i16x8.shr_s(theta_x8, 1), i16x8.abs(theta_x8)), 7);
  return i16x8.sub(theta_x8, rhs);
}

// this does a row of 8 pixels as 4 bytes
function renderSubSegment(x: i16, y: i16, t: i16): v128 {
  const x8 = i16x8(x, x + 1, x + 2, x + 3, x + 4, x + 5, x + 6, x + 7);
  const t8 = i16x8.splat(t);

  const phase = i16x8.add(t8, x8);
  // phase is in ( 0 .. ) we need to map it to a range that suits our
  // sine approximation, i.e. -256 to 256:

  const phaseWrapped = v128.and(phase, FIVE_ELEVENx8);
  // we've masked out the high bits so that
  // phaseWrapped is in ( 0 .. 511 )

  const centeredPhase = i16x8.sub(phaseWrapped, TWO_FIVE_SIXx8);
  // then we subtract 256 so that
  // centeredPhase is in ( -256 .. 256 )

  const v0 = approximatelySine(centeredPhase);
  // v0 is i16x8 in ( -64 .. 64 )

  const v1 = i16x8.shr_u(i16x8.add(v0, i16x8.splat(264 - y)), 5);
  // we want to pick a color from the palette ( 0 .. 15 ), best we
  // can do on the cheap is add to get into the () 0 .. 328 ) then
  // divide by 32 (aka. shift right 5) so that
  // v1 is in ( 0 .. 10 )

  // so v1 is 8 i6s each with a color, but wamicom wants two pixels
  // packed in each byte.
  //
  // viewed as u32x4 we look at two integers at once, they each have
  // only 4 interesting bits in the least-significant nibble:
  //
  //   u32[0] = 000b000a or 000a 000b
  //
  // First we'll combine the pairs by shifting left 20-bits putting
  // our most significant nibble "a" in the 3rd nibble and combining
  // them with an or, i.e. (n << 20) | n
  //
  //   u32[0] = 00ab000a
  //   u16[0] = 000a
  //   u16[1] = 00ab
  //
  // now if we consider these as bytes they look like this, because
  // wasm is little-endian
  //
  //    u8[0] = 0a
  //    u8[1] = 00
  //    u8[2] = ab
  //    u8[3] = 00
  //
  // so the actual bytes we want out of this are at
  //
  //    u8[2], u8[6], u8[10], u[14]
  //
  return v128.or(i32x4.shl(v1, 20), v1);
}

// render a row of 32 pixels as 16 bytes
function renderSegment(x: i16, y: i16, t: i16): void {
  const v1 = renderSubSegment(x + 0, y, t);
  const v2 = renderSubSegment(x + 8, y, t);
  const v3 = renderSubSegment(x + 16, y, t);
  const v4 = renderSubSegment(x + 24, y, t);

  // in renderSubSegment we end up with a v128 with each pair of pixels encoded
  // as a single byte (u8) at these lanes:  u8[2], u8[6], u8[10], u[14]
  //
  // Shuffle takes two vectors (v128) and you can pick lanes out of them by index
  // and they get copied to a new v128.
  //
  // We're going to combine v1 and v2 into a lhs, v3 and v4 into rhs and
  // then combine lhs with rhs into our final vector of 32 pixels (16 bytes)

  // v1 is packed into the first quarter of lhs, the pixels are from bytes 2, 6, 10, 14 in v1
  // v2 is packed into the second quarter of rhs, we pick lanes out of the second argument by
  // adding 16 to the indexes we want, so it's byes: 18, 22, 26, and 30
  //
  // the second half is filled with byte 1 (the second) which we know is 00
  const lhs = v128.shuffle<u8>(v1, v2, 2, 6, 10, 14, 18, 22, 26, 30, 1, 1, 1, 1, 1, 1, 1, 1);
  // we do the same process to merge v3 and v4 into rhs, but we fill the second half (the right
  // hand side).
  const rhs = v128.shuffle<u8>(v3, v4, 1, 1, 1, 1, 1, 1, 1, 1, 2, 6, 10, 14, 18, 22, 26, 30);
  // so the second half of lhs is all zeroes and the first half of rhs is all zeroes, we can
  // combine these into our final result with one bitwise or
  const v = v128.or(lhs, rhs);

  // now we can store the whole vector with one SIMD instruction
  let i = (x >>> 1) + y * HALF_SCREEN_WIDTH;
  v128.store(changetype<usize>(vBuffer) + i, v);
}

// Each pixel in superwamicom is a nibble so the video buffer
// size is HEIGHT x WIDTH x 4 bits.
const vBuffer = new StaticArray<u8>(SCREEN_HEIGHT * HALF_SCREEN_WIDTH);

export function get_buffer(): StaticArray<u8> {
  return vBuffer;
}

export function update_buffer(t: i16): void {
  let max_y = SCREEN_HEIGHT;
  let max_x = SCREEN_WIDTH_DIV_32;

  for (let y: i16 = 0; y < max_y; y++) {
    for (let x: i16 = 0; x < max_x; x++) {
      renderSegment(x * 32, y, t);
    }
  }
}
