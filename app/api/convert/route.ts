import sharp from "sharp";
import type { NextRequest, NextResponse } from "next/server";
import {
  incrementAnalyticsInBackground,
  apiJsonHeaders,
  jsonWithCors,
  getClientIp,
} from "@/lib/api-utils";
import { resolveApiBase } from "@/lib/api/base-url";
import { type ConversionFormat } from "@/lib/export/batch";
import { optimizeSvgMarkup } from "@/lib/api/convert/css-optimizer";

/**
 * Detects whether the hostname represents an IPv4 or IPv6 address.
 * @param hostname - Hostname string to inspect.
 * @returns True when the hostname is a literal IP.
 */
function isIpAddress(hostname: string): boolean {
  return (
    /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || // IPv4
    /^\[[0-9a-fA-F:]+\]$/.test(hostname) // IPv6 in brackets
  );
}

/**
 * Checks whether an IPv4 address belongs to private or loopback ranges.
 * @param hostname - Hostname to evaluate.
 */
function isPrivateOrLoopbackIp(hostname: string): boolean {
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) return false;
  const parts = hostname.split(".").map((x) => Number.parseInt(x, 10));
  if (parts[0] === 10) return true;
  if (parts[0] === 127) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  return false;
}

/**
 * Recognizes literal localhost hostnames or IPv6 loopback.
 * @param hostname - Hostname to test.
 */
function isLocalhost(hostname: string): boolean {
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
  );
}

/**
 * Determines whether a parsed URL is allowed for conversion given the
 * configured allowed domains and whether we are in development.
 * @returns True when the URL is safe and allowed.
 */
function isUrlAuthorized(
  parsedUrl: URL,
  allowedDomains: string[],
  isDevelopment: boolean,
): boolean {
  const protocolValid = isDevelopment
    ? parsedUrl.protocol === "https:" || parsedUrl.protocol === "http:"
    : parsedUrl.protocol === "https:";
  if (!allowedDomains.includes(parsedUrl.hostname)) return false;
  if (!protocolValid) return false;
  if (isIpAddress(parsedUrl.hostname) && !isLocalhost(parsedUrl.hostname))
    return false;
  if (
    isPrivateOrLoopbackIp(parsedUrl.hostname) &&
    !isLocalhost(parsedUrl.hostname)
  )
    return false;
  return true;
}

/**
 * Fetches an SVG from the provided URL, returning a NextResponse on failure
 * (so callers can early-return) or the SVG text on success.
 */
async function fetchSvgContent(
  parsedUrl: URL,
  request: NextRequest,
): Promise<{ errorResponse?: NextResponse; svg?: string }> {
  try {
    const response = await fetch(parsedUrl.href);
    if (!response.ok) {
      incrementAnalyticsInBackground("analytics:convert_api:failed_requests");
      return {
        errorResponse: jsonWithCors(
          { error: "Failed to fetch SVG" },
          request,
          response.status,
        ),
      };
    }
    const svgText = await response.text();
    return { svg: svgText };
  } catch (err: unknown) {
    console.error("🔴 [Convert API] fetchSvgContent error:", err);
    incrementAnalyticsInBackground("analytics:convert_api:failed_requests");
    return {
      errorResponse: jsonWithCors(
        { error: "Failed to fetch SVG" },
        request,
        500,
      ),
    };
  }
}

/**
 * Converts an SVG string into a raster data URL using sharp.
 */
async function convertSvgToDataUrl(
  svg: string,
  requestedFormat: ConversionFormat,
) {
  const transformer = sharp(Buffer.from(svg));
  if (requestedFormat === "webp") transformer.webp({ quality: 90 });
  else transformer.png();
  const convertedBuffer = await transformer.toBuffer();
  const mimeType = requestedFormat === "webp" ? "image/webp" : "image/png";
  return `data:${mimeType};base64,${convertedBuffer.toString("base64")}`;
}

