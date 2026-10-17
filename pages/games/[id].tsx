import Link from "next/link";
import Layout from "@/components/ui/Layout";
import { SectionHeading } from "@/components/ui";
import { BoxScoreTable } from "@/client/games/box-score";
import { getGameById, getAllGames } from "@/server/db/repositories";
import { HeadToHeadBlock } from "@/client/games/HeadToHeadBlock";
import { headToHead, type HeadToHead } from "@/domain/stats/head-to-head";
import { SITE_NAME } from "@/domain/shared/constants";

export default function GamePage({ game, earlier }: { game: any; earlier: HeadToHead }) {
  return (
    <Layout
      title={`${game.home ? "vs" : "@"} ${game.opponent} · ${game.result} ${game.score}`}
      ogDescription={`Box score: ${SITE_NAME} ${game.home ? "vs" : "at"} ${game.opponent} on ${game.date}. Result: ${game.result} ${game.score}.`}
    >
      <Link
        href="/games"
        className="text-[11px] font-bold text-ak-text-dim inline-block mb-4 hover:text-ak-text transition-colors duration-150"
      >
        ← Games
      </Link>
      <SectionHeading
        label={`${game.season} · ${game.leagueName}`}
        title={`${game.home ? "vs" : "@"} ${game.opponent}`}
        right={game.date}
      />
      <BoxScoreTable game={game} />
      <HeadToHeadBlock h2h={earlier} title="Earlier meetings" emptyText="First meeting between the teams." showAllLink />
    </Layout>
  );
}

const CUID_RE = /^c[0-9a-z]{24}$/;

export async function getStaticPaths() {
  try {
    const { getGameIds } = await import("@/server/db/repositories");
    const ids = await getGameIds();
    return {
      paths: ids.map((id: string) => ({ params: { id } })),
      fallback: "blocking" as const,
    };
  } catch (err) {
    console.error("[getStaticPaths] /games/[id] DB read failed", err);
    return { paths: [], fallback: "blocking" as const };
  }
}

export async function getStaticProps({ params }: any) {
  const { id } = params;
  if (!CUID_RE.test(id)) return { notFound: true };
  try {
    const game = await getGameById(id);
    if (!game) return { notFound: true };
    // Only earlier games, so this section never changes once the game is played.
    const earlier = headToHead(await getAllGames(), game.opponent, { before: game.date, limit: 3 });
    return { props: { game, earlier }, revalidate: 86400 };
  } catch {
    return { notFound: true };
  }
}
