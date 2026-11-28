import {
  DEFAULT_BASE_CARD_URL,
  DEFAULT_EXAMPLE_USER_ID,
  buildCardUrlWithParams,
  mapStoredConfigToCardUrlParams,
} from "@/lib/cards/urls";
import { FAVOURITE_CARD_TYPES, GRID_CARD_TYPE } from "@/lib/cards/catalogue";
import { colorPresets } from "@/lib/cards/colour-presets";
import type { ColorValue } from "@/lib/types/card";
import type { StoredCardConfig } from "@/lib/types/records";
import { isGradient } from "@/lib/color/gradients";

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
