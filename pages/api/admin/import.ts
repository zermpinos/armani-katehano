import { requireAuth } from "@/server/auth";
import { GameWriteSchema } from "@/schemas/game";
import { parseBody } from "@/server/http/parse-body";
import { getClientIp, auditLog } from "@/server/security/node";
import { handleError } from "@/server/http/handle-error";
import { commitImport, CommitError } from "@/server/services/import-commit";

export default requireAuth(async function handler(req: any, res: any) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const ip = getClientIp(req);
  const data = parseBody(GameWriteSchema, req.body, res);
  if (!data) return;

  try {
    const { gameId } = await commitImport(data, { ip, revalidate: (p: string) => res.revalidate?.(p) });
    return res.status(201).json({ ok: true, gameId });
  } catch (err) {
    if (err instanceof CommitError) {
      if (err.status === 409 && err.gameId)
        auditLog("game_create_duplicate", { ip, gameId: err.gameId, sourceUrl: data.sourceUrl });
      return res.status(err.status).json({ error: err.message, ...(err.gameId ? { gameId: err.gameId } : {}) });
    }
    auditLog("game_create_error", { ip, error: (err as any).message });
    return handleError(res, err);
  }
});
