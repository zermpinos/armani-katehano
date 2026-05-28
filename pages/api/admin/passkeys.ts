import { requireAuth }     from "@/server/auth/middleware/require-admin";
import { securityHeaders } from "@/server/security/edge";
import { auditLog }        from "@/server/security/node";
import prisma              from "@/server/db/client";

async function handler(req: any, res: any) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  const username = req.adminUser as string;

  if (req.method === "GET") {
    const rows = await prisma.passkeyCredential.findMany({
      where:   { username },
      select:  { id: true, label: true, createdAt: true, lastUsedAt: true, transports: true },
      orderBy: { createdAt: "asc" },
    });
    return res.status(200).json(rows);
  }

  if (req.method === "DELETE") {
    const { id } = req.body ?? {};
    if (typeof id !== "string" || !id) {
      return res.status(400).json({ error: "id is required" });
    }

    const row = await prisma.passkeyCredential.findUnique({ where: { id } });
    // Return 404 regardless of whether the row exists or belongs to another user
    // so we don't leak cross-admin credential existence
    if (!row || row.username !== username) {
      return res.status(404).json({ error: "Not found" });
    }

    await prisma.passkeyCredential.delete({ where: { id } });
    auditLog("passkey_delete", { username, id });

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default requireAuth(handler);
