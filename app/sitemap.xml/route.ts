import { stat } from "node:fs/promises";
import { resolve } from "node:path";

import { NextResponse } from "next/server";

import { getStaticSitemapEntries } from "@/lib/seo";
import { resolveSiteUrl } from "@/lib/site-config";

async function getLastModified(
  sourceFiles: readonly string[],
): Promise<string> {
  const stats = await Promise.all(
    [...sourceFiles, "lib/seo.ts"].map(async (sourceFile) => {
      try {
        return await stat(resolve(process.cwd(), sourceFile));
      } catch {
        return null;
      }
    }),
  );

  const mostRecentMtime = stats.reduce<Date | null>((latest, current) => {
    if (!current) {
      return latest;
    }

    if (!latest || current.mtime > latest) {
      return current.mtime;
    }

    return latest;
  }, null);

  return (mostRecentMtime ?? new Date()).toISOString();
}

/**
 * Builds the sitemap XML string covering curated routes and returns it as an XML response.
 * @returns {Promise<NextResponse>} Sitemap response consumed by crawlers.
 * @source
 */
export async function GET() {
  const pages = await Promise.all(
    getStaticSitemapEntries().map(async (page) => ({
      ...page,
      lastmod: await getLastModified(page.sourceFiles),
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
