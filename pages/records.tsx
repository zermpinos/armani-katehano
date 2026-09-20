import Layout from "@/components/ui/Layout";
import { SectionHeading } from "@/components/ui";
import { getAllPublicData, getGames } from "@/server/db/repositories";
import { computeRecord } from "@/domain/games/score";
import { teamRecords, playerGameRecords } from "@/domain/stats";
import { TeamRecordTiles, SeasonBySeason } from "@/client/records/team-records";
import { PlayerRecordRows } from "@/client/records/player-records";

export default function RecordsPage({ players, gamesBySeason, seasons }: any) {
  // Records are the whole history by definition, so this page has no season
  // selector: the other pages scope to a season, this one never does.
  const games = seasons.flatMap((s: string) => (Reflect.get(gamesBySeason as object, s) ?? []) as any[]);

  const nameById = new Map<string, string>(players.map((p: any) => [p.id, p.name]));
  const leaders  = playerGameRecords(games)
    .map(r => ({ ...r, playerName: nameById.get(r.playerId) ?? "" }))
    .filter(r => r.playerName);

  const seasonRows = [...seasons]
    .sort((a: string, b: string) => b.localeCompare(a))
    .map((season: string) => ({ season, rec: computeRecord((Reflect.get(gamesBySeason as object, season) ?? []) as any[]) }))
    .filter(row => row.rec.gp > 0);

  return (
    <Layout
      title="Records"
      ogDescription="Team and single-game records across every Armani Katehano season."
    >
      <SectionHeading title="Records" right={games.length > 0 ? `${games.length} Games` : undefined} />

      {games.length === 0 ? (
        <p className="text-center text-ak-text-dim text-[13px] py-6">No games recorded yet.</p>
      ) : (
        <>
          <TeamRecordTiles records={teamRecords(games)} />
          <PlayerRecordRows records={leaders} />
          <SeasonBySeason rows={seasonRows} />
        </>
      )}
    </Layout>
  );
}

export async function getStaticProps() {
  try {
    const { seasons, players } = await getAllPublicData(null);
    // Every season's games, the same read the team stats page does, because a
    // record is only a record against all of them.
    const gamesBySeason = Object.fromEntries(
      await Promise.all(seasons.map(async (s: string) => [s, await getGames(s)])),
    );
    return { props: { players, gamesBySeason, seasons }, revalidate: 3600 };
  } catch {
    // DB unavailable at build time (e.g. CI); ISR revalidates on first request.
    return { props: { players: [], gamesBySeason: {}, seasons: [] }, revalidate: 60 };
  }
}
