import { requireAuth }           from "@/server/auth";
import { auditLog, getClientIp } from "@/server/security/node";
import prisma                    from "@/server/db/client";
import {
  OpponentAliasWriteSchema,
  OpponentAliasUpdateSchema,
  OpponentAliasDeleteSchema,
} from "@/schemas/opponent-alias";
import { handleError }  from "@/server/http/handle-error";
import { parseBody }    from "@/server/http/parse-body";

async function listAliases(_req: any, res: any) {
  try {
    const aliases = await prisma.opponentAlias.findMany({ orderBy: { myName: "asc" } });
    return res.status(200).json({
      aliases: aliases.map(a => ({
        id:          a.id,
        myName:      a.myName,
        listingName: a.listingName,
        notes:       a.notes ?? null,
        createdAt:   a.createdAt.toISOString(),
        updatedAt:   a.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    return handleError(res, err);
  }
}

async function createAlias(req: any, res: any) {
  const ip   = getClientIp(req);
  const data = parseBody(OpponentAliasWriteSchema, req.body, res);
  if (!data) return;
  try {
    const row = await prisma.opponentAlias.create({
      data: { myName: data.myName, listingName: data.listingName, notes: data.notes ?? null },
    });
    auditLog("opponent_alias_created", { ip, id: row.id, myName: data.myName });
    return res.status(201).json({ ok: true, id: row.id });
  } catch (err) {
    auditLog("opponent_alias_create_error", { ip, error: (err as any).message });
    return handleError(res, err);
  }
}

async function updateAlias(req: any, res: any) {
  const ip   = getClientIp(req);
  const data = parseBody(OpponentAliasUpdateSchema, req.body, res);
  if (!data) return;
  try {
    await prisma.opponentAlias.update({
      where: { id: data.id },
      data:  { myName: data.myName, listingName: data.listingName, notes: data.notes ?? null },
    });
    auditLog("opponent_alias_updated", { ip, id: data.id });
    return res.status(200).json({ ok: true });
  } catch (err) {
    return handleError(res, err);
  }
}

async function deleteAlias(req: any, res: any) {
  const ip   = getClientIp(req);
  const data = parseBody(OpponentAliasDeleteSchema, req.body, res);
  if (!data) return;
  try {
    await prisma.opponentAlias.delete({ where: { id: data.id } });
    auditLog("opponent_alias_deleted", { ip, id: data.id });
    return res.status(200).json({ ok: true });
  } catch (err) {
    return handleError(res, err);
  }
}

export default requireAuth(async function handler(req: any, res: any) {
  if (req.method === "GET")    return listAliases(req, res);
  if (req.method === "POST")   return createAlias(req, res);
  if (req.method === "PUT")    return updateAlias(req, res);
  if (req.method === "DELETE") return deleteAlias(req, res);
  return res.status(405).json({ error: "Method not allowed" });
});
