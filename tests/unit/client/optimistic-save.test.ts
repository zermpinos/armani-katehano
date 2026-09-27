import { describe, it, expect, vi, afterEach } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useAdminData, storeAdminData, clearAdminData } from "@/client/admin/use-admin-data";
import { optimisticSave } from "@/client/admin/optimistic-save";

type Rows = { rows: string[] };
const URL_ = "/api/admin/things";

function Probe() {
  const { data } = useAdminData<Rows>(URL_);
  return createElement("span", null, data ? data.rows.join(",") : "none");
}
const shown = () => renderToStaticMarkup(createElement(Probe));
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => { clearAdminData(); vi.unstubAllGlobals(); });

const add = (d: Rows) => ({ rows: [...d.rows, "b"] });
const remove = (d: Rows) => ({ rows: d.rows.filter(r => r !== "b") });

describe("optimisticSave", () => {
  it("shows the change at once, then reconciles with the server", async () => {
    storeAdminData(URL_, { rows: ["a"] });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(200, { ok: true }))
      .mockResolvedValueOnce(json(200, { rows: ["a", "b"] }));
    vi.stubGlobal("fetch", fetchMock);
    const pending = optimisticSave<Rows>({ url: URL_, apply: add, rollback: remove, send: () => fetch("/api/admin/things", { method: "POST" }) });
    expect(shown()).toBe("<span>a,b</span>");
    const result = await pending;
    expect(result).toEqual({ ok: true, body: { ok: true } });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1][0]).toBe(URL_);
  });

  it("rolls back and returns the server's message when the save is rejected", async () => {
    storeAdminData(URL_, { rows: ["a"] });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json(409, { error: "Jersey #7 is already assigned to X." })));
    const result = await optimisticSave<Rows>({ url: URL_, apply: add, rollback: remove, send: () => fetch("/x") });
    expect(result).toEqual({ ok: false, status: 409, message: "Jersey #7 is already assigned to X." });
    expect(shown()).toBe("<span>a</span>");
  });

  it("reports a 401 so the caller can keep the draft for after sign-in", async () => {
    storeAdminData(URL_, { rows: ["a"] });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json(401, { error: "Unauthorized" })));
    const result = await optimisticSave<Rows>({ url: URL_, apply: add, rollback: remove, send: () => fetch("/x") });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.status).toBe(401);
    expect(shown()).toBe("<span>a</span>");
  });

  it("rolls back on a network failure", async () => {
    storeAdminData(URL_, { rows: ["a"] });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch")));
    const result = await optimisticSave<Rows>({ url: URL_, apply: add, rollback: remove, send: () => fetch("/x") });
    expect(result).toEqual({ ok: false, status: 0, message: "Network error. Check the connection and try again." });
    expect(shown()).toBe("<span>a</span>");
  });
});
