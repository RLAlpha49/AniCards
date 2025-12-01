import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { StoredCardConfig } from "@/lib/types/records";
import type {
  TemplateCardConfig,
  ColorValue,
  GradientDefinition,
} from "@/lib/types/card";
import type { TrustedSVG } from "@/lib/types/svg";
import JSZip from "jszip";

export const DEFAULT_CARD_BORDER_RADIUS = 8;
const BORDER_RADIUS_MIN = 0;
const BORDER_RADIUS_MAX = 100;

const _borderRadiusPromiseCache = new Map<string, Promise<number | null>>();

type GlobalWithCache = typeof globalThis & {
  __ANICARDS__borderRadiusCache?: Map<string, Promise<number | null>>;
};

const _envApiBase =
  typeof process === "undefined" ? undefined : process.env?.NEXT_PUBLIC_API_URL;

function resolveApiBase(url?: string): string {
  if (!url) return "https://api.anicards.alpha49.com";
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.startsWith("api.")) {
      parsed.hostname = `api.${parsed.hostname}`;
    }
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return "https://api.anicards.alpha49.com";
  }
}

export const API_BASE: string = resolveApiBase(_envApiBase);

/**
 * Build an absolute URL targeting the public API base.
 *
 * This helper resolves the configured `NEXT_PUBLIC_API_URL` (defaulting to
 * the public API host) and appends the provided path to produce an absolute
 * URL. Use this when you explicitly want to target the public API host
 * (e.g. a separate API origin or CDN-backed endpoint).
 *
 * If you intend to call in-app Next.js API routes (handled by this application),
 * prefer a relative path (for example "/api/get-user?userId=...") to avoid an extra
 * network hop or cross-origin call during local development.
 */
