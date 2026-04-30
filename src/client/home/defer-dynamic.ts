// Wraps a dynamic-import factory so the actual fetch+parse happens during
// browser idle time rather than inside the hydration task. Used for
// above-the-fold recharts charts whose ResponsiveContainer triggers a
// synchronous geometry read on mount — moving the mount past first paint
// keeps that ~100ms forced reflow out of the TBT critical window.

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
