// @ts-nocheck
import { vi, describe, it, expect, afterEach } from "vitest";

vi.mock("@/server/security/node/ssrf", () => ({
  assertSsrfSafe:       vi.fn().mockResolvedValue({ address: "203.0.113.7", family: 4 }),
  makeLockedDispatcher: vi.fn(() => ({ destroy: () => Promise.resolve() })),
}));

import { fetchGuarded } from "@/server/services/scrape-game";

const LISTING = "https://basketcity.sportstats.gr/men/teamdetails/id/TEAM";
const failWith = (err) => vi.stubGlobal("fetch", vi.fn().mockRejectedValue(err));

afterEach(() => vi.unstubAllGlobals());

describe("fetchGuarded", () => {
  it("names the network cause, so an alert says why the site could not be reached", async () => {
    failWith(new TypeError("fetch failed", {
      cause: Object.assign(new Error("connect ECONNREFUSED 203.0.113.7:443"), { code: "ECONNREFUSED" }),
    }));
    await expect(fetchGuarded(LISTING)).rejects.toThrow(/^Upstream unreachable: fetch failed \(ECONNREFUSED\)$/);
  });

  it("keeps the message unchanged when the error carries no cause code", async () => {
    failWith(new TypeError("fetch failed"));
    await expect(fetchGuarded(LISTING)).rejects.toThrow(/^Upstream unreachable: fetch failed$/);
  });
});
