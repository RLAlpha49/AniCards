import type { Metadata } from "next";

import {
  buildCanonicalUrl,
  getSiteUrlObject,
  resolveSiteUrl,
  SITE_NAME,
} from "@/lib/site-config";

/**
 * Configuration object used to generate SEO metadata for pages.
 * @source
 */
interface SEOConfig {
  title: string;
  description: string;
  keywords?: string[];
  openGraph?: {
    title?: string;
    description?: string;
    images?: string[];
    type?: string;
  };
  twitter?: {
    title?: string;
    description?: string;
    images?: string[];
  };
  canonical?: string;
}

export type SEOPageKey = keyof typeof seoConfigs;
export type SearchParamValue = string | string[] | undefined;

function getSearchParamValue(value: SearchParamValue): string | undefined {
  const normalizedValue = Array.isArray(value) ? value[0] : value;
  const trimmedValue = normalizedValue?.trim();

  return trimmedValue || undefined;
}

/**
 * Generate a Next.js-compatible Metadata object from a lightweight
 * SEOConfig shape. This ensures Title, Description, OpenGraph and
 * robots settings are consistently composed.
 * @param config - SEO configuration values for the page.
 * @returns A Metadata object consumed by Next.js pages.
 * @source
 */
export function generateMetadata(config: SEOConfig): Metadata {
  const {
    title,
    description,
    keywords = [],
    openGraph = {},
    canonical,
  } = config;
  const canonicalReference = canonical || "/";
  const canonicalUrl = resolveSiteUrl(canonicalReference);

  const fullTitle = title.includes(SITE_NAME)
    ? title
    : `${title} | ${SITE_NAME}`;

  return {
    metadataBase: getSiteUrlObject(),
    title: fullTitle,
    description,
    keywords,

    // Open Graph (Facebook, LinkedIn, etc.)
    openGraph: {
      title: openGraph.title || fullTitle,
      description: openGraph.description || description,
      url: canonicalUrl,
      siteName: SITE_NAME,
      type: (openGraph.type as "website" | "article") || "website",
      locale: "en_US",
    },

    // Additional SEO
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },

    // Canonical URL
    alternates: {
      canonical: canonicalReference,
    },

    // Additional metadata
    category: "Technology",
  };
}

/** Canonical SEO configurations for static app pages. @source */
export const seoConfigs = {
  home: {
    title:
      "AniList Stat Cards Generator - AniCards | Beautiful AniList Statistics",
    description:
      "Generate stunning AniList stat cards from your anime and manga data. Create beautiful, shareable AniList statistics cards that visualize your consumption habits, preferences, and social activity.",
    keywords: [
      "anilist stat cards",
      "anilist statistics cards",
      "anime stat cards",
      "manga stat cards",
      "anilist data visualization",
      "anilist profile generator",
      "anilist stats generator",
      "anime statistics generator",
      "manga statistics generator",
      "anilist card maker",
      "anilist",
      "anime stats",
      "manga stats",
      "anime cards",
      "anilist profile",
      "anime statistics",
      "manga statistics",
      "anilist visualization",
      "anime tracker",
      "manga tracker",
      "otaku stats",
      "anime dashboard",
      "weeb stats",
    ],
    canonical: "/",
  },

  search: {
    title: "Search AniList Users - AniCards",
    description:
      "Search for any AniList user to generate their personalized anime and manga stat cards. Enter a username to view detailed statistics and create shareable cards.",
    keywords: [
      "anilist user search",
      "find anilist profile",
      "anime user stats",
      "manga user stats",
      "anilist lookup",
      "user statistics",
    ],
    canonical: "/search",
  },

  examples: {
    title: "All Card Examples - AniCards",
    description:
      "Explore all available AniCards types and variants with real examples. View anime statistics, social metrics, genre distributions, voice actor insights, studio breakdowns, and more.",
    keywords: [
      "anilist card examples",
      "anime stat card examples",
      "manga stat card examples",
      "anilist statistics examples",
      "anime data visualization examples",
      "card types",
      "stat card variants",
      "anilist card gallery",
      "anime cards showcase",
    ],
    canonical: "/examples",
  },

  contact: {
    title: "Contact Us - AniCards",
    description:
      "Get in touch with the AniCards team. Find our social media links, GitHub repository, and contact information for support or feedback.",
    keywords: ["contact", "support", "feedback", "github", "social media"],
    canonical: "/contact",
  },

  projects: {
    title: "Other Projects - AniCards",
    description:
      "Explore other anime and manga related projects including AniList Custom List Manager, Kenmai to AniList converter, AniSearch ML tool, and more.",
    keywords: [
      "anime projects",
      "anilist tools",
      "anime software",
      "manga tools",
      "anilist utilities",
      "anime applications",
    ],
    canonical: "/projects",
  },

  user: {
    title: "User Stats - AniCards",
    description:
      "View and download personalized anime and manga stat cards. Generate beautiful visualizations of AniList data with customizable colors and designs.",
    keywords: [
      "user stats",
      "anime statistics",
      "manga statistics",
      "stat cards",
      "anilist data",
      "download cards",
      "custom colors",
    ],
    canonical: "/user",
  },
} as const satisfies Record<string, SEOConfig>;

/**
 * Returns a canonical SEO configuration for the user page based on resolved search params.
 */
export function getUserPageSEOConfig({
  username,
  userId,
}: {
  username?: SearchParamValue;
  userId?: SearchParamValue;
}): SEOConfig {
  const normalizedUsername = getSearchParamValue(username);
  const normalizedUserId = getSearchParamValue(userId);

  if (normalizedUsername) {
    return {
      title: `${normalizedUsername}'s AniList Stats - AniCards`,
      description: `View ${normalizedUsername}'s anime and manga statistics from AniList. Generate and download beautiful stat cards showcasing their viewing habits, preferences, and achievements.`,
      keywords: [
        `${normalizedUsername} anilist`,
        `${normalizedUsername} anime stats`,
        `${normalizedUsername} manga stats`,
        "anilist profile",
        "anime statistics",
        "manga statistics",
        "stat cards",
      ],
      canonical: `/user?username=${encodeURIComponent(normalizedUsername)}`,
    };
  }

  if (normalizedUserId) {
    return {
      ...seoConfigs.user,
      title: `AniList User ${normalizedUserId} Stats - AniCards`,
      description: `View anime and manga statistics for AniList user ${normalizedUserId}. Generate and download beautiful stat cards showcasing viewing habits, preferences, and achievements.`,
      keywords: [
        `anilist user ${normalizedUserId}`,
        "anilist user stats",
        "anime statistics",
        "manga statistics",
        "stat cards",
      ],
      canonical: buildCanonicalUrl("/user", { userId: normalizedUserId }),
    };
  }

  return seoConfigs.user;
}
