type Nibble = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

const clamp = (a: number, n: number, x: number) => Math.min(Math.max(a, n), x);
const toColor = (x: number) => clamp(Math.floor(x), 0, 15) as Nibble;

export const pixel = (x: number, y: number, t: number): Nibble => {
  const scaled_y = y / 200;
  const jitter = Math.sin(Math.PI * 10 * scaled_y) * 50;
  const scaled_x = (Math.PI * x + jitter) / 160;

  const height = (Math.sin(scaled_x + t * 0.03) + 1) * 0.5;

  return toColor(16 * (scaled_y - height));
};
