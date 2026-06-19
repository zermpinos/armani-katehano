import "@/server/_internal/node-only";

export type RevalidateFn = (path: string) => Promise<unknown>;

const LISTINGS_STATS_AND_HOME = ["/", "/players", "/leaderboard", "/games", "/team-stats", "/sitemap.xml"] as const;
const LISTINGS_STATS          = ["/leaderboard", "/players", "/games", "/team-stats"] as const;
const LISTINGS_ROSTER         = ["/", "/players", "/leaderboard", "/team-stats"] as const;
const LISTINGS_HOME_GAMES     = ["/", "/games", "/sitemap.xml"] as const;

async function fanout(revalidate: RevalidateFn | undefined, paths: readonly string[]) {
  if (!revalidate) return;
  await Promise.allSettled(paths.map((p) => revalidate(p)));
}

export interface GameMutationInvalidation {
  revalidate?: RevalidateFn;
  gameId: string;
  affectedPlayerSlugs?: readonly string[];
}

export async function invalidateForGameMutation(opts: GameMutationInvalidation) {
  const playerPaths = (opts.affectedPlayerSlugs ?? []).map((s) => `/players/${s}`);
  await fanout(opts.revalidate, [...LISTINGS_STATS_AND_HOME, `/games/${opts.gameId}`, ...playerPaths]);
}

export async function invalidateForScheduleMutation(opts: { revalidate?: RevalidateFn }) {
  await fanout(opts.revalidate, LISTINGS_HOME_GAMES);
}

export async function invalidateForRecalc(opts: { revalidate?: RevalidateFn }) {
  await fanout(opts.revalidate, LISTINGS_STATS_AND_HOME);
}

export async function invalidateForSeasonMutation(opts: { revalidate?: RevalidateFn }) {
  await fanout(opts.revalidate, LISTINGS_STATS);
}

export async function invalidateForLeagueMutation(opts: { revalidate?: RevalidateFn }) {
  await fanout(opts.revalidate, ["/games"]);
}

export async function invalidateForSeasonPhaseChange(opts: { revalidate?: RevalidateFn }) {
  await fanout(opts.revalidate, LISTINGS_HOME_GAMES);
}

export interface PlayerMutationInvalidation {
  revalidate?: RevalidateFn;
  playerSlug?: string;
  previousSlug?: string;
}

export async function invalidateForPlayerMutation(opts: PlayerMutationInvalidation) {
  const slugs = new Set<string>();
  if (opts.playerSlug)   slugs.add(opts.playerSlug);
  if (opts.previousSlug) slugs.add(opts.previousSlug);
  const playerPaths = [...slugs].map((s) => `/players/${s}`);
  await fanout(opts.revalidate, [...LISTINGS_ROSTER, ...playerPaths]);
}

export async function invalidateForRosterAnnouncement(opts: { revalidate?: RevalidateFn }) {
  await fanout(opts.revalidate, ["/"]);
}

export async function invalidateForPopupConfig(opts: { revalidate?: RevalidateFn }): Promise<void> {
  await fanout(opts.revalidate, ["/"]);
}
