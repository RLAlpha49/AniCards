import type { Metadata } from "next";

import { PROJECTS_PAGE_SOCIAL_PREVIEW } from "@/components/projects/constants";
import { normalizePositiveIntegerString } from "@/lib/api/primitives";
import { DEFAULT_EXAMPLE_USER_ID } from "@/lib/card-groups";
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
  socialPreview?: StaticSocialPreviewConfig;
}

interface StaticSocialPreviewConfig {
  cardType: string;
  colorPreset?: string;
  userId?: string;
  username?: string;
  variation?: string;
}

export type SEOPageKey = keyof typeof seoConfigs;
export type SearchParamValue = string | string[] | undefined;
export type SearchLookupMode = "username" | "userId";
export type SearchLookupInputNormalizationResult =
  | { ok: true; mode: SearchLookupMode; query: string }
  | { ok: false; reason: "invalid" | "expectedUserId" };
export type StaticSitemapChangeFrequency =
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly";

export interface SitemapEntry {
  path: string;
  priority: number;
  changefreq: StaticSitemapChangeFrequency;
  lastmod?: string;
}

export const SEARCH_PAGE_MODE_PARAM = "mode";
export const SEARCH_PAGE_QUERY_PARAM = "query";

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
  userId: DEFAULT_EXAMPLE_USER_ID,
  variation: "compact",
  colorPreset: "anicardsDarkGradient",
} as const satisfies StaticSocialPreviewConfig;

const SEARCH_SOCIAL_PREVIEW_CARD_QUERY = {
  cardType: "profileOverview",
  colorPreset: "anilistDark",
  userId: DEFAULT_EXAMPLE_USER_ID,
  variation: "default",
} as const satisfies StaticSocialPreviewConfig;

const EXAMPLES_SOCIAL_PREVIEW_CARD_QUERY = {
  cardType: "favoritesSummary",
  colorPreset: "anicardsDarkGradient",
  userId: DEFAULT_EXAMPLE_USER_ID,
  variation: "default",
} as const satisfies StaticSocialPreviewConfig;

const ABOUT_SOCIAL_PREVIEW_CARD_QUERY = {
  cardType: "socialStats",
  colorPreset: "anicardsDarkGradient",
  userId: DEFAULT_EXAMPLE_USER_ID,
  variation: "default",
} as const satisfies StaticSocialPreviewConfig;

const CONTACT_SOCIAL_PREVIEW_CARD_QUERY = {
  cardType: "recentActivitySummary",
  colorPreset: "anilistDark",
  userId: DEFAULT_EXAMPLE_USER_ID,
  variation: "default",
} as const satisfies StaticSocialPreviewConfig;

const PRIVACY_SOCIAL_PREVIEW_CARD_QUERY = {
  cardType: "statusCompletionOverview",
  colorPreset: "anicardsDarkGradient",
  userId: DEFAULT_EXAMPLE_USER_ID,
  variation: "combined",
} as const satisfies StaticSocialPreviewConfig;

const SOCIAL_PREVIEW_IMAGE_PATH = "/card.png";
const DEFAULT_TWITTER_CARD = "summary_large_image" as const;
const DEFAULT_SEARCH_LOOKUP_MODE: SearchLookupMode = "username";
const SEARCH_LOOKUP_MODE_USER_ID_ALIASES = new Set(["userid", "user-id"]);
const ANILIST_PROFILE_HOSTS = new Set(["anilist.co", "www.anilist.co"]);
const SEARCH_LOOKUP_USERNAME_PATTERN = /^[a-zA-Z0-9_\-\s]+$/;
const SITE_DEFAULT_DESCRIPTION =
  "Turn public AniList activity into polished anime and manga stat cards, compare long-term library patterns, and export visuals for profiles, posts, and readmes.";

