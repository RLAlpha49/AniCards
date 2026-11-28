import type { TrustedSVG } from "@/lib/types/svg";
import type { ColorValue } from "@/lib/types/card";
import { extraAnimeMangaStatsTemplate } from "@/lib/svg-templates/extra-anime-manga-stats/extra-anime-manga-stats";

/**
 * Template input for the Studio Collaboration card.
 * @source
 */
interface StudioCollaborationTemplateInput {
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
