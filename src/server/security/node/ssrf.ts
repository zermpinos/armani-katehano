import "@/server/_internal/node-only";
import dns from "node:dns";
import net from "node:net";
import { Agent, buildConnector } from "undici";

const ALLOWLIST: string[] = (
  process.env.SCRAPE_HOSTNAME_ALLOWLIST ?? "basketcity.sportstats.gr,basketaki.com,reports.sportstats.gr"
)
  .split(",")
  .map(h => h.trim().toLowerCase())
  .filter(Boolean);

export function isAllowedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return ALLOWLIST.some(entry => h === entry || h.endsWith("." + entry));
}

const PRIVATE = new net.BlockList();
PRIVATE.addSubnet("127.0.0.0",   8);
PRIVATE.addSubnet("10.0.0.0",    8);
PRIVATE.addSubnet("172.16.0.0", 12);
PRIVATE.addSubnet("192.168.0.0",16);
PRIVATE.addSubnet("169.254.0.0",16);
PRIVATE.addSubnet("0.0.0.0",     8);
PRIVATE.addSubnet("100.64.0.0", 10);
PRIVATE.addSubnet("198.18.0.0", 15);
PRIVATE.addAddress("::1",                          "ipv6");
PRIVATE.addSubnet ("fe80::",                  10, "ipv6");
PRIVATE.addSubnet ("fc00::",                   7, "ipv6");

export function isPrivateIp(ip: string): boolean {
  const family = net.isIP(ip) === 6 ? "ipv6" : "ipv4";
  return PRIVATE.check(ip, family);
}

export interface ResolvedTarget {
  address: string;
  family: number;
}

/**
 * Validates the URL against the allowlist and resolves DNS once.
 * Returns the resolved IP so callers can pin their connection to it,
 * eliminating the TOCTOU window between this check and the actual fetch.
 */
function rejectUrl(): never {
  throw Object.assign(new Error("URL not allowed"), { status: 400 });
}

export async function assertSsrfSafe(url: string): Promise<ResolvedTarget> {
  let urlObj: URL;
  try { urlObj = new URL(url); } catch {
    rejectUrl();
  }

  if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:")
    rejectUrl();

  if (!isAllowedHostname(urlObj.hostname))
    rejectUrl();

  let address: string;
  let family: number;
  try {
    ({ address, family } = await dns.promises.lookup(urlObj.hostname));
  } catch {
    rejectUrl();
  }

  if (isPrivateIp(address))
    rejectUrl();

  return { address, family };
}

/**
 * Returns an undici Agent whose connector bypasses DNS and connects directly
 * to `resolvedIp`. The original hostname is preserved as the TLS SNI value so
 * certificate verification still uses the correct name, not the raw IP.
 *
 * Pass this as `dispatcher` in the fetch options to close the TOCTOU gap:
 * the socket goes to the address validated by assertSsrfSafe, with no
 * second DNS lookup that an attacker could race.
 */
export function makeLockedDispatcher(resolvedIp: string): Agent {
  const connector = buildConnector({});
  return new Agent({
    connect(options, callback) {
      connector(
        { ...options, hostname: resolvedIp, servername: options.servername ?? options.hostname },
        callback,
      );
    },
  });
}
