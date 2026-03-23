/**
 * pages/api/public/data.js
 * GET /api/public/data  →  all public data (no auth required)
 *
 * Short cache: 60s on CDN, stale-while-revalidate 300s.
 * The public site calls this from getStaticProps / getServerSideProps.
 */
import { getAllPublicData } from "../../../lib/data.js";
import { securityHeaders } from "../../../lib/security.js";
import { prodError }       from "../../../lib/utils.js"; // ← FIX B-02: enables safe error messages in dev + prod

export default async function handler(req, res) {
  // Apply security headers, but allow CDN caching (remove no-store override)
  const headers = securityHeaders();
  delete headers["Cache-Control"];
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const data = await getAllPublicData();
    // 60s CDN cache, 300s stale-while-revalidate
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json(data);
  } catch (err) {
    console.error("[public/data]", err); // ← log full error server-side
    // prodError: returns err.message in development, "Internal server error" in production
    // Safe for a public endpoint — no stack traces or DB details leak to clients
    return res.status(500).json({ error: prodError(err) });
  }
}