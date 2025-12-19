import type { ColorValue } from "@/lib/types/card";
import type { TrustedSVG } from "@/lib/types/svg";
import {
  calculateDynamicFontSize,
  escapeForXml,
  getCardBorderRadius,
  markTrustedSvg,
  processColorsForSVG,
} from "@/lib/utils";
import {
  calculateCompletionRatio,
  getDimensions,
  generateStackedBar,
  generateStatusLegend,
  normalizeStatusCounts,
} from "./shared";

/** Status completion input structure. @source */
interface StatusCompletionInput {
  username: string;
  variant?: "combined" | "split";
  styles: {
    titleColor: ColorValue;
    backgroundColor: ColorValue;
    textColor: ColorValue;
    circleColor: ColorValue;
    borderColor?: ColorValue;
    borderRadius?: number;
  };
  animeStatuses: { status: string; count: number }[];
  mangaStatuses: { status: string; count: number }[];
}

/**
 * Renders the Status Completion Overview card showing cross-media completion stats.
 * @source
 */
export function statusCompletionOverviewTemplate(
  input: StatusCompletionInput,
): TrustedSVG {
  const { username, styles, variant = "combined" } = input;
  const animeStatuses = normalizeStatusCounts(input.animeStatuses ?? []);
  const mangaStatuses = normalizeStatusCounts(input.mangaStatuses ?? []);

  const { gradientDefs, resolvedColors } = processColorsForSVG(
    {
      titleColor: styles.titleColor,
      backgroundColor: styles.backgroundColor,
      textColor: styles.textColor,
      circleColor: styles.circleColor,
      borderColor: styles.borderColor,
    },
    [
      "titleColor",
      "backgroundColor",
      "textColor",
      "circleColor",
      "borderColor",
    ],
  );

  const cardRadius = getCardBorderRadius(styles.borderRadius);
  const dims = getDimensions("statusCompletionOverview", variant);
  const title = `${username}'s Completion Overview`;
  const safeTitle = escapeForXml(title);
  const headerFontSize = calculateDynamicFontSize(title, 18, dims.w - 40);

  const animeRatio = calculateCompletionRatio(animeStatuses);
  const mangaRatio = calculateCompletionRatio(mangaStatuses);

  const animeLabel = `Anime (${animeRatio.percentage}% completed)`;
  const mangaLabel = `Manga (${mangaRatio.percentage}% completed)`;

  let content: string;

  if (variant === "split") {
    content = `
      <g transform="translate(25, 65)">
        ${generateStackedBar(animeStatuses, {
          x: 0,
          y: 0,
          width: dims.w - 50,
          height: 20,
          label: animeLabel,
          textColor: resolvedColors.textColor,
          trackColor: resolvedColors.circleColor,
        })}
        ${generateStatusLegend(animeStatuses, 0, 34, resolvedColors.textColor)}
        ${generateStackedBar(mangaStatuses, {
          x: 0,
          y: 80,
          width: dims.w - 50,
          height: 20,
          label: mangaLabel,
          textColor: resolvedColors.textColor,
          trackColor: resolvedColors.circleColor,
        })}
        ${generateStatusLegend(mangaStatuses, 0, 114, resolvedColors.textColor)}
      </g>
    `;
  } else {
    // Combined variant - merge anime and manga statuses
    const combinedStatuses = normalizeStatusCounts([
      ...animeStatuses,
      ...mangaStatuses,
    ]);
    const combinedRatio = calculateCompletionRatio(combinedStatuses);
    const combinedLabel = `All Media (${combinedRatio.percentage}% completed)`;

    content = `
      <g transform="translate(25, 65)">
        ${generateStackedBar(combinedStatuses, {
          x: 0,
          y: 0,
          width: dims.w - 50,
          height: 24,
          label: combinedLabel,
          textColor: resolvedColors.textColor,
          trackColor: resolvedColors.circleColor,
        })}
        ${generateStatusLegend(combinedStatuses, 0, 40, resolvedColors.textColor)}
      </g>
    `;
  }

  return markTrustedSvg(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${dims.w}" height="${dims.h}" viewBox="0 0 ${dims.w} ${dims.h}" fill="none" role="img" aria-labelledby="title-id">
      ${gradientDefs ? `<defs>${gradientDefs}</defs>` : ""}
      <title id="title-id">${safeTitle}</title>
      <style>
        .header { fill: ${resolvedColors.titleColor}; font: 600 ${headerFontSize}px 'Segoe UI', Ubuntu, Sans-Serif; }
        .bar-label { font: 500 12px 'Segoe UI', Ubuntu, Sans-Serif; }
        .legend-text { font: 400 11px 'Segoe UI', Ubuntu, Sans-Serif; }
        .stagger { opacity: 0; animation: fadeIn 0.5s ease forwards; }
        @keyframes fadeIn { to { opacity: 1; } }
      </style>
      <rect x="0.5" y="0.5" width="${dims.w - 1}" height="${dims.h - 1}" rx="${cardRadius}" fill="${resolvedColors.backgroundColor}" ${resolvedColors.borderColor ? `stroke="${resolvedColors.borderColor}"` : ""} stroke-width="2"/>
      <g transform="translate(20, 35)">
        <text class="header">${safeTitle}</text>
      </g>
      ${content}
    </svg>
  `);
}
