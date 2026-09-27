import { describe, it, expect, vi, afterEach } from "vitest";
import { apiFetch, setUnauthorizedHandler } from "@/client/admin/csrf";

const respond = (status: number) => vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status })));

afterEach(() => {
  setUnauthorizedHandler(null);
  vi.unstubAllGlobals();
});

describe("apiFetch session expiry reporting", () => {
  it("reports a 401 from an admin API", async () => {
    respond(401);
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    await apiFetch("/api/admin/players");
    expect(handler).toHaveBeenCalledOnce();
  });

  it("ignores a 401 from the login endpoint, which means a wrong password", async () => {
    respond(401);
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    await apiFetch("/api/auth", { method: "POST" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("ignores a 403 from an admin API", async () => {
    respond(403);
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    await apiFetch("/api/admin/players");
    expect(handler).not.toHaveBeenCalled();
  });
});
