/**
 * Device capability probe.
 *
 * This file reports what the device *is*, and nothing more. It deliberately
 * makes no judgement about what to switch off: the site is a single scene with
 * one object, and the only honest reason to reduce anything is sustained frame
 * cost. Guessing from `hardwareConcurrency` and cutting the scene short just
 * drops quality on a fast machine that would have rendered it fine.
 *
 * The render resolution is fixed at the device's native pixel ratio — see
 * stage.ts. There is no quality selector, because on every device that can run
 * this scene the sharpest output is also the correct one.
 */

export type Capability = {
  /** Device pixel ratio as reported by the OS. Used verbatim as the render scale. */
  readonly nativeDpr: number;
  readonly reducedMotion: boolean;
  /** True when the primary pointer can hover (mouse/trackpad). */
  readonly canHover: boolean;
  /** True on a coarse pointer (finger). */
  readonly coarsePointer: boolean;
};

export function detectCapability(): Capability {
  return {
    nativeDpr: window.devicePixelRatio || 1,
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    canHover: window.matchMedia("(hover: hover)").matches,
    coarsePointer: window.matchMedia("(pointer: coarse)").matches,
  };
}
