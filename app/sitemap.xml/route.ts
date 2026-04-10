import { NextResponse } from "next/server";

import { getStaticSitemapEntries } from "@/lib/seo";
import { resolveSiteUrl } from "@/lib/site-config";

const SITEMAP_CACHE_CONTROL =
  "public, s-maxage=3600, stale-while-revalidate=600";

/**
 * Builds the sitemap XML string covering curated routes and returns it as a cacheable XML response.
 * @returns {Promise<NextResponse>} Sitemap response consumed by crawlers.
 * @source
 */
export async function GET() {
  const urls = getStaticSitemapEntries()
    .map((page) => {
      return `
    <url>
      <loc>${resolveSiteUrl(page.path)}</loc>
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
      "Cache-Control": SITEMAP_CACHE_CONTROL,
      "Content-Type": "application/xml",
    },
  });
}
