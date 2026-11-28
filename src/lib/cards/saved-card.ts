import { getAbsoluteUrl } from "@/lib/browser";

/**
 * One card saved for a profile, and the links that card can be shared through.
 *
 * The type and its two link builders share a module because neither is useful
 * alone: the type only exists to be rendered as a link, and every link helper
 * needs the stored URLs. Both are client-only, because they read the current
 * origin.
 * @source
 */

/**
 * One card saved for a profile, as the user page renders it.
 *
 * @property type - Display name, for example `Anime Stats`.
 * @property svgUrl - Versioned card URL, so the browser asks for new artwork
 *   when the stats or the configuration change.
 * @property rawType - Card identifier the API uses, for example `animeStats`.
 * @property variation - Human label for the layout, for example `Pie Chart`.
 * @property preset - Human label for the colour preset, for example `AniList Dark`.
 * @property borderRadius - Corner radius the stored configuration asked for.
 * @source
 */
export type SavedCard = Readonly<{
  type: string;
  svgUrl: string;
  rawType: string;
  variation: string;
  preset: string;
  borderRadius: number;
}>;

/** Stands in for the origin when a relative URL has to be parsed. @source */
const PLACEHOLDER_ORIGIN = "https://placeholder.invalid";

/**
 * Removes the `_t` cache-buster from a card URL.
 *
 * The parameter exists so the browser and the CDN fetch new artwork when the
 * card's content changes. A link someone pastes into a profile should not
 * carry it: the value is a timestamp, and a copied link that keeps changing is
 * a link nobody can compare or reuse.
 *
 * @param url - Card URL, absolute or relative.
 * @returns The same URL without `_t`.
 * @source
 */
function stripTimestampParam(url: string): string {
  const absolute = /^[a-z][a-z\d+.-]*:/i.test(url);
  try {
    const parsed = new URL(url, absolute ? undefined : PLACEHOLDER_ORIGIN);
    parsed.searchParams.delete("_t");
    const result = parsed.toString();
    return absolute ? result : result.replace(PLACEHOLDER_ORIGIN, "");
  } catch {
    // A URL the parser rejects still loses the parameter, so the copy is clean.
    return url.replaceAll(/[&?]_t=[^&]*/g, "");
  }
}

/**
 * Absolute SVG address for a saved card, safe to share.
 *
 * @param card - The card to address.
 * @returns An absolute URL without the cache-buster.
 * @source
 */
export function cardSvgLink(card: SavedCard): string {
  return stripTimestampParam(getAbsoluteUrl(card.svgUrl));
}

/**
 * The line AniList reads as an image in a profile's About field.
 *
 * @param card - The card to embed.
 * @returns `img150(...)` around the card's SVG address.
 * @source
 */
export function cardAnilistLine(card: SavedCard): string {
  return `img150(${cardSvgLink(card)})`;
}
