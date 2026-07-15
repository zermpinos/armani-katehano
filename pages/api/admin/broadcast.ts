import { requireAuth, rlKeyBigInt } from "@/server/auth";
import prisma              from "@/server/db/client";
import { auditLog }        from "@/server/security/node/audit-log";
import { prodError }       from "@/domain/shared/format";
import { BroadcastSchema } from "@/schemas/broadcast";
import {
  renderMarkdown,
  buildBroadcastHtml,
  buildBroadcastText,
} from "@/server/integrations/email/templates/broadcast";
import nodemailer from "nodemailer";

const FROM          = "Armani Katehano <noreply@armani-katehano.com>";
const LIMIT_DEFAULT = 20;
const LIMIT_MAX     = 50;

const SEND_COOLDOWN_MS = 120_000;
const DAILY_WINDOW_MS  = 86_400_000;
const DAILY_LIMIT      = 5;
// Sends are capped globally, not per caller, so every send contends one key.
const SEND_LOCK_KEY    = rlKeyBigInt("broadcast_send");

function createTransport(): nodemailer.Transporter | null {
  const user = process.env.BREVO_SMTP_USER;
  const pass = process.env.BREVO_SMTP_PASS;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    host:   "smtp-relay.brevo.com",
    port:   587,
    secure: false,
    auth:   { user, pass },
  });
}

