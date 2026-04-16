import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { logPrivacySafe } from "@/lib/api/logging";
import {
  INTERNAL_REQUEST_ID_HEADER,
  REQUEST_ID_HEADER,
} from "@/lib/api/request-context";
import {
  createRequestProofCookie,
  getRequestProofCookie,
  REQUEST_PROOF_COOKIE_NAME,
  resolveVerifiedClientIp,
} from "@/lib/api/request-proof";
import { buildCSPHeader } from "@/lib/csp-config";
import { generateSecureId } from "@/lib/utils";

const REQUEST_ID_MIDDLEWARE_MATCHER =
  "/((?!_next/static|_next/image|favicon.ico|icon.ico|icon.svg).*)";
const DOCUMENT_INLINE_STYLE_COMPATIBILITY_ROUTE_PREFIXES = [
  "/examples",
  "/user",
] as const;
const DOCUMENT_FETCH_DESTINATIONS = new Set(["document", "iframe"]);

function pathnameLooksLikeDocument(pathname: string): boolean {
  const lastSegment = pathname.split("/").filter(Boolean).at(-1);
  return !lastSegment?.includes(".");
}

function acceptsHtmlDocument(request: NextRequest): boolean {
  const acceptHeader = request.headers.get("accept")?.toLowerCase() ?? "";
  return (
    acceptHeader.includes("text/html") ||
    acceptHeader.includes("application/xhtml+xml")
  );
}

function isDocumentRequest(request: NextRequest, pathname: string): boolean {
  if (!["GET", "HEAD"].includes(request.method.toUpperCase())) {
    return false;
  }

  if (pathname.startsWith("/api/")) {
    return false;
  }

  if (!pathnameLooksLikeDocument(pathname)) {
    return false;
  }

  const fetchDestination = request.headers.get("sec-fetch-dest")?.toLowerCase();
  const fetchMode = request.headers.get("sec-fetch-mode")?.toLowerCase();

  return (
    acceptsHtmlDocument(request) ||
    DOCUMENT_FETCH_DESTINATIONS.has(fetchDestination ?? "") ||
    fetchMode === "navigate" ||
    (!fetchDestination && !fetchMode)
  );
}

function getOrCreateRequestId(): string {
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

function getRequestRoute(
  request: Pick<Request, "url"> & Partial<Pick<NextRequest, "nextUrl">>,
): string {
  const nextUrl = request.nextUrl;

  if (nextUrl) {
    return `${nextUrl.pathname}${nextUrl.search}`;
  }

  try {
    const parsedUrl = new URL(request.url);
    return `${parsedUrl.pathname}${parsedUrl.search}`;
  } catch {
    return "/";
  }
}

function shouldAllowInlineStyleAttributes(pathname: string): boolean {
  if (pathname === "/") {
    return true;
  }

  return DOCUMENT_INLINE_STYLE_COMPATIBILITY_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
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
  shouldBootstrapRequestProof: boolean,
): Promise<void> {
  if (!shouldBootstrapRequestProof) {
    return;
  }

  const clientIp = resolveVerifiedClientIp(request);
  const existingProofCookie = getRequestProofCookie(request);

  if (!clientIp.verified) {
    if (process.env.NODE_ENV === "production") {
      logPrivacySafe(
        "error",
        "App Middleware",
        "Skipped request-proof refresh because the client IP could not be verified.",
        {
          reason: clientIp.reason,
        },
        request,
      );
    }

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
  const requestId = getOrCreateRequestId();
  const pathname = getRequestPathname(request);
  const isDocumentNavigationRequest = isDocumentRequest(request, pathname);
  const nonce = isDocumentNavigationRequest ? generateNonce() : undefined;
  const isDevelopment = process.env.NODE_ENV === "development";
  const allowInlineStyleAttributes = shouldAllowInlineStyleAttributes(pathname);
  const requestRoute = getRequestRoute(request);

  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.delete(REQUEST_ID_HEADER);
  forwardedHeaders.delete(INTERNAL_REQUEST_ID_HEADER);
  forwardedHeaders.set(INTERNAL_REQUEST_ID_HEADER, requestId);
  forwardedHeaders.set("x-request-route", requestRoute);

  const cspHeader = nonce
    ? buildCSPHeader(nonce, {
        allowUnsafeEval: isDevelopment,
        allowUnsafeInlineStyles: isDevelopment,
        allowUnsafeInlineStyleAttributes:
          isDevelopment || allowInlineStyleAttributes,
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
  response.headers.set(REQUEST_ID_HEADER, requestId);

  if (nonce && cspHeader) {
    response.headers.set("Content-Security-Policy", cspHeader);
    response.headers.set("x-nonce", nonce);
  }

  await maybeRefreshRequestProof(
    request,
    response,
    isDocumentNavigationRequest,
  );

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
