import {
  DEFAULT_EXAMPLE_USER_ID,
  VARIATION_LABEL_MAP,
  buildCardUrlWithParams,
  mapStoredConfigToCardUrlParams,
} from "@/lib/card-groups";
import {
  GROUPS,
  GROUP_NOTES,
  GROUP_NUMERALS,
  buildCardTypes,
} from "@/components/examples/card-types";
import type { CardType, GroupName } from "@/components/examples/card-types";
import { colorPresets } from "@/lib/card-catalogue";
import type { ColorValue } from "@/lib/types/card";
import type { StoredCardConfig } from "@/lib/types/records";
import { DEFAULT_BASE_CARD_URL } from "@/lib/card-groups";
import { isGradient } from "@/lib/utils";

/**
 * Every card the generator can render.
 *
 * Reuses the examples page catalogue so the generator and the examples gallery
 * describe the same set of cards. Each entry carries its stable card id, so
 * selections can be keyed without a second lookup.
 * @source
 */
export const CARD_TYPES: CardType[] = buildCardTypes();

/** A card selection: which card, and which variation of it. @source */
export type CardSelection = Readonly<{
  variation: string;
  showFavourites: boolean;
}>;

/** Card types keyed by card id. @source */
const CARD_BY_ID = new Map(CARD_TYPES.map((card) => [card.id, card]));

/**
 * Looks a card type up by card id.
 * @param id - Card identifier, for example `animeStats`.
 * @returns The card type, or undefined when the id is unknown.
 * @source
 */
export function findCardType(id: string): CardType | undefined {
  return CARD_BY_ID.get(id);
}

/** The six card groups, in catalogue order. @source */
export const GROUP_SUMMARIES = GROUPS.map((name, index) => ({
  name,
  numeral: GROUP_NUMERALS[index],
  note: GROUP_NOTES[name],
  count: CARD_TYPES.filter((card) => card.group === name).length,
}));

/**
 * Card types whose template can list favourites alongside the counted names.
 * Mirrors the set the card API accepts `showFavorites` for.
 * @source
 */
export const FAVOURITE_CARD_TYPES = new Set([
  "animeVoiceActors",
  "animeStudios",
  "animeStaff",
  "mangaStaff",
]);

/** The card that needs an explicit grid size before the API will render it. @source */
export const GRID_CARD_TYPE = "favoritesGrid";

/**
 * Reads a variation id as a label.
 * @param variation - Variation id, for example `donut`.
 * @returns A human label, falling back to the raw id.
 * @source
 */
export function variationLabel(variation: string): string {
  return VARIATION_LABEL_MAP[variation] ?? variation;
}

/** One selectable colour theme. @source */
export type PalettePreset = Readonly<{
  name: string;
  label: string;
  colors: ColorValue[];
  /** True when any of the four colours is a gradient. */
  gradient: boolean;
  mode: "dark" | "light" | "custom";
}>;

/**
 * Turns a preset key into a spaced label.
 * @param name - Preset key, for example `anilistDarkGradient`.
 * @returns A display label, or `Custom` for the custom palette.
 * @source
 */
