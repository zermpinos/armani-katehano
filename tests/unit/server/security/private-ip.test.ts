import { describe, it, expect } from "vitest";
import { isPrivateIp } from "@/server/security/node/ssrf";

const PRIVATE_V4: ReadonlyArray<[string, string]> = [
  ["loopback",      "127.0.0.1"],
  ["10/8",          "10.0.0.1"],
  ["172.16/12",     "172.20.5.5"],
  ["192.168/16",    "192.168.1.1"],
  ["link-local",    "169.254.169.254"],
  ["0/8",           "0.0.0.0"],
  ["CGN 100.64/10", "100.64.0.1"],
  ["benchmark",     "198.18.0.1"],
];

const PRIVATE_V6: ReadonlyArray<[string, string]> = [
  ["::1",                   "::1"],
  ["mapped 127.0.0.1",      "::ffff:127.0.0.1"],
  ["mapped 10.0.0.1",       "::ffff:10.0.0.1"],
  ["mapped 172.20.5.5",     "::ffff:172.20.5.5"],
  ["mapped 192.168.1.1",    "::ffff:192.168.1.1"],
  ["mapped 169.254.169.254","::ffff:169.254.169.254"],
  ["fe80 link-local",       "fe80::1"],
  ["fc00 ULA",              "fc00::1"],
  ["fd00 ULA",              "fd12:3456:789a::1"],
];

const PUBLIC: ReadonlyArray<[string, string]> = [
  ["Google DNS v4",     "8.8.8.8"],
  ["Cloudflare DNS v4", "1.1.1.1"],
  ["Cloudflare DNS v6", "2606:4700:4700::1111"],
];

describe("isPrivateIp", () => {
  it.each(PRIVATE_V4)("flags IPv4 private: %s (%s)", (_label, ip) => {
    expect(isPrivateIp(ip)).toBe(true);
  });
  it.each(PRIVATE_V6)("flags IPv6 private: %s (%s)", (_label, ip) => {
    expect(isPrivateIp(ip)).toBe(true);
  });
  it.each(PUBLIC)("passes public: %s (%s)", (_label, ip) => {
    expect(isPrivateIp(ip)).toBe(false);
  });
});
