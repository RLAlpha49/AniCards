/**
 * Gradient colour values: type guards, SVG definitions, validation, and the
 * resolver that turns a card's colour settings into gradient ids.
 * @source
 */
import type { ColorValue, GradientDefinition } from "@/lib/types/card";
import { isValidHexColor } from "@/lib/color/convert";

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

  // Return as regular color string
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

    // Parse JSON-encoded gradients back to objects
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
