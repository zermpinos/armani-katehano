import { requireAuth } from "@/server/auth";
import prisma          from "@/server/db/client";
import { prodError }   from "@/domain/shared/format";

async function handler(req: any, res: any) {
  // ── GET ──────────────────────────────────────────────────────────────────
  if (req.method === "GET") {
    const rawPage  = parseInt(String(req.query.page  ?? "1"),  10);
    const rawLimit = parseInt(String(req.query.limit ?? "50"), 10);
    const search   = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const status   = req.query.status ?? "confirmed";

    if (!Number.isFinite(rawPage) || rawPage < 1)
      return res.status(400).json({ error: "Invalid page" });
    if (!Number.isFinite(rawLimit) || rawLimit < 1 || rawLimit > 200)
      return res.status(400).json({ error: "limit must be between 1 and 200" });
    if (!["confirmed", "unconfirmed", "all"].includes(status as string))
      return res.status(400).json({ error: "Invalid status" });

    const where: any = {};
    if (status === "confirmed")   where.confirmedAt = { not: null };
    if (status === "unconfirmed") where.confirmedAt = null;
    if (search)                   where.email = { contains: search, mode: "insensitive" };

    try {
      const [total, subscribers] = await Promise.all([
        prisma.subscriber.count({ where }),
        prisma.subscriber.findMany({
          where,
          orderBy: { createdAt: "desc" },
          select:  { id: true, email: true, createdAt: true, confirmedAt: true },
          skip:    (rawPage - 1) * rawLimit,
          take:    rawLimit,
        }),
      ]);
      return res.status(200).json({
        subscribers,
        total,
        page:    rawPage,
        limit:   rawLimit,
        hasMore: rawPage * rawLimit < total,
      });
    } catch (err) {
      return res.status(500).json({ error: prodError(err) });
    }
  }

  // ── DELETE ───────────────────────────────────────────────────────────────
  if (req.method === "DELETE") {
    const { ids } = req.body ?? {};
    if (!Array.isArray(ids) || ids.length === 0)
      return res.status(400).json({ error: "ids must be a non-empty array" });

    try {
      const result = await prisma.subscriber.deleteMany({
        where: { id: { in: ids } },
      });
      return res.status(200).json({ deleted: result.count });
    } catch (err) {
      return res.status(500).json({ error: prodError(err) });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default requireAuth(handler);
