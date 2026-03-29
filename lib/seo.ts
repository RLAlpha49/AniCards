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
    url?: string;
  };
  twitter?: {
    title?: string;
    description?: string;
    images?: string[];
    card?: "summary" | "summary_large_image";
  };
  canonical?: string;
  robots?: Metadata["robots"];
}

export type SEOPageKey = keyof typeof seoConfigs;
export type SearchParamValue = string | string[] | undefined;
export type StaticSitemapChangeFrequency =
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly";

const DEFAULT_ROBOTS: Metadata["robots"] = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    "max-video-preview": -1,
    "max-image-preview": "large",
    "max-snippet": -1,
  },
};

export const NOINDEX_ROBOTS: Metadata["robots"] = {
  index: false,
  follow: true,
  googleBot: {
    index: false,
    follow: true,
    "max-video-preview": -1,
    "max-image-preview": "large",
    "max-snippet": -1,
  },
};

const DEFAULT_SOCIAL_PREVIEW_CARD_QUERY = {
  cardType: "animeStats",
  userId: "542244",
  variation: "compact",
  colorPreset: "anicardsDarkGradient",
} as const;

const SOCIAL_PREVIEW_IMAGE_PATH = "/card.png";
const DEFAULT_TWITTER_CARD = "summary_large_image" as const;

function resolveSocialPreviewImages(images?: readonly string[]): string[] {
  const normalizedImages = (
    images?.length ? [...images] : [getDefaultSocialPreviewImage()]
  ).map(resolveSiteUrl);

  return normalizedImages.length
    ? normalizedImages
    : [getDefaultSocialPreviewImage()];
}

export function getDefaultSocialPreviewImage(): string {
  return buildCanonicalUrl(
    SOCIAL_PREVIEW_IMAGE_PATH,
    DEFAULT_SOCIAL_PREVIEW_CARD_QUERY,
  );
}

export function getDefaultSocialPreviewImages(): string[] {
  return [getDefaultSocialPreviewImage()];
}

