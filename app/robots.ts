import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/site-config";

const DISALLOW_PATHS = ["/api/"];

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [...DISALLOW_PATHS],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
