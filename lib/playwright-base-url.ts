export const DEFAULT_PLAYWRIGHT_BASE_URL = "http://localhost:3000";
export const ANICARDS_PRODUCTION_HOST = "anicards.alpha49.com";
export const ANICARDS_VERCEL_PREVIEW_HOST_PATTERN =
  /^anicards(?:-[a-z0-9]+)+\.vercel\.app$/;

export interface ResolvedPlaywrightBaseUrl {
  canSendBypassHeaders: boolean;
  isTrustedAniCardsHost: boolean;
  origin: string;
  parsedUrl: URL;
}

function createResolvedPlaywrightBaseUrl(
  parsedBaseUrl: URL,
): ResolvedPlaywrightBaseUrl {
  return {
    canSendBypassHeaders: isTrustedAniCardsPreviewHost(parsedBaseUrl.hostname),
    isTrustedAniCardsHost: isTrustedAniCardsHost(parsedBaseUrl.hostname),
    origin: parsedBaseUrl.origin,
    parsedUrl: parsedBaseUrl,
  };
}

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

export function resolvePlaywrightBaseUrl(
  rawBaseUrl?: string,
  label = "PLAYWRIGHT_BASE_URL",
): ResolvedPlaywrightBaseUrl | undefined {
  const parsedBaseUrl = parsePlaywrightBaseUrl(rawBaseUrl, label);

  return parsedBaseUrl
    ? createResolvedPlaywrightBaseUrl(parsedBaseUrl)
    : undefined;
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

export function buildPlaywrightAutomationBypassHeaders(options: {
  automationBypassSecret?: string;
  resolvedBaseUrl?: Pick<ResolvedPlaywrightBaseUrl, "canSendBypassHeaders">;
}): Record<string, string> | undefined {
  const { automationBypassSecret, resolvedBaseUrl } = options;

  if (!automationBypassSecret || !resolvedBaseUrl?.canSendBypassHeaders) {
    return undefined;
  }

  return {
    "x-vercel-protection-bypass": automationBypassSecret,
    "x-vercel-set-bypass-cookie": "true",
  };
}

export function resolveTrustedAniCardsBaseUrl(
  rawBaseUrl: string,
  label = "PLAYWRIGHT_BASE_URL",
): ResolvedPlaywrightBaseUrl {
  const resolvedBaseUrl = resolvePlaywrightBaseUrl(rawBaseUrl, label);
  if (!resolvedBaseUrl) {
    throw new Error(`${label} is required.`);
  }

  if (!resolvedBaseUrl.isTrustedAniCardsHost) {
    throw new Error(
      `${label} must target the AniCards production host or an AniCards Vercel preview host: ${rawBaseUrl.trim()}`,
    );
  }

  return resolvedBaseUrl;
}

export function parseTrustedAniCardsBaseUrl(
  rawBaseUrl: string,
  label = "PLAYWRIGHT_BASE_URL",
): URL {
  return resolveTrustedAniCardsBaseUrl(rawBaseUrl, label).parsedUrl;
}