export function buildApiUrl(path: string): string {
  if (!path) path = "";
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${normalized}`;
}

/**
 * Extracts a card border radius from a remote SVG by reading a lightweight
 * header or, optionally, parsing the SVG contents for the <rect>'s rx
 * attribute. Results are memoized by absolute URL to avoid duplicate
 * requests across instances.
 *
 * @param svgUrl - The SVG URL to inspect (absolute or relative).
 * @param opts - Options controlling fallback behavior. `allowFallback`
 *               enables the full GET + parsing fallback when `true`.
 *               Default: false (no fallback).
 */
export function getSvgBorderRadius(
  svgUrl: string,
  opts?: { allowFallback?: boolean },
): Promise<number | null> {
  const absoluteUrl = getAbsoluteUrl(svgUrl);
  // Prefer a global cache (persisted across HMR) but fall back to the
  // module-level cache otherwise.
  const g = globalThis as GlobalWithCache;
  const cache =
    g.__ANICARDS__borderRadiusCache ??
    (g.__ANICARDS__borderRadiusCache = _borderRadiusPromiseCache);

  let promise = cache.get(absoluteUrl);
  if (!promise) {
    promise = (async () => {
      const allowFallback = opts?.allowFallback ?? false;
      let isFirstPartyCardEndpoint = false;
      try {
        const hasWindow = globalThis.window !== undefined;
        const baseOrigin = hasWindow
          ? globalThis.window.location.origin
          : "http://localhost";
        const parsed = new URL(absoluteUrl, baseOrigin);
        const pathname = (parsed.pathname || "").toLowerCase();
        const parsedHost = (parsed.hostname || "").toLowerCase();
        const apiHost = (() => {
          try {
            return new URL(API_BASE).hostname.toLowerCase();
          } catch {
            return "";
          }
        })();

        if (
          pathname.startsWith("/api/card") ||
          parsedHost === apiHost ||
          parsedHost.startsWith("api.")
        ) {
          isFirstPartyCardEndpoint = true;
        }
      } catch {}
      try {
        const headRes = await fetch(absoluteUrl, { method: "HEAD" });
        if (headRes.ok) {
          const headerVal = headRes.headers.get("x-card-border-radius");
          if (headerVal) {
            const parsedFromHeader = Number.parseFloat(headerVal);
            if (Number.isFinite(parsedFromHeader)) return parsedFromHeader;
          }
        }
      } catch {}

      if (!allowFallback || isFirstPartyCardEndpoint) return null;
      try {
        const res = await fetch(absoluteUrl);
        if (!res.ok) return null;
        const text = await res.text();
        const match = new RegExp(
          /<rect[^>]*data-testid=["']card-bg["'][^>]*rx=["'](\d+(?:\.\d+)?)['"]/i,
        ).exec(text);
        if (!match) return null;
        const parsed = Number.parseFloat(match[1]);
        if (!Number.isFinite(parsed)) return null;
        return parsed;
      } catch (err) {
        // Remove the cached promise on error so subsequent attempts can retry.
        cache.delete(absoluteUrl);
        throw err;
      }
    })();
    cache.set(absoluteUrl, promise);
  }
  return promise;
}

/** Export formats supported for image conversion. @source */
export type ConversionFormat = "png" | "webp";

/** A card entry used for batch export operations. @source */
export interface BatchExportCard {
  type: string;
  svgUrl: string;
  rawType: string;
}

/** Progress payload passed to a progress callback during batch conversion. @source */
export interface BatchConversionProgress {
  current: number;
  total: number;
  success: number;
  failure: number;
  cardIndex: number;
}

/**
 * Merges and resolves conflicts between Tailwind CSS class names.
 * Uses clsx to conditionally join classes and twMerge to resolve conflicting tailwind directives.
 *
 * @param inputs - List of class names or expressions (of type ClassValue) to be merged.
 * @returns A single merged string of class names.
 * @source
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Type guard to check if a color value is a gradient definition.
 * @param value - The color value to check.
 * @returns True if the value is a GradientDefinition object.
 * @source
 */
export function isGradient(value: ColorValue): value is GradientDefinition {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    "stops" in value &&
    (value.type === "linear" || value.type === "radial") &&
    Array.isArray(value.stops)
  );
}

/**
 * Generates a unique ID for SVG gradient definitions.
 * @param prefix - A prefix for the ID (e.g., 'title', 'background').
 * @returns A unique gradient ID string.
 * @source
 */
export function generateGradientId(prefix: string): string {
  const uniquePart = Math.random().toString(36).substring(2, 9);
  return `gradient-${prefix}-${uniquePart}`;
}

/**
 * Generates SVG markup for a gradient definition.
 * @param gradient - The gradient definition object.
 * @param id - The unique ID for this gradient.
 * @returns SVG markup string for the gradient definition.
 * @source
 */
export function generateGradientSVG(
  gradient: GradientDefinition,
  id: string,
): string {
  const stops = gradient.stops
    .map((stop) => {
      const opacity =
        stop.opacity === undefined ? "" : ` stop-opacity="${stop.opacity}"`;
      return `<stop offset="${stop.offset}%" stop-color="${stop.color}"${opacity}/>`;
    })
    .join("");

  if (gradient.type === "linear") {
    const angle = gradient.angle ?? 0;
    // Convert angle to x1, y1, x2, y2 coordinates
    // 0° = left to right, 90° = top to bottom, etc.
    const angleRad = ((angle - 90) * Math.PI) / 180;
    const x1 = Math.round(50 + Math.sin(angleRad + Math.PI) * 50);
    const y1 = Math.round(50 + Math.cos(angleRad + Math.PI) * 50);
    const x2 = Math.round(50 + Math.sin(angleRad) * 50);
    const y2 = Math.round(50 + Math.cos(angleRad) * 50);

    return `<linearGradient id="${id}" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">${stops}</linearGradient>`;
  } else {
    // Radial gradient
    const cx = gradient.cx ?? 50;
    const cy = gradient.cy ?? 50;
    const r = gradient.r ?? 50;
    return `<radialGradient id="${id}" cx="${cx}%" cy="${cy}%" r="${r}%">${stops}</radialGradient>`;
  }
}