function buildStaticSocialPreviewImage(
  params: StaticSocialPreviewConfig,
): string {
  return buildCanonicalUrl(SOCIAL_PREVIEW_IMAGE_PATH, {
    cardType: params.cardType,
    colorPreset: params.colorPreset,
    userId: params.userId,
    username: params.username,
    variation: params.variation,
  });
}

function resolveSocialPreviewImages(
  images?: readonly string[],
  fallbackImage: string = getDefaultSocialPreviewImage(),
): string[] {
  const normalizedImages = (images?.length ? [...images] : [fallbackImage]).map(
    resolveSiteUrl,
  );

  return normalizedImages.length ? normalizedImages : [fallbackImage];
}

export function getDefaultSocialPreviewImage(): string {
  return buildStaticSocialPreviewImage(DEFAULT_SOCIAL_PREVIEW_CARD_QUERY);
}

export function getDefaultSocialPreviewImages(): string[] {
  return [getDefaultSocialPreviewImage()];
}

export function getStaticPageSocialPreviewImage(
  pageKey: Exclude<SEOPageKey, "user">,
): string {
  const config = seoConfigs[pageKey];

  return config.socialPreview
    ? buildStaticSocialPreviewImage(config.socialPreview)
    : getDefaultSocialPreviewImage();
}

/**
 * Shared root metadata for the App Router shell.
 *
 * This keeps the favicon metadata available for both the root layout and
 * lightweight unit tests without importing the font-heavy layout module.
 * @source
 */
export const siteMetadata: Metadata = {
  metadataBase: getSiteUrlObject(),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DEFAULT_DESCRIPTION,
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  icons: {
    icon: [
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
      {
        url: "/icon.ico",
        sizes: "any",
      },
    ],
  },
  openGraph: {
    description: SITE_DEFAULT_DESCRIPTION,
    siteName: SITE_NAME,
    images: getDefaultSocialPreviewImages(),
  },
  twitter: {
    card: "summary_large_image",
    description: SITE_DEFAULT_DESCRIPTION,
    images: getDefaultSocialPreviewImages(),
  },
};