/**
 * Handles POST requests that sanitize SVGs and convert them to PNG data URLs.
 * @param request - Incoming Next.js request with the svgUrl payload.
 * @returns NextResponse containing pngDataUrl on success or an error description.
 * @source
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const ip = getClientIp(request);
  console.log(`🚀 [Convert API] Request received from ${ip}`);

  try {
    // 1. Parse input and fetch SVG content
    const { svgUrl, format } = await request.json();
    if (!svgUrl) {
      console.warn(`⚠️ [Convert API] Missing 'svgUrl' parameter from ${ip}`);
      incrementAnalyticsInBackground("analytics:convert_api:failed_requests");
      return jsonWithCors({ error: "Missing svgUrl parameter" }, request, 400);
    }

    const allowedFormats: ConversionFormat[] = ["png", "webp"];
    const normalizedFormat =
      typeof format === "string" ? format.toLowerCase() : "png";
    if (!allowedFormats.includes(normalizedFormat as ConversionFormat)) {
      console.warn(
        `⚠️ [Convert API] Unsupported format '${format}' from ${ip}`,
      );
      // Increment analytics for failed requests to keep metrics consistent
      incrementAnalyticsInBackground("analytics:convert_api:failed_requests");
      return jsonWithCors({ error: "Invalid format parameter" }, request, 400);
    }
    let requestedFormat = normalizedFormat;

    // Validate the svgUrl
    let parsedUrl;
    try {
      // Handle relative URLs by using the request origin as base
      const baseUrl =
        request.headers.get("origin") ||
        request.headers.get("referer")?.split("?")[0] ||
        `${request.headers.get("x-forwarded-proto") || "https"}://${request.headers.get("host")}`;
      parsedUrl = new URL(svgUrl, baseUrl);
    } catch {
      console.warn(
        `⚠️ [Convert API] Invalid URL format for 'svgUrl' from ${ip}`,
      );
      return jsonWithCors({ error: "Invalid URL format" }, request, 400);
    }

    const allowedDomains: string[] = [
      new URL(resolveApiBase(process.env.NEXT_PUBLIC_API_URL)).hostname,
      ...(process.env.NEXT_PUBLIC_API_URL
        ? [new URL(process.env.NEXT_PUBLIC_API_URL).hostname]
        : []),
    ];
    // In development, allow localhost/127.0.0.1 with HTTP
    const isDevelopment =
      process.env.NODE_ENV === "development" ||
      allowedDomains.some(
        (domain) =>
          domain === "localhost" ||
          domain?.startsWith("127.") ||
          domain === "::1",
      );

    if (isDevelopment) {
      allowedDomains.push("localhost", "api.localhost", "127.0.0.1", "::1");
    }

    // In production, require HTTPS. In development, allow HTTP for localhost
    if (!isUrlAuthorized(parsedUrl, allowedDomains, isDevelopment)) {
      console.warn(
        `⚠️ [Convert API] Unauthorized or unsafe domain/protocol in 'svgUrl': ${parsedUrl.href} from ${ip}`,
      );
      return jsonWithCors(
        { error: "Unauthorized or unsafe domain/protocol" },
        request,
        403,
      );
    }

    // In development, normalize api.localhost to localhost for DNS resolution
    if (isDevelopment && parsedUrl.hostname === "api.localhost") {
      parsedUrl.hostname = "localhost";
    }

    console.log(`🔍 [Convert API] Fetching SVG from: ${parsedUrl.href}`);
    const fetched = await fetchSvgContent(parsedUrl, request);
    if (fetched.errorResponse) return fetched.errorResponse;
    let svgContent = fetched.svg || "";
    console.log(
      `📝 [Convert API] Received SVG content (${svgContent.length} characters)`,
    );

    // 1. Extract and sanitize CSS style blocks
    // Regex explanation:
    // - <style>([\s\S]*?)<\/style> matches the <style> tag and everything inside it
    const { svg: sanitizedSvg } = optimizeSvgMarkup(svgContent);
    svgContent = sanitizedSvg;
    console.log("🧼 [Convert API] Final SVG cleanup completed.");

    // 4. Convert the processed SVG to the requested raster format using sharp
    console.log(
      `🔄 [Convert API] Converting SVG to ${requestedFormat.toUpperCase()} using sharp...`,
    );
    const pngDataUrl = await convertSvgToDataUrl(
      svgContent,
      requestedFormat as ConversionFormat,
    );
    const conversionDuration = Date.now() - startTime;
    console.log(
      `✅ [Convert API] SVG converted to ${requestedFormat.toUpperCase()} successfully in ${conversionDuration}ms`,
    );
    incrementAnalyticsInBackground("analytics:convert_api:successful_requests");
    return jsonWithCors({ pngDataUrl }, request);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const errorDuration = Date.now() - startTime;
    console.error(
      `🔥 [Convert API] Conversion error after ${errorDuration}ms: ${error.message}`,
    );
    if (error.stack) {
      console.error(`💥 [Convert API] Stack Trace: ${error.stack}`);
    }
    incrementAnalyticsInBackground("analytics:convert_api:failed_requests");
    return jsonWithCors({ error: "Conversion failed" }, request, 500);
  }
}

export function OPTIONS(request: NextRequest) {
  const headers = apiJsonHeaders(request);
  return new Response(null, {
    headers: {
      ...headers,
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}
