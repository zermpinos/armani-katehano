import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("dotenv/config", () => ({}));

const POOLED = "postgresql://u:p@ep-x-pooler.example.neon.tech/db";
const DIRECT = "postgresql://u:p@ep-x.example.neon.tech/db";

async function loadConfig() {
  vi.resetModules();
  return (await import("../../prisma.config")).default;
}

describe("prisma.config.ts", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("gives the CLI the direct connection, not the pooler", async () => {
    vi.stubEnv("DATABASE_URL", POOLED);
    vi.stubEnv("DIRECT_URL", DIRECT);
    expect((await loadConfig()).datasource?.url).toBe(DIRECT);
  });

  it("never falls back to the pooler when DIRECT_URL is missing", async () => {
    vi.stubEnv("DATABASE_URL", POOLED);
    vi.stubEnv("DIRECT_URL", undefined);
    expect((await loadConfig()).datasource?.url).toBeUndefined();
  });
});
