/**
 * pages/api/cron/poll-imports.ts
 *
 * GET - daily cron. Scrapes the source URL of every recently played scheduled
 * game and commits the ones that come back complete and internally consistent.
 * Every other outcome is a skip: the game stays in the admin's quick-import
 * list exactly as it does today, so the poll can only ever add work it finished.
 *
 * A skip nobody hears about is indistinguishable from a quiet week, so anything
 * that will not resolve itself on a later run is emailed to the admin.
 *
 * Auth: Vercel sends Authorization: Bearer <CRON_SECRET> automatically.
 */

import { timingSafeEqual } from "node:crypto";
import prisma              from "@/server/db/client";
import { securityHeaders } from "@/server/security/edge";
import { auditLog }        from "@/server/security/node";
import { startCronRun, finishCronRun } from "@/server/services/cron-run";
import { scrapeAndResolve } from "@/server/services/import-pipeline";
import { commitImport, CommitError } from "@/server/services/import-commit";
import { toCommitInput } from "@/domain/import/resolve";
import { GameWriteSchema } from "@/schemas/game";
import { sendImportNotification } from "@/server/integrations/email/client";

// Three scrapes at an 8s timeout each fits the function budget with room for
// the commits. A fourth game on one night waits for tomorrow's run.
const MAX_CANDIDATES = 3;
const SETTLE_MS      = 90 * 60 * 1000;
// A week, so a game that needs someone to act first (add a new player to the
// roster, configure a season that covers the date) still imports itself once
// they have. Anything unresolved for longer wants a person, not another scrape.
const LOOKBACK_MS    = 7 * 24 * 60 * 60 * 1000;
// One daily run short of the window closing. Past this, a reason that would
// normally sort itself out has no later run left to do it in.
const LAST_RUN_MS    = LOOKBACK_MS - 24 * 60 * 60 * 1000;

export const config = { maxDuration: 60 };

// transient: expected to resolve on a later run, so it does not raise an alert.
type Skip = { sourceUrl: string; reason: string; transient: boolean };

export default async function handler(req: any, res: any) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });

  const secret   = process.env.CRON_SECRET;
  const auth     = String(req.headers["authorization"] ?? "");
  const expected = `Bearer ${secret ?? ""}`;
  if (
    !secret ||
    auth.length !== expected.length ||
    !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))
  ) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const runId = await startCronRun("pollImports");

  try {
    const now = Date.now();
    const candidates = await prisma.upcomingGame.findMany({
      where: {
        sourceUrl:    { not: null },
        scheduledFor: { gte: new Date(now - LOOKBACK_MS), lte: new Date(now - SETTLE_MS) },
      },
      orderBy: { scheduledFor: "desc" },
      take:    MAX_CANDIDATES,
      select:  { sourceUrl: true, scheduledFor: true },
    });

    const urls = candidates.map(c => c.sourceUrl as string);

    // purge-upcoming-games only clears imported rows once a day, so a game
    // imported by hand this evening is still a candidate tonight. Checking here
    // keeps the poll from spending a scrape to earn a 409.
    const alreadyImported = new Set(
      (await prisma.game.findMany({
        where:  { sourceUrl: { in: urls } },
        select: { sourceUrl: true },
      })).map(g => g.sourceUrl),
    );

    const committed: { sourceUrl: string; gameId: string }[] = [];
    const skipped:   Skip[] = [];

    for (const candidate of candidates) {
      const sourceUrl  = candidate.sourceUrl as string;
      const lastChance = now - candidate.scheduledFor.getTime() > LAST_RUN_MS;
      const skip = (reason: string, transient = false) =>
        skipped.push({ sourceUrl, reason, transient: transient && !lastChance });

      // Not a problem at any age: the game is in, this row just outlived it.
      if (alreadyImported.has(sourceUrl)) {
        skipped.push({ sourceUrl, reason: "already imported", transient: true });
        continue;
      }

      try {
        const result = await scrapeAndResolve(sourceUrl);

        if (result.gameState.state !== "final") { skip(`state ${result.gameState.state}`, true); continue; }
        if (!result.gate.ok)                    { skip("failed verification");                   continue; }
        if (result.unresolved.length)           { skip("league unresolved");                     continue; }
        if (result.unresolvedPlayers.length)    { skip("player not on roster");                  continue; }
        if (result.unknownOpponent)             { skip(`unknown opponent "${result.unknownOpponent}"`); continue; }

        // Same validation the admin's save goes through. The draft is derived
        // server-side, but the URL behind it is admin-entered.
        const parsed = GameWriteSchema.safeParse(toCommitInput(result.draft));
        if (!parsed.success) { skip("draft failed schema validation"); continue; }

        const { gameId } = await commitImport(parsed.data, {
          revalidate: (p: string) => res.revalidate?.(p),
        });
        committed.push({ sourceUrl, gameId });
        auditLog("poll_import_committed", { gameId, sourceUrl });
      } catch (err: any) {
        skip(err instanceof CommitError ? `commit: ${err.message}` : err.message);
      }
    }

    const stalled = skipped.filter(s => !s.transient);
    if (stalled.length) {
      await sendImportNotification({
        kind:    "stalled",
        entries: stalled.map(({ sourceUrl, reason }) => ({ sourceUrl, reason })),
      }).catch(err => console.error("[poll-imports] notify:", err));
    }

    const summary = { candidates: urls.length, committed, skipped };
    await finishCronRun(runId, { ok: true, summary });
    return res.status(200).json({ ok: true, committed: committed.length, skipped: skipped.length });
  } catch (err: any) {
    await finishCronRun(runId, { ok: false, error: err.message });
    await sendImportNotification({ kind: "stalled", entries: [], error: err.message })
      .catch(e => console.error("[poll-imports] notify:", e));
    console.error("[poll-imports]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
