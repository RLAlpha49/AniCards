const DEFAULT_SITE_URL = "https://anicards.alpha49.com";

export const SITE_NAME = "AniCards";
export const SITE_AUTHOR_NAME = "RLAlpha49";
export const SITE_CONTACT_EMAIL = "contact@alpha49.com";
export const SITE_AUTHOR_GITHUB_URL = "https://github.com/RLAlpha49";
export const SITE_REPOSITORY_URL = "https://github.com/RLAlpha49/AniCards";
export const SITE_LOGO_PATH = "/icon.svg";

export interface SiteSocialLink {
  href: string;
  label: string;
  name: "anilist" | "discord" | "email" | "github";
  includeInSameAs?: boolean;
}

export type SiteSocialLinkName = SiteSocialLink["name"];

export const SITE_SOCIAL_LINKS: readonly SiteSocialLink[] = [
  {
    href: "https://anilist.co/user/Alpha49",
    label: "AniList Profile",
    name: "anilist",
    includeInSameAs: true,
  },
  {
    href: "https://discordid.netlify.app/?id=251479989378220044",
    label: "Discord",
    name: "discord",
  },
  {
    href: `mailto:${SITE_CONTACT_EMAIL}`,
    label: "Email",
    name: "email",
  },
  {
    href: SITE_AUTHOR_GITHUB_URL,
    label: "GitHub Profile",
    name: "github",
    includeInSameAs: true,
  },
];

export const SITE_SAME_AS_LINKS = SITE_SOCIAL_LINKS.filter(
  (link) => link.includeInSameAs,
).map((link) => link.href);

type CanonicalSearchParams = Record<
  string,
  string | number | boolean | null | undefined
>;

function stripTrailingSlash(url: string): string {
  let end = url.length;

  while (end > 0 && url.endsWith("/", end)) {
    end -= 1;
  }

  return end === url.length ? url : url.slice(0, end);
}

/**
 * Returns the canonical public origin for the site, normalizing any trailing slash.
 * Falls back to the production hostname when the environment value is absent or invalid.
 */
export function getSiteUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (!configuredUrl) {
    return DEFAULT_SITE_URL;
  }

  try {
    return stripTrailingSlash(new URL(configuredUrl).toString());
  } catch {
    return DEFAULT_SITE_URL;
  }
}

/**
 * Returns the canonical site origin as a URL object for Next.js metadata APIs.
 */
export function getSiteUrlObject(): URL {
  return new URL(`${getSiteUrl()}/`);
}

/**
 * Builds a canonical URL from a path and optional search params using the configured site origin.
 */
export function buildCanonicalUrl(
  path: string = "/",
  searchParams?: CanonicalSearchParams,
): string {
  const siteUrl = getSiteUrl();
  const normalizedPath = path === "/" ? "" : path;
  const canonicalPath = normalizedPath.startsWith("/")
    ? normalizedPath
    : `/${normalizedPath}`;
  const url = new URL(`${siteUrl}${canonicalPath}` || siteUrl);

  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return;
      }

      const normalizedValue = String(value).trim();

      if (!normalizedValue) {
        return;
      }

      url.searchParams.set(key, normalizedValue);
    });
  }

  const resolvedPath = url.pathname === "/" ? "" : url.pathname;
  return `${url.origin}${resolvedPath}${url.search}`;
}

/**
 * Resolves either a relative path or a fully qualified URL into an absolute canonical URL.
 */
export function resolveSiteUrl(pathOrUrl: string): string {
  const lowerCased = pathOrUrl.toLowerCase();

  return lowerCased.startsWith("http://") || lowerCased.startsWith("https://")
    ? stripTrailingSlash(pathOrUrl)
    : buildCanonicalUrl(pathOrUrl);
}
