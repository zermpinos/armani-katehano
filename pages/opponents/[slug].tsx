import Link from "next/link";
import Layout from "@/components/ui/Layout";
import { SectionHeading } from "@/components/ui";
import { HeadToHeadBlock } from "@/client/games/HeadToHeadBlock";
import { getAllGames, getOpponentNames } from "@/server/db/repositories";
import { headToHead, opponentSlug, recordText, type HeadToHead } from "@/domain/stats/head-to-head";
import { SITE_NAME } from "@/domain/shared/constants";

export default function OpponentPage({ h2h }: { h2h: HeadToHead }) {
  const n = h2h.meetings.length;
  return (
    <Layout
      title={`vs ${h2h.opponent} · ${recordText(h2h)}`}
      ogDescription={`${SITE_NAME} against ${h2h.opponent}: ${recordText(h2h)} in ${n} meeting${n === 1 ? "" : "s"}.`}
    >
      <Link
        href="/games"
        className="text-[11px] font-bold text-ak-text-dim inline-block mb-4 hover:text-ak-text transition-colors duration-150"
      >
        ← Games
      </Link>
      <SectionHeading label="Head-to-head" title={`vs ${h2h.opponent}`} right={`Record ${recordText(h2h)}`} />
      <HeadToHeadBlock h2h={h2h} title="Every meeting" emptyText="" showAllLink={false} />
    </Layout>
  );
}

const SLUG_RE = /^[a-z0-9-]+$/;

export async function getStaticPaths() {
  try {
    const names = await getOpponentNames();
    // A name with no Latin letters or digits slugs to "": no page for it.
    const slugs = [...new Set(names.map(opponentSlug).filter(Boolean))];
    return { paths: slugs.map(slug => ({ params: { slug } })), fallback: "blocking" as const };
  } catch (err) {
    console.error("[getStaticPaths] /opponents/[slug] DB read failed", err);
    return { paths: [], fallback: "blocking" as const };
  }
}

export async function getStaticProps({ params }: any) {
  const { slug } = params;
  if (!SLUG_RE.test(slug)) return { notFound: true };
  try {
    const games = await getAllGames();
    const name = games.find(g => opponentSlug(g.opponent) === slug)?.opponent;
    if (!name) return { notFound: true };
    return { props: { h2h: headToHead(games, name) }, revalidate: 86400 };
  } catch {
    return { notFound: true };
  }
}