export function buildUserSocialPreviewImage(params: {
  username?: string;
  userId?: string;
}): string | undefined {
  const normalizedUsername = params.username?.trim();
  const normalizedUserId = params.userId?.trim();

  if (!normalizedUsername && !normalizedUserId) {
    return undefined;
  }

  return buildCanonicalUrl(SOCIAL_PREVIEW_IMAGE_PATH, {
    cardType: "profileOverview",
    colorPreset: "anilistDark",
    ...(normalizedUsername
      ? { username: normalizedUsername }
      : { userId: normalizedUserId }),
  });
}

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
    twitter = {},
    canonical,
    robots,
  } = config;
  const canonicalReference = canonical?.trim();
  const openGraphReference = openGraph.url?.trim() || canonicalReference || "/";
  const openGraphUrl = resolveSiteUrl(openGraphReference);
  const openGraphImages = resolveSocialPreviewImages(openGraph.images);
  const twitterImages = resolveSocialPreviewImages(
    twitter.images ?? openGraph.images,
  );

  const fullTitle = title.includes(SITE_NAME)
    ? title
    : `${title} | ${SITE_NAME}`;

  const metadata: Metadata = {
    metadataBase: getSiteUrlObject(),
    title: fullTitle,
    description,
    keywords,

    // Open Graph (Facebook, LinkedIn, etc.)
    openGraph: {
      title: openGraph.title || fullTitle,
      description: openGraph.description || description,
      siteName: SITE_NAME,
      type: (openGraph.type as "article" | "profile" | "website") || "website",
      locale: "en_US",
      images: openGraphImages,
      url: openGraphUrl,
    },

    twitter: {
      card: twitter.card ?? DEFAULT_TWITTER_CARD,
      title: twitter.title || openGraph.title || fullTitle,
      description: twitter.description || openGraph.description || description,
      images: twitterImages,
    },

    // Additional SEO
    robots: robots ?? DEFAULT_ROBOTS,

    // Additional metadata
    category: "Technology",
  };

  if (canonicalReference) {
    metadata.alternates = {
      canonical: canonicalReference,
    };
  }

  return metadata;
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

  privacy: {
    title: "Privacy Disclosure - AniCards",
    description:
      "Read AniCards' plain-language summary of analytics consent, saved data, telemetry minimization, and current retention limits.",
    keywords: [
      "privacy disclosure",
      "analytics consent",
      "data retention",
      "telemetry",
      "saved data",
    ],
    canonical: "/privacy",
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

type StaticSitemapEntryDef = {
  seoKey: Exclude<SEOPageKey, "user">;
  priority: number;
  changefreq: StaticSitemapChangeFrequency;
};

const staticSitemapEntryDefs = [
  {
    seoKey: "home",
    priority: 1,
    changefreq: "daily",
  },
  {
    seoKey: "search",
    priority: 0.9,
    changefreq: "weekly",
  },
  {
    seoKey: "examples",
    priority: 0.85,
    changefreq: "weekly",
  },
  {
    seoKey: "projects",
    priority: 0.6,
    changefreq: "monthly",
  },
  {
    seoKey: "privacy",
    priority: 0.55,
    changefreq: "yearly",
  },
  {
    seoKey: "contact",
    priority: 0.6,
    changefreq: "yearly",
  },
] as const satisfies readonly StaticSitemapEntryDef[];

export function getStaticSitemapEntries() {
  return staticSitemapEntryDefs.map((entry) => ({
    ...entry,
    path: seoConfigs[entry.seoKey].canonical ?? "/",
  }));
}

export function getUserProfilePath(username: string): string {
  return `/user/${encodeURIComponent(username.trim())}`;
}

function buildUserLookupPath({
  username,
  userId,
  q,
  visibility,
  group,
}: {
  username?: SearchParamValue;
  userId?: SearchParamValue;
  q?: SearchParamValue;
  visibility?: SearchParamValue;
  group?: SearchParamValue;
}): string {
  const normalizedUsername = getSearchParamValue(username);
  const normalizedUserId = getSearchParamValue(userId);
  const normalizedQuery = getSearchParamValue(q);
  const normalizedVisibility = getSearchParamValue(visibility);
  const normalizedGroup = getSearchParamValue(group);
  const searchParams = new URLSearchParams();

  if (normalizedUserId) {
    searchParams.set("userId", normalizedUserId);
  }

  if (normalizedUsername) {
    searchParams.set("username", normalizedUsername);
  }

  if (normalizedQuery) {
    searchParams.set("q", normalizedQuery);
  }

  if (normalizedVisibility && normalizedVisibility !== "all") {
    searchParams.set("visibility", normalizedVisibility);
  }

  if (normalizedGroup && normalizedGroup !== "All") {
    searchParams.set("group", normalizedGroup);
  }

  const search = searchParams.toString();
  return search ? `/user?${search}` : "/user";
}

function createUserSeoConfig(params: {
  canonical?: string;
  description: string;
  keywords: string[];
  openGraphUrl?: string;
  previewImage?: string;
  robots?: Metadata["robots"];
  title: string;
}): SEOConfig {
  return {
    title: params.title,
    description: params.description,
    keywords: params.keywords,
    ...(params.canonical ? { canonical: params.canonical } : {}),
    openGraph: {
      ...(params.previewImage ? { images: [params.previewImage] } : {}),
      ...(params.openGraphUrl ? { url: params.openGraphUrl } : {}),
      type: "profile",
    },
    ...(params.previewImage
      ? {
          twitter: {
            images: [params.previewImage],
          },
        }
      : {}),
    ...(params.robots ? { robots: params.robots } : {}),
  };
}

function hasUserPageStatefulParams({
  q,
  visibility,
  group,
}: {
  q?: SearchParamValue;
  visibility?: SearchParamValue;
  group?: SearchParamValue;
}): boolean {
  const normalizedQuery = getSearchParamValue(q);
  const normalizedVisibility = getSearchParamValue(visibility);
  const normalizedGroup = getSearchParamValue(group);

  return Boolean(
    normalizedQuery ||
    (normalizedVisibility && normalizedVisibility !== "all") ||
    (normalizedGroup && normalizedGroup !== "All"),
  );
}

/**
 * Returns a canonical SEO configuration for the user page based on resolved search params.
 */
export function getUserPageSEOConfig({
  username,
  userId,
  q,
  visibility,
  group,
  routeType = "lookup",
}: {
  username?: SearchParamValue;
  userId?: SearchParamValue;
  q?: SearchParamValue;
  visibility?: SearchParamValue;
  group?: SearchParamValue;
  routeType?: "lookup" | "profile";
}): SEOConfig {
  const normalizedUsername = getSearchParamValue(username);
  const normalizedUserId = getSearchParamValue(userId);
  const profilePreviewImage = buildUserSocialPreviewImage({
    username: normalizedUsername,
    userId: normalizedUserId,
  });
  const shouldNoIndex =
    routeType === "lookup" ||
    hasUserPageStatefulParams({ q, visibility, group });
  const robots = shouldNoIndex ? NOINDEX_ROBOTS : undefined;

  if (routeType === "lookup" && normalizedUserId) {
    return createUserSeoConfig({
      title: `AniList User ${normalizedUserId} Stats - AniCards`,
      description: `View anime and manga statistics for AniList user ${normalizedUserId}. Generate and download beautiful stat cards showcasing viewing habits, preferences, and achievements.`,
      keywords: [
        `anilist user ${normalizedUserId}`,
        "anilist user stats",
        "anime statistics",
        "manga statistics",
        "stat cards",
      ],
      openGraphUrl: buildUserLookupPath({
        userId: normalizedUserId,
        username: normalizedUsername,
        q,
        visibility,
        group,
      }),
      robots,
      previewImage: profilePreviewImage,
    });
  }

  if (normalizedUsername) {
    return createUserSeoConfig({
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
      canonical: getUserProfilePath(normalizedUsername),
      robots,
      previewImage: profilePreviewImage,
    });
  }

  if (normalizedUserId) {
    return createUserSeoConfig({
      title: `AniList User ${normalizedUserId} Stats - AniCards`,
      description: `View anime and manga statistics for AniList user ${normalizedUserId}. Generate and download beautiful stat cards showcasing viewing habits, preferences, and achievements.`,
      keywords: [
        `anilist user ${normalizedUserId}`,
        "anilist user stats",
        "anime statistics",
        "manga statistics",
        "stat cards",
      ],
      openGraphUrl: buildUserLookupPath({
        userId: normalizedUserId,
        username: normalizedUsername,
        q,
        visibility,
        group,
      }),
      robots,
      previewImage: profilePreviewImage,
    });
  }

  return {
    ...seoConfigs.user,
    robots,
  };
}
