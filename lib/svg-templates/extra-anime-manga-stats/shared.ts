import type { TrustedSVG } from "@/lib/types/svg";
import { displayNames } from "@/lib/card-data";
import {
  ANIMATION,
  POSITIONING,
  SPACING,
  TYPOGRAPHY,
  getCardDimensions,
  getColorByIndex,
  getStatColor,
  resolveCircleBaseColor,
} from "@/lib/svg-templates/common";

import {
  calculateDynamicFontSize,
  getCardBorderRadius,
  processColorsForSVG,
  escapeForXml,
  markTrustedSvg,
} from "@/lib/utils";
import type { ColorValue } from "@/lib/types/card";

import { generateCommonStyles } from "@/lib/svg-templates/common/style-generators";
import { generateCardBackground } from "@/lib/svg-templates/common/base-template-utils";
import {
  createRectElement,
  createStaggeredGroup,
  createTextElement,
} from "@/lib/svg-templates/common/svg-primitives";

/**
 * Render an SVG card for additional anime/manga statistics including pie/bar
 * and a minimal default detail list. The function returns a string containing
 * ready-to-embed SVG markup.
 * @param data - Input shape required by the template.
 * @returns A string of SVG markup representing the card.
 * @source
 */
export const extraAnimeMangaStatsTemplate = (data: {
  username: string;
  variant?: "default" | "pie" | "bar";
  styles: {
    titleColor: ColorValue;
    backgroundColor: ColorValue;
    textColor: ColorValue;
    circleColor: ColorValue;
    borderColor?: ColorValue;
    borderRadius?: number;
  };
  format: string;
  stats: { name: string; count: number }[];
  showPieChart?: boolean;
  favorites?: string[];
  fixedStatusColors?: boolean;
  showPiePercentages?: boolean;
}): TrustedSVG => {
  // Process colors for gradient support
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

  const statBaseCircleColor = resolveCircleBaseColor(data.styles.circleColor);
  const titleText = `${data.username}'s ${data.format}`;
  const safeTitle = escapeForXml(titleText);
  const titleFontSize =
    Number.parseFloat(calculateDynamicFontSize(titleText)) || 18;

  // Determine variant flags
  const isPie = data.showPieChart || data.variant === "pie";
  const isBar = data.variant === "bar";

  let svgWidth: number;
  const svgDims = (() => {
    if (isPie) return getCardDimensions("extraStats", "pie");
    if (isBar) return getCardDimensions("extraStats", "bar");
    return getCardDimensions("extraStats", "default");
  })();
  svgWidth = svgDims.w;
  const viewBoxWidth = svgWidth;
  const svgHeight = svgDims.h;
  const cardRadius = getCardBorderRadius(data.styles.borderRadius);

  /** List of formats that should render hearts for favorites (pink heart). @source */
  const FAVORITE_FORMATS = [
    "Anime Voice Actors",
    "Anime Studios",
    "Anime Staff",
    "Manga Staff",
  ];
  const showFavorites = FAVORITE_FORMATS.includes(data.format);

  /** Inline SVG used to render the 'favorite' heart icon in lists and legends. @source */
  const heartSVG =
    '<svg x="-18" y="2" width="14" height="14" viewBox="0 0 20 20" fill="#fe428e" xmlns="http://www.w3.org/2000/svg"><path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"/></svg>';

  const statsContentWithoutPie = data.stats
    .map((stat, index) => {
      const isFavorite = showFavorites && data.favorites?.includes(stat.name);
      const content =
        `${isFavorite ? heartSVG : ""}` +
        createTextElement(0, 12.5, `${stat.name}:`, "stat bold") +
        createTextElement(
          POSITIONING.STAT_VALUE_X_DEFAULT,
          12.5,
          String(stat.count),
          "stat bold",
        );

      return createStaggeredGroup(
        `translate(${SPACING.CARD_PADDING}, ${index * SPACING.ROW_HEIGHT})`,
        content,
        `${ANIMATION.BASE_DELAY + index * ANIMATION.STAGGER_INCREMENT}ms`,
      );
    })
    .join("");

  const normalizedStats = data.stats.map((s) => ({
    ...s,
    count: Math.max(0, s.count),
  }));
  const totalForPie = normalizedStats.reduce((acc, s) => acc + s.count, 0) || 1;
  const statsContentWithPie = data.stats
    .map((stat, index) => {
      const isFavorite = showFavorites && data.favorites?.includes(stat.name);
      const heartLegendSVG = heartSVG.replace('x="-18"', 'x="-36"');
      const fillColor = getStatColor(
        index,
        stat.name,
        statBaseCircleColor,
        data.fixedStatusColors && data.format.endsWith("Statuses"),
      );
      const pct = ((Math.max(0, stat.count) / totalForPie) * 100).toFixed(0);
      const pctSuffix = data.showPiePercentages ? ` (${pct}%)` : "";
      const content =
        `${isFavorite ? heartLegendSVG : ""}` +
        createRectElement(-20, 2, 12, 12, { fill: fillColor }) +
        createTextElement(0, 12.5, `${stat.name}:`, "stat") +
        createTextElement(
          POSITIONING.STAT_VALUE_X_LARGE,
          12.5,
          `${stat.count}${pctSuffix}`,
          "stat",
        );

      return createStaggeredGroup(
        `translate(0, ${index * SPACING.ROW_HEIGHT})`,
        content,
        `${ANIMATION.BASE_DELAY + index * ANIMATION.STAGGER_INCREMENT}ms`,
      );
    })
    .join("");

  const pieChartContent = (() => {
    const statsForPie = data.stats.map((stat, index) => ({
      ...stat,
      index,
      count: Math.max(0, stat.count),
    }));
    const total = statsForPie.reduce((acc, stat) => acc + stat.count, 0);
    let currentAngle = 0;
    if (total <= 0) {
      const cx = 40,
        cy = 40,
        r = 40;
      const fillColor = getStatColor(
        0,
        "no-data",
        statBaseCircleColor,
        data.fixedStatusColors && data.format.endsWith("Statuses"),
      );
      return `
        <circle
          cx="${cx}"
          cy="${cy}"
          r="${r}"
          fill="${fillColor}"
          stroke="${resolvedColors.backgroundColor}"
          stroke-width="1.5"
          class="stagger"
          style="animation-delay: ${ANIMATION.BASE_DELAY}ms"
        />
      `;
    }
    return statsForPie
      .filter((s) => s.count > 0)
      .map((stat) => {
        const angle = (stat.count / total) * 360;
        const startAngle = currentAngle;
        currentAngle += angle;

        const cx = 40,
          cy = 40,
          r = 40;
        const startRadians = ((startAngle - 90) * Math.PI) / 180;
        const endRadians = ((currentAngle - 90) * Math.PI) / 180;
        const largeArc = angle > 180 ? 1 : 0;

        return `
              <path
                d="M ${cx} ${cy}
                  L ${cx + r * Math.cos(startRadians)} ${cy + r * Math.sin(startRadians)}
                  A ${r} ${r} 0 ${largeArc} 1 
                  ${cx + r * Math.cos(endRadians)} ${cy + r * Math.sin(endRadians)}
                  Z"
                fill="${getStatColor(
                  stat.index,
                  stat.name,
                  statBaseCircleColor,
                  data.fixedStatusColors && data.format.endsWith("Statuses"),
                )}"
                stroke="${resolvedColors.backgroundColor}"
                stroke-width="1.5"
                stroke-linejoin="round"
                class="stagger"
                style="animation-delay: ${ANIMATION.BASE_DELAY + stat.index * ANIMATION.STAGGER_INCREMENT}ms"
              />
            `;
      })
      .join("");
  })();

  const barsContent = isBar
    ? (() => {
        if (!data.stats || data.stats.length === 0) {
          return "";
        }

        const sanitizedCounts = data.stats.map((s) => Math.max(0, s.count));
        const maxCount = Math.max(1, ...sanitizedCounts);

        const hasRenderableBars = sanitizedCounts.some((c) => c > 0);
        if (!hasRenderableBars) {
          return "";
        }

        return data.stats
          .map((stat, index) => {
            const count = Math.max(0, stat.count);
            const barWidth = ((count / maxCount) * 140).toFixed(2);
            const isFavorite =
              showFavorites && data.favorites?.includes(stat.name);
            const fill = getColorByIndex(index, statBaseCircleColor);
            const w = Number(barWidth);
            const content =
              `${isFavorite ? heartSVG : ""}` +
              createTextElement(0, 12, `${stat.name}:`, "stat") +
              createRectElement(150, 2, w, 14, { rx: 3, fill }) +
              createTextElement(155 + w, 13, String(count), "stat");

            return createStaggeredGroup(
              `translate(0, ${index * SPACING.ROW_HEIGHT_LARGE})`,
              content,
              `${ANIMATION.BASE_DELAY + index * ANIMATION.SLOW_INCREMENT}ms`,
            );
          })
          .join("");
      })()
    : "";

  let mainStatsContent: string;
  if (isPie) {
    mainStatsContent = `
        <g transform="translate(45, 0)">
          ${statsContentWithPie}
        </g>
        <g transform="translate(240, 20)">
          ${pieChartContent}
        </g>
      `;
  } else if (isBar) {
    mainStatsContent = `<g transform="translate(25, 0)">${barsContent}</g>`;
  } else {
    mainStatsContent = statsContentWithoutPie;
  }

  return markTrustedSvg(`
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="${svgWidth}"
      height="${svgHeight}"
      viewBox="0 0 ${viewBoxWidth} ${svgHeight}"
      fill="none"
      role="img"
      aria-labelledby="desc-id"
    >
      ${gradientDefs ? `<defs>${gradientDefs}</defs>` : ""}
      <title id="title-id">${safeTitle}</title>
      <desc id="desc-id">
        ${data.stats.map((stat) => `${escapeForXml(stat.name)}: ${escapeForXml(stat.count)}`).join(", ")}
      </desc>
      <style>
        ${generateCommonStyles(resolvedColors, titleFontSize)}

        .stat.bold {
          fill: ${resolvedColors.textColor};
          font: 600 ${TYPOGRAPHY.STAT_SIZE}px 'Segoe UI', Ubuntu, Sans-Serif;
        }
      </style>
      ${generateCardBackground({ w: viewBoxWidth, h: svgHeight }, cardRadius, resolvedColors)}
      <g data-testid="card-title" transform="translate(25, 35)">
        <g transform="translate(0, 0)">
          <text x="0" y="0" class="header" data-testid="header">
            ${safeTitle}
          </text>
        </g>
      </g>
      <g data-testid="main-card-body" transform="translate(0, 55)">
        ${mainStatsContent}
      </g>
    </svg>
  `);
};

