/**
 * scripts/preview-game-imported-email.ts
 *
 * Renders the game-imported email using the latest played Game in the DB.
 *
 * Default mode:
 *   npx tsx scripts/preview-game-imported-email.ts
 *     Writes /tmp/ak-game-imported-preview.{html,txt}. No mail is sent.
 *
 * Test-send mode:
 *   npx tsx scripts/preview-game-imported-email.ts --to=<email>
 *     Delivers the rendered recap to that one address for visual QA.
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import prisma from "@/server/db/client";
import {
  buildGameImportedHtml,
  buildGameImportedText,
  type GameImportedGame,
  type TopPerformer,
  type GameEmailContext,
} from "@/server/integrations/email/templates";
import { sendGameImportedTestEmail } from "@/server/integrations/email/client";
import { fetchBroadcastEnrichment } from "@/server/services/broadcast-import";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HTML_OUT    = "/tmp/ak-game-imported-preview.html";
const TEXT_OUT    = "/tmp/ak-game-imported-preview.txt";
const USAGE       = "Usage: npx tsx scripts/preview-game-imported-email.ts [--to=<email>]";

function parseTo(argv: string[]): string | null {
  let to: string | null = null;
  for (const arg of argv) {
    if (arg.startsWith("--to=")) {
      const email = arg.slice("--to=".length);
      if (!EMAIL_REGEX.test(email)) {
        console.error(`Invalid email: ${email}`);
        process.exit(1);
      }
      to = email;
    } else {
      console.error(`Unknown flag: ${arg}`);
      console.error(USAGE);
      process.exit(1);
    }
  }
  return to;
}

async function loadLatestGame(): Promise<{
  game:           GameImportedGame;
  topPerformers:  TopPerformer[];
  ctx:            GameEmailContext;
} | null> {
  const g = await prisma.game.findFirst({
    orderBy: { playedOn: "desc" },
    include: { seasonLeague: { include: { league: { select: { name: true } } } } },
  });
  if (!g) return null;

  const game: GameImportedGame = {
    id:            g.id,
    opponent:      g.opponent,
    location:      g.location,
    teamScore:     g.teamScore,
    opponentScore: g.opponentScore,
    result:        g.result,
    playedOn:      g.playedOn,
    venueNote:     g.notes,
    competition:   g.seasonLeague.league.name,
  };

  const { topPerformers, ctx } = await fetchBroadcastEnrichment(g.id, g.seasonLeagueId, g.playedOn);

  return { game, topPerformers, ctx };
}

async function main(): Promise<void> {
  const to   = parseTo(process.argv.slice(2));
  const data = await loadLatestGame();
  if (!data) {
    console.error("No Game rows found. Import a game first.");
    process.exit(1);
  }

  const { game, topPerformers, ctx } = data;
  const appUrl             = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "https://armani-katehano.com";
  const previewUnsubscribe = `${appUrl}/unsubscribe?token=PREVIEW_TOKEN`;

  const html = buildGameImportedHtml(game, topPerformers, ctx, appUrl, previewUnsubscribe);
  const text = buildGameImportedText(game, topPerformers, ctx, appUrl, previewUnsubscribe);

  writeFileSync(HTML_OUT, html, "utf8");
  writeFileSync(TEXT_OUT, text, "utf8");

  const vsAt = game.location === "home" ? "vs" : "@";
  console.log(`Source:  ${game.id} ${vsAt} ${game.opponent} (${game.playedOn.toISOString().slice(0, 10)})`);
  console.log(`Score:   ${game.teamScore}-${game.opponentScore} (${game.result})`);
  console.log(`Top:     ${topPerformers.length} performer${topPerformers.length === 1 ? "" : "s"}`);
  console.log(`Stats:   FG% ${ctx.teamStats?.fgPct ?? "n/a"}  REB ${ctx.teamStats?.teamReb ?? "n/a"}  TOV ${ctx.teamStats?.teamTov ?? "n/a"}`);
  console.log(`Record:  ${ctx.record ? `${ctx.record.wins}-${ctx.record.losses}` : "n/a"}`);
  console.log(`Next:    ${ctx.nextGame?.opponent ?? "none"}`);
  console.log(`HTML ->  ${HTML_OUT}`);
  console.log(`TEXT ->  ${TEXT_OUT}`);

  if (to) {
    console.log(`Sending test email to ${to}...`);
    try {
      await sendGameImportedTestEmail({ to, game, topPerformers, ctx });
      console.log(`Test send to ${to} dispatched.`);
    } catch (err: unknown) {
      console.error(`Test send failed: ${(err as Error).message}`);
      process.exit(2);
    }
  }
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