/**
 * Converts a ColorValue to a string suitable for SVG fill/stroke attributes.
 * For solid colors, returns the hex string directly.
 * For gradients, returns a url() reference to the gradient ID.
 * @param value - The color value (string or GradientDefinition).
 * @param gradientId - The ID to use if the value is a gradient.
 * @returns A string suitable for fill/stroke attributes.
 * @source
 */
export function colorValueToString(
  value: ColorValue,
  gradientId?: string,
): string {
  if (isGradient(value)) {
    if (gradientId) {
      return `url(#${gradientId})`;
    }
    // Fallback: return the first stop color if no ID provided
    return value.stops[0]?.color ?? "#000000";
  }
  return value;
}

/**
 * Validates a hex color string (3, 6, or 8 character format with leading #).
 * @param color - The color string to validate.
 * @returns True if the color is a valid hex color.
 * @source
 */
export function isValidHexColor(color: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/.test(color);
}

/**
 * Validates a single gradient stop object.
 * @param stop - The stop to validate.
 * @returns True if the stop is valid.
 * @source
 */
function isValidGradientStop(stop: unknown): boolean {
  if (typeof stop !== "object" || stop === null) return false;
  const s = stop as Record<string, unknown>;

  // Validate color
  if (typeof s.color !== "string" || !isValidHexColor(s.color)) return false;

  // Validate offset
  if (typeof s.offset !== "number" || s.offset < 0 || s.offset > 100)
    return false;

  // Validate optional opacity
  if (s.opacity !== undefined) {
    if (typeof s.opacity !== "number" || s.opacity < 0 || s.opacity > 1)
      return false;
  }

  // Validate optional id
  if (s.id !== undefined) {
    if (typeof s.id !== "string") return false;
  }

  return true;
}

/**
 * Validates radial gradient properties (cx, cy, r).
 * @param grad - The gradient object to validate.
 * @returns True if radial properties are valid.
 * @source
 */
function isValidRadialProperties(grad: Record<string, unknown>): boolean {
  for (const prop of ["cx", "cy", "r"]) {
    const value = grad[prop];
    if (value !== undefined) {
      if (typeof value !== "number" || value < 0 || value > 100) return false;
    }
  }
  return true;
}

/**
 * Validates a gradient definition object.
 * @param value - The value to validate.
 * @returns True if the value is a valid gradient definition.
 * @source
 */
export function isValidGradient(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;

  const grad = value as Record<string, unknown>;

  // Validate type
  if (grad.type !== "linear" && grad.type !== "radial") return false;

  // Validate stops
  if (!Array.isArray(grad.stops) || grad.stops.length < 2) return false;

  for (const stop of grad.stops) {
    if (!isValidGradientStop(stop)) return false;
  }

  // Validate linear gradient angle
  if (grad.type === "linear" && grad.angle !== undefined) {
    if (typeof grad.angle !== "number" || grad.angle < 0 || grad.angle > 360)
      return false;
  }

  // Validate radial gradient properties
  if (grad.type === "radial" && !isValidRadialProperties(grad)) {
    return false;
  }

  return true;
}

/**
 * Validates a color value (either a hex string or a gradient definition).
 * @param value - The value to validate.
 * @returns True if the value is a valid color value.
 * @source
 */
export function validateColorValue(value: unknown): boolean {
  if (typeof value === "string") {
    return isValidHexColor(value);
  }
  return isValidGradient(value);
}

/** Provide a human-readable reason when a color value is invalid. */
export function getColorInvalidReason(value: unknown): string {
  if (typeof value === "string") {
    if (isValidHexColor(value))
      return "hex string passed regex but failed shared validation";
    return "invalid hex string";
  }
  if (isValidGradient(value))
    return "gradient passed validation but failed shared validation";
  return "invalid gradient definition";
}

