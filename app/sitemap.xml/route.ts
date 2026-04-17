import { NextResponse } from "next/server";

import {
  getStaticSitemapEntries,
  getUserProfilePath,
  type SitemapEntry,
  USER_PROFILE_SITEMAP_ENTRY,
} from "@/lib/seo";
import { listPublicUserProfileSitemapEntries } from "@/lib/server/user-data";
import { resolveSiteUrl } from "@/lib/site-config";

export const dynamic = "force-dynamic";

const SITEMAP_CACHE_CONTROL =
  "public, s-maxage=3600, stale-while-revalidate=600";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function renderSitemapEntry(entry: SitemapEntry): string {
  const lastmod = entry.lastmod
    ? `
      <lastmod>${escapeXml(entry.lastmod)}</lastmod>`
    : "";

  return `
    <url>
      <loc>${escapeXml(resolveSiteUrl(entry.path))}</loc>${lastmod}
      <changefreq>${entry.changefreq}</changefreq>
      <priority>${entry.priority}</priority>
    </url>`;
}

/**
 * Builds the sitemap XML string covering curated routes and returns it as a cacheable XML response.
 * @returns {Promise<NextResponse>} Sitemap response consumed by crawlers.
 * @source
 */
export async function GET() {
  const profileEntries = await listPublicUserProfileSitemapEntries();
  const urls = [
    ...getStaticSitemapEntries(),
    ...profileEntries.map((entry) => ({
      ...USER_PROFILE_SITEMAP_ENTRY,
      path: getUserProfilePath(entry.username),
      ...(entry.lastmod ? { lastmod: entry.lastmod } : {}),
    })),
  ]
    .map(renderSitemapEntry)
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
