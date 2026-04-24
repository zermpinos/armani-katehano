/**
 * pages/api/webhooks/sportstats-game-email.ts
 *
 * POST -- Postmark Inbound webhook. Triggered when info@sportstats.gr sends a
 * game-end confirmation email that Proton forwards to our Postmark inbound address.
 *
 * Security: HMAC-SHA256 (primary) + IP allowlist (defense-in-depth).
 * Postmark never retries on 2xx, so we always return 200 unless HMAC is wrong (401).
 */

import crypto          from "crypto";
import type { IncomingMessage, ServerResponse } from "http";
import { auditLog }    from "@/server/security/audit-log";
import { getClientIp } from "@/server/security/client-ip";
import { parseSubject } from "@/server/services/parse-game-email-subject";
import { matchUpcomingGame } from "@/server/services/match-upcoming-game";
import { processJob }  from "@/server/services/import-job";
import { sendAdminAlert } from "@/server/integrations/email/client";
import prisma           from "@/server/db/client";

export const config = { api: { bodyParser: false } };

// Postmark's published inbound webhook IPs (updated 2025-Q4)
const POSTMARK_IPS = new Set([
  "3.134.147.250",
  "50.31.156.6",
  "50.31.156.77",
  "18.217.206.57",
]);

const ALLOWED_FROM = "info@sportstats.gr";

function allowedIps(): Set<string> {
  const override = process.env.POSTMARK_ALLOWED_IPS;
  if (override) return new Set(override.split(",").map(s => s.trim()).filter(Boolean));
  return POSTMARK_IPS;
}

async function getRawBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end",  () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function verifyHmac(secret: string, rawBody: Buffer, headerValue: string): boolean {
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(headerValue));
  } catch {
    return false;
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  const rawBody = await getRawBody(req);

  // HMAC verification -- return 401 on failure (Postmark won't retry on 4xx)
  const secret    = process.env.POSTMARK_WEBHOOK_SECRET ?? "";
  const sigHeader = ((req as any).headers?.["x-postmark-signature-256"] as string | undefined) ?? "";

  if (!secret || !verifyHmac(secret, rawBody, sigHeader)) {
    auditLog("webhook_hmac_failed", { ip: getClientIp(req as any) });
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }

  // IP allowlist -- defense-in-depth; log warning but do not reject (HMAC passed)
  const ip = getClientIp(req as any);
  if (!allowedIps().has(ip)) {
    auditLog("webhook_unknown_ip", { ip });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // Verify sender
  const from: string = (payload.FromFull?.Email ?? payload.From ?? "").toLowerCase().trim();
  if (from !== ALLOWED_FROM) {
    auditLog("webhook_ignored_sender", { from });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  const subject: string = payload.Subject ?? "";

  // Parse subject
  const parsed = parseSubject(subject);
  if (!parsed) {
    auditLog("webhook_subject_unmatched", { subject });
    await sendAdminAlert({
      subject: "[AK] Import webhook: subject could not be parsed",
      body: `Received email from ${ALLOWED_FROM} with unrecognisable subject:\n\n  "${subject}"\n\nPlease check and import manually if needed.`,
    });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // Fuzzy-match UpcomingGame
  const match = await matchUpcomingGame(parsed.dateStr, parsed.opponent);

  if (!match) {
    auditLog("webhook_no_upcoming_game", { dateStr: parsed.dateStr, opponent: parsed.opponent });
    await sendAdminAlert({
      subject: "[AK] Import webhook: no matching upcoming game",
      body: `Received game-end email for "${parsed.opponent}" on ${parsed.dateStr}, but no matching UpcomingGame was found.\n\nSubject: "${subject}"\n\nPlease schedule the game or import manually.`,
    });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (!match.sourceUrl) {
    auditLog("webhook_no_source_url", { upcomingGameId: match.id, opponent: match.opponent });
    await sendAdminAlert({
      subject: "[AK] Import webhook: sourceUrl missing",
      body: `Matched "${match.opponent}" (${match.scheduledFor.toISOString().slice(0, 10)}) to UpcomingGame ${match.id}, but sourceUrl is not set.\n\nSubject: "${subject}"\n\nPlease set the sourceUrl and re-run import.`,
    });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // Retrieve or create job
  let job = match.importJobs[0] ?? null;

  if (job?.state === "IMPORTED") {
    auditLog("webhook_already_imported", { upcomingGameId: match.id, jobId: job.id });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (!job) {
    job = await prisma.gameImportJob.create({
      data: { upcomingGameId: match.id, sourceUrl: match.sourceUrl, state: "PENDING" },
    });
  }

  auditLog("webhook_triggering_import", { upcomingGameId: match.id, jobId: job.id, opponent: match.opponent });

  // Fire and forget -- Postmark needs a quick 200, import may take several seconds
  void processJob(job.id).catch(err =>
    auditLog("webhook_process_job_error", { jobId: job!.id, error: (err as any).message }),
  );

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true }));
}
