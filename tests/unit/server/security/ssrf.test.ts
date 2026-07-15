import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import dns from "node:dns";

// Mock undici so makeLockedDispatcher's connector can be inspected without opening a socket.
const undiciMocks = vi.hoisted(() => {
  const baseConnector = vi.fn();
  const buildConnector = vi.fn(() => baseConnector);
  const Agent = vi.fn(function (this: Record<string, unknown>, opts: unknown) {
    this.options = opts;
  });
  return { baseConnector, buildConnector, Agent };
});

vi.mock("undici", () => ({
  Agent: undiciMocks.Agent,
  buildConnector: undiciMocks.buildConnector,
}));

import { assertSsrfSafe, isAllowedHostname, makeLockedDispatcher } from "@/server/security/node/ssrf";

// Default allowlist (SCRAPE_HOSTNAME_ALLOWLIST unset): basketcity.sportstats.gr, basketaki.com, reports.sportstats.gr

describe("assertSsrfSafe", () => {
  let lookup: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    lookup = vi.spyOn(dns.promises, "lookup");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("allows an allowlisted host that resolves to a public IP and returns the resolved target", async () => {
    lookup.mockResolvedValue({ address: "8.8.8.8", family: 4 } as never);
    await expect(assertSsrfSafe("https://basketaki.com/report")).resolves.toEqual({
      address: "8.8.8.8",
      family: 4,
    });
    expect(lookup).toHaveBeenCalledWith("basketaki.com");
  });

  it("allows a subdomain of an allowlisted host", async () => {
    lookup.mockResolvedValue({ address: "203.0.113.9", family: 4 } as never);
    await expect(assertSsrfSafe("https://www.basketaki.com/x")).resolves.toEqual({
      address: "203.0.113.9",
      family: 4,
    });
  });

  // DNS-rebinding defense: an allowlisted host must still reject when it resolves to a private target.
  it.each<[string, string, number]>([
    ["loopback", "127.0.0.1", 4],
    ["cloud metadata 169.254.169.254", "169.254.169.254", 4],
    ["private 10/8", "10.0.0.1", 4],
    ["private 192.168/16", "192.168.1.1", 4],
    ["ipv6 loopback", "::1", 6],
  ])("rejects an allowlisted host resolving to a %s address", async (_label, address, family) => {
    lookup.mockResolvedValue({ address, family } as never);
    await expect(assertSsrfSafe("https://basketaki.com/x")).rejects.toThrow("URL not allowed");
  });

  it("rejects a non-allowlisted host without resolving DNS", async () => {
    await expect(assertSsrfSafe("https://evil.example.com/")).rejects.toThrow("URL not allowed");
    expect(lookup).not.toHaveBeenCalled();
  });

  // evilbasketaki.com ends with the allowlisted string but is not a subdomain of it.
  it("rejects a suffix-collision host such as evilbasketaki.com", async () => {
    await expect(assertSsrfSafe("https://evilbasketaki.com/")).rejects.toThrow("URL not allowed");
    expect(lookup).not.toHaveBeenCalled();
  });

  it.each<[string, string]>([
    ["ftp", "ftp://basketaki.com/x"],
    ["file", "file:///etc/passwd"],
    ["gopher", "gopher://basketaki.com/"],
    ["data", "data:text/plain,hi"],
  ])("rejects non-http(s) protocol: %s", async (_label, url) => {
    await expect(assertSsrfSafe(url)).rejects.toThrow("URL not allowed");
    expect(lookup).not.toHaveBeenCalled();
  });

  it("rejects a malformed URL", async () => {
    await expect(assertSsrfSafe("not a url")).rejects.toThrow("URL not allowed");
  });

  it("rejects when DNS resolution fails", async () => {
    lookup.mockRejectedValue(new Error("ENOTFOUND"));
    await expect(assertSsrfSafe("https://basketaki.com/x")).rejects.toThrow("URL not allowed");
  });

  it("rejects with HTTP 400 attached to the error", async () => {
    await expect(assertSsrfSafe("https://evil.example.com/")).rejects.toMatchObject({ status: 400 });
  });
});

describe("isAllowedHostname", () => {
  it.each([
    "basketaki.com",
    "basketcity.sportstats.gr",
    "reports.sportstats.gr",
    "www.basketaki.com",
    "a.b.basketaki.com",
    "BASKETAKI.COM",
  ])("allows %s", (hostname) => {
    expect(isAllowedHostname(hostname)).toBe(true);
  });

  it.each([
    "evilbasketaki.com",
    "basketaki.com.evil.com",
    "notbasketaki.com",
    "basketaki.co",
    "sportstats.gr",
    "google.com",
    "",
  ])("rejects %s", (hostname) => {
    expect(isAllowedHostname(hostname)).toBe(false);
  });
});

type ConnectFn = (opts: Record<string, unknown>, cb: unknown) => void;

function capturedConnect(): ConnectFn {
  return (undiciMocks.Agent.mock.calls.at(-1)![0] as { connect: ConnectFn }).connect;
}

describe("makeLockedDispatcher", () => {
  beforeEach(() => {
    undiciMocks.Agent.mockClear();
    undiciMocks.buildConnector.mockClear();
    undiciMocks.baseConnector.mockClear();
  });

  it("returns an undici Agent built from a connector", () => {
    const dispatcher = makeLockedDispatcher("203.0.113.5");
    expect(dispatcher).toBeInstanceOf(undiciMocks.Agent);
    expect(undiciMocks.buildConnector).toHaveBeenCalledTimes(1);
  });

  it("pins the socket to the resolved IP and keeps the hostname as SNI", () => {
    makeLockedDispatcher("203.0.113.5");
    const connect = capturedConnect();
    const cb = vi.fn();

    connect({ hostname: "basketaki.com", servername: undefined, port: 443 }, cb);

    expect(undiciMocks.baseConnector).toHaveBeenCalledTimes(1);
    const [passedOpts, passedCb] = undiciMocks.baseConnector.mock.calls[0];
    expect(passedOpts).toMatchObject({
      hostname: "203.0.113.5",
      servername: "basketaki.com",
      port: 443,
    });
    expect(passedCb).toBe(cb);
  });

  it("keeps an explicit servername when one is already set", () => {
    makeLockedDispatcher("203.0.113.5");
    const connect = capturedConnect();

    connect({ hostname: "basketaki.com", servername: "custom.example" }, vi.fn());

    expect(undiciMocks.baseConnector.mock.calls[0][0]).toMatchObject({
      hostname: "203.0.113.5",
      servername: "custom.example",
    });
  });
});
