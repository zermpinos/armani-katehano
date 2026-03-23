/**
 * pages/sitemap.xml.js
 * Generates a static sitemap for all public pages.
 */

const BASE_URL = "https://armanikatehano.gr";

function buildSitemap() {
  const pages = [
    { url: "/",            priority: "1.0", changefreq: "daily"  },
    { url: "/players",     priority: "0.9", changefreq: "weekly" },
    { url: "/leaderboard", priority: "0.9", changefreq: "weekly" },
    { url: "/games",       priority: "0.8", changefreq: "weekly" },
    { url: "/team",        priority: "0.8", changefreq: "weekly" },
  ];

  const entries = pages.map(({ url, priority, changefreq }) => `
  <url>
    <loc>${BASE_URL}${url}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>`;
}

export default function Sitemap() {
  return null;
}

export async function getServerSideProps({ res }) {
  const xml = buildSitemap();
  res.setHeader("Content-Type", "text/xml");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.write(xml);
  res.end();
  return { props: {} };
}
