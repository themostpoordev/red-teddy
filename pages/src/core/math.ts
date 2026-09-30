/** Small math helpers shared by the scene modules. */

/** Frame-rate independent exponential approach. `speed` is per second. */
export function damp(current: number, target: number, speed: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-speed * dt));
}

/** Wraps a value into [0, range). */
export function wrap(v: number, range: number): number {
  return ((v % range) + range) % range;
}

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
