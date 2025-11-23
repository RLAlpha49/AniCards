import { NextResponse } from "next/server";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://anicards.alpha49.com";

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
    path: "/user",
    priority: 0.8,
    changefreq: "weekly" as const,
  },
  {
    path: "/settings",
    priority: 0.7,
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
  {
    path: "/license",
    priority: 0.4,
    changefreq: "yearly" as const,
  },
];

export async function GET() {
  const lastmod = new Date().toISOString();

  const urls = pages
    .map((page) => {
      return `
    <url>
      <loc>${BASE_URL}${page.path}</loc>
      <lastmod>${lastmod}</lastmod>
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
