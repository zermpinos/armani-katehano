/**
 * pages/api/cron/poll-imports.ts
 *
 * GET - daily cron. Reads the team pages for games the organisers have posted a
 * result for, and commits the ones that come back complete and internally
 * consistent. Every other outcome is a skip, leaving the game to be imported by
 * hand exactly as before, so the poll can only ever add work it finished.
 *
 * Candidates come from the listing rather than from the schedule because the
 * game URL is not knowable before the organisers publish the fixture, so no one
 * can put it on an UpcomingGame row in advance.
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
import { parseGreekDate } from "@/domain/calendar/greek-date";
import { GameWriteSchema } from "@/schemas/game";
import { sendImportNotification } from "@/server/integrations/email/client";
import { discoverGames } from "@/server/services/discover-games";

// Three scrapes at an 8s timeout each fits the function budget with room for
// the commits, on top of the two listing fetches. A fourth game on one night
// waits for tomorrow's run.
const MAX_CANDIDATES = 3;
// A week, so a game that needs someone to act first (add a new player to the
// roster, name an unknown opponent) still imports itself once they have.
// Anything older is history rather than news, and stays out so a game that can
// never import does not raise an alert every night forever.
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
    const { games, errors } = await discoverGames();

    // Keyed on the game id rather than the URL: the same game has been served
    // under both /winter-cup/ and /super-winter-cup/, and one stored URL ends
    // in a newline. Matching on the string would import either one twice.
    const importedIds = new Set(
      (await prisma.game.findMany({ select: { sourceUrl: true } }))
        .map(g => (g.sourceUrl ?? "").trim().split("/id/")[1])
        .filter(Boolean),
    );

    const candidates = games
      .filter(g => !importedIds.has(g.gameId))
      .map(g => ({ ...g, playedOn: parseGreekDate(g.dateText) }))
      .filter(g => g.playedOn && now - g.playedOn.getTime() < LOOKBACK_MS)
      .sort((a, b) => b.playedOn!.getTime() - a.playedOn!.getTime())
      .slice(0, MAX_CANDIDATES);

    const committed: { sourceUrl: string; gameId: string }[] = [];
    const skipped:   Skip[] = [];
    for (const e of errors) skipped.push({ sourceUrl: "listing", reason: e, transient: false });

    for (const candidate of candidates) {
      const sourceUrl  = candidate.url;
      const lastChance = now - candidate.playedOn!.getTime() > LAST_RUN_MS;
      const skip = (reason: string, transient = false) =>
        skipped.push({ sourceUrl, reason, transient: transient && !lastChance });

      try {
        const result = await scrapeAndResolve(sourceUrl, { leagueSlug: candidate.leagueSlug });

        if (result.gameState.state !== "final") { skip(`state ${result.gameState.state}`, true); continue; }
        if (!result.gate.ok)                    { skip("failed verification");                   continue; }
        if (result.unresolved.length)           { skip("league unresolved");                     continue; }
        if (result.unresolvedPlayers.length)    { skip("player not on roster");                  continue; }
        if (result.unknownOpponent)             { skip(`unknown opponent "${result.unknownOpponent}"`); continue; }

        // Same validation the admin's save goes through. Round comes from the
        // listing label, which is the only place a playoff game says so.
        const parsed = GameWriteSchema.safeParse({ ...toCommitInput(result.draft), round: candidate.round });
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

    const summary = { listed: games.length, candidates: candidates.length, committed, skipped };
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
