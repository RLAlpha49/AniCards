/**
 * Color utility helpers.
 * Central place for gradient -> CSS conversion and helpers.
 */
import type { GradientDefinition } from "@/lib/types/card";

/**
 * Convert a hex color string to an rgba() CSS string using the provided alpha.
 * Only the first 6 hex digits are considered (i.e., #RRGGBB). This mirrors
 * the behavior used in existing local helpers.
 */
export function hexToRgba(hex: string, alpha: number): string {
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
    return `rgba(0, 0, 0, ${alpha})`;
  }

  const r = Number.parseInt(cleanHex.substring(0, 2), 16);
  const g = Number.parseInt(cleanHex.substring(2, 4), 16);
  const b = Number.parseInt(cleanHex.substring(4, 6), 16);
  const a = Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : alpha;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
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
  return `radial-gradient(circle ${r}% at ${cx}% ${cy}%, ${stops})`;
}