/**
 * Factory function to create format-specific template wrappers.
 * Accepts a format string (from displayNames) and returns a wrapper function.
 */
export function createExtraStatsTemplate(format: string) {
  return (
    input: Omit<Parameters<typeof extraAnimeMangaStatsTemplate>[0], "format">,
  ) => {
    return extraAnimeMangaStatsTemplate({ ...input, format });
  };
}

/**
 * Pre-configured template functions for all extra stats card types.
 * Maps card type names to their corresponding template functions.
 */
export const extraStatsTemplates = {
  animeGenres: createExtraStatsTemplate(displayNames["animeGenres"]),
  mangaGenres: createExtraStatsTemplate(displayNames["mangaGenres"]),
  animeTags: createExtraStatsTemplate(displayNames["animeTags"]),
  mangaTags: createExtraStatsTemplate(displayNames["mangaTags"]),
  animeStaff: createExtraStatsTemplate(displayNames["animeStaff"]),
  mangaStaff: createExtraStatsTemplate(displayNames["mangaStaff"]),
  animeStudios: createExtraStatsTemplate(displayNames["animeStudios"]),
  animeVoiceActors: createExtraStatsTemplate(displayNames["animeVoiceActors"]),
  animeStatusDistribution: createExtraStatsTemplate(
    displayNames["animeStatusDistribution"],
  ),
  mangaStatusDistribution: createExtraStatsTemplate(
    displayNames["mangaStatusDistribution"],
  ),
  animeFormatDistribution: createExtraStatsTemplate(
    displayNames["animeFormatDistribution"],
  ),
  mangaFormatDistribution: createExtraStatsTemplate(
    displayNames["mangaFormatDistribution"],
  ),
  animeCountry: createExtraStatsTemplate(displayNames["animeCountry"]),
  mangaCountry: createExtraStatsTemplate(displayNames["mangaCountry"]),
} as const;

export type ExtraStatsTemplateInput = Parameters<
  ReturnType<typeof createExtraStatsTemplate>
>[0];
