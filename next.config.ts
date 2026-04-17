// next.config.ts
//
// Central Next.js runtime configuration for AniCards. Static security headers live here,
// while CSP nonces stay in `app/middleware.ts` because they must be generated per request.
//
// Host-based rewrites preserve the public `api.*` domains and the legacy `/card.svg`
// entry points without forcing the app code to duplicate API route implementations.

import type { NextConfig } from "next";

export function getRequiredNextPublicApiUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const apiUrl = env.NEXT_PUBLIC_API_URL?.trim();

  if (!apiUrl) {
    throw new Error(
      "Missing required NEXT_PUBLIC_API_URL. AniCards no longer falls back to the production API host; set NEXT_PUBLIC_API_URL explicitly in .env.local or your deployment environment.",
    );
  }

  let parsedApiUrl: URL;

  try {
    parsedApiUrl = new URL(apiUrl);
  } catch {
    throw new Error("NEXT_PUBLIC_API_URL must be an absolute http(s) URL.");
  }

  if (parsedApiUrl.protocol !== "http:" && parsedApiUrl.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_API_URL must be an absolute http(s) URL.");
  }

  return apiUrl;
}

const requiredNextPublicApiUrl = getRequiredNextPublicApiUrl();

/**
 * Note: The main CSP header with nonces is injected via middleware (app/middleware.ts)
 * to enable per-request nonce generation. Static security headers are configured here.
 *
 * @see app/middleware.ts for CSP header generation
 * @see lib/csp-config.ts for CSP directive configuration
 * @see docs/SECURITY.md for the durable CSP, headers, and route-protection notes
 */
const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_GOOGLE_ANALYTICS_ID:
      process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID,
    NEXT_PUBLIC_API_URL: requiredNextPublicApiUrl,
  },
  serverExternalPackages: ["@napi-rs/canvas"],
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
      {
        hostname: "anilist.co",
        protocol: "https",
      },
      {
        hostname: "cdn.anilist.co",
        protocol: "https",
      },
      {
        hostname: "s1.anilist.co",
        protocol: "https",
      },
      {
        hostname: "s2.anilist.co",
        protocol: "https",
      },
      {
        hostname: "s3.anilist.co",
        protocol: "https",
      },
      {
        hostname: "s4.anilist.co",
        protocol: "https",
      },
    ],
    qualities: [100, 75],
  },

  /**
   * CSP directives are defined in `lib/csp-config.ts` and injected per request
   * in `app/middleware.ts` so that nonces can be generated via `crypto.getRandomValues`.
   * `next.config.ts` only hosts the static headers below and purposely avoids duplicating
   * CSP logic.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            // This is redundant with CSP frame-ancestors but provides defense-in-depth
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            // This prevents attacks based on MIME type confusion
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          {
            // strict-origin-when-cross-origin: Full URL for same-origin, only origin for cross-origin
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            // This prevents malicious scripts from accessing sensitive APIs
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },

  async rewrites() {
    const primaryRules = [
      {
        source: "/:path((?!api/).*)",
        has: [
          {
            type: "host" as const,
            value: "api.anicards.alpha49.com",
          },
        ],
        destination: "/api/:path*",
      },
    ];

    const devPort = process.env.PORT ?? "3000";
    const devHosts = [
      "api.localhost",
      "api.lvh.me",
      "api.anicards.localhost",
      "api.anicards.lvh.me",
    ];

    // Duplicate the development hosts with and without an explicit port because
    // local proxies and browsers do not agree on whether `Host` preserves `:PORT`.
    const devRules = devHosts.flatMap((h) => [
      {
        source: "/:path((?!api/).*)",
        has: [
          {
            type: "host" as const,
            value: h,
          },
        ],
        destination: "/api/:path*",
      },
      {
        source: "/:path((?!api/).*)",
        has: [
          {
            type: "host" as const,
            value: `${h}:${devPort}`,
          },
        ],
        destination: "/api/:path*",
      },
    ]);

    return [
      ...primaryRules,
      ...devRules,
      // Keep old embeddable card URLs working while `/api/card` remains the
      // canonical handler. Cache semantics live in the route response because
      // canonical embeds, preview variants, and aliases now need different
      // policies without fighting static pre-rewrite headers.
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
