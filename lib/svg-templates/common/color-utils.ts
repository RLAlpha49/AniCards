import type { ColorValue } from "@/lib/types/card";
import { hexToHsl, hslToHex, isGradient, isValidHexColor } from "@/lib/utils";

export { hexToHsl, hslToHex, isValidHexColor } from "@/lib/utils";

/** Default stat base color used when a circle color cannot be resolved. @source lib/svg-templates/extra-anime-manga-stats/shared.ts */
export const DEFAULT_STAT_BASE_COLOR = "#2563eb";

/** Heatmap color palette configuration. @source lib/svg-templates/activity-stats/shared.ts */
export type HeatmapPalette = "default" | "github" | "fire";

/**
 * Try to parse a JSON-stringified gradient-like object and return a first valid hex stop color.
 *
 * @param jsonStr - A string that may contain JSON (e.g. a JSON-stringified gradient config).
 * @returns An object containing the first valid hex stop color, or null if no color can be resolved.
 * @source lib/svg-templates/extra-anime-manga-stats/shared.ts
 */
export const tryParseJsonGradient = (
  jsonStr: string,
): { color: string } | null => {
  try {
    const parsed = JSON.parse(jsonStr);

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      (parsed as { type?: unknown }).type &&
      Array.isArray((parsed as { stops?: unknown }).stops) &&
      ((parsed as { stops?: unknown[] }).stops?.length ?? 0) > 0
    ) {
      for (const stop of (parsed as { stops: unknown[] }).stops) {
        if (
          typeof stop === "object" &&
          stop !== null &&
          "color" in stop &&
          typeof (stop as { color?: unknown }).color === "string" &&
          isValidHexColor((stop as { color: string }).color)
        ) {
          return { color: (stop as { color: string }).color };
        }
      }
    }
  } catch {
    // JSON parsing failed, not a JSON string
  }

  return null;
};

/**
 * Resolve a circle/base color for stat visualizations.
 *
 * - If the value is a gradient object, returns the first valid hex stop.
 * - If the value is a hex string, returns it.
 * - If the value is a JSON-stringified gradient, returns the first valid hex stop.
 * - Otherwise, returns {@link DEFAULT_STAT_BASE_COLOR}.
 *
 * @param value - Card color value (hex string, gradient object, or other supported color value).
 * @returns A hex color string.
 * @source lib/svg-templates/extra-anime-manga-stats/shared.ts
 */
export const resolveCircleBaseColor = (
  value: ColorValue | undefined,
): string => {
  // Handle gradient objects (in-memory form)
  if (value && typeof value === "object" && isGradient(value)) {
    for (const stop of value.stops) {
      if (stop.color && isValidHexColor(stop.color)) {
        return stop.color;
      }
    }
    return DEFAULT_STAT_BASE_COLOR;
  }

  // Handle string values
  if (typeof value === "string") {
    // Try hex first
    if (isValidHexColor(value)) {
      return value;
    }

    // Try parsing as JSON (for JSON-stringified gradients from config)
    const gradResult = tryParseJsonGradient(value);
    if (gradResult) {
      return gradResult.color;
    }
  }

  return DEFAULT_STAT_BASE_COLOR;
};

/**
 * Generate a color variation from a base color using HSL adjustments. Colors
 * are derived deterministically by index to ensure consistent visual ordering.
 *
 * @param index - Zero-based index used to compute a deterministic variation.
 * @param baseColor - The base hex color used to compute variations.
 * @returns A CSS HSL color string.
 * @source lib/svg-templates/extra-anime-manga-stats/shared.ts
 */
export const getColorByIndex = (index: number, baseColor: string): string => {
  const [h0, s0, l0] = hexToHsl(baseColor);
  const h = h0 * 360;
  const s = s0 * 100;
  const l = l0 * 100;

  const variations = [
    { s: s * 0.8, l: l * 1.2 }, // Lightest
    { s: s, l: l }, // Base
    { s: s * 1.2, l: l * 0.8 },
    { s: s * 1.4, l: l * 0.6 },
    { s: s * 1.6, l: l * 0.4 }, // Darkest
  ];

  const variation = variations[index % variations.length];
  return `hsl(${h}, ${Math.min(variation.s, 100)}%, ${Math.min(variation.l, 100)}%)`;
};

/**
 * Select a color for a stat entry.
 *
 * If `useFixed` is truthy and the stat matches a known set of statuses this
 * function returns a fixed color; otherwise it returns an HSL-based variation
 * of the base color.
 *
 * @param index - Index used to derive color variations by position.
 * @param statName - Name of the stat (used for fixed mapping lookup).
 * @param baseColor - Base color used for non-fixed mapping.
 * @param useFixed - When true, use fixed status mapping for known statuses.
 * @returns A CSS color string.
 * @source lib/svg-templates/extra-anime-manga-stats/shared.ts
 */
export const getStatColor = (
  index: number,
  statName: string,
  baseColor: string,
  useFixed: boolean | undefined,
): string => {
  if (useFixed) {
    const key = statName.toLowerCase();
    const map: Record<string, string> = {
      current: "#16a34a", // green-600
      watching: "#16a34a",
      reading: "#16a34a",
      paused: "#ca8a04", // yellow-600
      completed: "#2563eb", // blue-600
      dropped: "#dc2626", // red-600
      planning: "#6b7280", // gray-500
      planned: "#6b7280",
      on_hold: "#ca8a04",
    };

    if (map[key]) return map[key];
  }

  return getColorByIndex(index, baseColor);
};

/**
 * Gets heatmap color based on activity intensity and palette.
 *
 * @param intensity - Normalized intensity value between 0 and 1.
 * @param palette - Color palette to use.
 * @param baseColor - Base color for default palette.
 * @returns Object with resolved color (hex or provided base) and opacity.
 * @source lib/svg-templates/activity-stats/shared.ts
 */
export function getHeatmapColor(
  intensity: number,
  palette: HeatmapPalette,
  baseColor: string,
): { color: string; opacity: number } {
  const level = Math.min(4, Math.ceil(intensity * 4));

  switch (palette) {
    case "github": {
      const githubColors = [
        "#ebedf0",
        "#9be9a8",
        "#40c463",
        "#30a14e",
        "#216e39",
      ];
      return { color: githubColors[level], opacity: 1 };
    }
    case "fire": {
      const fireColors = [
        "#ebedf0",
        "#ffadad",
        "#ff6b6b",
        "#ff3838",
        "#e60000",
      ];
      return { color: fireColors[level], opacity: 1 };
    }
    default:
      if (baseColor.startsWith("#")) {
        const [h, s] = hexToHsl(baseColor);
        // Vary lightness from light (0.9) to dark (0.1)
        const lightnesses = [0.9, 0.7, 0.5, 0.3, 0.1];
        const color = hslToHex(h, s, lightnesses[level]);
        return { color, opacity: 1 };
      }

      // For gradients, use varying opacity
      {
        const alphas = [0.2, 0.5, 0.7, 0.9, 1];
        return { color: baseColor, opacity: alphas[level] };
      }
  }
}
