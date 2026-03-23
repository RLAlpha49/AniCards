const DEFAULT_SITE_URL = "https://anicards.alpha49.com";

export const SITE_NAME = "AniCards";
export const SITE_AUTHOR_NAME = "RLAlpha49";

type CanonicalSearchParams = Record<
  string,
  string | number | boolean | null | undefined
>;

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
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
  return /^https?:\/\//i.test(pathOrUrl)
    ? stripTrailingSlash(pathOrUrl)
    : buildCanonicalUrl(pathOrUrl);
}
