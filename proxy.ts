import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
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
  // Use Web Crypto API which is available in the Node.js runtime
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  // Convert to base64 manually for runtime compatibility
  return btoa(String.fromCodePoint(...array));
}

/**
 * Next.js Proxy for CSP injection
 *
 * This proxy generates a unique cryptographic nonce for each request, builds
 * the Content Security Policy header from it, and passes the nonce to the
 * React tree so inline scripts can be authorised.
 *
 * Security Benefits:
 * - Prevents XSS attacks by only allowing scripts with valid nonces
 * - Blocks unauthorized resource loading from untrusted sources
 * - Prevents clickjacking via frame-ancestors directive
 * - Automatically upgrades HTTP to HTTPS
 *
 * @param request - The incoming Next.js request
 * @returns Response with CSP headers
 *
 * @see lib/csp-config.ts for CSP directive configuration
 * @see docs/SECURITY.md for comprehensive security documentation
 * @source
 */
export function proxy(request: NextRequest) {
  // Generate a unique nonce for this request
  const nonce = generateNonce();

  // Build the CSP header with the nonce
  const cspHeader = buildCSPHeader(nonce);

  // Create response with CSP headers and forward the nonce in request headers
  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set("x-nonce", nonce);
  // Next.js reads the nonce from the *request* Content-Security-Policy header
  // and applies it to the scripts it injects. Without this, its bootstrap
  // scripts carry no nonce and a strict policy would block them.
  forwardedHeaders.set("Content-Security-Policy", cspHeader);
  const response = NextResponse.next({
    request: {
      headers: forwardedHeaders,
    },
  });

  // Set CSP header for enforcement
  // Note: Using Content-Security-Policy-Report-Only initially for testing
  // Switch to Content-Security-Policy after validation
  response.headers.set("Content-Security-Policy-Report-Only", cspHeader);

  // Store nonce in custom header for access by Server Components
  // This allows layout.tsx and other components to retrieve the nonce
  response.headers.set("x-nonce", nonce);

  return response;
}

/**
 * Proxy configuration
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
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
