import type { NextConfig } from "next";

/**
 * Public site origin used when `NEXT_PUBLIC_SITE_URL` is unset or unusable.
 * @source
 */
const SITE_ORIGIN_FALLBACK = "https://anicards.alpha49.com";

/**
 * Production host that serves the API.
 * @source
 */
const API_HOST = "api.anicards.alpha49.com";

/**
 * Development hosts that stand in for the API host.
 * @source
 */
const DEV_API_HOSTS = [
  "api.localhost",
  "api.lvh.me",
  "api.anicards.localhost",
  "api.anicards.lvh.me",
  "api.anicards.test",
];

/**
 * Every host the API is served on.
 *
 * Host conditions match the `Host` header with its port removed, so a
 * `host:3000` value would never match. One entry per host covers every port.
 * @source
 */
const API_HOSTS = [API_HOST, ...DEV_API_HOSTS];

/**
 * First path segments the API host serves instead of the site.
 *
 * `api` and `_next` are framework surfaces. `StatCards` is the retired card
 * endpoint whose notice SVG is still embedded in GitHub profiles. The rest are
 * the bare aliases rewritten to `/api/...` below, which the README documents
 * as public card URLs.
 * @source
 */
const API_SURFACE_SEGMENTS = [
  "api",
  "_next",
  "StatCards",
  "anilist",
  "card",
  "card\\.svg",
  "convert",
  "cron",
  "get-cards",
  "get-user",
  "store-cards",
  "store-users",
];

/**
 * Bare paths on the API host that rewrite to their `/api/...` route.
 * @source
 */
const API_ALIAS_SEGMENTS = [
  "anilist",
  "card",
  "card\\.svg",
  "convert",
  "cron",
  "get-cards",
  "get-user",
  "store-cards",
  "store-users",
];

/**
 * Matches a path whose first segment is not part of the API surface.
 *
 * Used as a redirect source, so the API host stops serving the site: without
 * it a request for a page falls through the rewrite below (its `/api/<page>`
 * destination does not exist) and renders the full site on the API origin.
 * @source
 */
const NON_API_PATH_SOURCE = `/:path((?!(?:${API_SURFACE_SEGMENTS.join(
  "|",
)})(?:/|$)).*)`;

/**
 * Matches a bare API alias path, with or without further segments.
 * @source
 */
const API_ALIAS_PATH_SOURCE = `/:path((?:${API_ALIAS_SEGMENTS.join(
  "|",
)})(?:/.*)?)`;

/**
 * Resolves the origin page requests on the API host are sent to.
 *
 * Read from `NEXT_PUBLIC_SITE_URL` so the Docker dev stack redirects to the dev
 * site host rather than to production. A value that points back at an API host
 * is ignored, because redirecting the API host to itself would loop.
 *
 * @returns A parseable origin with a non-API host.
 * @source
 */
function getSiteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (!configured) return SITE_ORIGIN_FALLBACK;

  let origin: string;
  try {
    origin = new URL(configured).origin;
  } catch {
    return SITE_ORIGIN_FALLBACK;
  }

  return API_HOSTS.includes(new URL(origin).hostname)
    ? SITE_ORIGIN_FALLBACK
    : origin;
}

/**
 * Next.js Configuration
 *
 * This configuration includes:
 * - Environment variables for analytics and the public API origin
 * - Image optimization settings for local and production domains
 * - Security headers for defense-in-depth protection
 *
 * Note: The main CSP header with nonces is injected via proxy (proxy.ts)
 * to enable per-request nonce generation. Static security headers are configured here.
 *
 * Server-only secrets must not be listed in `env`: Next.js inlines those
 * values into the client bundle. Read them with `process.env` in the server
 * code that needs them instead.
 *
 * @see proxy.ts for CSP header generation
 * @see lib/csp-config.ts for CSP directive configuration
 * @see docs/SECURITY.md for comprehensive security documentation
 * @source
 */
const nextConfig: NextConfig = {
  allowedDevOrigins: ["anicards.test", "api.anicards.test"],
  env: {
    NEXT_PUBLIC_GOOGLE_ANALYTICS_ID:
      process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID,
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL ?? "https://api.anicards.alpha49.com",
  },
  images: {
    remotePatterns: [
      {
        hostname: "localhost",
        protocol: "http",
        port: "3000",
      },
      {
        hostname: "api.anicards.alpha49.com",
        protocol: "https",
      },
      {
        hostname: "anicards.alpha49.com",
        protocol: "https",
      },
      {
        hostname: "lvh.me",
        protocol: "http",
        port: "3000",
      },
      {
        hostname: "api.localhost",
        protocol: "http",
        port: "3000",
      },
    ],
    qualities: [100, 75],
  },

  /**
   * Security Headers Configuration
   *
   * These headers provide defense-in-depth security measures.
   * The CSP directives themselves are defined in `lib/csp-config.ts` and injected per request
   * in `proxy.ts` so that nonces can be generated via `crypto.getRandomValues`.
   * `next.config.ts` only hosts the static headers below and purposely avoids duplicating
   * CSP logic.
   *
   * Headers applied:
   * - X-DNS-Prefetch-Control: Enable DNS prefetching for performance
   * - X-Frame-Options: Prevent clickjacking (defense-in-depth with CSP frame-ancestors)
   * - X-Content-Type-Options: Prevent MIME type sniffing attacks
   * - Referrer-Policy: Control referrer information sent to other origins
   * - Permissions-Policy: Disable unnecessary browser features
   */
  headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/:path*",
        headers: [
          {
            // Enable DNS prefetching for improved performance
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            // Prevent clickjacking by disallowing embedding in frames
            // This is redundant with CSP frame-ancestors but provides defense-in-depth
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            // Prevent browsers from MIME-sniffing a response away from the declared content-type
            // This prevents attacks based on MIME type confusion
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            // Control how much referrer information is included with requests
            // strict-origin-when-cross-origin: Full URL for same-origin, only origin for cross-origin
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            // Disable unnecessary browser features to reduce attack surface
            // This prevents malicious scripts from accessing sensitive APIs
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },

  /**
   * Sends every non-API request on the API host to the site origin.
   *
   * Redirects are evaluated before rewrites and before the filesystem, so this
   * wins over the fall-through that used to render the site on the API origin.
   * The redirect is temporary: a permanent one would be cached in browsers and
   * survive any later change to how the two hosts are split.
   *
   * @see https://nextjs.org/docs/app/api-reference/config/next-config-js/redirects
   * @source
   */
  redirects() {
    return API_HOSTS.map((host) => ({
      source: NON_API_PATH_SOURCE,
      has: [{ type: "host" as const, value: host }],
      destination: `${getSiteOrigin()}/:path`,
      permanent: false,
    }));
  },

  rewrites() {
    // Only the aliases are rewritten. A blanket `/:path` would hand any future
    // page path to an API route of the same name instead of the redirect above.
    const aliasRules = API_HOSTS.map((host) => ({
      source: API_ALIAS_PATH_SOURCE,
      has: [{ type: "host" as const, value: host }],
      destination: "/api/:path",
    }));

    return [
      ...aliasRules,
      {
        source: "/card.svg",
        destination: "/api/card",
      },
      {
        source: "/api/card.svg",
        destination: "/api/card",
      },
    ];
  },
};

export default nextConfig;
