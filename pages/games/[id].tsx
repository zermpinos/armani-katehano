import Link from "next/link";
import Layout from "@/components/ui/Layout";
import { SectionHeading } from "@/components/ui";
import { BoxScoreTable } from "@/client/games/box-score";
import { getGameById, getGameIds } from "@/server/db/repositories";
import { SITE_NAME } from "@/domain/shared/constants";

export default function GamePage({ game }: { game: any }) {
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
        label={`${game.season.replace(/-/g, "–")} · ${game.leagueName}`}
        title={`${game.home ? "vs" : "@"} ${game.opponent}`}
        right={game.date}
      />
      <BoxScoreTable game={game} />
    </Layout>
  );
}

export async function getStaticPaths() {
  const ids = await getGameIds();
  return {
    paths: ids.map((id: string) => ({ params: { id } })),
    fallback: "blocking",
  };
}

export async function getStaticProps({ params }: any) {
  try {
    const game = await getGameById(params.id as string);
    if (!game) return { notFound: true };
    return { props: { game }, revalidate: 86400 };
  } catch {
    return { notFound: true };
  }
}
