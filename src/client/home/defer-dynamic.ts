// Defers a dynamic import to requestIdleCallback so recharts'
// ResponsiveContainer mount lands after first paint, not inside hydration.
// Lighthouse median of 3 runs against npm start, 2026-06-21:
//   TBT  baseline 33 ms, candidate (no wrapper) 211 ms, delta +178 ms.
//   LCP  baseline 2110 ms, candidate 2406 ms, delta +296 ms.
// Delta above the 100 ms threshold, wrapper kept.

type Loader<T> = () => Promise<{ default: T }>;

interface IdleWindow {
  requestIdleCallback?: (
    cb: () => void,
    opts?: { timeout?: number }
  ) => number;
}

const IDLE_TIMEOUT_MS = 500;

export function deferDynamic<T>(loader: Loader<T>): Loader<T> {
  return () =>
    new Promise<{ default: T }>((resolve, reject) => {
      const run = () => {
        loader().then(resolve, reject);
      };
      const w =
        typeof globalThis !== "undefined"
          ? (globalThis as unknown as IdleWindow)
          : ({} as IdleWindow);
      if (typeof w.requestIdleCallback === "function") {
        w.requestIdleCallback(run, { timeout: IDLE_TIMEOUT_MS });
      } else {
        setTimeout(run, 0);
      }
    });
}
