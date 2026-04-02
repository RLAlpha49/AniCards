import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  createRequestProofCookie,
  getRequestProofCookie,
  REQUEST_PROOF_COOKIE_NAME,
  resolveVerifiedClientIp,
  verifyRequestProofToken,
} from "@/lib/api/request-proof";
import { buildCSPHeader } from "@/lib/csp-config";
import { generateSecureId } from "@/lib/utils";

const REQUEST_ID_HEADER = "x-request-id";
const REQUEST_ID_MIDDLEWARE_MATCHER =
  "/((?!_next/static|_next/image|favicon.ico).*)";

function isSafeRequestId(value: string): boolean {
  return /^[A-Za-z0-9._:-]{8,120}$/.test(value);
}

function getOrCreateRequestId(request: NextRequest): string {
  const existing = request.headers.get(REQUEST_ID_HEADER)?.trim();
  if (existing && isSafeRequestId(existing)) {
    return existing;
  }

  if (typeof crypto?.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return generateSecureId("request");
}

function getRequestPathname(request: Pick<Request, "url">): string {
  try {
    return new URL(request.url).pathname;
  } catch {
    return "/";
  }
}

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

async function maybeRefreshRequestProof(
  request: NextRequest,
  response: NextResponse,
  isApiRequest: boolean,
): Promise<void> {
  const clientIp = resolveVerifiedClientIp(request);
  const existingProofCookie = getRequestProofCookie(request);

  if (!clientIp.verified) {
    if (existingProofCookie) {
      response.cookies.set({
        name: REQUEST_PROOF_COOKIE_NAME,
        value: "",
        maxAge: 0,
        path: "/",
      });
    }

    return;
  }

  if (isApiRequest) {
    if (!existingProofCookie) {
      return;
    }

    const verification = await verifyRequestProofToken(existingProofCookie, {
      ip: clientIp.ip,
      userAgent: request.headers.get("user-agent"),
    });
    if (!verification.valid) {
      response.cookies.set({
        name: REQUEST_PROOF_COOKIE_NAME,
        value: "",
        maxAge: 0,
        path: "/",
      });
      return;
    }
  }

  const proofCookie = await createRequestProofCookie({
    ip: clientIp.ip,
    userAgent: request.headers.get("user-agent"),
  });
  if (proofCookie) {
    response.cookies.set(proofCookie);
  }
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
 * @see docs/SECURITY.md for the durable CSP, nonce, and route-protection notes
 * @source
 */
export async function middleware(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const isApiRequest = getRequestPathname(request).startsWith("/api/");
  const nonce = isApiRequest ? undefined : generateNonce();
  const isDevelopment = process.env.NODE_ENV !== "production";

  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set(REQUEST_ID_HEADER, requestId);

  const cspHeader = nonce
    ? buildCSPHeader(nonce, {
        allowUnsafeEval: isDevelopment,
        allowUnsafeInlineStyles: isDevelopment,
      })
    : undefined;

  if (nonce && cspHeader) {
    forwardedHeaders.set("x-nonce", nonce);
    // Next.js reads the request-side CSP header during rendering so it can
    // automatically attach the nonce to framework-generated inline scripts and
    // styles (such as the font optimization `<style>` tags).
    forwardedHeaders.set("Content-Security-Policy", cspHeader);
  }

  const response = NextResponse.next({
    request: {
      headers: forwardedHeaders,
    },
  });
  response.headers.set("X-Request-Id", requestId);

  if (nonce && cspHeader) {
    response.headers.set("Content-Security-Policy", cspHeader);
    response.headers.set("x-nonce", nonce);
  }

  await maybeRefreshRequestProof(request, response, isApiRequest);

  return response;
}

/**
 * Middleware configuration
 *
 * Runs on all routes except:
 * - Static files (_next/static)
 * - Image optimization files (_next/image)
 * - Favicon
 *
 * API routes participate so request IDs are injected consistently, while the
 * HTML-only CSP nonce path stays limited to non-API requests.
 *
 * @source
 */
export const config = {
  matcher: [REQUEST_ID_MIDDLEWARE_MATCHER],
};
