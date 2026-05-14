import { statCardTypes } from "@/lib/card-types";
import type { StoredCardConfig } from "@/lib/types/records";

type StatCardType = (typeof statCardTypes)[number];

export type CardId = StatCardType["id"];
export type VariationId = StatCardType["variations"][number]["id"];

export interface CardRenderMatrixCase {
  cardId: CardId;
  cardLabel: string;
  variation: VariationId;
  variationLabel: string;
}

export type CardRenderMatrixConfig = Pick<
  StoredCardConfig,
  | "backgroundColor"
  | "borderColor"
  | "borderRadius"
  | "cardName"
  | "circleColor"
  | "gridCols"
  | "gridRows"
  | "showFavorites"
  | "showPiePercentages"
  | "textColor"
  | "titleColor"
  | "variation"
> & {
  colorPreset: "custom";
};

export const cardRenderMatrixCases: CardRenderMatrixCase[] =
  statCardTypes.flatMap((cardType) =>
    cardType.variations.map((variation) => ({
      cardId: cardType.id,
      cardLabel: cardType.label,
      variation: variation.id,
      variationLabel: variation.label,
    })),
  );

export const CARD_RENDER_MATRIX_CASE_COUNT = cardRenderMatrixCases.length;

/**
 * Builds the shared card-generator config used by matrix probes.
 *
 * @param cardId - The stat card id to render.
 * @param variation - The variation id to render for that card.
 * @returns A card-generator config with the matrix probe's shared defaults.
 */
export function createCardRenderMatrixConfig(
  cardId: CardId,
  variation: VariationId,
): CardRenderMatrixConfig {
  return {
    backgroundColor: "#0f172a",
    borderColor: "#38bdf8",
    borderRadius: 16,
    cardName: cardId,
    circleColor: "#f97316",
    colorPreset: "custom",
    gridCols: 3,
    gridRows: 2,
    showFavorites: true,
    showPiePercentages: true,
    textColor: "#e2e8f0",
    titleColor: "#f8fafc",
    variation,
  };
}
