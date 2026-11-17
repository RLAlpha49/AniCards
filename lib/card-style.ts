/**
 * Card style resolution: the default palette, border radius, and the stored to
 * template config conversion.
 * @source
 */
import type { TemplateCardConfig } from "@/lib/types/card";
import type { StoredCardConfig } from "@/lib/types/records";
import { API_BASE } from "@/lib/api/base-url";
import { getAbsoluteUrl } from "@/lib/browser";

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
            if (Number.isFinite(parsedFromHeader))
              return clampBorderRadius(parsedFromHeader);
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
        return clampBorderRadius(parsed);
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
    titleColor: card.titleColor ?? DEFAULT_TITLE_COLOR,
    backgroundColor: card.backgroundColor ?? DEFAULT_BACKGROUND_COLOR,
    textColor: card.textColor ?? DEFAULT_TEXT_COLOR,
    circleColor: card.circleColor ?? DEFAULT_CIRCLE_COLOR,
    borderColor: "borderColor" in card ? card.borderColor : undefined,
    useStatusColors:
      "useStatusColors" in card ? card.useStatusColors : undefined,
  };
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
