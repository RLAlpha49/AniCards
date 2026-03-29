import { NextResponse } from "next/server";

import { getStaticSitemapEntries } from "@/lib/seo";
import { resolveSiteUrl } from "@/lib/site-config";

/**
 * Builds the sitemap XML string covering curated routes and returns it as an XML response.
 * @returns {Promise<NextResponse>} Sitemap response consumed by crawlers.
 * @source
 */
export async function GET() {
  const lastmod = new Date().toISOString();
  const pages = await Promise.all(
    getStaticSitemapEntries().map(async (page) => ({
      ...page,
      lastmod,
    })),
  );

  const urls = pages
    .map((page) => {
      return `
    <url>
      <loc>${resolveSiteUrl(page.path)}</loc>
      <lastmod>${page.lastmod}</lastmod>
      <changefreq>${page.changefreq}</changefreq>
      <priority>${page.priority}</priority>
    </url>`;
    })
    .join("");

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${urls}
  </urlset>`;

  return new NextResponse(sitemap, {
    headers: {
      "Content-Type": "application/xml",
    },
  });
}
