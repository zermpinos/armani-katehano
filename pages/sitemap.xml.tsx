import { getPlayers } from "@/server/db/repositories";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://armani-katehano.com";

const PAGES = [
  { url: "/",            priority: "1.0", changefreq: "daily"  },
  { url: "/players",     priority: "0.9", changefreq: "weekly" },
  { url: "/leaderboard", priority: "0.9", changefreq: "weekly" },
  { url: "/games",       priority: "0.8", changefreq: "weekly" },
  { url: "/team-stats",  priority: "0.8", changefreq: "weekly" },
];

const xmlEscape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function buildSitemap(lastmod: string, playerSlugs: string[]) {
  const staticEntries = PAGES.map(({ url, priority, changefreq }) =>
    `  <url>\n    <loc>${BASE_URL}${url}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`
  );
  const playerEntries = playerSlugs.map(slug =>
    `  <url>\n    <loc>${BASE_URL}/players/${xmlEscape(slug)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`
  );
  const entries = [...staticEntries, ...playerEntries].join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>`;
}

export default function Sitemap() {
  return null;
}

export async function getServerSideProps({ res }: any) {
  const lastmod = new Date().toISOString().split("T")[0];
  const players = await getPlayers();
  const xml = buildSitemap(lastmod, players.map(p => p.slug));

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.write(xml);
  res.end();

  return { props: {} };
}
