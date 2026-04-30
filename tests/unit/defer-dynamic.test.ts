// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { deferDynamic } from "@/client/home/defer-dynamic";

describe("deferDynamic", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    // @ts-expect-error tests stash globals
    delete globalThis.requestIdleCallback;
  });

  it("does not invoke the loader synchronously", async () => {
    const loader = vi.fn().mockResolvedValue({ default: "x" });
    const factory = deferDynamic(loader);
    factory(); // schedule but do not await
    expect(loader).not.toHaveBeenCalled();
  });

  it("uses requestIdleCallback when available", async () => {
    let cb: () => void = () => {};
    const ric = vi.fn((fn: () => void) => {
      cb = fn;
      return 1;
    });
    // @ts-expect-error attaching to global for the helper to find
    globalThis.requestIdleCallback = ric;

    const loader = vi.fn().mockResolvedValue({ default: "ok" });
    const promise = deferDynamic(loader)();

    expect(ric).toHaveBeenCalledOnce();
    expect(loader).not.toHaveBeenCalled();

    cb();
    await expect(promise).resolves.toEqual({ default: "ok" });
    expect(loader).toHaveBeenCalledOnce();
  });

  it("falls back to setTimeout when requestIdleCallback is missing", async () => {
    const loader = vi.fn().mockResolvedValue({ default: "fallback" });
    const promise = deferDynamic(loader)();

    expect(loader).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toEqual({ default: "fallback" });
    expect(loader).toHaveBeenCalledOnce();
  });
});
