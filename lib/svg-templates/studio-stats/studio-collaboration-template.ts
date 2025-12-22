import type { TrustedSVG } from "../../types/svg";
import { extraAnimeMangaStatsTemplate } from "../extra-anime-manga-stats/shared";
import type { ColorValue } from "../../types/card";

/**
 * Template input for the Studio Collaboration card.
 * @source
 */
export interface StudioCollaborationTemplateInput {
  username: string;
  variant?: "default";
  styles: {
    titleColor: ColorValue;
    backgroundColor: ColorValue;
    textColor: ColorValue;
    circleColor: ColorValue;
    borderColor?: ColorValue;
    borderRadius?: number;
  };
  stats: { name: string; count: number }[];
}

/**
 * Renders the Studio Collaboration card showing top studio co-occurrence pairs.
 * Reuses the extraAnimeMangaStatsTemplate for consistent styling.
 * @param input - Template input including username, styles, and stats.
 * @returns A TrustedSVG with the rendered card.
 * @source
 */
export const studioCollaborationTemplate = (
  input: StudioCollaborationTemplateInput,
): TrustedSVG => {
  return extraAnimeMangaStatsTemplate({
    ...input,
    format: "Studio Collaboration",
  });
};