/**
 * Processes color values for SVG templates, generating gradient IDs and defs.
 * @param styles - Object containing color values.
 * @param colorKeys - Array of keys to process (e.g., ['titleColor', 'backgroundColor']).
 * @returns Object containing gradient IDs, defs string, and resolved color strings.
 * @source
 */
export function processColorsForSVG(
  styles: Record<string, ColorValue | undefined>,
  colorKeys: string[],
): {
  gradientIds: Record<string, string>;
  gradientDefs: string;
  resolvedColors: Record<string, string>;
} {
  const gradientIds: Record<string, string> = {};
  const gradientDefs: string[] = [];
  const resolvedColors: Record<string, string> = {};

  for (const key of colorKeys) {
    const value = styles[key];
    if (value === undefined) {
      resolvedColors[key] = "";
      continue;
    }

    if (isGradient(value)) {
      const id = generateGradientId(key);
      gradientIds[key] = id;
      gradientDefs.push(generateGradientSVG(value, id));
      resolvedColors[key] = `url(#${id})`;
    } else {
      resolvedColors[key] = value;
    }
  }

  return {
    gradientIds,
    gradientDefs: gradientDefs.length > 0 ? gradientDefs.join("") : "",
    resolvedColors,
  };
}

/**
 * Converts an SVG file referenced by a URL to a raster image data URL via an API call.
 *
 * Makes a POST request to the conversion API endpoint with the SVG URL and requested format.
 *
 * @param svgUrl - The URL of the SVG file to be converted.
 * @param format - Desired output format ('png' | 'webp'). Defaults to 'png'.
 * @returns A Promise that resolves to the image data URL as a string.
 * @throws Error when the conversion process or network request fails.
 * @source
 */
export async function svgToPng(
  svgUrl: string,
  format: ConversionFormat = "png",
): Promise<string> {
  try {
    const isClient =
      (globalThis as unknown as { window?: unknown }).window !== undefined;
    const convertEndpoint = isClient ? "/api/convert" : buildApiUrl("/convert");
    const response = await fetch(convertEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ svgUrl, format }),
    });

    const payload = await parseResponsePayload(response);

    if (!response.ok) {
      throw new Error(
        `Failed to convert SVG: ${getResponseErrorMessage(response, payload)}`,
      );
    }

    return extractImageDataUrl(payload);
  } catch (error) {
    console.error("Conversion failed:", error);
    throw error;
  }
}

/**
 * Try to parse a Response body as JSON; if that fails, return the text body.
 * If both attempts fail, return null.
 * @source
 */
export async function parseResponsePayload(
  response: Response,
): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    try {
      // Clone so reading text does not consume the original stream more than once.
      return await response.clone().text();
    } catch {
      return null;
    }
  }
}

/**
 * Create a human-friendly error message from the HTTP response and optional payload.
 * If the payload contains an `error` or `message` field those are prioritized.
 * @source
 */
export function getResponseErrorMessage(
  response: Response,
  payload: unknown,
): string {
  let message = `HTTP ${response.status} ${response.statusText}`;
  if (!payload) return message;
  if (typeof payload === "object" && payload !== null) {
    const obj = payload as Record<string, unknown>;
    if (typeof obj.error === "string" && obj.error.trim()) return obj.error;
    if (typeof obj.message === "string" && obj.message.trim())
      return obj.message;
  }
  if (typeof payload === "string" && payload.trim()) return payload;
  return message;
}

/**
 * Validate the parsed payload and extract the pngDataUrl property. Throws on invalid payloads.
 * @source
 */
function extractImageDataUrl(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    throw new Error(
      "Invalid response from convert API: missing or invalid pngDataUrl",
    );
  }
  const maybe = (payload as Record<string, unknown>).pngDataUrl;
  if (typeof maybe !== "string" || !maybe.trim()) {
    throw new Error(
      "Invalid response from convert API: missing or invalid pngDataUrl",
    );
  }
  return maybe;
}

/**
 * Copies the specified text to the system clipboard.
 *
 * A simple wrapper around the browser's clipboard API that returns a promise.
 *
 * @param text - The text to be copied.
 * @returns A Promise that resolves when the text is successfully copied.
 * @source
 */
