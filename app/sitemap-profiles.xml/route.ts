import { NextResponse } from "next/server";

import { logPrivacySafe } from "@/lib/api/logging";
import {
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

async function listProfileEntriesForSitemapShard() {
  try {
    return await listPublicUserProfileSitemapEntries();
  } catch (error) {
    logPrivacySafe(
      "warn",
      "Sitemap",
      "Returning an empty profile sitemap shard after the public-profile sitemap source failed",
      {
        error: error instanceof Error ? error.message : String(error),
      },
    );

    return [];
  }
}

export async function GET() {
  const profileEntries = await listProfileEntriesForSitemapShard();
  const urls = profileEntries
    .map((entry) => ({
      ...USER_PROFILE_SITEMAP_ENTRY,
      path: getUserProfilePath(entry.username),
      ...(entry.lastmod
        ? {
            lastmod: entry.lastmod,
          }
        : {}),
    }))
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
