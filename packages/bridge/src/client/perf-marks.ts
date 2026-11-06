// Timing marks for the performance runs (`pnpm bench:ui`, PB-01). Off unless the page sets
// `window.__KC_PERF__ = true` before the Bridge loads, so a normal session keeps no entries.

/** Records how long one Bridge step took as a `performance` measure named `name`. */
export function measureSince(name: string, startedAt: number): void {
  if (Reflect.get(globalThis, '__KC_PERF__') !== true) return;
  performance.measure(name, { start: startedAt, end: performance.now() });
}