export function copyToClipboard(text: string): Promise<void> {
  // Utilize the browser's native clipboard API.
  return navigator.clipboard.writeText(text);
}

/**
 * Calculates a dynamic font size for the provided text such that it fits within a maximum width.
 *
 * The calculation iteratively reduces the font size based on the text's length and an adaptive multiplier,
 * ensuring the resulting font size does not drop below a minimum threshold.
 *
 * @param text - The text string for which the font size is calculated.
 * @param initialFontSize - The starting font size (default: 18).
 * @param maxWidth - The maximum width that the text is allowed to occupy (default: 220).
 * @param minFontSize - The minimum allowable font size to keep text readable (default: 8).
 * @returns The computed font size as a string rounded to one decimal place.
 * @source
 */
export const calculateDynamicFontSize = (
  text: string,
  initialFontSize = 18,
  maxWidth = 220,
  minFontSize = 8,
) => {
  let fontSize = initialFontSize;
  // Calculate a dynamic multiplier that reduces effective width per character as the text length increases.
  const charWidthMultiplier = Math.max(0.4, 0.6 - text.length * 0.003);

  // Iteratively decrease the font size until the resulting width is less than the maxWidth or until the minimum font size is reached.
  while (
    text.length * fontSize * charWidthMultiplier > maxWidth &&
    fontSize > minFontSize
  ) {
    fontSize -= 0.1;
  }
  // Return the final font size formatted to one decimal place.
  return fontSize.toFixed(1);
};

/**
 * Formats a byte count into a human-readable string using appropriate units (Bytes, KB, MB, GB).
 *
 * Divides the byte count by the appropriate power of 1024 and formats the number to the specified decimal precision.
 *
 * @param bytes - The number of bytes to format.
 * @param decimals - The number of decimal places (default: 2).
 * @returns A formatted string representing the size (e.g., "1.23 MB").
 * @source
 */
export function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = Math.max(decimals, 0);
  const sizes = ["Bytes", "KB", "MB", "GB"];
  // Determine the appropriate unit based on the logarithm of the byte count.
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  // Calculate the size in the determined unit and format it.
  return (
    Number.parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i]
  );
}

/**
 * Safely parses a JSON string into an object of type T.
 *
 * If the input is a string, it attempts to parse it as JSON. If parsing fails, it logs an error and throws the exception.
 * If the input is not a string, it is assumed to already be parsed and is returned as-is.
 *
 * @param data - The data to parse, which may be a JSON string or an already-parsed object.
 * @param context - Optional human-friendly label used in logs to indicate parse context.
 * @returns The parsed object of type T.
 * @throws Error if JSON.parse fails.
 * @source
 */
export function safeParse<T>(data: unknown, context?: string): T {
  if (typeof data !== "string") return data as T;
  const logParseError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    const isProduction =
      typeof process !== "undefined" && process.env?.NODE_ENV === "production";

    const maxSnippet = 200;
    const length = data.length;
    const ctxLabel = context ? ` [${context}]` : "";
    if (isProduction) {
      console.error(
        `Failed to parse JSON${ctxLabel}: ${message}. Payload length: ${length}`,
      );
      return;
    }

    const snippet = data.slice(0, maxSnippet);
    const truncated = length > maxSnippet ? "..." : "";
    console.error(
      `Failed to parse JSON${ctxLabel}: ${message}. Payload snippet (first ${Math.min(
        maxSnippet,
        length,
      )} chars, length ${length}): ${snippet}${truncated}`,
    );
  };

  try {
    return JSON.parse(data);
  } catch (error) {
    logParseError(error);
    throw error;
  }
}

/**
 * Converts a relative URL to an absolute URL if needed.
 *
 * This utility is useful for ensuring URLs are absolute when sharing or embedding images,
 * particularly for client-side operations where the window object is available.
 *
 * @param url - The URL to convert (may be relative or absolute).
 * @returns The absolute URL. If already absolute or running on server, returns the original URL.
 * @source
 */
