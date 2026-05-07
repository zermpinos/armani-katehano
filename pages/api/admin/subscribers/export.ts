import { requireAuth } from "@/server/auth";
import prisma          from "@/server/db/client";

async function handler(req: any, res: any) {
  if (req.method !== "GET") return res.status(405).end("Method not allowed");

  try {
    const rows = await prisma.subscriber.findMany({
      where:   { confirmedAt: { not: null } },
      orderBy: { createdAt: "desc" },
      select:  { email: true, createdAt: true, confirmedAt: true },
    });

    const lines = [
      "email,createdAt,confirmedAt",
      ...rows.map(r =>
        [r.email, r.createdAt.toISOString(), r.confirmedAt!.toISOString()].join(",")
      ),
    ];

    res.setHeader("Content-Type",        "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="subscribers.csv"');
    return res.status(200).send(lines.join("\n"));
  } catch {
    return res.status(500).send("Internal server error");
  }
}

export default requireAuth(handler);