export function buildUserSocialPreviewImage(params: {
  username?: string;
  userId?: string;
}): string | undefined {
  const normalizedUsername = params.username?.trim();
  const normalizedUserId = params.userId?.trim();

  if (!normalizedUsername && !normalizedUserId) {
    return undefined;
  }

  return buildStaticSocialPreviewImage({
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

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function stripLookupSearchAndHash(value: string): string {
  const questionMarkIndex = value.indexOf("?");
  const hashIndex = value.indexOf("#");
  let endIndex = value.length;

  if (questionMarkIndex >= 0 && questionMarkIndex < endIndex) {
    endIndex = questionMarkIndex;
  }

  if (hashIndex >= 0 && hashIndex < endIndex) {
    endIndex = hashIndex;
  }

  return value.slice(0, endIndex);
}

function trimLeadingLookupDecorators(value: string): string {
  let startIndex = 0;

  while (startIndex < value.length) {
    const character = value[startIndex];

    if (character !== "@" && character !== "/") {
      break;
    }

    startIndex += 1;
  }

  return value.slice(startIndex);
}

function trimTrailingForwardSlashes(value: string): string {
  let endIndex = value.length;

  while (endIndex > 0 && value[endIndex - 1] === "/") {
    endIndex -= 1;
  }

  return endIndex === value.length ? value : value.slice(0, endIndex);
}

function startsWithIgnoreCase(value: string, prefix: string): boolean {
  return (
    value.length >= prefix.length &&
    value.slice(0, prefix.length).toLowerCase() === prefix.toLowerCase()
  );
}

function isLookupUrlLike(value: string): boolean {
  const lowerCasedValue = value.toLowerCase();

  return (
    lowerCasedValue.startsWith("http://") ||
    lowerCasedValue.startsWith("https://") ||
    lowerCasedValue.startsWith("www.") ||
    lowerCasedValue.startsWith("anilist.co/")
  );
}

function isLookupPathLike(value: string): boolean {
  const lowerCasedValue = value.toLowerCase();

  return (
    value.startsWith("/") ||
    value.startsWith("@") ||
    startsWithIgnoreCase(value, "user/") ||
    value.endsWith("/") ||
    lowerCasedValue.includes("/user/")
  );
}

function findUserSegmentIndex(pathSegments: string[]): number {
  for (let index = 0; index < pathSegments.length; index += 1) {
    if (pathSegments[index]?.toLowerCase() === "user") {
      return index;
    }
  }

  return -1;
}

function normalizeSearchLookupToken(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  let normalizedValue = value.trim();
  if (!normalizedValue) {
    return null;
  }

  normalizedValue = stripLookupSearchAndHash(normalizedValue).trim();

  if (!normalizedValue) {
    return null;
  }

  normalizedValue = trimLeadingLookupDecorators(normalizedValue);

  if (startsWithIgnoreCase(normalizedValue, "user/")) {
    normalizedValue = normalizedValue.slice(5);
  }

  normalizedValue = safeDecodeURIComponent(
    trimTrailingForwardSlashes(normalizedValue).trim(),
  ).trim();

  return normalizedValue || null;
}

function normalizeSearchLookupUsername(value: string): string | null {
  const trimmedValue = value.trim();

  if (
    trimmedValue.length === 0 ||
    trimmedValue.length > 100 ||
    !SEARCH_LOOKUP_USERNAME_PATTERN.test(trimmedValue)
  ) {
    return null;
  }

  return trimmedValue;
}

function extractAniListProfileTokenFromUrl(value: string): string | null {
  const lowerCasedValue = value.toLowerCase();
  const normalizedUrl =
    lowerCasedValue.startsWith("http://") ||
    lowerCasedValue.startsWith("https://")
      ? value
      : `https://${value}`;

  try {
    const parsedUrl = new URL(normalizedUrl);
    if (!ANILIST_PROFILE_HOSTS.has(parsedUrl.hostname.toLowerCase())) {
      return null;
    }

    const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);
    const userSegmentIndex = findUserSegmentIndex(pathSegments);

    if (userSegmentIndex < 0) {
      return null;
    }

    return normalizeSearchLookupToken(pathSegments[userSegmentIndex + 1]);
  } catch {
    return null;
  }
}

function extractAniListProfileTokenFromPath(value: string): string | null {
  const pathOnly = stripLookupSearchAndHash(value.trim());
  const pathSegments = pathOnly.split("/").filter(Boolean);

  if (pathSegments.length === 0) {
    return null;
  }

  const userSegmentIndex = findUserSegmentIndex(pathSegments);

  if (userSegmentIndex >= 0) {
    return normalizeSearchLookupToken(pathSegments[userSegmentIndex + 1]);
  }

  if (pathSegments.length === 1) {
    return normalizeSearchLookupToken(pathSegments[0]);
  }

  return null;
}

function extractAniListProfileToken(value: string): {
  structured: boolean;
  token: string | null;
} {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return {
      structured: false,
      token: null,
    };
  }

  const isUrlLike = isLookupUrlLike(trimmedValue);
  if (isUrlLike) {
    return {
      structured: true,
      token: extractAniListProfileTokenFromUrl(trimmedValue),
    };
  }

  const isPathLike = isLookupPathLike(trimmedValue);

  if (isPathLike) {
    return {
      structured: true,
      token: extractAniListProfileTokenFromPath(trimmedValue),
    };
  }

  return {
    structured: false,
    token: normalizeSearchLookupToken(trimmedValue),
  };
}

export function getSearchLookupMode(value: SearchParamValue): SearchLookupMode {
  const normalizedValue = getSearchParamValue(value)?.toLowerCase();

  return normalizedValue &&
    SEARCH_LOOKUP_MODE_USER_ID_ALIASES.has(normalizedValue)
    ? "userId"
    : DEFAULT_SEARCH_LOOKUP_MODE;
}

export function getBlankSearchLookupError(
  searchMethod: SearchLookupMode,
): string {
  if (searchMethod === "userId") {
    return "You'll need to enter a numeric AniList user ID first.";
  }

  return "You'll need to enter an AniList username, profile link, or user ID first.";
}

export function getSearchLookupValidationError(
  searchMethod: SearchLookupMode,
  reason: "invalid" | "expectedUserId",
): string {
  if (searchMethod === "userId") {
    if (reason === "expectedUserId") {
      return "That looks like a username or profile link. Switch to Username mode or paste a numeric AniList user ID.";
    }

    return "Enter a numeric AniList user ID or an AniList /user/... link that resolves to one.";
  }

  return "Enter an AniList username, @handle, profile URL, copied /user/... slug, or numeric ID.";
}

export function normalizeSearchLookupInput(
  value: SearchParamValue,
  preferredMode: SearchLookupMode = DEFAULT_SEARCH_LOOKUP_MODE,
): SearchLookupInputNormalizationResult | null {
  const rawValue = getSearchParamValue(value);
  if (!rawValue) {
    return null;
  }

  const { structured, token } = extractAniListProfileToken(rawValue);
  if (!token) {
    return {
      ok: false,
      reason: structured
        ? "invalid"
        : preferredMode === "userId"
          ? "expectedUserId"
          : "invalid",
    };
  }

  const normalizedUserId = normalizePositiveIntegerString(token);
  if (normalizedUserId) {
    return {
      ok: true,
      mode: "userId",
      query: normalizedUserId,
    };
  }

  const normalizedUsername = normalizeSearchLookupUsername(token);
  if (!normalizedUsername) {
    return {
      ok: false,
      reason: "invalid",
    };
  }

  if (preferredMode === "userId") {
    return {
      ok: false,
      reason: "expectedUserId",
    };
  }

  return {
    ok: true,
    mode: "username",
    query: normalizedUsername,
  };
}

export function getSearchPagePrefillQuery(
  value: SearchParamValue,
  preferredMode: SearchLookupMode = DEFAULT_SEARCH_LOOKUP_MODE,
): string {
  const rawValue = getSearchParamValue(value);
  if (!rawValue) {
    return "";
  }

  const normalizedValue = normalizeSearchLookupInput(rawValue, preferredMode);

  return normalizedValue?.ok ? normalizedValue.query : rawValue;
}

export function getSearchPagePath(
  options: {
    mode?: SearchParamValue;
    query?: SearchParamValue;
    includeDefaultMode?: boolean;
  } = {},
): string {
  const mode = getSearchLookupMode(options.mode);
  const query = getSearchParamValue(options.query);
  const searchParams = new URLSearchParams();

  if (options.includeDefaultMode || mode !== DEFAULT_SEARCH_LOOKUP_MODE) {
    searchParams.set(SEARCH_PAGE_MODE_PARAM, mode);
  }

  if (query) {
    searchParams.set(SEARCH_PAGE_QUERY_PARAM, query);
  }

  const search = searchParams.toString();

  return search ? `/search?${search}` : "/search";
}

function hasSearchPageStatefulParams({
  mode,
  query,
}: {
  mode?: SearchParamValue;
  query?: SearchParamValue;
}): boolean {
  return (
    Boolean(getSearchParamValue(query)) ||
    getSearchLookupMode(mode) !== DEFAULT_SEARCH_LOOKUP_MODE
  );
}

export function getSearchPageSEOConfig({
  mode,
  query,
}: {
  mode?: SearchParamValue;
  query?: SearchParamValue;
} = {}): SEOConfig {
  return {
    ...seoConfigs.search,
    ...(hasSearchPageStatefulParams({ mode, query })
      ? {
          robots: NOINDEX_ROBOTS,
        }
      : {}),
  };
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
  const fallbackSocialPreviewImage = config.socialPreview
    ? buildStaticSocialPreviewImage(config.socialPreview)
    : getDefaultSocialPreviewImage();
  const openGraphImages = resolveSocialPreviewImages(
    openGraph.images,
    fallbackSocialPreviewImage,
  );
  const twitterImages = resolveSocialPreviewImages(
    twitter.images ?? openGraph.images,
    fallbackSocialPreviewImage,
  );
  const shouldUseAbsoluteTitle = title.includes(SITE_NAME);

  const fullTitle = shouldUseAbsoluteTitle ? title : `${title} | ${SITE_NAME}`;

  const metadata: Metadata = {
    metadataBase: getSiteUrlObject(),
    title: shouldUseAbsoluteTitle ? { absolute: title } : title,
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
    title: "AniList Stat Cards & Profile Visuals | AniCards",
    description: SITE_DEFAULT_DESCRIPTION,
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
    socialPreview: DEFAULT_SOCIAL_PREVIEW_CARD_QUERY,
  },

  search: {
    title: "Search AniList Profiles",
    description:
      "Look up any public AniList profile by username or numeric ID, open a polished stats view, and carry example styles straight into the card editor.",
    keywords: [
      "anilist user search",
      "anilist username search",
      "anilist user id search",
      "find anilist profile",
      "search anilist by id",
      "anime user stats",
      "manga user stats",
      "anilist lookup",
      "user statistics",
    ],
    canonical: "/search",
    socialPreview: SEARCH_SOCIAL_PREVIEW_CARD_QUERY,
  },

  examples: {
    title: "AniCards Gallery & Card Examples",
    description:
      "Browse the AniCards gallery by collection, preview real card variations, and jump into the editor with layouts for stats, genres, favourites, and activity.",
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
    socialPreview: EXAMPLES_SOCIAL_PREVIEW_CARD_QUERY,
  },

  contact: {
    title: "Contact the AniCards Project Maintainer",
    description:
      "Reach the AniCards maintainer for bug reports, collaboration notes, privacy requests, and feature ideas through the channel that fits the conversation.",
    keywords: ["contact", "support", "feedback", "github", "social media"],
    canonical: "/contact",
    socialPreview: CONTACT_SOCIAL_PREVIEW_CARD_QUERY,
  },

  projects: {
    title: "Anime Tracking Projects & Tools",
    description:
      "Explore the wider AniCards toolset, from AniList automation helpers to migration utilities built for anime and manga tracking workflows.",
    keywords: [
      "anime projects",
      "anilist tools",
      "anime software",
      "manga tools",
      "anilist utilities",
      "anime applications",
    ],
    canonical: "/projects",
    socialPreview: PROJECTS_PAGE_SOCIAL_PREVIEW,
  },

  privacy: {
    title: "AniCards Privacy & Data Handling",
    description:
      "Read the plain-language overview of AniCards analytics consent, saved settings, telemetry minimization, and current retention limits.",
    keywords: [
      "privacy disclosure",
      "analytics consent",
      "data retention",
      "telemetry",
      "saved data",
    ],
    canonical: "/privacy",
    socialPreview: PRIVACY_SOCIAL_PREVIEW_CARD_QUERY,
  },

  about: {
    title: "About AniCards",
    description:
      "Learn why AniCards exists, how it turns public AniList data into customizable stat cards, and which open-source principles shape the project.",
    keywords: [
      "about anicards",
      "anilist project",
      "anime stat cards",
      "open source",
      "project philosophy",
    ],
    canonical: "/about",
    socialPreview: ABOUT_SOCIAL_PREVIEW_CARD_QUERY,
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
  },
} as const satisfies Record<string, SEOConfig>;

export const USER_PROFILE_SITEMAP_ENTRY = {
  changefreq: "weekly",
  priority: 0.7,
} as const satisfies Pick<SitemapEntry, "changefreq" | "priority">;

type StaticSitemapEntryDef = {
  seoKey: Exclude<SEOPageKey, "user">;
  priority: number;
  changefreq: StaticSitemapChangeFrequency;
  lastmod?: string;
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
    seoKey: "about",
    priority: 0.65,
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

export function getStaticSitemapEntries(): SitemapEntry[] {
  return staticSitemapEntryDefs.map((entry) => ({
    ...entry,
    path: seoConfigs[entry.seoKey].canonical ?? "/",
  }));
}

export function getUserProfilePath(username: string): string {
  return `/user/${encodeURIComponent(username.trim())}`;
}

export function buildUserLookupPath({
  username,
  userId,
  q,
  visibility,
  group,
  customFilter,
}: {
  username?: SearchParamValue;
  userId?: SearchParamValue;
  q?: SearchParamValue;
  visibility?: SearchParamValue;
  group?: SearchParamValue;
  customFilter?: SearchParamValue;
}): string {
  const normalizedUsername = getSearchParamValue(username);
  const normalizedUserId = getSearchParamValue(userId);
  const normalizedQuery = getSearchParamValue(q);
  const normalizedVisibility = getSearchParamValue(visibility);
  const normalizedGroup = getSearchParamValue(group);
  const normalizedCustomFilter = getSearchParamValue(customFilter);
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

  if (normalizedCustomFilter && normalizedCustomFilter !== "all") {
    searchParams.set("customFilter", normalizedCustomFilter);
  }

  const search = searchParams.toString();
  return search ? `/user?${search}` : "/user";
}

export function buildCanonicalUserPageUrl({
  username,
  q,
  visibility,
  group,
  customFilter,
}: {
  username: string;
  q?: SearchParamValue;
  visibility?: SearchParamValue;
  group?: SearchParamValue;
  customFilter?: SearchParamValue;
}): string {
  const normalizedUsername = getSearchParamValue(username);
  const normalizedQuery = getSearchParamValue(q);
  const normalizedVisibility = getSearchParamValue(visibility);
  const normalizedGroup = getSearchParamValue(group);
  const normalizedCustomFilter = getSearchParamValue(customFilter);
  const searchParams = new URLSearchParams();

  if (!normalizedUsername) {
    return "/user";
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

  if (normalizedCustomFilter && normalizedCustomFilter !== "all") {
    searchParams.set("customFilter", normalizedCustomFilter);
  }

  const pathname = getUserProfilePath(normalizedUsername);
  const search = searchParams.toString();

  return search ? `${pathname}?${search}` : pathname;
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
  customFilter,
}: {
  q?: SearchParamValue;
  visibility?: SearchParamValue;
  group?: SearchParamValue;
  customFilter?: SearchParamValue;
}): boolean {
  const normalizedQuery = getSearchParamValue(q);
  const normalizedVisibility = getSearchParamValue(visibility);
  const normalizedGroup = getSearchParamValue(group);
  const normalizedCustomFilter = getSearchParamValue(customFilter);

  return Boolean(
    normalizedQuery ||
    (normalizedVisibility && normalizedVisibility !== "all") ||
    (normalizedGroup && normalizedGroup !== "All") ||
    (normalizedCustomFilter && normalizedCustomFilter !== "all"),
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
  customFilter,
  routeType = "lookup",
}: {
  username?: SearchParamValue;
  userId?: SearchParamValue;
  q?: SearchParamValue;
  visibility?: SearchParamValue;
  group?: SearchParamValue;
  customFilter?: SearchParamValue;
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
    hasUserPageStatefulParams({ q, visibility, group, customFilter });
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
        customFilter,
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
      ...(routeType === "lookup"
        ? {
            openGraphUrl: buildUserLookupPath({
              username: normalizedUsername,
              userId: normalizedUserId,
              q,
              visibility,
              group,
              customFilter,
            }),
          }
        : {}),
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
        customFilter,
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
