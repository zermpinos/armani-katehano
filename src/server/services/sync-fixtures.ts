import "@/server/_internal/node-only";
import prisma from "@/server/db/client";
import type { ListedGame } from "@/server/integrations/scraper/team-schedule";
import { displayOpponent, suggestDisplayName, type OpponentAliases } from "@/domain/import/opponents";
import { parseGreekDateTime } from "@/domain/calendar/greek-date";
import { sameSourceGame } from "@/domain/import/identity";

export interface FixtureChange {
  opponent: string;
  field:    "scheduledFor" | "location" | "notes";
  from:     string;
  to:       string;
}

export interface UnmappedFixture {
  scrapedName: string;
  suggestion:  string;
  dateText:    string;
}

export interface FixtureSync {
  created:  { opponent: string; scheduledFor: Date }[];
  changed:  FixtureChange[];
  unmapped: UnmappedFixture[];
  skipped:  string[];
}

// Fixtures the organisers have published, written to UpcomingGame so the site
// shows the next game without anyone retyping it.
//
// Rows are matched on the source game id and updated in place, never deleted and
// recreated: GameRosterAnnouncement hangs off the row, so a new id would orphan
// whatever the coach has already published.
export async function syncFixtures(
  fixtures: ListedGame[],
  aliases: OpponentAliases,
): Promise<FixtureSync> {
  const out: FixtureSync = { created: [], changed: [], unmapped: [], skipped: [] };
  if (fixtures.length === 0) return out;

  const seasonLeagues = await prisma.seasonLeague.findMany({
    where:   { season: { archivedAt: null } },
    include: { league: true },
  });
  const stored = await prisma.upcomingGame.findMany({ where: { sourceUrl: { not: null } } });

  for (const row of fixtures) {
    const scheduledFor = parseGreekDateTime(row.dateText, row.tipoff);
    if (!scheduledFor) {
      out.skipped.push(`${row.url}: could not read a date and time from "${row.dateText}"`);
      continue;
    }

    // A listing keeps last season's rows until the competition rolls over, and
    // a game the organisers never scored stays there looking unplayed forever.
    // Writing one would publish a months-old game as the next fixture, and the
    // purge would delete it again every night. Not news, so not reported.
    if (scheduledFor.getTime() < Date.now()) continue;

    if (!row.opponent) {
      out.skipped.push(`${row.url}: no opponent named in the listing`);
      continue;
    }

    // A name we cannot write is reported with a suggestion rather than guessed
    // at, the same rule the import already follows.
    const opponent = displayOpponent(row.opponent, aliases);
    if (!opponent) {
      out.unmapped.push({
        scrapedName: row.opponent,
        suggestion:  suggestDisplayName(row.opponent),
        dateText:    row.dateText,
      });
      continue;
    }

    const seasonLeague = seasonLeagues.find(sl => sl.league.sourceSlug === row.leagueSlug);
    if (!seasonLeague) {
      out.skipped.push(`${row.url}: no open season runs league "${row.leagueSlug}"`);
      continue;
    }

    const location = row.isHome ? "home" : "away";
    const existing = stored.find(f => sameSourceGame(f.sourceUrl, row.url));

    if (!existing) {
      await prisma.upcomingGame.create({
        data: {
          opponent, scheduledFor, location,
          round:       row.round,
          competition: seasonLeague.league.name,
          notes:       row.venue,
          seasonLeagueId: seasonLeague.id,
          sourceUrl:   row.url,
        },
      });
      out.created.push({ opponent, scheduledFor });
      continue;
    }

    // Only the fields the listing owns are compared, so an admin's edit to
    // anything else survives the next run.
    const diff: Record<string, unknown> = {};
    if (existing.scheduledFor.getTime() !== scheduledFor.getTime()) {
      out.changed.push({ opponent, field: "scheduledFor", from: existing.scheduledFor.toISOString(), to: scheduledFor.toISOString() });
      diff.scheduledFor = scheduledFor;
    }
    if (existing.location !== location) {
      out.changed.push({ opponent, field: "location", from: existing.location, to: location });
      diff.location = location;
    }
    if (row.venue && existing.notes !== row.venue) {
      out.changed.push({ opponent, field: "notes", from: existing.notes ?? "", to: row.venue });
      diff.notes = row.venue;
    }

    // Follows the path the listing uses now; readers never see it, so it is not reported.
    if (existing.sourceUrl !== row.url) diff.sourceUrl = row.url;

    if (Object.keys(diff).length > 0) {
      await prisma.upcomingGame.update({ where: { id: existing.id }, data: diff });
    }
  }

  return out;
}
