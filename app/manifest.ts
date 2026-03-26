import type { MetadataRoute } from "next";

import { SITE_NAME } from "@/lib/site-config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: `${SITE_NAME} — AniList mobile stat cards`,
    short_name: SITE_NAME,
    description:
      "Install AniCards for an app-like shell, launch-friendly metadata, and offline fallbacks for cached public pages.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0c0a10",
    theme_color: "#0c0a10",
    lang: "en-US",
    dir: "ltr",
    categories: ["entertainment", "utilities"],
    prefer_related_applications: false,
    icons: [
      {
        src: "/pwa/icon-any.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/pwa/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
      {
        src: "/pwa/apple-touch-icon.svg",
        sizes: "180x180",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
