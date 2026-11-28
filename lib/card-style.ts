/**
 * Card style resolution: the default palette, border radius, and the stored to
 * template config conversion.
 * @source
 */
import type { TemplateCardConfig } from "@/lib/types/card";
import type { StoredCardConfig } from "@/lib/types/records";

export const DEFAULT_CARD_BORDER_RADIUS = 8;

const BORDER_RADIUS_MIN = 0;

const BORDER_RADIUS_MAX = 100;

const DEFAULT_TITLE_COLOR = "#fe428e";

const DEFAULT_BACKGROUND_COLOR = "#141321";

const DEFAULT_TEXT_COLOR = "#a9fef7";

const DEFAULT_CIRCLE_COLOR = "#fe428e";

const _borderRadiusPromiseCache = new Map<string, Promise<number | null>>();

type GlobalWithCache = typeof globalThis & {
  __ANICARDS__borderRadiusCache?: Map<string, Promise<number | null>>;
};

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
