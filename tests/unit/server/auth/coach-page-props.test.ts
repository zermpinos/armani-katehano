import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/server/db/client", () => ({ default: {} }));

beforeEach(() => vi.stubEnv("COACH_TOKEN", "right-token"));
afterEach(() => vi.unstubAllEnvs());

async function props(token: string) {
  const { getServerSideProps } = await import("@/pages/coach/[token]");
  return getServerSideProps({ params: { token } });
}

describe("coach page getServerSideProps", () => {
  it("hands the URL token to the page, which sends it with the login", async () => {
    expect(await props("right-token")).toEqual({ props: { token: "right-token" } });
  });

  it("404s a wrong token", async () => {
    expect(await props("wrong-token")).toEqual({ notFound: true });
  });
});
