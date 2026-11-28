/**
 * Origin policy, CORS headers, and JSON response factories.
 *
 * Which origin may embed a card, which may call the JSON endpoints, and the
 * header set every JSON answer carries. `apiJsonHeaders` and `jsonWithCors`
 * are the only places those headers are spelled out.
 * @source
 */
import { NextResponse } from "next/server";
import { logWith } from "@/lib/log";
import {
  DEFAULT_SITE_ORIGIN,
  normalizeOrigin,
  resolveSiteOrigin,
} from "@/lib/site-origin";

/**
 * Public API origin. Mirrors the default in `lib/utils.ts`.
 * @source
 */
const DEFAULT_API_ORIGIN = "https://api.anicards.alpha49.com";

/**
 * Resolves the origin configured for the JSON APIs.
 *
 * `NEXT_PUBLIC_APP_URL` is the API origin; `NEXT_PUBLIC_SITE_URL` is the
 * public site origin used by `lib/seo.ts`. They stay separate variables
 * because they describe different deployments, and the site origin is used
 * only as the production fallback below, never as a substitute for the
 * configured API origin.
 *
 * @returns The configured origin, or null when the variable is unset or unusable.
 * @source
 */
function getConfiguredApiOrigin(): string | null {
  return normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL);
}

/**
 * Collects every origin this deployment serves to a browser.
 *
 * The site and the API are the same app on two hosts, so a page on either
 * host calls `/api/...` same-origin and the browser sends that host as
 * `Origin`. Accepting only `NEXT_PUBLIC_APP_URL` rejected every generator
 * request made from the API host, because its `Origin` is the API host.
 *
 * The request's own origin is included because `Origin` matching the host
 * that served the request is same-origin by definition: a page on another
 * site cannot make the browser send this host as `Origin`.
 *
 * @param request - The request whose URL origin is also accepted.
 * @returns Origins allowed to call the JSON APIs from a browser.
 * @source
 */
export function getAllowedApiOrigins(request: Request): Set<string> {
  const origins = new Set<string>();
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_ORIGIN,
    process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_ORIGIN,
    request.url,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeOrigin(candidate);
    if (normalized) origins.add(normalized);
  }

  return origins;
}

/**
 * Reports whether `getAllowedCardSvgOrigin` can return a different value for
 * two requests to the same URL.
 *
 * The card SVG response declares `Vary: Origin`, which tells a shared cache to
 * store a separate copy per `Origin` value. That is only correct when the
 * origin really depends on the request. In production it is a single constant,
 * so declaring the variance split one cached card into one entry per embedding
 * context and per no-`Origin` request, and each of those paid for its own
 * render.
 *
 * @returns True when the origin is derived from the request, false when it is
 *   fixed for the deployment.
 * @source
 */
export function doesCardSvgOriginVary(): boolean {
  if (normalizeOrigin(process.env.NEXT_PUBLIC_CARD_SVG_ALLOWED_ORIGIN)) {
    return false;
  }
  return process.env.NODE_ENV !== "production";
}

/**
 * Determine the Access-Control-Allow-Origin value used by the Card SVG API.
 * Priority: NEXT_PUBLIC_CARD_SVG_ALLOWED_ORIGIN env -> production fallback -> request origin or '*'.
 * This helper centralizes CORS policy and is used by card route header helpers.
 * @param request - Optional Request used to extract the request origin in development.
 */
export function getAllowedCardSvgOrigin(request?: Request): string {
  const rawConfigured = process.env.NEXT_PUBLIC_CARD_SVG_ALLOWED_ORIGIN;
  const configured = normalizeOrigin(rawConfigured);

  let origin: string | undefined;

  if (configured) {
    origin = configured;
  } else if (process.env.NODE_ENV === "production") {
    origin = "https://anilist.co";
  } else {
    const requestOrigin = request?.headers?.get("origin");
    const requestNormalized = normalizeOrigin(requestOrigin);
    origin = requestNormalized ?? "*";
  }

  if (process.env.NODE_ENV === "production" && origin === "*") {
    logWith(
      "warn",
      "Card CORS",
      "Computed Access-Control-Allow-Origin is '*' in production; forcing to https://anilist.co",
    );
    origin = "https://anilist.co";
  }

  return origin;
}

/**
 * Determine the Access-Control-Allow-Origin value used by JSON API endpoints.
 *
 * Precedence: the configured app or site origin, then the site origin in
 * production, then the request origin in development. The wildcard is only
 * reachable in development; in production the site origin is always available,
 * so a request origin is never reflected back.
 *
 * @param request - Optional Request used to extract the request origin in development.
 * @returns An origin, or `*` when running outside production with nothing configured.
 * @source
 */
export function getAllowedApiOrigin(request?: Request): string {
  const configured = getConfiguredApiOrigin();

  let origin: string;

  if (configured) {
    origin = configured;
  } else if (process.env.NODE_ENV === "production") {
    origin = resolveSiteOrigin();
    logWith(
      "warn",
      "API CORS",
      "No API origin is configured; using the site origin for Access-Control-Allow-Origin",
    );
  } else {
    const requestOrigin = request?.headers?.get("origin");
    const requestNormalized = normalizeOrigin(requestOrigin);
    origin = requestNormalized ?? "*";
  }

  return origin;
}

/**
 * Standard headers for JSON API responses including CORS and Vary semantics.
 * @param request - Optional request to calculate the allowed origin in development.
 */
export function apiJsonHeaders(request?: Request): Record<string, string> {
  const allowedOrigin = getAllowedApiOrigin(request);
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS, POST",
    Vary: "Origin",
  };
}

/**
 * JSON response factory that always applies API CORS headers so callers don't forget.
 * Use this instead of calling `NextResponse.json(...)` directly when returning JSON.
 * @param data - payload to serialize
 * @param request - Request used to compute the allowed origin in dev
 * @param status - optional HTTP status code
 */
export function jsonWithCors<T = unknown>(
  data: T,
  request?: Request,
  status?: number,
): NextResponse<T> {
  const opts: Record<string, unknown> = {
    headers: apiJsonHeaders(request),
  };
  if (typeof status === "number") opts.status = status;
  return NextResponse.json(
    data as unknown,
    opts as ResponseInit,
  ) as NextResponse<T>;
}
