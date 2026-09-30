/**
 * Per-frame clock with a clamped delta.
 *
 * The clamp is the whole point. When a tab is backgrounded, rAF stops firing
 * and the first frame back reports a delta of however long the user was away
 * (minutes, sometimes). Every spring, lerp and idle-timer in the scene
 * integrates that value, so the bear would teleport across the screen and the
 * idle state would fire every reaction at once. Clamping to 1/20s means a
 * returning tab resumes as if it had only been away for one slow frame.
 */

const MAX_DT = 1 / 20;

export type Ticker = {
  /** Seconds since the previous frame, clamped to MAX_DT. */
  dt: number;
  /** Seconds since the previous frame, unclamped. For FPS measurement only. */
  rawDt: number;
  /** Monotonic seconds since the ticker started. */
  elapsed: number;
};

/**
 * Advances the clock. Call once at the top of each frame, before anything
 * reads `ticker.dt`.
 */
export function createTicker() {
  const state: Ticker = { dt: 0, rawDt: 0, elapsed: 0 };
  let last = performance.now();

  return {
    state,
    tick(): Ticker {
      const now = performance.now();
      const raw = (now - last) / 1000;
      last = now;
      state.rawDt = raw;
      state.dt = Math.min(raw, MAX_DT);
      state.elapsed += state.dt;
      return state;
    },
    /** Resets the baseline without advancing time. Call after a long stall. */
    resync(): void {
      last = performance.now();
    },
  };
}

export type TickerLoop = ReturnType<typeof createTicker>;
