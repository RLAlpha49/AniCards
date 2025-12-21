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
  variant?: "default" | "pie" | "donut" | "bar" | "radar";
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
  const isDonut = data.variant === "donut";
  const isBar = data.variant === "bar";
  const isRadar = data.variant === "radar";
  const isPieLike = isPie || isDonut;
  const showPercentages = isPieLike && !!data.showPiePercentages;

  let svgWidth: number;
  const svgDims = (() => {
    if (isPie) return getCardDimensions("extraStats", "pie");
    if (isDonut) return getCardDimensions("extraStats", "donut");
    if (isBar) return getCardDimensions("extraStats", "bar");
    if (isRadar) return getCardDimensions("extraStats", "radar");
    return getCardDimensions("extraStats", "default");
  })();
  svgWidth = svgDims.w;
  const viewBoxWidth = svgWidth;
  const baseHeight = svgDims.h;
  const cardRadius = getCardBorderRadius(data.styles.borderRadius);

  const BODY_Y = SPACING.CONTENT_Y;
  const bottomPad = SPACING.CARD_PADDING;

  const barRowCount = (() => {
    if (!isBar || !data.stats || data.stats.length === 0) return 0;
    const hasRenderableBars = data.stats.some((s) => Math.max(0, s.count) > 0);
    return hasRenderableBars ? data.stats.length : 0;
  })();

  const bodyContentHeight = (() => {
    if (!data.stats) return 0;

    if (isBar) {
      return barRowCount > 0 ? barRowCount * SPACING.ROW_HEIGHT_LARGE : 0;
    }

    if (isPieLike) {
      const pieLikeChartHeight = 100;
      const legendHeight =
        data.stats.length > 0 ? data.stats.length * SPACING.ROW_HEIGHT : 0;
      return Math.max(pieLikeChartHeight, legendHeight);
    }

    if (isRadar) {
      const radarChartHeight = 140;
      const legendHeight =
        data.stats.length > 0 ? data.stats.length * SPACING.ROW_HEIGHT : 0;
      return Math.max(radarChartHeight, legendHeight);
    }

    return data.stats.length > 0 ? data.stats.length * SPACING.ROW_HEIGHT : 0;
  })();

  const requiredHeight =
    bodyContentHeight > 0 ? BODY_Y + bodyContentHeight + bottomPad : baseHeight;

  const svgHeight = Math.max(baseHeight, requiredHeight);

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
      const pctSuffix = showPercentages ? ` (${pct}%)` : "";
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

  const donutChartContent = (() => {
    const statsForDonut = data.stats.map((stat, index) => ({
      ...stat,
      index,
      count: Math.max(0, stat.count),
    }));
    const total = statsForDonut.reduce((acc, stat) => acc + stat.count, 0);

    const cx = 40;
    const cy = 40;
    const outerR = 40;
    const innerR = 22;

    if (total <= 0) {
      const strokeColor = getStatColor(
        0,
        "no-data",
        statBaseCircleColor,
        data.fixedStatusColors && data.format.endsWith("Statuses"),
      );
      const ringR = (outerR + innerR) / 2;
      const ringW = outerR - innerR;
      return `
        <circle
          cx="${cx}"
          cy="${cy}"
          r="${ringR}"
          fill="none"
          stroke="${strokeColor}"
          stroke-width="${ringW}"
          stroke-linecap="butt"
          class="stagger"
          style="animation-delay: ${ANIMATION.BASE_DELAY}ms"
        />
        <text x="${cx}" y="${cy}" text-anchor="middle" class="donut-total">0</text>
        <text x="${cx}" y="${cy + 15}" text-anchor="middle" class="donut-label">Total</text>
      `;
    }

    let currentAngle = 0;
    const slices = statsForDonut
      .filter((s) => s.count > 0)
      .map((stat) => {
        const angle = (stat.count / total) * 360;
        const startAngle = currentAngle;
        currentAngle += angle;

        const startRadians = ((startAngle - 90) * Math.PI) / 180;
        const endRadians = ((currentAngle - 90) * Math.PI) / 180;
        const largeArc = angle > 180 ? 1 : 0;

        const ox1 = cx + outerR * Math.cos(startRadians);
        const oy1 = cy + outerR * Math.sin(startRadians);
        const ox2 = cx + outerR * Math.cos(endRadians);
        const oy2 = cy + outerR * Math.sin(endRadians);

        const ix1 = cx + innerR * Math.cos(startRadians);
        const iy1 = cy + innerR * Math.sin(startRadians);
        const ix2 = cx + innerR * Math.cos(endRadians);
        const iy2 = cy + innerR * Math.sin(endRadians);

        const fill = getStatColor(
          stat.index,
          stat.name,
          statBaseCircleColor,
          data.fixedStatusColors && data.format.endsWith("Statuses"),
        );

        return `
          <path
            d="M ${ox1} ${oy1}
              A ${outerR} ${outerR} 0 ${largeArc} 1 ${ox2} ${oy2}
              L ${ix2} ${iy2}
              A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix1} ${iy1}
              Z"
            fill="${fill}"
            stroke="${resolvedColors.backgroundColor}"
            stroke-width="1.2"
            stroke-linejoin="round"
            class="stagger"
            style="animation-delay: ${ANIMATION.BASE_DELAY + stat.index * ANIMATION.STAGGER_INCREMENT}ms"
          />
        `;
      })
      .join("");

    return `
      ${slices}
      <text x="${cx}" y="${cy}" text-anchor="middle" class="donut-total">${total}</text>
      <text x="${cx}" y="${cy + 15}" text-anchor="middle" class="donut-label">Total</text>
    `;
  })();

  const radarChartContent = (() => {
    const statsForRadar = data.stats.map((stat, index) => ({
      ...stat,
      index,
      count: Math.max(0, stat.count),
    }));

    const n = statsForRadar.length;
    if (n === 0) {
      return `<text x="70" y="70" text-anchor="middle" class="radar-empty">No data</text>`;
    }

    const maxCount = Math.max(1, ...statsForRadar.map((s) => s.count));
    const cx = 70;
    const cy = 70;
    const R = 55;
    const rings = 4;
    const startAngle = -Math.PI / 2;
    const step = (Math.PI * 2) / Math.max(1, n);

    const truncateLabel = (value: string, maxLen: number) => {
      const s = String(value ?? "");
      if (s.length <= maxLen) return s;
      return `${s.slice(0, Math.max(0, maxLen - 1))}…`;
    };

    const axisPoints = statsForRadar.map((s, i) => {
      const angle = startAngle + i * step;
      const ax = cx + R * Math.cos(angle);
      const ay = cy + R * Math.sin(angle);
      const r = (s.count / maxCount) * R;
      const px = cx + r * Math.cos(angle);
      const py = cy + r * Math.sin(angle);

      // Label placement
      const labelPad = 14;
      const lx = cx + (R + labelPad) * Math.cos(angle);
      const ly = cy + (R + labelPad) * Math.sin(angle);
      const cos = Math.cos(angle);
      let anchor: "start" | "middle" | "end" = "middle";
      if (cos > 0.35) {
        anchor = "start";
      } else if (cos < -0.35) {
        anchor = "end";
      }

      return {
        i,
        angle,
        ax,
        ay,
        px,
        py,
        lx,
        ly,
        anchor,
        label: truncateLabel(s.name, 14),
      };
    });

    const mkPointList = (radius: number) => {
      if (n < 3) return "";
      return axisPoints
        .map((p) => {
          const x = cx + radius * Math.cos(p.angle);
          const y = cy + radius * Math.sin(p.angle);
          return `${x.toFixed(2)},${y.toFixed(2)}`;
        })
        .join(" ");
    };

    const grid = (() => {
      if (n < 3) {
        return Array.from({ length: rings }, (_, idx) => {
          const rr = ((idx + 1) / rings) * R;
          return `<circle cx="${cx}" cy="${cy}" r="${rr.toFixed(2)}" class="radar-grid" />`;
        }).join("");
      }
      return Array.from({ length: rings }, (_, idx) => {
        const rr = ((idx + 1) / rings) * R;
        return `<polygon points="${mkPointList(rr)}" class="radar-grid" />`;
      }).join("");
    })();

    const axes = axisPoints
      .map(
        (p) =>
          `<line x1="${cx}" y1="${cy}" x2="${p.ax.toFixed(2)}" y2="${p.ay.toFixed(2)}" class="radar-axis" />`,
      )
      .join("");

    const valuePointsStr = axisPoints
      .map((p) => `${p.px.toFixed(2)},${p.py.toFixed(2)}`)
      .join(" ");

    const area =
      n >= 3
        ? `<polygon points="${valuePointsStr}" class="radar-area" />`
        : `<polyline points="${valuePointsStr}" class="radar-area" fill="none" />`;

    const vertices = axisPoints
      .map((p) => {
        const fill = getStatColor(
          p.i,
          data.stats[p.i]?.name ?? "",
          statBaseCircleColor,
          data.fixedStatusColors && data.format.endsWith("Statuses"),
        );
        return `
          <circle cx="${p.px.toFixed(2)}" cy="${p.py.toFixed(2)}" r="3" fill="${fill}" stroke="${resolvedColors.backgroundColor}" stroke-width="1" class="stagger" style="animation-delay: ${ANIMATION.BASE_DELAY + p.i * ANIMATION.STAGGER_INCREMENT}ms" />
        `;
      })
      .join("");

    const labels = axisPoints
      .map((p, idx) => {
        const safe = escapeForXml(p.label);
        return `
          <text x="${p.lx.toFixed(2)}" y="${p.ly.toFixed(2)}" text-anchor="${p.anchor}" dominant-baseline="central" class="radar-label stagger" style="animation-delay: ${ANIMATION.BASE_DELAY + idx * ANIMATION.STAGGER_INCREMENT}ms">${safe}</text>
        `;
      })
      .join("");

    return `
      <g>
        ${grid}
        ${axes}
        ${area}
        ${vertices}
        ${labels}
      </g>
    `;
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
  } else if (isDonut) {
    mainStatsContent = `
        <g transform="translate(45, 0)">
          ${statsContentWithPie}
        </g>
        <g transform="translate(240, 20)">
          ${donutChartContent}
        </g>
      `;
  } else if (isBar) {
    mainStatsContent = `<g transform="translate(25, 0)">${barsContent}</g>`;
  } else if (isRadar) {
    const radarChartX = Math.max(
      svgWidth - 250,
      POSITIONING.STAT_VALUE_X_LARGE + 135,
    );
    mainStatsContent = `
        <g transform="translate(45, 0)">
          ${statsContentWithPie}
        </g>
        <g transform="translate(${radarChartX}, -5)">
          ${radarChartContent}
        </g>
      `;
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

        .donut-total {
          fill: ${resolvedColors.textColor};
          font: 700 14px 'Segoe UI', Ubuntu, Sans-Serif;
        }

        .donut-label {
          fill: ${resolvedColors.textColor};
          opacity: 0.7;
          font: 400 10px 'Segoe UI', Ubuntu, Sans-Serif;
        }

        .radar-grid {
          fill: none;
          stroke: ${resolvedColors.textColor};
          opacity: 0.16;
          stroke-width: 1;
        }

        .radar-axis {
          stroke: ${resolvedColors.textColor};
          opacity: 0.18;
          stroke-width: 1;
        }

        .radar-area {
          stroke: ${resolvedColors.titleColor};
          stroke-width: 2;
          fill: ${resolvedColors.titleColor};
          fill-opacity: 0.16;
        }

        .radar-label {
          fill: ${resolvedColors.textColor};
          font: 500 9px 'Segoe UI', Ubuntu, Sans-Serif;
          opacity: 0.95;
        }

        .radar-empty {
          fill: ${resolvedColors.textColor};
          font: 600 12px 'Segoe UI', Ubuntu, Sans-Serif;
          opacity: 0.7;
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
      <g data-testid="main-card-body" transform="translate(0, ${BODY_Y})">
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
  animeSeasonalPreference: createExtraStatsTemplate(
    displayNames["animeSeasonalPreference"],
  ),
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
