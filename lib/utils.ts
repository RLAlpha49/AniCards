import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { StoredCardConfig } from "@/lib/types/records";
import type {
  TemplateCardConfig,
  ColorValue,
  GradientDefinition,
} from "@/lib/types/card";
import JSZip from "jszip";

// Utility functions for common application needs.
// These helpers assist in merging class names, performing clipboard operations,
// converting SVG to various image formats, calculating dynamic font sizes, formatting bytes, and safely parsing JSON data.

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

// ==================== Gradient Utilities ====================

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
      resolvedColors[key] = "none";
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
    const response = await fetch("/api/convert", {
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
async function parseResponsePayload(response: Response): Promise<unknown> {
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
function getResponseErrorMessage(response: Response, payload: unknown): string {
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
 * @returns The parsed object of type T.
 * @throws Error if JSON.parse fails.
 * @source
 */
export function safeParse<T>(data: unknown): T {
  if (typeof data === "string") {
    try {
      // Attempt to parse the data string as JSON.
      return JSON.parse(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isProduction =
        typeof process !== "undefined" &&
        process.env?.NODE_ENV === "production";

      const maxSnippet = 200;
      const length = data.length;

      if (isProduction) {
        console.error(
          `Failed to parse JSON: ${message}. Payload length: ${length}`,
        );
      } else {
        const snippet = data.slice(0, maxSnippet);
        const truncated = length > maxSnippet ? "..." : "";
        console.error(
          `Failed to parse JSON: ${message}. Payload snippet (first ${Math.min(
            maxSnippet,
            length,
          )} chars, length ${length}): ${snippet}${truncated}`,
        );
      }
      throw error;
    }
  }
  // If data is not a string, return it as is.
  return data as T;
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
  };
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
