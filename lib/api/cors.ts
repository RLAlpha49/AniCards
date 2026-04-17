import { NextResponse } from "next/server";

import { withRequestIdHeaders } from "@/lib/api/request-context";

export function normalizeOrigin(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * Determine the Access-Control-Allow-Origin value used by the Card SVG API.
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
    console.warn(
      "[Card CORS] Computed Access-Control-Allow-Origin is '*' in production; forcing to https://anilist.co",
    );
    origin = "https://anilist.co";
  }

  return origin;
}

/**
 * Determine the Access-Control-Allow-Origin value used by JSON API endpoints.
 */
export function getAllowedApiOrigin(request?: Request): string | null {
  const rawConfigured = process.env.NEXT_PUBLIC_APP_URL;
  const configured = normalizeOrigin(rawConfigured);

  if (configured) {
    return configured;
  }

  if (process.env.NODE_ENV === "production") {
    console.error(
      "[API CORS] NEXT_PUBLIC_APP_URL is missing or invalid in production; omitting Access-Control-Allow-Origin to fail closed.",
    );
    return null;
  }

  const requestOrigin = request?.headers?.get("origin");
  const requestNormalized = normalizeOrigin(requestOrigin);
  return requestNormalized ?? "*";
}

/**
 * Standard headers for JSON API responses including CORS and Vary semantics.
 */
export function apiJsonHeaders(request?: Request): Record<string, string> {
  const allowedOrigin = getAllowedApiOrigin(request);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS, POST",
    "Access-Control-Expose-Headers":
      "Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset",
    Vary: "Origin",
  };

  if (allowedOrigin) {
    headers["Access-Control-Allow-Origin"] = allowedOrigin;
  }

  return withRequestIdHeaders(headers, request);
}

export function apiTextHeaders(request?: Request): Record<string, string> {
  return {
    ...apiJsonHeaders(request),
    "Content-Type": "text/plain",
  };
}

/**
 * JSON response factory that always applies API CORS headers.
 */
export function jsonWithCors<T = unknown>(
  data: T,
  request?: Request,
  status?: number,
  headers?: Record<string, string>,
): NextResponse<T> {
  const responseHeaders = apiJsonHeaders(request);

  if (headers) {
    for (const [key, value] of Object.entries(headers)) {
      if (
        key.toLowerCase() === "access-control-expose-headers" &&
        typeof responseHeaders[key] === "string"
      ) {
        const mergedValues = new Set(
          `${responseHeaders[key]},${value}`
            .split(",")
            .map((entry) => entry.trim())
            .filter(Boolean),
        );
        responseHeaders[key] = [...mergedValues].join(", ");
        continue;
      }

      responseHeaders[key] = value;
    }
  }

  const options: ResponseInit = {
    headers: responseHeaders,
    ...(typeof status === "number" ? { status } : {}),
  };

  return NextResponse.json(data as unknown, options) as NextResponse<T>;
}
