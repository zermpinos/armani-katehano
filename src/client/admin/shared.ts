export interface Player {
  id: string;
  name: string;
  number: string | number;
  position: string;
  height?: string;
  weight?: string;
  photoUrl?: string | null;
  contactEmail?: string | null;
  isActive?: boolean;
}

export interface BoxScoreRow {
  playerId: string;
  min?: number;
  minutes?: number;
  pts?: number;
  reb?: number;
  orb?: number;
  drb?: number;
  ast?: number;
  stl?: number;
  blk?: number;
  tov?: number;
  pf?: number;
  fgm?: number;
  fga?: number;
  fg2m?: number;
  fg2a?: number;
  fg3m?: number;
  fg3a?: number;
  ftm?: number;
  fta?: number;
  eff?: number;
}

export interface Game {
  id: string;
  result: "W" | "L" | "T";
  opponent: string;
  teamScore: number;
  opponentScore: number;
  score?: string;
  date?: string;
  playedOn?: string;
  home?: boolean;
  location?: "home" | "away";
  seasonLeagueId: string;
  sourceUrl?: string | null;
  youtubeUrl?: string | null;
  boxScore?: BoxScoreRow[];
}

export interface ScheduledGame {
  id: string;
  opponent: string;
  scheduledFor: string;
  location: "home" | "away";
  competition?: string | null;
  notes?: string | null;
  sourceUrl?: string | null;
}

export interface SeasonLeague {
  id: string;
  leagueName: string;
  leagueSlug: string;
  seasonName: string;
}

export interface Season {
  id: string;
  name: string;
  year: string | number;
  startDate?: string;
  endDate?: string;
  archivedAt?: string | null;
  gameCount?: number;
}

export interface League {
  id: string;
  name: string;
  organization: string;
  sourceSlug?: string | null;
  listingUrl?: string | null;
  organizer?: string;
  level?: string;
}

export const byJersey = (a: Player, b: Player) => Number(a.number) - Number(b.number);
