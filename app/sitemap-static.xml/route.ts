import { NextResponse } from "next/server";

import {
  buildExamplesCollectionPath,
  EXAMPLE_COLLECTIONS,
  EXAMPLES_GALLERY_PATH,
} from "@/lib/examples-collections";
import { getStaticSitemapEntries, type SitemapEntry } from "@/lib/seo";
import { resolveSiteUrl } from "@/lib/site-config";

import { ABOUT_PAGE_LASTMOD } from "../about/page";
import { CONTACT_PAGE_LASTMOD } from "../contact/page";
import { EXAMPLES_COLLECTION_PAGE_LASTMOD } from "../examples/[collection]/page";
import { EXAMPLES_GALLERY_PAGE_LASTMOD } from "../examples/gallery/page";
import { EXAMPLES_INDEX_PAGE_LASTMOD } from "../examples/page";
import { HOME_PAGE_LASTMOD } from "../page";
import { PRIVACY_PAGE_LASTMOD } from "../privacy/page";
import { PROJECTS_PAGE_LASTMOD } from "../projects/page";
import { SEARCH_PAGE_LASTMOD } from "../search/page";

export const revalidate = 3600;

const SITEMAP_CACHE_CONTROL =
  "public, s-maxage=3600, stale-while-revalidate=600";

export const ROUTE_OWNED_STATIC_SITEMAP_LASTMODS = {
  "/": HOME_PAGE_LASTMOD,
  "/search": SEARCH_PAGE_LASTMOD,
  "/examples": EXAMPLES_INDEX_PAGE_LASTMOD,
  [EXAMPLES_GALLERY_PATH]: EXAMPLES_GALLERY_PAGE_LASTMOD,
  ...Object.fromEntries(
    EXAMPLE_COLLECTIONS.map((collection) => [
      buildExamplesCollectionPath(collection.slug),
      EXAMPLES_COLLECTION_PAGE_LASTMOD,
    ]),
  ),
  "/projects": PROJECTS_PAGE_LASTMOD,
  "/about": ABOUT_PAGE_LASTMOD,
  "/privacy": PRIVACY_PAGE_LASTMOD,
  "/contact": CONTACT_PAGE_LASTMOD,
} as const;

export function getRouteOwnedStaticSitemapEntries(): SitemapEntry[] {
  return getStaticSitemapEntries({
    lastmodsByPath: ROUTE_OWNED_STATIC_SITEMAP_LASTMODS,
  });
}

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
  const urls = getRouteOwnedStaticSitemapEntries()
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
