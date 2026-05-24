import { getGameIds } from "@/server/db/repositories";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://armani-katehano.com";

const STATIC_PAGES = [
  { url: "/",            priority: "1.0", changefreq: "daily"  },
  { url: "/players",     priority: "0.9", changefreq: "weekly" },
  { url: "/leaderboard", priority: "0.9", changefreq: "weekly" },
  { url: "/games",       priority: "0.8", changefreq: "weekly" },
  { url: "/team-stats",  priority: "0.8", changefreq: "weekly" },
];

function buildSitemap(lastmod: string, gameIds: string[]) {
  const staticEntries = STATIC_PAGES.map(({ url, priority, changefreq }) =>
    `  <url>\n    <loc>${BASE_URL}${url}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`
  );
  const gameEntries = gameIds.map(id =>
    `  <url>\n    <loc>${BASE_URL}/games/${id}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>never</changefreq>\n    <priority>0.7</priority>\n  </url>`
  );
  const entries = [...staticEntries, ...gameEntries].join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>`;
}

export default function Sitemap() {
  return null;
}

export async function getServerSideProps({ res }: any) {
  const lastmod = new Date().toISOString().split("T")[0];
  const gameIds = await getGameIds();
  const xml     = buildSitemap(lastmod, gameIds);

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.write(xml);
  res.end();

  return { props: {} };
}
