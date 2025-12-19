import type { TrustedSVG } from "@/lib/types/svg";
import type { UserFavourites } from "@/lib/types/records";
import {
  calculateDynamicFontSize,
  escapeForXml,
  getCardBorderRadius,
  markTrustedSvg,
  processColorsForSVG,
} from "@/lib/utils";
import {
  generateCardBackground,
  generateCommonStyles,
  generateFavouritesSummaryBody,
  getFavouriteCounts,
  type TemplateStyles,
} from "./shared";

/**
 * Renders the Favourites Summary card - a compact KPI-style card summarizing
 * how many favourites the user has in each category.
 * @param data - Template input including username, styles, and favourites.
 * @returns The generated SVG markup as a TrustedSVG.
 * @source
 */
export const favoritesSummaryTemplate = (data: {
  username: string;
  variant?: "default";
  styles: TemplateStyles;
  favourites: UserFavourites;
}): TrustedSVG => {
  const { gradientDefs, resolvedColors } = processColorsForSVG(
    {
      titleColor: data.styles.titleColor,
      backgroundColor: data.styles.backgroundColor,
      textColor: data.styles.textColor,
      circleColor: data.styles.circleColor,
      borderColor: data.styles.borderColor,
    },
    [
      "titleColor",
      "backgroundColor",
      "textColor",
      "circleColor",
      "borderColor",
    ],
  );

  // Get counts from each category
  const counts = getFavouriteCounts(data.favourites);
  const animeCount = counts.anime;
  const mangaCount = counts.manga;
  const charactersCount = counts.characters;
  const staffCount = counts.staff;
  const studiosCount = counts.studios;

  const totalFavourites =
    animeCount + mangaCount + charactersCount + staffCount + studiosCount;

  const dims = { w: 350, h: 180 };
  const cardRadius = getCardBorderRadius(data.styles.borderRadius);

  const title = `${data.username}'s Favourites`;
  const safeTitle = escapeForXml(title);

  return markTrustedSvg(`
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${dims.w}"
  height="${dims.h}"
  viewBox="0 0 ${dims.w} ${dims.h}"
  fill="none"
  role="img"
  aria-labelledby="title-id desc-id"
>
  ${gradientDefs ? `<defs>${gradientDefs}</defs>` : ""}
  <title id="title-id">${safeTitle}</title>
  <desc id="desc-id">
    Total Favourites: ${totalFavourites}.
    Anime: ${counts.anime}, Manga: ${counts.manga}, Characters: ${counts.characters},
    Staff: ${counts.staff}, Studios: ${counts.studios}.
  </desc>

  <style>
    ${generateCommonStyles(
      resolvedColors,
      Number.parseFloat(calculateDynamicFontSize(title)),
    )}

    .total-count {
      fill: ${resolvedColors.circleColor};
      font: 700 24px 'Segoe UI', Ubuntu, Sans-Serif;
    }

    .category-icon {
      fill: ${resolvedColors.circleColor};
      font-size: 14px;
    }
  </style>

  ${generateCardBackground(dims, cardRadius, resolvedColors)}

  <g data-testid="card-title" transform="translate(25, 35)">
    <text x="0" y="0" class="header">${safeTitle}</text>
  </g>

  ${generateFavouritesSummaryBody(counts, resolvedColors)}
</svg>
`);
};
