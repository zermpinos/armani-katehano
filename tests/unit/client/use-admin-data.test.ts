import { describe, it, expect, afterEach, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useAdminData, storeAdminData, clearAdminData, loadAdminData, mutateAdminData, refreshAllAdminData } from "@/client/admin/use-admin-data";

function Probe({ url }: { url: string }) {
  const { data } = useAdminData<{ n: number }>(url);
  return createElement("span", null, data ? String(data.n) : "none");
}
const render = (url: string) => renderToStaticMarkup(createElement(Probe, { url }));

afterEach(() => {
  clearAdminData();
  vi.unstubAllGlobals();
});

describe("useAdminData", () => {
  it("renders cached data on the first render", () => {
    storeAdminData("/api/admin/players", { n: 7 });
    expect(render("/api/admin/players")).toBe("<span>7</span>");
  });

  it("renders nothing for a url it has not seen", () => {
    expect(render("/api/admin/schedule")).toBe("<span>none</span>");
  });

  it("forgets everything on clear, which logout relies on", () => {
    storeAdminData("/api/admin/players", { n: 7 });
    clearAdminData();
    expect(render("/api/admin/players")).toBe("<span>none</span>");
  });
});

describe("loadAdminData", () => {
  it("returns data and caches it, which a following render shows", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ n: 3 }), { status: 200, headers: { "Content-Type": "application/json" } })));
    const result = await loadAdminData("/api/admin/players");
    expect(result).toEqual({ n: 3 });
    expect(render("/api/admin/players")).toBe("<span>3</span>");
  });

  it("returns undefined for a 500 response and leaves cache empty", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 500 })));
    const result = await loadAdminData("/api/admin/players");
    expect(result).toBeUndefined();
    expect(render("/api/admin/players")).toBe("<span>none</span>");
  });

  it("returns undefined if fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("Network error"); }));
    const result = await loadAdminData("/api/admin/players");
    expect(result).toBeUndefined();
  });
});

describe("mutateAdminData", () => {
  it("changes what the next render shows", () => {
    storeAdminData("/api/admin/players", { n: 1 });
    mutateAdminData<{ n: number }>("/api/admin/players", d => ({ n: d.n + 1 }));
    expect(render("/api/admin/players")).toBe("<span>2</span>");
  });

  it("does nothing for a url with no data yet", () => {
    mutateAdminData<{ n: number }>("/api/admin/unknown", d => ({ n: d.n + 1 }));
    expect(render("/api/admin/unknown")).toBe("<span>none</span>");
  });
});

describe("refreshAllAdminData", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("refetches every url the store holds", async () => {
    storeAdminData("/api/admin/players", { n: 1 });
    storeAdminData("/api/admin/schedule", { n: 2 });
    const fetchMock = vi.fn(async (_url: string) => new Response(JSON.stringify({ n: 9 }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    refreshAllAdminData();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls.map(c => c[0]).sort()).toEqual(["/api/admin/players", "/api/admin/schedule"]);
  });
});
