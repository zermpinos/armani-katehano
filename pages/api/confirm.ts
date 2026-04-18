/**
 * pages/api/confirm.ts  (public — no auth required)
 *
 * GET ?token=<hex>  → confirm a pending subscription (double opt-in)
 */

import { z } from "zod";
import prisma from "../../lib/prisma";
import { securityHeaders, auditLog } from "../../lib/security";

const TokenSchema = z.object({
  token: z.string().min(32).max(128),
});

export default async function handler(req: any, res: any) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = TokenSchema.safeParse(req.query ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid confirmation token" });
  }
  const { token } = parsed.data;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  try {
    const subscriber = await prisma.subscriber.findUnique({ where: { token } });

    if (!subscriber) {
      // Token not found — redirect neutrally (don't reveal non-existence)
      return res.redirect(302, `${appUrl}/?confirmed=0`);
    }

    if (!subscriber.confirmedAt) {
      await prisma.subscriber.update({
        where: { token },
        data:  { confirmedAt: new Date() },
      });
      auditLog("subscriber_confirmed", { emailHash: token.slice(0, 8) });
    }

    return res.redirect(302, `${appUrl}/?confirmed=1`);
  } catch (err) {
    console.error("[confirm]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
