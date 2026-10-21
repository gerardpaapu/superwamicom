const SCREEN_HEIGHT: u32 = 200;
const HALF_SCREEN_WIDTH: u32 = 160;
const QUARTER_SCREEN_WIDTH: u32 = 80;

const INV_HEIGHT: f32 = 0.005;
// const INV_WIDTH_2: f32 = 0.00625;

// Mathf.PI is PI as a 32-bit float (f32)
const TWO_PIx4 = f32x4.splat(2 * Mathf.PI);
const INV_TWO_PIx4 = f32x4.splat(1.0 / (2 * Mathf.PI));
const NEG_PIx4 = f32x4.splat(-Mathf.PI + 0.0);

// So there's this thing called a taylor/maclaurin series (?) that can approximate functions
// since we can do each part (addition, multiplication, etc) in parallel, we can do the whol
// thing over 4 values simulataneously
// https://en.wikipedia.org/wiki/Taylor_series#Trigonometric_functions
//
// TODO: apparently parabola is a better approximation for this
//
// sin(x) ~= x - (x^3/fac(3)) + (x^5/fac(5)) - (x^7/fac(7)) + ...
// fac(3) = 1/6, fac(5) = 1/120 and 1/fac(7) = 1/5040 are constants so we can precalculate them
const INV_FAC3 = f32x4.splat(1 / 6);
const INV_FAC5 = f32x4.splat(1 / 120);
const INV_FAC7 = f32x4.splat(1 / 5040);
const INV_FAC9 = f32x4.splat(1 / 362880);

function sin4x32(theta: v128): v128 {
  // calculate all the needed exponents as a multiplication tree
  // x^5 = (x * x * x) * (x * x) = x^3 * x ^2
  // x^(a + b) = x^a * x^b
  let x2 = v128.mul<f32>(theta, theta);
  let x3 = v128.mul<f32>(theta, x2);
  let x5 = v128.mul<f32>(x3, x2);
  let x7 = v128.mul<f32>(x5, x2);
  let x9 = v128.mul<f32>(x7, x2);

  // rearrange so the atomic thing is last
  // -x^3 * INV_FAC3 + (x^5 * INV_FAC5 + (-x^7 * INV_FAC7 + x))
  let d = v128.relaxed_madd<f32>(x9, INV_FAC9, theta);
  let c = v128.relaxed_nmadd<f32>(x7, INV_FAC7, d);
  let b = v128.relaxed_madd<f32>(x5, INV_FAC5, c);
  let a = v128.relaxed_nmadd<f32>(x3, INV_FAC3, b);

  return a;
}

const Y_SCALEx4 = f32x4.splat(INV_HEIGHT);
const HALFx4 = f32x4.splat(0.5);
const EIGHTx4 = f32x4.splat(8);

function clampToRadiansx4(x: v128): v128 {
  // scaled = x * 1 / 2pi
  let scaled = f32x4.mul(x, INV_TWO_PIx4);
  // wrapped = scaled - floor(scaled)
  let wrapped = f32x4.sub(scaled, f32x4.floor(scaled));
  let out = f32x4.relaxed_madd(wrapped, TWO_PIx4, NEG_PIx4);
  return out;
}

const _0xFFFFx4 = v128.splat<u32>(0xffff);
const SCALE = v128.div<f32>(TWO_PIx4, v128.splat<f32>(0x10000));

// calculates 4 pixels at once
function renderSegment(x: u32, y: u32, t: u32): void {
  const phase = v128.add<u32>(
    v128.shl<u32>(i32x4(x, x + 1, x + 2, x + 3), 8),
    v128.splat<u32>(t << 6),
  );

  const wf = f32x4.convert_i32x4_u(v128.and(phase, _0xFFFFx4));
  const scaled_y = f32x4.mul(f32x4.splat(f32(y)), Y_SCALEx4);
  const theta = clampToRadiansx4(f32x4.relaxed_madd(wf, SCALE, NEG_PIx4));
  const threshold = f32x4.relaxed_madd(sin4x32(theta), HALFx4, HALFx4);

  // y is 0..1, threshold is 0..1, so diff is -1..1
  const diff = f32x4.sub(scaled_y, threshold);
  const norm = f32x4.relaxed_madd(diff, EIGHTx4, EIGHTx4);
  const asInt = v128.trunc_sat<u32>(norm);

  let i = u32((x >>> 1) + y * HALF_SCREEN_WIDTH);
  const a = v128.extract_lane<u8>(asInt, 0);
  const b = v128.extract_lane<u8>(asInt, 4);
  const c = v128.extract_lane<u8>(asInt, 8);
  const d = v128.extract_lane<u8>(asInt, 12);

  vBuffer[i + 0] = (a << 4) | b;
  vBuffer[i + 1] = (c << 4) | d;
}

// Each pixel in superwamicom is a nibble so the video buffer
// size is HEIGHT x WIDTH x 4 bits.
const vBuffer = new StaticArray<u8>(SCREEN_HEIGHT * HALF_SCREEN_WIDTH);

export function get_buffer(): StaticArray<u8> {
  return vBuffer;
}

export function update_buffer(t: u32): void {
  let max_y = SCREEN_HEIGHT;
  let max_qx = QUARTER_SCREEN_WIDTH;

  for (let y: u32 = 0; y < max_y; y++) {
    for (let qx: u32 = 0; qx < max_qx; qx++) {
      renderSegment(qx * 4, y, t);
    }
  }
}