export function paletteLabel(name: string): string {
  if (name === "custom") return "Custom";
  const spaced = name.replaceAll(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Every named palette, with `default` first.
 *
 * The `custom` entry is left out: the generator builds custom colours from its
 * own four colour fields, so listing it as a preset would be a dead tile.
 * @source
 */
export const PALETTE_PRESETS: PalettePreset[] = Object.entries(colorPresets)
  .filter(([name]) => name !== "custom")
  .map(([name, preset]) => ({
    name,
    label: paletteLabel(name),
    colors: preset.colors,
    gradient: preset.colors.some((color) => isGradient(color)),
    mode: preset.mode,
  }))
  .sort((a, b) => {
    if (a.name === "default") return -1;
    if (b.name === "default") return 1;
    return a.label.localeCompare(b.label);
  });

/**
 * The settings every preview renders with.
 *
 * Bundled so the preview, the option demos, and any future thumbnail all describe
 * the same draft through one shape.
 * @source
 */
export type PreviewOptions = Readonly<{
  colors: ColorValue[];
  frameEnabled: boolean;
  frameColor: string;
  cornerRadius: number;
  animeStatusColors: boolean;
  mangaStatusColors: boolean;
  piePercentages: boolean;
  gridColumns: number;
  gridRows: number;
}>;

type PreviewRequest = Readonly<{
  cardTypeId: string;
  variation: string;
  showFavourites: boolean;
  options: PreviewOptions;
}>;

/**
 * Serialises one colour for a query parameter.
 *
 * The card API parses a JSON object back into a gradient, so a gradient can
 * travel in the URL just like a hex value. That is what lets the preview show the
 * exact palette instead of a stand-in preset.
 * @param color - Solid hex or gradient definition.
 * @returns A query-safe colour string.
 * @source
 */
function encodeColor(color: ColorValue): string {
  return isGradient(color) ? JSON.stringify(color) : color;
}

/**
 * Builds the preview URL for one card in the current settings.
 *
 * Colours always travel individually, including gradients, so the thumbnail is
 * rendered in the palette the visitor actually chose. The frame travels
 * too, which is why the preview shows the border and corner radius. Passing a
 * preset name instead would lose every hand-edited colour.
 *
 * @param request - Card type, variation, favourites flag, and the settings.
 * @returns An absolute card URL rendered from the shared example profile.
 * @source
 */
export function buildCardPreviewUrl({
  cardTypeId,
  variation,
  showFavourites,
  options,
}: PreviewRequest): string {
  const {
    colors,
    frameEnabled,
    frameColor,
    cornerRadius,
    animeStatusColors,
    mangaStatusColors,
    piePercentages,
    gridColumns,
    gridRows,
  } = options;

  const [titleColor, backgroundColor, textColor, circleColor] =
    colors.map(encodeColor);

  const candidate: Partial<StoredCardConfig> = {
    cardName: cardTypeId,
    variation,
    titleColor,
    backgroundColor,
    textColor,
    circleColor,
    ...(frameEnabled && frameColor
      ? { borderColor: frameColor, borderRadius: cornerRadius }
      : {}),
    ...(FAVOURITE_CARD_TYPES.has(cardTypeId)
      ? { showFavorites: showFavourites }
      : {}),
    ...(cardTypeId === "animeStatusDistribution"
      ? { useStatusColors: animeStatusColors }
      : {}),
    ...(cardTypeId === "mangaStatusDistribution"
      ? { useStatusColors: mangaStatusColors }
      : {}),
    ...(variation === "pie" || variation === "donut"
      ? { showPiePercentages: piePercentages }
      : {}),
    ...(cardTypeId === GRID_CARD_TYPE
      ? { gridCols: gridColumns, gridRows: gridRows }
      : {}),
  };

  return buildCardUrlWithParams(
    mapStoredConfigToCardUrlParams(candidate, {
      userId: DEFAULT_EXAMPLE_USER_ID,
      includeColors: true,
      defaultToCustomPreset: false,
    }),
    DEFAULT_BASE_CARD_URL,
  );
}

/**
 * Filters cards by a search term.
 *
 * Matches the card title, its description, its group, and its variation names,
 * so a search for "donut" finds every chart that offers that shape.
 *
 * @param cards - Cards to filter.
 * @param query - Raw search term.
 * @returns Matching cards, or the input when the term is empty.
 * @source
 */
export function filterCardTypes(cards: CardType[], query: string): CardType[] {
  const term = query.trim().toLowerCase();
  if (!term) return cards;

  return cards.filter(
    (card) =>
      card.title.toLowerCase().includes(term) ||
      card.description.toLowerCase().includes(term) ||
      card.group.toLowerCase().includes(term) ||
      card.variations.some((variation) =>
        variationLabel(variation.variation).toLowerCase().includes(term),
      ),
  );
}
