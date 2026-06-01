/**
 * pages/api/confirm.ts  (public - no auth required)
 *
 * GET ?token=<hex>  -> confirm a pending subscription (double opt-in)
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
  // 'token' here carries the confirmToken value - not the permanent unsubscribe token
  const { token } = parsed.data;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  try {
    const subscriber = await prisma.subscriber.findUnique({ where: { confirmToken: token } });

    if (!subscriber) {
      // Token not found: either already confirmed (confirmToken was nulled) or invalid.
      // Redirect to success - a re-click of a used confirmation link should not show an error.
      return res.redirect(302, `${appUrl}/?confirmed=1`);
    }

    const expired = Date.now() - subscriber.createdAt.getTime() > CONFIRM_TTL_MS;
    if (expired) {
      try {
        await prisma.subscriber.delete({ where: { confirmToken: token } });
      } catch (err: any) {
        if (err?.code !== "P2025") throw err;
        // Concurrent expiry delete already removed the row - treat as success
      }
      auditLog("subscriber_confirm_expired", { tokenPrefix: token.slice(0, 8) });
      return res.redirect(302, `${appUrl}/?confirmed=expired`);
    }

    try {
      await prisma.subscriber.update({
        where: { confirmToken: token },
        data:  { confirmedAt: new Date(), confirmToken: null },
      });
    } catch (err: any) {
      if (err?.code === "P2025") {
        // Concurrent confirm won the race - this token was already nulled. Treat as success.
        return res.redirect(302, `${appUrl}/?confirmed=1`);
      }
      throw err;
    }
    auditLog("subscriber_confirmed", { tokenPrefix: token.slice(0, 8) });

    return res.redirect(302, `${appUrl}/?confirmed=1`);
  } catch (err) {
    console.error("[confirm]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
