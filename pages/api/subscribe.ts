/**
 * pages/api/subscribe.ts  (public -- no auth required)
 *
 * POST  { email }               -> subscribe
 * DELETE { token }              -> unsubscribe via token (linked from emails)
 */

import { z } from "zod";
import { randomBytes } from "crypto";
import prisma from "../../lib/prisma";
import { prodError } from "../../lib/utils";

const SubscribeSchema = z.object({
  email: z.string().email().max(254).transform(v => v.toLowerCase().trim()),
});

const UnsubscribeSchema = z.object({
  token: z.string().min(32).max(128),
});

export default async function handler(req: any, res: any) {
  // ── SUBSCRIBE ──────────────────────────────────────────────────────────────
  if (req.method === "POST") {
    const parsed = SubscribeSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid email address" });
    }
    const { email } = parsed.data;

    try {
      const existing = await prisma.subscriber.findUnique({ where: { email } });
      if (existing) {
        // Already subscribed -- return success silently (don't reveal existence)
        return res.status(200).json({ ok: true });
      }

      const token = randomBytes(32).toString("hex");
      await prisma.subscriber.create({
        data: { email, token, confirmedAt: new Date() },
      });

      return res.status(201).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: prodError(err) });
    }
  }

  // ── UNSUBSCRIBE ────────────────────────────────────────────────────────────
  if (req.method === "DELETE") {
    const parsed = UnsubscribeSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid unsubscribe token" });
    }
    const { token } = parsed.data;

    try {
      await prisma.subscriber.delete({ where: { token } });
      return res.status(200).json({ ok: true });
    } catch {
      // Token not found -- treat as success to avoid token enumeration
      return res.status(200).json({ ok: true });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
