/**
 * Response shaping for the card endpoint.
 *
 * A card response is an SVG with cache and CORS headers; a card error is an
 * error card with no cache at all. Both are built here so the route can answer
 * without carrying header strings or message prefixes of its own.
 *
 * @source
 */

import {
  getAllowedCardSvgOrigin,
  doesCardSvgOriginVary,
  runAfterResponse,
} from "@/lib/api-utils";
import { getCardBorderRadius, DEFAULT_CARD_BORDER_RADIUS } from "@/lib/utils";
import { buildErrorCardSvg } from "@/lib/svg-templates/error-card";
import { toCleanSvgResponse, type TrustedSVG } from "@/lib/types/svg";
import { recordUserCardRequest } from "@/lib/server/user-activity";
import { CardDataError } from "@/lib/card-data";

/**
 * Generate the error SVG returned for a failed card request.
 *
 * Error responses are the only place the API returns a card that is not
 * generated from user data, so the size and wrapping rules live with the
 * template rather than this route. See `buildErrorCardSvg`.
 *
 * @param message - The human-readable message to display inside the SVG.
 * @returns A TrustedSVG containing the wrapped message.
 * @source
 */
export function svgError(message: string): TrustedSVG {
  return buildErrorCardSvg(message);
}

/**
 * Format a CardDataError's message with a suitable prefix depending on status.
 *
 * Client errors are prefixed with 'Client Error:' unless they're 'Not Found',
 * and server errors are prefixed with 'Server Error:' to keep responses
 * consistent for listeners and debugging.
 *
 * @param err - CardDataError containing status and message.
 * @returns A prefixed, human-readable message.
 * @source
 */
export function formatCardDataErrorMessage(err: CardDataError): string {
  const raw = String(err?.message ?? "");
  if (err.status === 404) {
    return raw.startsWith("Not Found:") ? raw : `Not Found: ${raw}`;
  }
  if (err.status >= 400 && err.status < 500) {
    return raw.startsWith("Client Error:") || raw.startsWith("Not Found:")
      ? raw
      : `Client Error: ${raw}`;
  }
  return raw.startsWith("Server Error:") ? raw : `Server Error: ${raw}`;
}

/**
 * Headers used for successful SVG responses.
 *
 * These include aggressive caching and CORS headers, exposing the card border radius
 * in a response header so clients can render a placeholder sized correctly.
 *
 * Implements stale-while-revalidate pattern:
 * - max-age: 24 hours (browser cache fresh for a full day)
 * - s-maxage: 24 hours (required for Vercel's CDN to cache a function response;
 *   without it the edge stores the response only via max-age)
 * - stale-while-revalidate: 7 days (continue serving stale content for a week while revalidating)
 * - stale-if-error: 14 days (serve stale if origin is down)
 *
 * Vercel consumes `s-maxage`, `stale-while-revalidate`, and `stale-if-error` and
 * strips them from the copy sent to the browser, so the client sees only
 * `public, max-age=86400`.
 *
 * @param request - Optional incoming request used to determine allowed origin.
 * @returns A headers object suitable for passing to Response.
 * @source
 */
function svgHeaders(request?: Request) {
  const allowedOrigin = getAllowedCardSvgOrigin(request);
  return {
    "Content-Type": "image/svg+xml",
    "Cache-Control":
      "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800, stale-if-error=1209600",
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, HEAD",
    "Access-Control-Expose-Headers": "X-Card-Border-Radius, X-Cache-Source",
    // Only declared when the origin depends on the request. A constant origin
    // does not need the variance, and declaring it stored one copy of every
    // card per embedding context.
    ...(doesCardSvgOriginVary() ? { Vary: "Origin" } : {}),
    "X-Card-Border-Radius": String(DEFAULT_CARD_BORDER_RADIUS),
  };
}

/**
 * Headers used for error SVG responses.
 *
 * Error responses are not cached and use CORS headers consistent with the
 * card SVG responses. This ensures the browser doesn't persist erroneous
 * output for long.
 *
 * @param request - Optional incoming request used to determine allowed origin.
 * @returns A headers object suitable for passing to Response.
 * @source
 */
function errorHeaders(request?: Request) {
  const allowedOrigin = getAllowedCardSvgOrigin(request);
  return {
    "Content-Type": "image/svg+xml",
    "Cache-Control": "no-store, max-age=0, must-revalidate", // No cache, force revalidation
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, HEAD",
    "Access-Control-Expose-Headers": "X-Card-Border-Radius",
    // Errors are never cached, so the variance costs nothing to declare and
    // keeps the header correct when the origin is request-derived.
    ...(doesCardSvgOriginVary() ? { Vary: "Origin" } : {}),
    "X-Card-Border-Radius": String(DEFAULT_CARD_BORDER_RADIUS),
  };
}

/**
 * Where the SVG in a response came from.
 *
 * `memory` means this process already had the render. `render` means the card
 * was produced for this request. `bypass` means the request carried a `_t`
 * parameter, which asks for a render that does not use a stored copy.
 *
 * @source
 */
export type CardCacheSource = "memory" | "render" | "bypass";

/**
 * Creates the success response with SVG content and headers.
 *
 * Every served card records a card request for the resolved user, because this
 * is the one funnel all successful paths pass through: cache hit and fresh
 * render. Failed requests do not record activity, so they cannot keep
 * a removed or invalid user looking active.
 *
 * @param svgContent - The trusted SVG to return.
 * @param request - The incoming request, used to build CORS headers.
 * @param borderRadius - The card's border radius, returned in a header.
 * @param userId - The resolved user the card belongs to.
 * @param cacheSource - Where the SVG came from, returned in `X-Cache-Source`.
 * @source
 */
export function createSuccessResponse(
  svgContent: TrustedSVG,
  request: Request,
  borderRadius: number | undefined,
  userId: number,
  cacheSource: CardCacheSource,
): Response {
  runAfterResponse(recordUserCardRequest(userId));
  const cleaned = toCleanSvgResponse(svgContent);
  const headerRadius = getCardBorderRadius(borderRadius);
  const responseHeaders = {
    ...svgHeaders(request),
    "X-Card-Border-Radius": String(headerRadius),
    "X-Cache-Source": cacheSource,
  } as Record<string, string>;
  return new Response(cleaned, { headers: responseHeaders });
}

/**
 * Builds an error SVG response.
 *
 * @param request - The incoming request, used to build CORS headers.
 * @param message - Message to draw inside the card.
 * @param status - HTTP status for the response.
 * @source
 */
export function errorResponse(
  request: Request,
  message: string,
  status: number,
): Response {
  return new Response(toCleanSvgResponse(svgError(message)), {
    headers: errorHeaders(request),
    status,
  });
}
