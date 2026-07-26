import { requireAuth }  from "@/server/auth";
import { ScrapeSchema } from "@/schemas/scrape";
import { ScrapeError }  from "@/server/services/scrape-game";
import { scrapeAndResolve } from "@/server/services/import-pipeline";

export default requireAuth(async function handler(req: any, res: any) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const parsed = ScrapeSchema.safeParse(req.body ?? {});
  if (!parsed.success)
    return res.status(400).json({ error: "Invalid URL" });

  try {
    return res.status(200).json({ ok: true, ...await scrapeAndResolve(parsed.data.url) });
  } catch (err) {
    if (err instanceof ScrapeError)
      return res.status(err.status).json({ error: err.message });
    return res.status(500).json({ error: "Unexpected error" });
  }
});
