/**
 * Content Security Policy (CSP) Configuration Module
 *
 * Centralized CSP configuration for AniCards to restrict trusted content sources
 * and reduce the risk of XSS and code injection.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP
 * @see https://content-security-policy.com/
 * @source
 */

/** CSP keyword constants for type safety and consistency. @source */
export const CSP_KEYWORDS = {
  /** Allow resources from the same origin */
  SELF: "'self'",
  /** Allow inline resources when a directive explicitly opts into them */
  UNSAFE_INLINE: "'unsafe-inline'",
  /** Allow eval()-based development tooling; avoid this in production */
  UNSAFE_EVAL: "'unsafe-eval'",
  /** Enable strict-dynamic for modern browsers - allows dynamically loaded scripts from trusted sources */
  STRICT_DYNAMIC: "'strict-dynamic'",
  /** Block all sources (used for frame-ancestors to prevent clickjacking) */
  NONE: "'none'",
  /** Allow data: URIs */
  DATA: "data:",
  /** Allow blob: URIs */
  BLOB: "blob:",
} as const;

const STATIC_REMOTE_IMAGE_SOURCES = [
  "https://api.anicards.alpha49.com",
  "https://anicards.alpha49.com",
  "https://anilist.co",
  "https://cdn.anilist.co",
  "https://s1.anilist.co",
  "https://s2.anilist.co",
  "https://s3.anilist.co",
  "https://s4.anilist.co",
  "https://img.anili.st",
] as const;

const DEVELOPMENT_REMOTE_IMAGE_SOURCES = [
  "http://localhost:3000",
  "http://lvh.me:3000",
  "http://api.localhost:3000",
] as const;

