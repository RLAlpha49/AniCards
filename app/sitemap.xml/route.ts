import { NextResponse } from "next/server";

import { getSiteUrl } from "@/lib/site-config";

/**
 * Base URL for sitemap entries, defaulting to the hosted site when the environment variable is missing.
 * @source
 */
const BASE_URL = getSiteUrl();

/**
 * Static route metadata that drives sitemap priorities and update frequencies.
 * @source
 */
const pages = [
  {
    path: "/",
    priority: 1,
    changefreq: "daily" as const,
  },
  {
    path: "/search",
    priority: 0.9,
    changefreq: "weekly" as const,
  },
  {
    path: "/examples",
    priority: 0.85,
    changefreq: "weekly" as const,
  },
  {
    path: "/user",
    priority: 0.8,
    changefreq: "weekly" as const,
  },
  {
    path: "/projects",
    priority: 0.6,
    changefreq: "monthly" as const,
  },
  {
    path: "/contact",
    priority: 0.6,
    changefreq: "yearly" as const,
  },
];

/**
 * Builds the sitemap XML string covering curated routes and returns it as an XML response.
 * @returns {Promise<NextResponse>} Sitemap response consumed by crawlers.
 * @source
 */
export async function GET() {
  const urls = pages
    .map((page) => {
      return `
    <url>
      <loc>${BASE_URL}${page.path}</loc>
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
