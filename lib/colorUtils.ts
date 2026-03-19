/**
 * Color utility helpers.
 * Central place for gradient -> CSS conversion and helpers.
 */
import type { ColorValue, GradientDefinition } from "@/lib/types/card";

/**
 * Convert a hex color string to an rgba() CSS string using the provided alpha.
 * Only the first 6 hex digits are considered (i.e., #RRGGBB). This mirrors
 * the behavior used in existing local helpers.
 */
export function hexToRgba(hex: string, alpha: number): string {
  // Normalize alpha: clamp to [0, 1], default to 0 if invalid
  const normalizedAlpha = Number.isFinite(alpha)
    ? Math.max(0, Math.min(1, alpha))
    : 0;

  // Normalize: strip leading '#' and whitespace
  let cleanHex = hex.trim().replace(/^#/, "").toLowerCase();

  // Expand 3-digit hex (#rgb -> #rrggbb)
  if (/^[a-f0-9]{3}$/.test(cleanHex)) {
    cleanHex = cleanHex
      .split("")
      .map((c) => c + c)
      .join("");
  }

  // Accept 6 or 8 hex digits; use only the first 6 characters for r/g/b
  if (!/^[a-f0-9]{6}(?:[a-f0-9]{2})?$/.test(cleanHex)) {
    return `rgba(0, 0, 0, ${normalizedAlpha})`;
  }

  const r = Number.parseInt(cleanHex.substring(0, 2), 16);
  const g = Number.parseInt(cleanHex.substring(2, 4), 16);
  const b = Number.parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${normalizedAlpha})`;
}
/**
 * Convert a GradientDefinition into a CSS gradient string.
 * Supports linear and radial gradients and respects stop opacity.
 */
export function gradientToCss(gradient: GradientDefinition): string {
  const stops = gradient.stops
    .map((stop) => {
      const opacity = stop.opacity ?? 1;
      const color = opacity < 1 ? hexToRgba(stop.color, opacity) : stop.color;
      return `${color} ${stop.offset}%`;
    })
    .join(", ");

  if (gradient.type === "linear") {
    return `linear-gradient(${gradient.angle ?? 90}deg, ${stops})`;
  }

  const cx = gradient.cx ?? 50;
  const cy = gradient.cy ?? 50;
  const r = gradient.r ?? 50;
  return `radial-gradient(${r}% ${r}% at ${cx}% ${cy}%, ${stops})`;
}

/**
 * Normalize a ColorValue (or string/undefined) for comparison.
 * Returns a string representation when the value is present, or undefined when absent.
 *
 * This is used for legacy heuristics that compare gradients/strings by their serialized value.
 */
export function normalizeForCompare(
  value: ColorValue | string | undefined,
): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === "string" ? value : JSON.stringify(value);
}