function normalizeImageSourceOrigin(
  urlString: string | undefined,
): string | null {
  if (!urlString) return null;

  try {
    const url = new URL(urlString);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function normalizeCanonicalApiImageSourceOrigin(
  urlString: string | undefined,
): string | null {
  if (!urlString) return null;

  try {
    const url = new URL(urlString);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    if (!url.hostname.startsWith("api.")) {
      url.hostname = `api.${url.hostname}`;
    }

    return url.origin;
  } catch {
    return null;
  }
}

function normalizeConnectSourceOrigin(
  urlString: string | undefined,
): string | null {
  if (!urlString) {
    return null;
  }

  try {
    const url = new URL(urlString);
    return url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

export function getImageSrcAllowlist(
  options: {
    apiUrl?: string;
    siteUrl?: string;
    nodeEnv?: string;
  } = {},
): string[] {
  const apiUrl = options.apiUrl ?? process.env.NEXT_PUBLIC_API_URL;
  const siteUrl = options.siteUrl ?? process.env.NEXT_PUBLIC_SITE_URL;
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV;

  const configuredOrigins = [
    normalizeImageSourceOrigin(apiUrl),
    normalizeCanonicalApiImageSourceOrigin(apiUrl),
    normalizeImageSourceOrigin(siteUrl),
  ];

  return [
    ...new Set([
      ...STATIC_REMOTE_IMAGE_SOURCES,
      ...configuredOrigins.filter((origin): origin is string =>
        Boolean(origin),
      ),
      ...(nodeEnv === "production" ? [] : DEVELOPMENT_REMOTE_IMAGE_SOURCES),
    ]),
  ];
}

const IMAGE_SRC_ALLOWLIST = getImageSrcAllowlist();

export function getConnectSrcAllowlist(
  options: {
    upstashRedisRestUrl?: string;
  } = {},
): string[] {
  const upstashRedisRestUrl =
    options.upstashRedisRestUrl ?? process.env.UPSTASH_REDIS_REST_URL;

  return [
    ...new Set(
      [normalizeConnectSourceOrigin(upstashRedisRestUrl)].filter(
        (origin): origin is string => Boolean(origin),
      ),
    ),
  ];
}

const CONNECT_SRC_ALLOWLIST = getConnectSrcAllowlist();

/**
 * CSP Directives Configuration
 *
 * Whitelisted source URLs grouped by directive — used to assemble CSP headers.
 *
 * @source
 */
export const CSP_DIRECTIVES = {
  /** Default policy for all resource types not explicitly specified */
  defaultSrc: [CSP_KEYWORDS.SELF],

  /**
   * Script sources - controls which scripts can execute
   * Note: Nonce is dynamically added via buildCSPHeader function
   */
  scriptSrc: [
    CSP_KEYWORDS.SELF,
    "https://www.googletagmanager.com",
    "https://va.vercel-scripts.com",
    "https://vitals.vercel-insights.com",
    CSP_KEYWORDS.STRICT_DYNAMIC,
  ],

  /**
   * Style sources - controls which stylesheet URLs and nonce-backed inline
   * style blocks can be applied.
   *
   * Production uses a request nonce instead of a universal inline allowance so
   * framework-generated `<style>` tags (for example, from Next.js font
   * optimization) stay authorized without broadly permitting all inline CSS.
   */
  styleSrc: [CSP_KEYWORDS.SELF, "https://fonts.googleapis.com"],

  /**
   * Image sources - controls which images can be loaded
   * Allows same-origin images, generated data/blob URLs, AniCards preview origins,
   * and explicit AniList image hosts used by the application.
   */
  imgSrc: [
    CSP_KEYWORDS.SELF,
    CSP_KEYWORDS.DATA,
    CSP_KEYWORDS.BLOB,
    ...IMAGE_SRC_ALLOWLIST,
  ],

  /**
   * Font sources - controls which fonts can be loaded
   * Google Fonts serves font files from fonts.gstatic.com
   */
  fontSrc: [CSP_KEYWORDS.SELF, "https://fonts.gstatic.com", CSP_KEYWORDS.DATA],

  /**
   * Connect sources - controls which URLs can be used for fetch, XHR, WebSocket
   * Whitelists all external APIs and analytics services
   */
  connectSrc: [
    CSP_KEYWORDS.SELF,
    "https://graphql.anilist.co",
    ...CONNECT_SRC_ALLOWLIST,
    "https://va.vercel-scripts.com",
    "https://vitals.vercel-insights.com",
    "https://www.google-analytics.com",
    "https://region1.google-analytics.com",
  ],

  /**
   * Frame ancestors - controls which origins can embed this page
   * Set to 'none' to prevent clickjacking attacks
   */
  frameAncestors: [CSP_KEYWORDS.NONE],

  /** Block legacy plugin/object/embed content entirely. */
  objectSrc: [CSP_KEYWORDS.NONE],

  /** Base URI - restricts URLs that can be used in <base> element */
  baseUri: [CSP_KEYWORDS.SELF],

  /** Form action - restricts URLs that can be used as form submission targets */
  formAction: [CSP_KEYWORDS.SELF],

  /** Automatically upgrade HTTP requests to HTTPS */
  upgradeInsecureRequests: true,
} as const;

/**
 * Build a complete CSP header string and inject the provided nonce into script-src.
 *
 * @param nonce - A base64-encoded cryptographic nonce to authorize inline scripts
 * @param options - Optional policy toggles for the current environment
 * @returns The complete Content-Security-Policy header string
 * @source
 */
export function buildCSPHeader(
  nonce: string,
  options: {
    allowUnsafeEval?: boolean;
    allowUnsafeInlineStyles?: boolean;
    allowUnsafeInlineStyleAttributes?: boolean;
  } = {},
): string {
  const scriptSrcValues = [
    CSP_KEYWORDS.SELF,
    `'nonce-${nonce}'`,
    ...(options.allowUnsafeEval ? [CSP_KEYWORDS.UNSAFE_EVAL] : []),
    ...CSP_DIRECTIVES.scriptSrc.filter(
      (src) => src !== CSP_KEYWORDS.SELF, // Avoid duplicate 'self'
    ),
  ];

  const styleSrcValues = [
    CSP_KEYWORDS.SELF,
    ...(options.allowUnsafeInlineStyles
      ? [CSP_KEYWORDS.UNSAFE_INLINE]
      : [`'nonce-${nonce}'`]),
    ...CSP_DIRECTIVES.styleSrc.filter(
      (src) => src !== CSP_KEYWORDS.SELF, // Avoid duplicate 'self'
    ),
  ];

  const directives = [
    `default-src ${CSP_DIRECTIVES.defaultSrc.join(" ")}`,
    `script-src ${scriptSrcValues.join(" ")}`,
    `style-src ${styleSrcValues.join(" ")}`,
    ...(options.allowUnsafeInlineStyleAttributes
      ? [`style-src-attr ${CSP_KEYWORDS.UNSAFE_INLINE}`]
      : []),
    `img-src ${CSP_DIRECTIVES.imgSrc.join(" ")}`,
    `font-src ${CSP_DIRECTIVES.fontSrc.join(" ")}`,
    `connect-src ${CSP_DIRECTIVES.connectSrc.join(" ")}`,
    `frame-ancestors ${CSP_DIRECTIVES.frameAncestors.join(" ")}`,
    `object-src ${CSP_DIRECTIVES.objectSrc.join(" ")}`,
    `base-uri ${CSP_DIRECTIVES.baseUri.join(" ")}`,
    `form-action ${CSP_DIRECTIVES.formAction.join(" ")}`,
    ...(CSP_DIRECTIVES.upgradeInsecureRequests
      ? ["upgrade-insecure-requests"]
      : []),
  ];

  return directives.join("; ");
}
