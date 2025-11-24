import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { StoredCardConfig } from "@/lib/types/records";
import type { TemplateCardConfig } from "@/lib/types/card";

// Utility functions for common application needs.
// These helpers assist in merging class names, performing clipboard operations,
// converting SVG to PNG, calculating dynamic font sizes, formatting bytes, and safely parsing JSON data.

/**
 * Merges and resolves conflicts between Tailwind CSS class names.
 * Uses clsx to conditionally join classes and twMerge to resolve conflicting tailwind directives.
 *
 * @param inputs - List of class names or expressions (of type ClassValue) to be merged.
 * @returns A single merged string of class names.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converts an SVG file referenced by a URL to a PNG data URL via an API call.
 *
 * Makes a POST request to the conversion API endpoint with the SVG URL and retrieves the PNG data URL.
 *
 * @param svgUrl - The URL of the SVG file to be converted.
 * @returns A Promise that resolves to the PNG data URL as a string.
 * @throws Error when the conversion process or network request fails.
 */
export async function svgToPng(svgUrl: string): Promise<string> {
  try {
    // Call the conversion API with the provided SVG URL.
    const response = await fetch("/api/convert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ svgUrl }),
    });

    // Extract and return the PNG data URL from the API response.
    const { pngDataUrl } = await response.json();
    return pngDataUrl;
  } catch (error) {
    // Log the error for debugging and rethrow it.
    console.error("Conversion failed:", error);
    throw error;
  }
}

/**
 * Copies the specified text to the system clipboard.
 *
 * A simple wrapper around the browser's clipboard API that returns a promise.
 *
 * @param text - The text to be copied.
 * @returns A Promise that resolves when the text is successfully copied.
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
 */
export function safeParse<T>(data: unknown): T {
  if (typeof data === "string") {
    try {
      // Attempt to parse the data string as JSON.
      return JSON.parse(data);
    } catch (error) {
      // Log the failure along with the data that caused the error.
      console.error("Failed to parse JSON:", data);
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
 */
export function toTemplateCardConfig(
  card: StoredCardConfig | TemplateCardConfig,
  defaultVariation = "default",
): TemplateCardConfig {
  return {
    cardName: card.cardName,
    variation:
      "variation" in card && (card as TemplateCardConfig).variation !== undefined
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
