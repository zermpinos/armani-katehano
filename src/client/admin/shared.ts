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
  credential?: { username: string } | null;
  invites?: { expiresAt: string }[];
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

export interface RecentGame {
  id: string;
  result: "W" | "L" | "T";
  opponent: string;
  teamScore: number;
  opponentScore: number;
  playedOn: string;
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
  round: string;
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
}

export interface League {
  id: string;
  name: string;
  organizer?: string;
  level?: string;
}

export interface DashboardData {
  record?: { wins: number; losses: number };
  ppg?: number | string;
  rpg?: number | string;
  apg?: number | string;
  currentSeason?: string;
  totalGames?: number;
  totalPlayers?: number;
  totalSeasonLeagues?: number;
  recentGames?: RecentGame[];
}

export const byJersey = (a: Player, b: Player) => Number(a.number) - Number(b.number);
