import "@/server/_internal/node-only";
import dns from "node:dns";
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

export function isPrivateIp(ip: string): boolean {
  if (
    /^127\./.test(ip)                                           ||
    /^10\./.test(ip)                                            ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)                      ||
    /^192\.168\./.test(ip)                                      ||
    /^169\.254\./.test(ip)                                      ||
    /^0\./.test(ip)                                             ||
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip)       ||
    /^198\.1[89]\./.test(ip)
  ) return true;

  if (
    ip === "::1"                  ||
    /^::ffff:127\./i.test(ip)     ||
    /^fe80:/i.test(ip)            ||
    /^fc00:/i.test(ip)            ||
    /^fd[0-9a-f]{2}:/i.test(ip)
  ) return true;

  return false;
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
export async function assertSsrfSafe(url: string): Promise<ResolvedTarget> {
  let urlObj: URL;
  try { urlObj = new URL(url); } catch {
    throw Object.assign(new Error("URL not allowed"), { status: 400 });
  }

  if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:")
    throw Object.assign(new Error("URL not allowed"), { status: 400 });

  if (!isAllowedHostname(urlObj.hostname))
    throw Object.assign(new Error("URL not allowed"), { status: 400 });

  let address: string;
  let family: number;
  try {
    ({ address, family } = await dns.promises.lookup(urlObj.hostname));
  } catch {
    throw Object.assign(new Error("URL not allowed"), { status: 400 });
  }

  if (isPrivateIp(address))
    throw Object.assign(new Error("URL not allowed"), { status: 400 });

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