export function getAbsoluteUrl(url: string): string {
  if (!globalThis.window) return url;
  if (url.startsWith("http")) return url;
  return `${globalThis.window.location.origin}${url}`;
}

/**
 * Converts a stored card configuration (StoredCardConfig) into the template-facing
 * TemplateCardConfig shape. This ensures templates always receive the expected fields
 * while the stored shape may include additional persistence-only flags.
 * @source
 */
export function toTemplateCardConfig(
  card: StoredCardConfig | TemplateCardConfig,
  defaultVariation = "default",
): TemplateCardConfig {
  return {
    cardName: card.cardName,
    variation:
      "variation" in card &&
      (card as TemplateCardConfig).variation !== undefined
        ? (card as TemplateCardConfig).variation
        : defaultVariation,
    titleColor: card.titleColor,
    backgroundColor: card.backgroundColor,
    textColor: card.textColor,
    circleColor: card.circleColor,
    borderColor: "borderColor" in card ? card.borderColor : undefined,
    useStatusColors:
      "useStatusColors" in card ? card.useStatusColors : undefined,
  };
}

/**
 * Extracts the style subset from a stored or template card config so templates
 * receive only the style values they need.
 * @source
 */
export function extractStyles(
  cardConfig: StoredCardConfig | TemplateCardConfig,
) {
  return {
    titleColor: cardConfig.titleColor,
    backgroundColor: cardConfig.backgroundColor,
    textColor: cardConfig.textColor,
    circleColor: cardConfig.circleColor,
    borderColor: cardConfig.borderColor,
    borderRadius: cardConfig.borderRadius,
  };
}

/**
 * Clamp a numeric border radius value to the allowed range and normalize precision.
 * @param value - The radius value to clamp.
 * @returns A number between the min and max border radius bounds, rounded to one decimal place.
 */
export function clampBorderRadius(value: number) {
  const safeValue = Number.isFinite(value) ? value : DEFAULT_CARD_BORDER_RADIUS;
  const clamped = Math.max(
    BORDER_RADIUS_MIN,
    Math.min(BORDER_RADIUS_MAX, safeValue),
  );
  return Math.round(clamped * 10) / 10;
}

/**
 * Validates that the provided value is a finite number within the allowed border radius range.
 * @param value - The value to validate.
 * @returns True when the value is numeric and between the configured bounds.
 */
export function validateBorderRadius(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= BORDER_RADIUS_MIN &&
    value <= BORDER_RADIUS_MAX
  );
}

/**
 * Determines the corner radius for the card background rectangle.
 * Custom radius is honored only when a border color is defined.
 * @param borderColor - Configured border color (falsy when a border is not rendered).
 * @param borderRadius - Configured border radius value.
 * @param defaultRadius - Radius to use when no custom radius is provided (defaults to DEFAULT_CARD_BORDER_RADIUS).
 * @returns A number between the min and max border radius bounds.
 * @source
 */
export function getCardBorderRadius(
  borderRadius: number | undefined,
  defaultRadius = DEFAULT_CARD_BORDER_RADIUS,
) {
  if (typeof borderRadius === "number") {
    return clampBorderRadius(borderRadius);
  }
  return defaultRadius;
}

/**
 * Escape a string for safe embedding inside XML/SVG text nodes or attributes.
 * This function escapes the five XML special characters and normalizes inputs
 * to a string. It is intentionally small and deterministic — templates should
 * use the original unescaped values for measurement (e.g. dynamic font sizing)
 * and only embed escaped values in the final markup.
 * @param value - The potentially unsafe string value.
 * @returns An escaped string safe to include inside an XML document.
 * @source
 */
