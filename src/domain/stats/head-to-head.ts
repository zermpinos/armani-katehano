export interface MeetingSource {
  id:         string;
  date:       string;
  opponent:   string;
  home:       boolean;
  result:     string;
  score:      string;
  season:     string;
  leagueName: string;
}

export interface Meeting {
  id:          string;
  date:        string;
  season:      string;
  competition: string;
  home:        boolean;
  result:      string;
  score:       string;
}

export interface HeadToHead {
  opponent: string;
  slug:     string;
  wins:     number;
  losses:   number;
  ties:     number;
  meetings: Meeting[];
}

export function opponentSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// Dates are YYYY-MM-DD, so "before" compares as text; the record counts every meeting, the limit trims only the list.
export function headToHead(
  games: readonly MeetingSource[],
  opponent: string,
  opts: { before?: string; limit?: number } = {},
): HeadToHead {
  const mine = games
    .filter(g => g.opponent === opponent && (!opts.before || g.date < opts.before))
    .sort((a, b) => b.date.localeCompare(a.date));
  const count = (result: string) => mine.filter(g => g.result === result).length;
  return {
    opponent,
    slug:     opponentSlug(opponent),
    wins:     count("W"),
    losses:   count("L"),
    ties:     count("T"),
    meetings: mine.slice(0, opts.limit ?? mine.length).map(g => ({
      id: g.id, date: g.date, season: g.season, competition: g.leagueName, home: g.home, result: g.result, score: g.score,
    })),
  };
}

export function headToHeadAll(games: readonly MeetingSource[], limit: number): HeadToHead[] {
  return [...new Set(games.map(g => g.opponent))].map(name => headToHead(games, name, { limit }));
}

export function recordText(h: HeadToHead): string {
  return `${h.wins}-${h.losses}${h.ties ? `-${h.ties}` : ""}`;
}
