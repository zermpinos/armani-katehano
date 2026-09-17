/**
 * pages/api/slack/interactivity.ts
 * POST - Slack block action callback.
 *
 * The poll reports a fixture whose opponent has no alias, with the name it
 * would suggest. Confirming here writes the alias so the next run can publish
 * the fixture, which is the whole point: a new opponent stops needing a deploy.
 *
 * Auth is the Slack signature alone. This route is deliberately outside
 * requireAuth and CSRF, both of which assume a browser session, so the
 * signature check below is the only thing standing in front of a write.
 */

import "@/server/_internal/node-only";
import prisma from "@/server/db/client";
import { auditLog } from "@/server/security/node";
import { securityHeaders } from "@/server/security/edge";
import { verifySlackSignature } from "@/server/integrations/slack/verify";
import { aliasKey } from "@/domain/import/opponents";

// Slack signs raw bytes, so the parsed body Next would hand us is useless here.
export const config = { api: { bodyParser: false } };

// A block action payload is a few KB. Anything larger is not Slack, and it is
// refused before the HMAC runs so an oversized body cannot be used to burn CPU.
const MAX_BODY_BYTES = 128 * 1024;

async function readRawBody(req: any): Promise<string | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) return null;
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

// Slack replaces the original message when the response says so, which is what
// turns the buttons into a record of who decided what.
const replace = (text: string) => ({ replace_original: true, text });

export default async function handler(req: any, res: any) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rawBody = await readRawBody(req);
  if (rawBody === null) {
    return res.status(413).json({ error: "Payload too large" });
  }

  const verified = verifySlackSignature({
    signature:     req.headers["x-slack-signature"],
    timestamp:     req.headers["x-slack-request-timestamp"],
    rawBody,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
  });

  if (!verified.ok) {
    // The reason is recorded but never returned: an unverified caller learns
    // only that it was refused.
    auditLog("slack_interactivity_rejected", { reason: verified.reason });
    return res.status(401).json({ error: "Unauthorized" });
  }

  let payload: any;
  try {
    const raw = new URLSearchParams(rawBody).get("payload");
    payload = JSON.parse(raw ?? "");
  } catch {
    return res.status(400).json({ error: "Malformed payload" });
  }

  const action = payload?.actions?.[0];
  const actor  = payload?.user?.username ?? payload?.user?.id ?? "unknown";
  if (!action?.action_id) {
    return res.status(400).json({ error: "No action in payload" });
  }

  // The signature proves Slack sent this, not that the values inside are sane,
  // so they are validated like any other input before a write.
  let scrapedName = "";
  let displayName = "";
  try {
    const value = JSON.parse(action.value ?? "{}");
    scrapedName = String(value.scrapedName ?? "").trim();
    displayName = String(value.displayName ?? "").trim();
  } catch {
    return res.status(400).json({ error: "Malformed action value" });
  }

  if (!scrapedName || !displayName || scrapedName.length > 200 || displayName.length > 200) {
    return res.status(400).json({ error: "Action value out of range" });
  }

  if (action.action_id === "alias_reject") {
    auditLog("slack_alias_rejected", { scrapedName, actor });
    return res.status(200).json(replace(
      `Left "${scrapedName}" unmapped, asked for by ${actor}. The fixture stays off the site until a name is set.`,
    ));
  }

  if (action.action_id !== "alias_confirm") {
    return res.status(400).json({ error: "Unknown action" });
  }

  try {
    // Keyed the same way the lookup normalises, so confirming twice updates
    // rather than colliding on the unique index.
    await prisma.opponentAlias.upsert({
      where:  { scrapedName: aliasKey(scrapedName) },
      update: { displayName },
      create: { scrapedName: aliasKey(scrapedName), displayName },
    });
    auditLog("slack_alias_confirmed", { scrapedName, displayName, actor });
    return res.status(200).json(replace(
      `"${scrapedName}" will show as ${displayName}, confirmed by ${actor}. The next run publishes the fixture.`,
    ));
  } catch (err: any) {
    auditLog("slack_alias_failed", { scrapedName, error: err?.message });
    return res.status(200).json(replace(
      `Could not save "${scrapedName}". It stays unmapped and will be raised again on the next run.`,
    ));
  }
}