export function escapeForXml(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/**
 * Safely coerce an unknown value into a finite number.
 * Returns a finite number when the input is a number or a numeric string,
 * otherwise returns the provided fallback (default: null). In non-production
 * environments, an informative warning will be logged to make it easier to
 * detect malformed server data during development and tests.
 *
 * Notes:
 * - Unlike Number.parseFloat(String(...)), this helper is stricter and will
 *   only accept strings that are fully numeric (no trailing characters).
 * - This function helps avoid silently treating malformed values as 0.
 *
 * @param value - Unknown value to coerce to a finite number
 * @param opts - Optional configuration: label for logs, explicit fallback
 */
export function toFiniteNumber(
  value: unknown,
  opts?: { label?: string; fallback?: number | null; log?: boolean },
): number | null {
  const label = opts?.label ? `${opts.label} ` : "";
  const fallback = opts?.fallback ?? null;
  const isProduction =
    typeof process !== "undefined" && process.env?.NODE_ENV === "production";
  const shouldLog = opts?.log ?? !isProduction;

  const warn = (message: string) => {
    if (!shouldLog) return;
    // Keep the message small and deterministic for tests and dev debugging.
    console.warn(`[toFiniteNumber] ${label}${message}`);
  };

  if (typeof value === "number") {
    if (Number.isFinite(value)) return value;
    warn(`non-finite number: ${String(value)}`);
    return fallback;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      warn(`empty string`);
      return fallback;
    }
    // Strict numeric test: only accept a full numeric string with optional exponent
    // Examples accepted: 10, -8.5, 1e3, 3.14E-2
    const numericRegex = /^[-+]?(?:\d+|\d*\.\d+)(?:[eE][-+]?\d+)?$/;
    if (!numericRegex.test(trimmed)) {
      warn(`non-numeric string: ${trimmed}`);
      return fallback;
    }
    const parsed = Number.parseFloat(trimmed);
    if (Number.isFinite(parsed)) return parsed;
    warn(`parseFloat produced non-finite number: ${trimmed}`);
    return fallback;
  }

  warn(`unsupported type: ${typeof value}`);
  return fallback;
}

/**
 * Simple runtime branding for trusted SVG strings. The return value prepends a
 * compact marker comment to the serialized SVG. This allows client-side checks
 * to assert that a string was produced by one of the project's templates or
 * explicitly sanitized pipelines.
 * NOTE: The comment itself is harmless and will not affect the rendering of
 * the resulting SVG, but it gives us a deterministic signal at runtime.
 * @param svg - The sanitized SVG string.
 * @returns A marked string typed as TrustedSVG.
 */
export function markTrustedSvg(svg: string): TrustedSVG {
  const prefix = "<!--ANICARDS_TRUSTED_SVG-->";
  return `${prefix}${svg}` as TrustedSVG;
}

/**
 * Check whether the provided string is a marked Trusted SVG.
 * This is a lightweight runtime guard used by client components that render
 * pre-sanitized SVG markup to ensure the string passed to
 * `dangerouslySetInnerHTML` came from one of our trusted template helpers.
 * @param svg - The string to check.
 * @returns True if the string is marked as trusted.
 */
export function isTrustedSvgString(svg: unknown): boolean {
  if (typeof svg !== "string") return false;
  return svg.startsWith("<!--ANICARDS_TRUSTED_SVG-->");
}

/** Successful result for a single conversion in a batch. @source */
type BatchConversionSuccess = {
  success: true;
  card: BatchExportCard;
  dataUrl: string;
  format: ConversionFormat;
  cardIndex: number;
};

/** Failure result representation for a single conversion in a batch. @source */
type BatchConversionFailure = {
  success: false;
  card: BatchExportCard;
  error: string;
  cardIndex: number;
};

/** Union type representing the result of a batch conversion (success or failure). @source */
export type BatchConversionResult =
  | BatchConversionSuccess
  | BatchConversionFailure;

/** Image data used internally when packaging converted images into a ZIP. @source */
interface BatchConversionImage {
  filename: string;
  dataUrl: string;
  format: ConversionFormat;
}

/** Summary after exporting a batch of converted images. @source */
export interface BatchExportSummary {
  total: number;
  exported: number;
  failed: number;
}

