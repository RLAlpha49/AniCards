import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/site-config";

const PREVIEW_MEDIA_DISALLOW_PATHS = ["/api/", "/card.png", "/card.svg"];

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [...PREVIEW_MEDIA_DISALLOW_PATHS],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