async function handler(req: any, res: any) {
  if (req.method === "GET") {
    const rawLimit = parseInt(String(req.query.limit ?? LIMIT_DEFAULT), 10);
    const limit    = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, LIMIT_MAX) : LIMIT_DEFAULT;
    try {
      const [logs, total] = await Promise.all([
        prisma.broadcastLog.findMany({
          orderBy: { sentAt: "desc" },
          take:    limit,
          select:  { id: true, subject: true, recipientCount: true, deliveredCount: true, failedCount: true, sentAt: true, sentToAll: true },
        }),
        prisma.broadcastLog.count(),
      ]);
      return res.status(200).json({ logs, total });
    } catch (err) {
      return res.status(500).json({ error: prodError(err) });
    }
  }

  if (req.method === "POST") {
    const parsed = BroadcastSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; "),
      });
    }
    const data = parsed.data;

    if (data.mode === "resolve") {
      try {
        const matched       = await prisma.subscriber.findMany({
          where:  { email: { in: data.targetEmails }, confirmedAt: { not: null } },
          select: { email: true },
        });
        const matchedEmails = new Set(matched.map(s => s.email));
        const unmatched     = data.targetEmails.filter(e => !matchedEmails.has(e));
        auditLog("broadcast_resolve_checked", { count: data.targetEmails.length });
        return res.status(200).json({
          matched:        matched.length,
          unmatchedCount: unmatched.length,
          unmatched:      unmatched.slice(0, 20),
        });
      } catch (err) {
        return res.status(500).json({ error: prodError(err) });
      }
    }

    const subject = data.subject.replace(/[\r\n]/g, " ");
    const body    = data.body;
    const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? "";

    if (data.mode === "preview") {
      const adminEmail = process.env.ADMIN_ALERT_EMAIL;
      if (!adminEmail) return res.status(400).json({ error: "Admin preview email not configured" });
      const transport = createTransport();
      if (!transport) return res.status(400).json({ error: "Email transport not configured" });
      try {
        const renderedHtml   = renderMarkdown(body);
        const previewSubject = "[PREVIEW] " + subject.slice(0, 190);
        const fakeUnsub      = `${appUrl}/unsubscribe?token=PREVIEW_TOKEN`;
        const html           = buildBroadcastHtml(renderedHtml, appUrl, fakeUnsub);
        const text           = buildBroadcastText(renderedHtml, appUrl, fakeUnsub);
        await transport.sendMail({ from: FROM, to: adminEmail, subject: previewSubject, html, text });
        auditLog("broadcast_preview_sent", { subjectLength: subject.length, bodyLength: body.length });
        return res.status(200).json({ ok: true, renderedHtml: String(renderedHtml) });
      } catch (err: any) {
        auditLog("broadcast_preview_failed", { error: err.message });
        return res.status(500).json({ error: prodError(err) });
      }
    }

    if (data.mode === "send") {
      const subscriberWhere: any = { confirmedAt: { not: null } };
      if (data.targetEmails && data.targetEmails.length > 0) {
        subscriberWhere.email = { in: data.targetEmails };
      }
      const subscribers = await prisma.subscriber.findMany({
        where:  subscriberWhere,
        select: { id: true, email: true, token: true },
      });

      if (subscribers.length === 0) {
        return res.status(400).json({ error: "No confirmed subscribers matched." });
      }

      const transport = createTransport();
      if (!transport) return res.status(500).json({ error: "Email transport not configured" });

      const renderedHtml = renderMarkdown(body);
      const resolvedIds  = subscribers.map(s => s.id);
      const sentToAll    = !data.targetEmails || data.targetEmails.length === 0;

      const claim = await prisma.$transaction(async (tx) => {
        // $executeRaw, not $queryRaw: pg_advisory_xact_lock() returns void, which
        // @prisma/adapter-neon refuses to deserialize (P2010).
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SEND_LOCK_KEY}::bigint)`;

        const recentSend = await tx.broadcastLog.findFirst({
          where:   { sentAt: { gt: new Date(Date.now() - SEND_COOLDOWN_MS) } },
          orderBy: { sentAt: "desc" },
        });
        if (recentSend) return { ok: false as const, reason: "cooldown" as const };

        const dailyCount = await tx.broadcastLog.count({
          where: { sentAt: { gt: new Date(Date.now() - DAILY_WINDOW_MS) } },
        });
        if (dailyCount >= DAILY_LIMIT) return { ok: false as const, reason: "daily" as const };

        // The log row is the claim. It commits while the lock is still held, so
        // the next caller's check sees it and cannot pass the same window.
        const log = await tx.broadcastLog.create({
          data: {
            subject,
            bodyMarkdown:   body,
            recipientCount: subscribers.length,
            failedIds:      [],
            sentToAll,
            targetIds:      sentToAll ? [] : resolvedIds,
          },
        });
        return { ok: true as const, log };
      });

      if (!claim.ok) {
        return res.status(429).json({
          error: claim.reason === "cooldown"
            ? "A broadcast was sent recently. Please wait before sending again."
            : "Daily broadcast limit reached.",
        });
      }

      const results = await Promise.allSettled(
        subscribers.map(sub => {
          const unsubscribeUrl = `${appUrl}/unsubscribe?token=${sub.token}`;
          const html = buildBroadcastHtml(renderedHtml, appUrl, unsubscribeUrl);
          const text = buildBroadcastText(renderedHtml, appUrl, unsubscribeUrl);
          return transport.sendMail({ from: FROM, to: sub.email, subject, html, text })
            .then(() => ({ id: sub.id, ok: true  as const }))
            .catch(() => ({ id: sub.id, ok: false as const }));
        }),
      );

      const delivered      = results.filter(r => r.status === "fulfilled" && r.value.ok).length;
      const failedIds      = results
        .filter(r => r.status === "fulfilled" && !r.value.ok)
        .map(r => (r as PromiseFulfilledResult<{ id: string; ok: false }>).value.id);
      const failedRejected = results.filter(r => r.status === "rejected").length;
      const failedCount    = failedIds.length + failedRejected;

      await prisma.broadcastLog.update({
        where: { id: claim.log.id },
        data:  { deliveredCount: delivered, failedCount, failedIds },
      });

      const deliveredIds = results
        .filter(r => r.status === "fulfilled" && r.value.ok)
        .map(r => (r as PromiseFulfilledResult<{ id: string; ok: true }>).value.id);
      if (deliveredIds.length > 0) {
        prisma.subscriber.updateMany({
          where: { id: { in: deliveredIds } },
          data:  { lastEmailedAt: new Date() },
        }).catch(() => {});
      }

      auditLog("broadcast_sent", {
        sentToAll,
        targetIds:      resolvedIds,
        recipientCount: subscribers.length,
        deliveredCount: delivered,
        failedCount,
        failedIds,
      });

      return res.status(200).json({ delivered, failed: failedCount });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default requireAuth(handler);