/** Max number of concurrent conversions during batch processing. @source */
const BATCH_CONCURRENCY_LIMIT = 4;

/**
 * Converts multiple SVG URLs to raster images with concurrency limits.
 *
 * @param cards - Cards to convert, each containing type/rawType and svgUrl.
 * @param format - Target format for conversion (png | webp).
 * @param progressCallback - Optional progress callback invoked per card.
 * @returns Array of success/failure results.
 * @source
 */
export async function batchConvertSvgsToPngs(
  cards: BatchExportCard[],
  format: ConversionFormat,
  progressCallback?: (progress: BatchConversionProgress) => void,
): Promise<BatchConversionResult[]> {
  const queue = cards.map((card, index) => ({ card, index }));
  const total = cards.length;
  let completed = 0;
  let successCount = 0;
  let failureCount = 0;

  const convertCard = async (
    card: BatchExportCard,
    index: number,
  ): Promise<BatchConversionResult> => {
    try {
      const dataUrl = await svgToPng(card.svgUrl, format);
      successCount += 1;
      return {
        success: true,
        card,
        dataUrl,
        format,
        cardIndex: index,
      };
    } catch (error) {
      failureCount += 1;
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        card,
        error: message,
        cardIndex: index,
      };
    } finally {
      completed += 1;
      progressCallback?.({
        current: completed,
        total,
        success: successCount,
        failure: failureCount,
        cardIndex: index,
      });
    }
  };

  const workers = new Array(
    Math.min(BATCH_CONCURRENCY_LIMIT, queue.length),
  ).fill(null);

  const results: BatchConversionResult[] = [];

  const worker = async () => {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) break;
      const result = await convertCard(next.card, next.index);
      results.push(result);
    }
  };

  await Promise.all(workers.map(() => worker()));
  return results;
}

/**
 * Generates a ZIP archive from converted images.
 *
 * @param images - Image data with filenames and formats.
 * @returns ZIP blob ready for download.
 * @source
 */
export async function generateZipFromImages(
  images: BatchConversionImage[],
): Promise<Blob> {
  const zip = new JSZip();
  for (const image of images) {
    const [, base64] = image.dataUrl.split(",");
    if (!base64) continue;
    zip.file(image.filename, base64, { base64: true });
  }
  return await zip.generateAsync({ type: "blob" });
}

/**
 * Triggers a browser download for the provided blob.
 *
 * @param blob - Binary data to download.
 * @param filename - Desired filename for the download.
 * @source
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Converts multiple cards, zips the results, and triggers a download.
 *
 * @param cards - Cards to convert and bundle.
 * @param format - Target export format.
 * @param progressCallback - Optional progress callback for UI updates.
 * @returns Summary containing counts of success and failures.
 * @source
 */
export async function batchConvertAndZip(
  cards: BatchExportCard[],
  format: ConversionFormat,
  progressCallback?: (progress: BatchConversionProgress) => void,
): Promise<BatchExportSummary> {
  if (cards.length === 0) {
    throw new Error("No cards available for export.");
  }

  const conversionResults = await batchConvertSvgsToPngs(
    cards,
    format,
    progressCallback,
  );

  const successful = conversionResults.filter(
    (result): result is BatchConversionSuccess => result.success,
  );

  if (successful.length === 0) {
    throw new Error("Unable to convert any cards for export.");
  }

  const images: BatchConversionImage[] = successful.map((result) => ({
    filename: `${result.card.rawType || result.card.type}.${format}`,
    dataUrl: result.dataUrl,
    format: result.format,
  }));

  const zipBlob = await generateZipFromImages(images);
  const timestamp = new Date()
    .toISOString()
    .replaceAll(":", "-")
    .replaceAll(".", "-");
  downloadBlob(zipBlob, `anicards-export-${timestamp}.zip`);

  return {
    total: cards.length,
    exported: successful.length,
    failed: conversionResults.length - successful.length,
  };
}
