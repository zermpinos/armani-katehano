/**
 * pages/api/public/data.js
 * GET /api/public/data  →  all public data (no auth required)
 *
 * Short cache: 60s on CDN, stale-while-revalidate 300s.
 * The public site calls this from getStaticProps / getServerSideProps.
 */
import { getAllPublicData } from "@/server/db/repositories";
import { securityHeaders } from "@/server/security/edge";
import { getClientIp }     from "@/server/security/node";
import { rlKey } from "@/server/auth";
import { prodError }       from "@/domain/shared/format";
import prisma              from "@/server/db/client";

const PUBLIC_DATA_LIMIT  = 30;  // max requests per IP per minute
const PUBLIC_DATA_WINDOW = 60;  // 1 minute in seconds

export default async function handler(req: any, res: any) {
  // Apply security headers, but allow CDN caching (remove no-store override)
  const { "Cache-Control": _cc, ...headers } = securityHeaders();
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // IP-based rate limit — prevents DB pool exhaustion from bots or cache-busting
  const ip = getClientIp(req);
  const rateLimitKey = rlKey(`pub_${ip}`);
  const since = new Date(Date.now() - PUBLIC_DATA_WINDOW * 1000);
  const attempts = await prisma.loginAttempt.count({
    where: { ip: rateLimitKey, attemptedAt: { gte: since } },
  });
  if (attempts >= PUBLIC_DATA_LIMIT) {
    return res.status(429).json({ error: "Too many requests. Try again later." });
  }
  prisma.loginAttempt.create({ data: { ip: rateLimitKey } })
    .catch((err: unknown) => console.error("[public/data] rate-limit record failed:", err));

  try {
    const data = await getAllPublicData();
    // 60s CDN cache, 300s stale-while-revalidate
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json(data);
  } catch (err) {
    console.error("[public/data]", err);
    return res.status(500).json({ error: prodError(err) });
  }
}