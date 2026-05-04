import { NextResponse } from "next/server";

import { logPrivacySafe } from "@/lib/api/logging";
import { getSitemapIndexEntries, type SitemapIndexEntry } from "@/lib/seo";
import { listPublicUserProfileSitemapEntries } from "@/lib/server/user-data";
import { resolveSiteUrl } from "@/lib/site-config";

import { getRouteOwnedStaticSitemapEntries } from "../sitemap-static.xml/route";

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

function renderSitemapIndexEntry(entry: SitemapIndexEntry): string {
  const lastmod = entry.lastmod
    ? `
      <lastmod>${escapeXml(entry.lastmod)}</lastmod>`
    : "";

  return `
    <sitemap>
      <loc>${escapeXml(resolveSiteUrl(entry.path))}</loc>${lastmod}
    </sitemap>`;
}

/**
 * Builds the sitemap index XML string covering the static and profile shards and returns it as a cacheable XML response.
 * @returns {Promise<NextResponse>} Sitemap index response consumed by crawlers.
 * @source
 */
async function listProfileEntriesForSitemapIndex() {
  try {
    return await listPublicUserProfileSitemapEntries();
  } catch (error) {
    logPrivacySafe(
      "warn",
      "Sitemap",
      "Falling back to a static-only sitemap index after the public-profile sitemap source failed",
      {
        error: error instanceof Error ? error.message : String(error),
      },
    );

    return [];
  }
}

export async function GET() {
  const profileEntries = await listProfileEntriesForSitemapIndex();
  const sitemaps = getSitemapIndexEntries({
    staticEntries: getRouteOwnedStaticSitemapEntries(),
    profileEntries,
  })
    .map(renderSitemapIndexEntry)
    .join("");

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
  <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${sitemaps}
  </sitemapindex>`;

  return new NextResponse(sitemap, {
    headers: {
      "Cache-Control": SITEMAP_CACHE_CONTROL,
      "Content-Type": "application/xml",
    },
  });
}
