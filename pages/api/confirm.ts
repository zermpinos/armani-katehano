/**
 * pages/api/confirm.ts  (public — no auth required)
 *
 * GET ?token=<hex>  → confirm a pending subscription (double opt-in)
 */

import prisma from "@/server/db/client";
import { securityHeaders } from "@/server/security/edge";
import { auditLog } from "@/server/security/node";
import { TokenSchema } from "@/schemas/subscriber";

const CONFIRM_TTL_MS = 86_400_000; // 1 day

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
      return res.redirect(302, `${appUrl}/?confirmed=0`);
    }

    // Already confirmed — idempotent success
    if (subscriber.confirmedAt) {
      return res.redirect(302, `${appUrl}/?confirmed=1`);
    }

    const expired = Date.now() - subscriber.createdAt.getTime() > CONFIRM_TTL_MS;
    if (expired) {
      await prisma.subscriber.delete({ where: { token } });
      auditLog("subscriber_confirm_expired", { emailHash: token.slice(0, 8) });
      return res.redirect(302, `${appUrl}/?confirmed=expired`);
    }

    await prisma.subscriber.update({
      where: { token },
      data:  { confirmedAt: new Date() },
    });
    auditLog("subscriber_confirmed", { emailHash: token.slice(0, 8) });

    return res.redirect(302, `${appUrl}/?confirmed=1`);
  } catch (err) {
    console.error("[confirm]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
