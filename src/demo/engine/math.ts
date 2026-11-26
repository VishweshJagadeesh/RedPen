/** Small numeric helpers shared by the engine, the 3D world and the scenes. */
export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Ease in-out (cubic). */
export const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** Ease out (cubic). */
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
/** Progress of `t` through [a, b], clamped to 0..1. */
export const prog = (t: number, a: number, b: number) => (b === a ? (t >= b ? 1 : 0) : clamp((t - a) / (b - a)));

/** Deterministic pseudo-random sequence (Park–Miller). */
export function rng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
