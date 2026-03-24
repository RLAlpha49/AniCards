import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { buildCSPHeader } from "@/lib/csp-config";

/**
 * Generates a cryptographically secure random nonce for CSP
 *
 * The nonce is 16 bytes (128 bits) of random data, base64 encoded.
 * A new nonce is generated for each request to prevent replay attacks.
 *
 * @returns A base64-encoded random nonce string
 * @source
 */
function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCodePoint(...array));
}

/**
 * Next.js Middleware for CSP and Route Protection
 *
 * This middleware performs two main functions:
 *
 * 1. **Content Security Policy (CSP) Injection**
 *    - Generates a unique cryptographic nonce for each request
 *    - Builds and sets CSP headers to protect against XSS and code injection
 *    - Passes the nonce to components via a custom x-nonce header
 *
 * 2. **Route Guards**
 *    - Redirects `/user` to `/user/lookup` when `userId` param is missing
 *
 * Security Benefits:
 * - Prevents XSS attacks by only allowing scripts with valid nonces
 * - Blocks unauthorized resource loading from untrusted sources
 * - Prevents clickjacking via frame-ancestors directive
 * - Automatically upgrades HTTP to HTTPS
 *
 * @param request - The incoming Next.js request
 * @returns Response with CSP headers or redirect response
 *
 * @see lib/csp-config.ts for CSP directive configuration
 * @see docs/SECURITY.md for comprehensive security documentation
 * @source
 */
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const params = request.nextUrl.searchParams;

  if (path === "/user" && !params.get("userId")) {
    return NextResponse.redirect(new URL("/user/lookup", request.url));
  }

  const nonce = generateNonce();

  const cspHeader = buildCSPHeader(nonce);

  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set("x-nonce", nonce);
  const response = NextResponse.next({
    request: {
      headers: forwardedHeaders,
    },
  });

  response.headers.set("Content-Security-Policy", cspHeader);

  response.headers.set("x-nonce", nonce);

  return response;
}

/**
 * Middleware configuration
 *
 * Runs on all routes except:
 * - API routes (they don't render HTML with scripts)
 * - Static files (_next/static)
 * - Image optimization files (_next/image)
 * - Favicon
 *
 * @source
 */
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
