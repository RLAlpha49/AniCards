import { NextResponse } from "next/server";

import { getStaticSitemapEntries, type SitemapEntry } from "@/lib/seo";
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

export async function GET() {
  const urls = getStaticSitemapEntries().map(renderSitemapEntry).join("");

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
