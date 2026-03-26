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
  /** Allow inline styles (required for Tailwind CSS) */
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
  /** Allow any HTTPS source */
  HTTPS: "https:",
} as const;

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
    "https://*.vercel-insights.com",
    CSP_KEYWORDS.STRICT_DYNAMIC,
  ],

  /**
   * Style sources - controls which stylesheets can be applied
   * unsafe-inline is required for Tailwind CSS's runtime styles
   */
  styleSrc: [
    CSP_KEYWORDS.SELF,
    CSP_KEYWORDS.UNSAFE_INLINE,
    "https://fonts.googleapis.com",
  ],

  /**
   * Image sources - controls which images can be loaded
   * Allows data URIs for inline images, blob for generated content, and any HTTPS source
   */
  imgSrc: [
    CSP_KEYWORDS.SELF,
    CSP_KEYWORDS.DATA,
    CSP_KEYWORDS.BLOB,
    CSP_KEYWORDS.HTTPS,
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
    "https://*.upstash.io",
    "https://va.vercel-scripts.com",
    "https://*.vercel-insights.com",
    "https://www.google-analytics.com",
    "https://region1.google-analytics.com",
  ],

  /** Allows same-origin service workers and other workers used for progressive enhancement. */
  workerSrc: [CSP_KEYWORDS.SELF],

  /** Allows the install manifest to be loaded from the same origin. */
  manifestSrc: [CSP_KEYWORDS.SELF],

  /**
   * Frame ancestors - controls which origins can embed this page
   * Set to 'none' to prevent clickjacking attacks
   */
  frameAncestors: [CSP_KEYWORDS.NONE],

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
  options: { allowUnsafeEval?: boolean } = {},
): string {
  const scriptSrcValues = [
    CSP_KEYWORDS.SELF,
    `'nonce-${nonce}'`,
    ...(options.allowUnsafeEval ? [CSP_KEYWORDS.UNSAFE_EVAL] : []),
    ...CSP_DIRECTIVES.scriptSrc.filter(
      (src) => src !== CSP_KEYWORDS.SELF, // Avoid duplicate 'self'
    ),
  ];

  const directives = [
    `default-src ${CSP_DIRECTIVES.defaultSrc.join(" ")}`,
    `script-src ${scriptSrcValues.join(" ")}`,
    `style-src ${CSP_DIRECTIVES.styleSrc.join(" ")}`,
    `img-src ${CSP_DIRECTIVES.imgSrc.join(" ")}`,
    `font-src ${CSP_DIRECTIVES.fontSrc.join(" ")}`,
    `connect-src ${CSP_DIRECTIVES.connectSrc.join(" ")}`,
    `worker-src ${CSP_DIRECTIVES.workerSrc.join(" ")}`,
    `manifest-src ${CSP_DIRECTIVES.manifestSrc.join(" ")}`,
    `frame-ancestors ${CSP_DIRECTIVES.frameAncestors.join(" ")}`,
    `base-uri ${CSP_DIRECTIVES.baseUri.join(" ")}`,
    `form-action ${CSP_DIRECTIVES.formAction.join(" ")}`,
    ...(CSP_DIRECTIVES.upgradeInsecureRequests
      ? ["upgrade-insecure-requests"]
      : []),
  ];

  return directives.join("; ");
}
