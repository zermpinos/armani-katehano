import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Set required env vars before importing the module
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("APP_URL", "https://example.com");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("getExpectedOrigin", () => {
  it("returns APP_URL in production with https", async () => {
    const { getExpectedOrigin } = await import("@/server/auth/passkey");
    expect(getExpectedOrigin()).toBe("https://example.com");
  });

  it("throws in production when APP_URL is http://", async () => {
    vi.stubEnv("APP_URL", "http://example.com");
    await expect(import("@/server/auth/passkey")).rejects.toThrow(
      "APP_URL must be https://"
    );
  });

  it("throws in production when APP_URL is unset", async () => {
    vi.stubEnv("APP_URL", "");
    await expect(import("@/server/auth/passkey")).rejects.toThrow(
      "APP_URL must be https://"
    );
  });

  it("does not throw in development with http://", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_URL", "http://localhost:3000");
    const { getExpectedOrigin } = await import("@/server/auth/passkey");
    expect(getExpectedOrigin()).toBe("http://localhost:3000");
  });
});

describe("getRpId", () => {
  it("extracts hostname from APP_URL", async () => {
    const { getRpId } = await import("@/server/auth/passkey");
    expect(getRpId()).toBe("example.com");
  });

  it("returns localhost when APP_URL has no valid hostname", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_URL", "");
    const { getRpId } = await import("@/server/auth/passkey");
    expect(getRpId()).toBe("localhost");
  });
});
