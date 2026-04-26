/**
 * Renders the roster-announcement email using real DB data.
 *
 * Preference order:
 *   1. Most recent published GameRosterAnnouncement (real game + real picks).
 *   2. Fallback: soonest UpcomingGame + all active players, marking the 5
 *      lowest jersey numbers as starters so the divider is exercised.
 *
 * Run: npx tsx scripts/preview-roster-email.ts
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import prisma from "@/server/db/client";
import { buildHtml, buildText, type Game, type PlayerSlot } from "@/server/integrations/email/templates";

const HTML_OUT = "/tmp/roster-preview.html";
const TEXT_OUT = "/tmp/roster-preview.txt";

async function loadFromAnnouncement(): Promise<{ game: Game; players: PlayerSlot[]; message: string | null; source: string } | null> {
  const a = await prisma.gameRosterAnnouncement.findFirst({
    orderBy: { publishedAt: "desc" },
    include: {
      upcomingGame: true,
      players: { include: { player: { select: { name: true, number: true } } } },
    },
  });
  if (!a) return null;
  return {
    source:  `announcement ${a.id} (${a.upcomingGame.opponent})`,
    message: a.message ?? null,
    game: {
      opponent:     a.upcomingGame.opponent,
      scheduledFor: a.upcomingGame.scheduledFor.toISOString(),
      location:     a.upcomingGame.location,
      competition:  a.upcomingGame.competition ?? null,
      notes:        a.upcomingGame.notes ?? null,
    },
    players: a.players.map(p => ({
      name:   p.player.name,
      number: p.player.number,
      note:   p.note ?? null,
    })),
  };
}

async function loadFromFallback(): Promise<{ game: Game; players: PlayerSlot[]; message: string | null; source: string } | null> {
  const now  = new Date();
  const game = await prisma.upcomingGame.findFirst({
    where:   { scheduledFor: { gte: now } },
    orderBy: { scheduledFor: "asc" },
  }) ?? await prisma.upcomingGame.findFirst({ orderBy: { scheduledFor: "desc" } });
  if (!game) return null;

  const allPlayers = await prisma.player.findMany({
    where:   { isActive: true },
    orderBy: { number: "asc" },
    select:  { name: true, number: true },
  });
  if (allPlayers.length === 0) return null;

  const starterCount = Math.min(5, allPlayers.length);
  const players: PlayerSlot[] = allPlayers.map((p, i) => ({
    name:   p.name,
    number: p.number,
    note:   i < starterCount ? "starting" : null,
  }));

  return {
    source:  `fallback: upcoming ${game.id} (${game.opponent}) + ${allPlayers.length} active players, lowest ${starterCount} jerseys marked starting`,
    message: null,
    game: {
      opponent:     game.opponent,
      scheduledFor: game.scheduledFor.toISOString(),
      location:     game.location,
      competition:  game.competition ?? null,
      notes:        game.notes ?? null,
    },
    players,
  };
}

async function main() {
  const data = (await loadFromAnnouncement()) ?? (await loadFromFallback());
  if (!data) {
    console.error("No real data available (no announcements, upcoming games, or active players).");
    process.exit(1);
  }

  const appUrl         = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "https://armanikatehano.gr";
  const unsubscribeUrl = `${appUrl}/unsubscribe?token=preview`;

  const html = buildHtml(data.game, data.players, data.message, appUrl, unsubscribeUrl);
  const text = buildText(data.game, data.players, data.message, appUrl, unsubscribeUrl);

  writeFileSync(HTML_OUT, html, "utf8");
  writeFileSync(TEXT_OUT, text, "utf8");

  const starters = data.players.filter(p => /^start(er|ing)?$/i.test((p.note ?? "").trim())).length;
  console.log(`Source:  ${data.source}`);
  console.log(`Players: ${data.players.length} (${starters} starters, ${data.players.length - starters} bench)`);
  console.log(`HTML ->   ${HTML_OUT}`);
  console.log(`TEXT ->   ${TEXT_OUT}`);
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
