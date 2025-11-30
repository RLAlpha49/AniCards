import type { NextConfig } from "next";

/**
 * Next.js Configuration
 *
 * This configuration includes:
 * - Environment variables for API authentication and analytics
 * - Image optimization settings for local and production domains
 * - Security headers for defense-in-depth protection
 *
 * Note: The main CSP header with nonces is injected via middleware (app/middleware.ts)
 * to enable per-request nonce generation. Static security headers are configured here.
 *
 * @see app/middleware.ts for CSP header generation
 * @see lib/csp-config.ts for CSP directive configuration
 * @see docs/SECURITY.md for comprehensive security documentation
 * @source
 */
const nextConfig: NextConfig = {
  env: {
    API_SECRET_TOKEN: process.env.API_SECRET_TOKEN,
    NEXT_PUBLIC_GOOGLE_ANALYTICS_ID:
      process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID,
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
   * in `app/middleware.ts` so that nonces can be generated via `crypto.getRandomValues`.
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
  async headers() {
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

  async rewrites() {
    const primaryRules = [
      {
        source: "/:path*",
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

    const isProd = process.env.NODE_ENV === "production";
    const devRules = isProd
      ? []
      : devHosts.flatMap((h) => [
            {
              source: "/:path*",
              has: [
                {
                  type: "host" as const,
                  value: h,
                },
              ],
              destination: "/api/:path*",
            },
            {
              source: "/:path*",
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
      {
        source: "/api/card.svg",
        destination: "/api/card",
      },
    ];
  },
};

export default nextConfig;
