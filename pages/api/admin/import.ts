import { requireAuth }  from "@/server/auth";
import { importGame, ImportError } from "@/server/services/import-game";

export default requireAuth(async function handler(req: any, res: any) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const result = await importGame(
      { data: req.body?.data },
      { revalidate: (path: string) => res.revalidate(path) },
    );
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof ImportError) {
      const body: Record<string, unknown> = { ok: false, error: err.message, ...err.extra };
      if ((err as any).gameId) body.gameId = (err as any).gameId;
      return res.status(err.status).json(body);
    }
    console.error("[import]", err);
    return res.status(500).json({ error: "Unexpected error" });
  }
});
