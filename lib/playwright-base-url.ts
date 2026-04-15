export const DEFAULT_PLAYWRIGHT_BASE_URL = "http://localhost:3000";
export const ANICARDS_PRODUCTION_HOST = "anicards.alpha49.com";
export const ANICARDS_VERCEL_PREVIEW_HOST_PATTERN =
  /^anicards(?:-[a-z0-9]+)+\.vercel\.app$/;

export function parsePlaywrightBaseUrl(
  rawBaseUrl?: string,
  label = "PLAYWRIGHT_BASE_URL",
): URL | undefined {
  const trimmedBaseUrl = rawBaseUrl?.trim();
  if (!trimmedBaseUrl) {
    return undefined;
  }

  let parsedBaseUrl: URL;
  try {
    parsedBaseUrl = new URL(trimmedBaseUrl);
  } catch {
    throw new Error(
      `${label} must be a valid absolute http(s) URL: ${trimmedBaseUrl}`,
    );
  }

  if (!/^https?:$/.test(parsedBaseUrl.protocol)) {
    throw new Error(`${label} must use http(s): ${trimmedBaseUrl}`);
  }

  if (parsedBaseUrl.username || parsedBaseUrl.password) {
    throw new Error(`${label} must not include embedded credentials.`);
  }

  return parsedBaseUrl;
}

export function isTrustedAniCardsHost(hostname: string): boolean {
  const normalizedHostname = hostname.trim().toLowerCase();

  return (
    normalizedHostname === ANICARDS_PRODUCTION_HOST ||
    ANICARDS_VERCEL_PREVIEW_HOST_PATTERN.test(normalizedHostname)
  );
}

export function isTrustedAniCardsPreviewHost(hostname: string): boolean {
  return ANICARDS_VERCEL_PREVIEW_HOST_PATTERN.test(
    hostname.trim().toLowerCase(),
  );
}

export function parseTrustedAniCardsBaseUrl(
  rawBaseUrl: string,
  label = "PLAYWRIGHT_BASE_URL",
): URL {
  const parsedBaseUrl = parsePlaywrightBaseUrl(rawBaseUrl, label);
  if (!parsedBaseUrl) {
    throw new Error(`${label} is required.`);
  }

  if (!isTrustedAniCardsHost(parsedBaseUrl.hostname)) {
    throw new Error(
      `${label} must target the AniCards production host or an AniCards Vercel preview host: ${rawBaseUrl.trim()}`,
    );
  }

  return parsedBaseUrl;
}
