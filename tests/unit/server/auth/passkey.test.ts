import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://example.com");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("getExpectedOrigin", () => {
  it("returns NEXT_PUBLIC_APP_URL in production with https", async () => {
    const { getExpectedOrigin } = await import("@/server/auth/passkey");
    expect(getExpectedOrigin()).toBe("https://example.com");
  });

  it("throws in production when NEXT_PUBLIC_APP_URL is http://", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://example.com");
    const { getExpectedOrigin } = await import("@/server/auth/passkey");
    expect(() => getExpectedOrigin()).toThrow("NEXT_PUBLIC_APP_URL must be https://");
  });

  it("throws in production when NEXT_PUBLIC_APP_URL is unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    const { getExpectedOrigin } = await import("@/server/auth/passkey");
    expect(() => getExpectedOrigin()).toThrow("NEXT_PUBLIC_APP_URL must be https://");
  });

  it("does not throw in development with http://", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    const { getExpectedOrigin } = await import("@/server/auth/passkey");
    expect(getExpectedOrigin()).toBe("http://localhost:3000");
  });
});

describe("getRpId", () => {
  it("extracts hostname from NEXT_PUBLIC_APP_URL", async () => {
    const { getRpId } = await import("@/server/auth/passkey");
    expect(getRpId()).toBe("example.com");
  });

  it("returns localhost when NEXT_PUBLIC_APP_URL has no valid hostname", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    const { getRpId } = await import("@/server/auth/passkey");
    expect(getRpId()).toBe("localhost");
  });

  it("propagates the production guard error instead of returning localhost", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://example.com");
    const { getRpId } = await import("@/server/auth/passkey");
    expect(() => getRpId()).toThrow("NEXT_PUBLIC_APP_URL must be https://");
  });
});
