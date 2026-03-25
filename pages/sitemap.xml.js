const BASE_URL = "https://armani-katehano.vercel.app";

function buildSitemap() {
  const pages = [
    { url: "/",            priority: "1.0", changefreq: "daily"  },
    { url: "/players",     priority: "0.9", changefreq: "weekly" },
    { url: "/leaderboard", priority: "0.9", changefreq: "weekly" },
    { url: "/games",       priority: "0.8", changefreq: "weekly" },
    { url: "/team",        priority: "0.8", changefreq: "weekly" },
  ];

  const entries = pages.map(({ url, priority, changefreq }) => {
    const loc = `${BASE_URL}${url}`;
    const lastmod = new Date().toISOString();

    return `<url>
  <loc>${loc}</loc>
  <lastmod>${lastmod}</lastmod>
  <changefreq>${changefreq}</changefreq>
  <priority>${priority}</priority>
</url>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>`;
}
