/**
 * Cross-cutting utility helpers shared by the UI, SVG generation, lightweight
 * conversion helpers, and API clients.
 *
 * The file is intentionally broad: it collects small reusable helpers plus a
 * few app-level contracts around color handling and trusted SVG output so those
 * rules stay consistent everywhere they are used.
 */
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

import type {
  ColorValue,
  GradientDefinition,
  TemplateCardConfig,
} from "@/lib/types/card";
import type { StoredCardConfig } from "@/lib/types/records";
import type { TrustedSVG } from "@/lib/types/svg";

export const DEFAULT_CARD_BORDER_RADIUS = 8;
const BORDER_RADIUS_MIN = 0;
const BORDER_RADIUS_MAX = 100;

const DEFAULT_TITLE_COLOR = "#fe428e";
const DEFAULT_BACKGROUND_COLOR = "#141321";
const DEFAULT_TEXT_COLOR = "#a9fef7";
const DEFAULT_CIRCLE_COLOR = "#fe428e";

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

/** Export formats supported for image conversion. @source */
export type ConversionFormat = "png" | "webp";

export interface SvgConversionSource {
  svgContent?: string;
  svgUrl?: string;
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

function normalizeHexRgb(hex: string): string | null {
  const raw = String(hex ?? "")
    .trim()
    .toLowerCase();
  if (!raw) return null;
  const withHash = raw.startsWith("#") ? raw : `#${raw}`;

  // Expand #rgb to #rrggbb
  const short = /^#([0-9a-f]{3})$/.exec(withHash);
  if (short) {
    const [r, g, b] = short[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`;
  }

  if (/^#[0-9a-f]{6}$/.test(withHash)) return withHash;
  return null;
}

/**
 * Determine whether a string is a recognized CSS named color.
 * Prefers the DOM Option-based technique when available and falls back to
 * `CSS.supports('color', value)` when present. Wrapped in try/catch to avoid
 * throwing in non-browser environments.
 */
let cachedColorOption: HTMLOptionElement | null = null;

/**
 * Determine whether a string is a recognized CSS named color.
 * Prefers the DOM Option-based technique when available and falls back to
 * `CSS.supports('color', value)` when present. Avoids unnecessary try/catch
 * by guarding access to potentially-absent globals.
 */
export function isCssNamedColor(val: string): boolean {
  const input = String(val ?? "").trim();
  if (!input) return false;

  // Try DOM Option technique first (fast and reliable in browser envs).
  // Use a cached Option element to avoid repeated allocations.
  type GlobalWithOption = {
    Option?: new (...args: unknown[]) => HTMLOptionElement;
    CSS?: { supports?: (prop: string, value: string) => boolean };
  };
  const g = globalThis as unknown as GlobalWithOption;
  const OptionCtor = g.Option;
  if (typeof OptionCtor === "function" && typeof document !== "undefined") {
    cachedColorOption ??= new OptionCtor();
    const s = cachedColorOption.style;
    s.color = input;
    if (s.color !== "") return true;
  }

  // Fallback to CSS.supports if available
  const cssSupports = g.CSS?.supports;
  if (typeof cssSupports === "function") {
    try {
      return Boolean(cssSupports("color", input));
    } catch {
      // Some host environments might throw for unexpected values; fallthrough.
    }
  }

  return false;
}

/**
 * Normalize various color input formats to a canonical representation used
 * by the settings UI. Behavior mirrors the inline logic previously present in
 * `SettingsContent.tsx`:
 * - No-hash 3/6/8 character hex -> '#' prefix; 3-char expands to 6 by doubling
 * - '#rgb' expands to '#rrggbb' (preserves input case)
 * - '#rrggbb' or '#rrggbbaa' -> lowercased (slice to at most 8 digits)
 * - CSS named colors -> lowercased
 * - Fallback -> lowercased input
 */
export function normalizeColorInput(input: string): string {
  const v = String(input ?? "").trim();

  // No-hash hex like `ABC`, `ABCDEF`, or `11223344`
  const noHashMatch = /^([0-9A-F]{3}|[0-9A-F]{6}|[0-9A-F]{8})$/i.exec(v);
  if (noHashMatch) {
    const s = noHashMatch[1];
    if (s.length === 3) {
      return (
        "#" +
        s
          .split("")
          .map((c) => c + c)
          .join("")
      );
    }
    return "#" + s;
  }

  // '#rgb' expand to '#rrggbb' (preserve case)
  if (/^#([0-9A-F]{3})$/i.test(v)) {
    const m = /^#([0-9A-F]{3})$/i.exec(v)!;
    return (
      "#" +
      m[1]
        .split("")
        .map((c) => c + c)
        .join("")
    );
  }

  // '#rrggbb' or '#rrggbbaa' -> slice up to 8 chars and lowercase
  if (/^#([0-9A-F]{6,8})$/i.test(v)) {
    return ("#" + v.replace(/^#/, "").slice(0, 8)).toLowerCase();
  }

  // Named colors and fallback: lowercase
  if (isCssNamedColor(v)) return v.toLowerCase();
  return v.toLowerCase();
}

/**
 * Convert a hex RGB color into HSL.
 *
 * @param hex - Color in #rrggbb (or #rgb) format.
 * @returns Tuple [h, s, l] where each component is in the range 0..1.
 */
export function hexToHsl(hex: string): [number, number, number] {
  const normalized = normalizeHexRgb(hex);
  if (!normalized) return [0, 0, 0];

  const r = Number.parseInt(normalized.slice(1, 3), 16) / 255;
  const g = Number.parseInt(normalized.slice(3, 5), 16) / 255;
  const b = Number.parseInt(normalized.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return [h, s, l];
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

  if (typeof s.color !== "string" || !isValidHexColor(s.color)) return false;

  if (typeof s.offset !== "number" || s.offset < 0 || s.offset > 100)
    return false;

  if (s.opacity !== undefined) {
    if (typeof s.opacity !== "number" || s.opacity < 0 || s.opacity > 1)
      return false;
  }

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

  if (grad.type !== "linear" && grad.type !== "radial") return false;

  if (!Array.isArray(grad.stops) || grad.stops.length < 2) return false;

  for (const stop of grad.stops) {
    if (!isValidGradientStop(stop)) return false;
  }

  if (grad.type === "linear" && grad.angle !== undefined) {
    if (typeof grad.angle !== "number" || grad.angle < 0 || grad.angle > 360)
      return false;
  }

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
    const trimmed = value.trim();
    if (trimmed.length === 0) return false;
    // Support JSON-encoded gradient definitions (stored/transported as strings).
    if (trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (isValidGradient(parsed)) return true;
      } catch {
        // Fall through to hex validation
      }
    }
    return isValidHexColor(trimmed);
  }
  return isValidGradient(value);
}

/** Provide a human-readable reason when a color value is invalid. Returns an empty string when the value is valid. */
export function getColorInvalidReason(value: unknown): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    // Treat empty or whitespace-only strings as a distinct failure mode so callers
    // can surface a clearer diagnostic message instead of a generic hex error.
    if (trimmed.length === 0) return "empty color value";

    if (trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (isValidGradient(parsed)) return "";
        return "invalid gradient JSON definition";
      } catch {
        return "invalid gradient JSON (parse error)";
      }
    }

    if (isValidHexColor(trimmed)) return "";
    return "invalid hex string";
  }
  if (isValidGradient(value)) return "";
  return "invalid gradient definition";
}

/**
 * Parses a color value, converting JSON strings back to gradient objects if needed.
 * @param value - The color value (may be a string or JSON-encoded gradient).
 * @returns The parsed color value as ColorValue.
 * @source
 */
function parseColorValue(value: ColorValue | string): ColorValue | undefined {
  if (typeof value !== "string") {
    return value;
  }

  // Try to parse JSON-encoded gradients
  if (value.startsWith("{")) {
    try {
      const parsed = JSON.parse(value);
      if (isGradient(parsed)) {
        return parsed;
      }
    } catch {
      // Not JSON or not a valid gradient, treat as regular string
    }
  }

  return value;
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
    let value = styles[key];
    if (value === undefined) {
      resolvedColors[key] = "";
      continue;
    }

    value = parseColorValue(value);

    if (value !== undefined && isGradient(value)) {
      const id = generateGradientId(key);
      gradientIds[key] = id;
      gradientDefs.push(generateGradientSVG(value, id));
      resolvedColors[key] = `url(#${id})`;
    } else if (value !== undefined) {
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
 * Maps any public/absolute card preview URL back to the in-app `/api/card` endpoint.
 * This preserves the query string while letting callers share the normalized preview cache.
 */
export function toCardApiHref(previewUrl: string): string | null {
  try {
    const url = new URL(previewUrl, "https://example.invalid");

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return `/api/card${url.search}`;
  } catch {
    return null;
  }
}

function normalizeSvgConversionSource(
  source: string | SvgConversionSource,
): SvgConversionSource {
  if (typeof source === "string") {
    return { svgUrl: source };
  }

  return source;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const mimeType = blob.type || "application/octet-stream";

  if (typeof FileReader === "undefined") {
    const arrayBuffer = await blob.arrayBuffer();
    return `data:${mimeType};base64,${Buffer.from(arrayBuffer).toString("base64")}`;
  }

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => {
      reject(reader.error ?? new Error("Failed to read conversion response"));
    };
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Failed to read conversion response"));
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Reads SVG markup from a browser object URL so callers can reuse a previously fetched preview.
 */
export async function readSvgMarkupFromObjectUrl(
  objectUrl: string,
): Promise<string> {
  const response = await fetch(objectUrl);
  if (!response.ok) {
    throw new Error(`Failed to read cached preview SVG: ${response.status}`);
  }

  return await response.text();
}

/**
 * Converts SVG input into a raster blob using the conversion API's binary response mode.
 */
export async function convertSvgToBlob(
  source: string | SvgConversionSource,
  format: ConversionFormat = "png",
): Promise<Blob> {
  const payloadSource = normalizeSvgConversionSource(source);

  if (!payloadSource.svgUrl && !payloadSource.svgContent) {
    throw new Error("Missing SVG source for conversion");
  }

  const isClient =
    (globalThis as unknown as { window?: unknown }).window !== undefined;
  const convertEndpoint = isClient ? "/api/convert" : buildApiUrl("/convert");
  const response = await fetch(convertEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payloadSource,
      format,
      responseType: "binary",
    }),
  });

  if (!response.ok) {
    const payload = await parseResponsePayload(response);
    throw new Error(
      `Failed to convert SVG: ${getResponseErrorMessage(response, payload)}`,
    );
  }

  const blob = await response.blob();
  const expectedMimeType = format === "webp" ? "image/webp" : "image/png";
  const mimeType = blob.type || expectedMimeType;

  if (mimeType !== expectedMimeType) {
    throw new Error(
      `Invalid response from convert API: expected ${expectedMimeType} but received ${mimeType}`,
    );
  }

  if (blob.type === expectedMimeType) {
    return blob;
  }

  return new Blob([await blob.arrayBuffer()], { type: expectedMimeType });
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
  source: string | SvgConversionSource,
  format: ConversionFormat = "png",
): Promise<string> {
  try {
    const blob = await convertSvgToBlob(source, format);
    return await blobToDataUrl(blob);
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
  const message = `HTTP ${response.status} ${response.statusText}`;
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
  return fontSize.toFixed(1);
};

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
 * Extracts the style subset from a stored or template card config so templates
 * receive only the style values they need. Provides default colors when undefined.
 * @source
 */
export function extractStyles(
  cardConfig: StoredCardConfig | TemplateCardConfig,
) {
  return {
    titleColor: cardConfig.titleColor ?? DEFAULT_TITLE_COLOR,
    backgroundColor: cardConfig.backgroundColor ?? DEFAULT_BACKGROUND_COLOR,
    textColor: cardConfig.textColor ?? DEFAULT_TEXT_COLOR,
    circleColor: cardConfig.circleColor ?? DEFAULT_CIRCLE_COLOR,
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
  return clampBorderRadius(defaultRadius);
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
