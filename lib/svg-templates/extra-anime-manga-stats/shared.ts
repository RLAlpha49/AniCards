/**
 * Shared SVG renderer for category-style anime and manga breakdown cards.
 *
 * Genres, tags, studios, status distributions, and similar cards all reuse this
 * file so the project can support several chart variants without duplicating the
 * same legend, sizing, and favorite-highlighting rules in every template.
 */
import { displayNames } from "@/lib/card-data";
import {
  buildSvgTextLengthAdjustAttributes,
  fitSvgSingleLineText,
  resolveSvgTitleTextFit,
} from "@/lib/pretext/runtime";
import {
  ANIMATION,
  getCardDimensions,
  getColorByIndex,
  getStatColor,
  POSITIONING,
  resolveCircleBaseColor,
  SPACING,
  TYPOGRAPHY,
} from "@/lib/svg-templates/common";
import { generateCardBackground } from "@/lib/svg-templates/common/base-template-utils";
import { generateCommonStyles } from "@/lib/svg-templates/common/style-generators";
import {
  createRectElement,
  createStaggeredGroup,
  createTextElement,
} from "@/lib/svg-templates/common/svg-primitives";
import type { ColorValue } from "@/lib/types/card";
import type { TrustedSVG } from "@/lib/types/svg";
import {
  escapeForXml,
  getCardBorderRadius,
  markTrustedSvg,
  processColorsForSVG,
} from "@/lib/utils";

interface RadarLabelLineFit {
  fontSize: number;
  naturalWidth: number;
  text: string;
  truncated: boolean;
}

interface WrappedRadarLabelFit {
  lineHeight: number;
  lines: RadarLabelLineFit[];
  maxLineWidth: number;
}

const MAX_RADAR_LABEL_CANDIDATES = 256;
const MAX_BARS_PER_COLUMN = 8;
const RADAR_CHART_HEIGHT = 154;
const RADAR_CHART_Y_OFFSET = 8;

// estimateRadarLabelWidth uses a lightweight heuristic because radar labels are
// measured repeatedly while fitting. `charWidthMultiplier` starts at 0.56,
// drops by 0.003 per `safeText` character to reflect tighter averages on longer
// labels, and clamps at 0.4 so the estimate does not collapse. The final
// return value is `safeText.length * fontSizePx * charWidthMultiplier`, which
// approximates pixel width well enough for radar labels without a full canvas
// measurement.
function estimateRadarLabelWidth(text: string, fontSizePx: number): number {
  const safeText = String(text ?? "");
  if (!safeText) {
    return 0;
  }

  const charWidthMultiplier = Math.max(0.4, 0.56 - safeText.length * 0.003);
  return safeText.length * fontSizePx * charWidthMultiplier;
}

function buildRadarLabelCandidates(
  words: string[],
  lineCount: number,
  startIndex: number = 0,
  currentLines: string[] = [],
  maxCandidates: number = MAX_RADAR_LABEL_CANDIDATES,
): string[][] {
  if (lineCount <= 1) {
    return [[...currentLines, words.slice(startIndex).join(" ")]];
  }

  const candidates: string[][] = [];
  for (
    let splitIndex = startIndex + 1;
    splitIndex <= words.length - (lineCount - 1);
    splitIndex += 1
  ) {
    if (candidates.length >= maxCandidates) {
      return candidates;
    }

    const nextLine = words.slice(startIndex, splitIndex).join(" ");
    const childCandidates = buildRadarLabelCandidates(
      words,
      lineCount - 1,
      splitIndex,
      [...currentLines, nextLine],
      maxCandidates,
    );

    for (const candidate of childCandidates) {
      candidates.push(candidate);
      if (candidates.length >= maxCandidates) {
        return candidates;
      }
    }
  }

  return candidates;
}

type RadarSingleLineFitOptions = {
  fontWeight: number;
  initialFontSize: number;
  maxWidth: number;
  minFontSize: number;
  text: string;
};

function buildRadarLineFitCacheKey(options: RadarSingleLineFitOptions): string {
  return [
    options.text,
    options.initialFontSize,
    options.maxWidth,
    options.minFontSize,
    options.fontWeight,
    "shrink-then-truncate",
  ].join("\u0001");
}

/**
 * Build radar label layouts by enumerating candidate word groupings, using
 * provisional single-line fits to choose a shared font size, then re-fitting
 * each candidate with that uniform size so truncation, natural widths, and
 * wrapped line counts stay comparable. Results are cached for repeated
 * single-line fits and label-width estimates, and the search exits early once
 * it finds a zero-truncation layout at or above the initial font size.
 */
function fitRadarLabelLines(
  text: string,
  maxWidth: number,
): WrappedRadarLabelFit {
  const safeText = String(text ?? "").trim();
  const safeMaxWidth = Math.max(24, maxWidth);
  const words = safeText.split(/\s+/).filter(Boolean);
  const minFontSize = 6;
  const initialFontSize = 9;
  const singleLineFitCache = new Map<
    string,
    ReturnType<typeof fitSvgSingleLineText>
  >();
  const labelWidthCache = new Map<string, number>();

  function getRadarSingleLineFit(options: RadarSingleLineFitOptions) {
    const cacheKey = buildRadarLineFitCacheKey(options);
    const cachedFit = singleLineFitCache.get(cacheKey);

    if (cachedFit !== undefined) {
      return cachedFit;
    }

    const fit = fitSvgSingleLineText({
      fontWeight: options.fontWeight,
      initialFontSize: options.initialFontSize,
      maxWidth: options.maxWidth,
      minFontSize: options.minFontSize,
      mode: "shrink-then-truncate",
      text: options.text,
    });

    singleLineFitCache.set(cacheKey, fit);
    return fit;
  }

  function getRadarLabelWidth(text: string, fontSizePx: number): number {
    const cacheKey = `${text}\u0001${fontSizePx}`;
    const cachedWidth = labelWidthCache.get(cacheKey);

    if (cachedWidth !== undefined) {
      return cachedWidth;
    }

    const width = estimateRadarLabelWidth(text, fontSizePx);
    labelWidthCache.set(cacheKey, width);
    return width;
  }

  const candidateLineGroups = (() => {
    if (words.length <= 1) {
      return [[safeText]];
    }

    const groups = new Map<string, string[]>();
    groups.set(safeText, [safeText]);

    for (
      let lineCount = 2;
      lineCount <= Math.min(3, words.length);
      lineCount += 1
    ) {
      for (const lines of buildRadarLabelCandidates(words, lineCount)) {
        groups.set(lines.join("\u0000"), lines);
      }
    }

    return [...groups.values()];
  })();

  let bestFit: WrappedRadarLabelFit | null = null;
  let bestTruncationCount = Number.POSITIVE_INFINITY;
  let bestUniformFontSize = Number.NEGATIVE_INFINITY;

  for (const candidateLines of candidateLineGroups) {
    const provisionalFits = candidateLines.map((line) =>
      getRadarSingleLineFit({
        fontWeight: 500,
        initialFontSize,
        maxWidth: safeMaxWidth,
        minFontSize,
        text: line,
      }),
    );
    const uniformFontSize = Math.min(
      ...provisionalFits.map((fit) => fit?.fontSize ?? initialFontSize),
    );
    const finalFits = candidateLines.map((line) => {
      const fittedLine = getRadarSingleLineFit({
        fontWeight: 500,
        initialFontSize: uniformFontSize,
        maxWidth: safeMaxWidth,
        minFontSize,
        text: line,
      });
      const fallbackText = fittedLine?.text ?? line;
      const fallbackFontSize = fittedLine?.fontSize ?? uniformFontSize;
      const fallbackWidth = Math.min(
        safeMaxWidth,
        fittedLine?.naturalWidth ??
          getRadarLabelWidth(fallbackText, fallbackFontSize),
      );

      return {
        fontSize: fallbackFontSize,
        naturalWidth: fallbackWidth,
        text: fallbackText,
        truncated: fittedLine?.truncated ?? fallbackText.trim() !== line.trim(),
      } satisfies RadarLabelLineFit;
    });
    const truncationCount = finalFits.filter((fit) => fit.truncated).length;

    if (
      truncationCount > bestTruncationCount ||
      (truncationCount === bestTruncationCount &&
        uniformFontSize < bestUniformFontSize - 0.01)
    ) {
      continue;
    }

    if (
      truncationCount < bestTruncationCount ||
      uniformFontSize > bestUniformFontSize + 0.01 ||
      bestFit === null ||
      candidateLines.length < bestFit.lines.length
    ) {
      bestFit = {
        lineHeight: Math.max(8, uniformFontSize + 1.75),
        lines: finalFits.map((fit) => ({
          ...fit,
          fontSize: uniformFontSize,
        })),
        maxLineWidth: Math.max(...finalFits.map((fit) => fit.naturalWidth)),
      };
      bestTruncationCount = truncationCount;
      bestUniformFontSize = uniformFontSize;

      if (truncationCount === 0 && uniformFontSize >= initialFontSize - 0.01) {
        break;
      }
    }
  }

  if (bestFit) {
    return bestFit;
  }

  return {
    lineHeight: initialFontSize + 2,
    lines: [
      {
        fontSize: initialFontSize,
        naturalWidth: Math.min(
          safeMaxWidth,
          getRadarLabelWidth(safeText, initialFontSize),
        ),
        text: safeText,
        truncated: false,
      },
    ],
    maxLineWidth: Math.min(
      safeMaxWidth,
      getRadarLabelWidth(safeText, initialFontSize),
    ),
  };
}

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
  const animationsEnabled =
    (data.styles as { animate?: boolean }).animate !== false;

  // Determine variant flags
  const isPie = data.showPieChart || data.variant === "pie";
  const isDonut = data.variant === "donut";
  const isBar = data.variant === "bar";
  const isRadar = data.variant === "radar";
  const isPieLike = isPie || isDonut;
  const showPercentages = isPieLike && !!data.showPiePercentages;

  const svgDims = (() => {
    if (isPie) return getCardDimensions("extraStats", "pie");
    if (isDonut) return getCardDimensions("extraStats", "donut");
    if (isBar) return getCardDimensions("extraStats", "bar");
    if (isRadar) return getCardDimensions("extraStats", "radar");
    return getCardDimensions("extraStats", "default");
  })();
  const svgWidth = svgDims.w;
  const viewBoxWidth = svgWidth;
  const baseHeight = svgDims.h;
  const cardRadius = getCardBorderRadius(data.styles.borderRadius);
  const titleMaxWidth = svgWidth - SPACING.CARD_PADDING * 2;
  const titleFit = resolveSvgTitleTextFit({
    maxWidth: titleMaxWidth,
    text: titleText,
  });
  const titleLengthAdjustAttrs = buildSvgTextLengthAdjustAttributes(titleFit, {
    initialFontSize: 18,
    maxWidth: titleMaxWidth,
  });
  const safeVisibleTitle = escapeForXml(titleFit.text);

  const BODY_Y = SPACING.CONTENT_Y;
  const bottomPad = SPACING.CARD_PADDING;

  const normalizedStats = data.stats.map((s) => ({
    ...s,
    count: Math.max(0, s.count),
  }));

  const barRowCount = (() => {
    if (!isBar || normalizedStats.length === 0) return 0;
    const sliced = normalizedStats.slice(0, MAX_BARS_PER_COLUMN);
    const hasRenderableBars = sliced.some((s) => s.count > 0);
    return hasRenderableBars ? sliced.length : 0;
  })();

  const bodyContentHeight = (() => {
    if (!normalizedStats.length) return 0;

    if (isBar) {
      return barRowCount > 0 ? barRowCount * SPACING.ROW_HEIGHT_LARGE : 0;
    }

    if (isPieLike) {
      const pieLikeChartHeight = 100;
      const legendHeight =
        normalizedStats.length > 0
          ? normalizedStats.length * SPACING.ROW_HEIGHT
          : 0;
      return Math.max(pieLikeChartHeight, legendHeight);
    }

    if (isRadar) {
      const radarChartHeight = RADAR_CHART_HEIGHT;
      const legendHeight =
        normalizedStats.length > 0
          ? normalizedStats.length * SPACING.ROW_HEIGHT
          : 0;
      return Math.max(radarChartHeight, legendHeight);
    }

    return normalizedStats.length > 0
      ? normalizedStats.length * SPACING.ROW_HEIGHT
      : 0;
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

  const totalForPie = normalizedStats.reduce((acc, s) => acc + s.count, 0) || 1;

  const radarLegendSafeRightX = isRadar
    ? 45 +
      Math.max(
        0,
        ...normalizedStats.map((stat) => {
          const pct = ((stat.count / totalForPie) * 100).toFixed(0);
          const pctSuffix = showPercentages ? ` (${pct}%)` : "";
          const labelText = `${stat.name}:`;
          const valueText = `${stat.count}${pctSuffix}`;
          const labelFit = fitSvgSingleLineText({
            fontWeight: 400,
            initialFontSize: TYPOGRAPHY.STAT_SIZE,
            maxWidth: POSITIONING.STAT_VALUE_X_LARGE - 12,
            minFontSize: 8,
            mode: "shrink-then-truncate",
            text: labelText,
          });
          const valueFit = fitSvgSingleLineText({
            fontWeight: 600,
            initialFontSize: TYPOGRAPHY.STAT_SIZE,
            maxWidth: 88,
            minFontSize: 8,
            mode: "shrink-then-truncate",
            text: valueText,
          });
          const labelRightEdge =
            labelFit?.naturalWidth ??
            estimateRadarLabelWidth(
              labelFit?.text ?? labelText,
              labelFit?.fontSize ?? TYPOGRAPHY.STAT_SIZE,
            );
          const valueRightEdge =
            POSITIONING.STAT_VALUE_X_LARGE +
            (valueFit?.naturalWidth ??
              estimateRadarLabelWidth(
                valueFit?.text ?? valueText,
                valueFit?.fontSize ?? TYPOGRAPHY.STAT_SIZE,
              ));

          return Math.max(labelRightEdge, valueRightEdge);
        }),
      )
    : 0;
  const radarChartX = isRadar
    ? Math.max(svgWidth - 200, radarLegendSafeRightX + 24)
    : 0;
  const radarRightEdgeX = svgWidth - SPACING.CARD_PADDING;

  const statsContentWithoutPie = normalizedStats
    .map((stat, index) => {
      const isFavorite = showFavorites && data.favorites?.includes(stat.name);
      const labelText = `${stat.name}:`;
      const countText = String(stat.count);
      const defaultLabelMaxWidth = POSITIONING.STAT_VALUE_X_DEFAULT - 12;
      const labelFit = fitSvgSingleLineText({
        fontWeight: 600,
        initialFontSize: TYPOGRAPHY.STAT_SIZE,
        maxWidth: defaultLabelMaxWidth,
        minFontSize: 8,
        mode: "shrink-then-truncate",
        text: labelText,
      });
      const valueFit = fitSvgSingleLineText({
        fontWeight: 700,
        initialFontSize: TYPOGRAPHY.STAT_SIZE,
        maxWidth: 72,
        minFontSize: 8,
        mode: "shrink-then-truncate",
        text: countText,
      });
      const content =
        `${isFavorite ? heartSVG : ""}` +
        createTextElement(
          0,
          12.5,
          labelFit?.text ?? labelText,
          "stat bold",
          labelFit
            ? {
                fontSize: labelFit.fontSize,
                ...(labelFit.truncated ||
                labelFit.fontSize < TYPOGRAPHY.STAT_SIZE - 0.25 ||
                labelFit.naturalWidth > defaultLabelMaxWidth - 0.25
                  ? {
                      lengthAdjust: "spacingAndGlyphs" as const,
                      textLength: defaultLabelMaxWidth,
                    }
                  : {}),
              }
            : undefined,
        ) +
        createTextElement(
          POSITIONING.STAT_VALUE_X_DEFAULT,
          12.5,
          valueFit?.text ?? countText,
          "stat bold",
          valueFit ? { fontSize: valueFit.fontSize } : undefined,
        );

      return createStaggeredGroup(
        `translate(${SPACING.CARD_PADDING}, ${index * SPACING.ROW_HEIGHT})`,
        content,
        `${ANIMATION.BASE_DELAY + index * ANIMATION.STAGGER_INCREMENT}ms`,
      );
    })
    .join("");

  const statsContentWithPie = normalizedStats
    .map((stat, index) => {
      const isFavorite = showFavorites && data.favorites?.includes(stat.name);
      const heartLegendSVG = heartSVG.replace('x="-18"', 'x="-36"');
      const fillColor = getStatColor(
        index,
        stat.name,
        statBaseCircleColor,
        data.fixedStatusColors && data.format.endsWith("Statuses"),
      );
      const pct = ((stat.count / totalForPie) * 100).toFixed(0);
      const pctSuffix = showPercentages ? ` (${pct}%)` : "";
      const labelText = `${stat.name}:`;
      const valueText = `${stat.count}${pctSuffix}`;
      const legendLabelMaxWidth = POSITIONING.STAT_VALUE_X_LARGE - 12;
      const labelFit = fitSvgSingleLineText({
        fontWeight: 400,
        initialFontSize: TYPOGRAPHY.STAT_SIZE,
        maxWidth: legendLabelMaxWidth,
        minFontSize: 8,
        mode: "shrink-then-truncate",
        text: labelText,
      });
      const valueFit = fitSvgSingleLineText({
        fontWeight: 600,
        initialFontSize: TYPOGRAPHY.STAT_SIZE,
        maxWidth: 88,
        minFontSize: 8,
        mode: "shrink-then-truncate",
        text: valueText,
      });
      const content =
        `${isFavorite ? heartLegendSVG : ""}` +
        createRectElement(-20, 2, 12, 12, { fill: fillColor }) +
        createTextElement(0, 12.5, labelFit?.text ?? labelText, "stat", {
          ...(labelFit
            ? {
                fontSize: labelFit.fontSize,
                ...(labelFit.truncated ||
                labelFit.fontSize < TYPOGRAPHY.STAT_SIZE - 0.25 ||
                labelFit.naturalWidth > legendLabelMaxWidth - 0.25
                  ? {
                      lengthAdjust: "spacingAndGlyphs" as const,
                      textLength: legendLabelMaxWidth,
                    }
                  : {}),
              }
            : {}),
        }) +
        createTextElement(
          POSITIONING.STAT_VALUE_X_LARGE,
          12.5,
          valueFit?.text ?? valueText,
          "stat",
          valueFit ? { fontSize: valueFit.fontSize } : undefined,
        );

      return createStaggeredGroup(
        `translate(0, ${index * SPACING.ROW_HEIGHT})`,
        content,
        `${ANIMATION.BASE_DELAY + index * ANIMATION.STAGGER_INCREMENT}ms`,
      );
    })
    .join("");

  const pieChartContent = (() => {
    const statsForPie = normalizedStats.map((stat, index) => ({
      ...stat,
      index,
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
    const statsForDonut = normalizedStats.map((stat, index) => ({
      ...stat,
      index,
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
      const totalFit = fitSvgSingleLineText({
        fontWeight: 700,
        initialFontSize: 14,
        maxWidth: innerR * 2,
        minFontSize: 8,
        mode: "shrink-then-truncate",
        text: "0",
      });
      const labelFit = fitSvgSingleLineText({
        fontWeight: 400,
        initialFontSize: 14,
        maxWidth: innerR * 2,
        minFontSize: 8,
        mode: "shrink-then-truncate",
        text: "Total",
      });
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
        <text x="${cx}" y="${cy}" text-anchor="middle" class="donut-total"${totalFit ? ` font-size="${totalFit.fontSize}"` : ""}>${escapeForXml(totalFit?.text ?? "0")}</text>
        <text x="${cx}" y="${cy + 15}" text-anchor="middle" class="donut-label"${labelFit ? ` font-size="${labelFit.fontSize}"` : ""}>${escapeForXml(labelFit?.text ?? "Total")}</text>
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

    const totalText = String(total);
    const totalFit = fitSvgSingleLineText({
      fontWeight: 700,
      initialFontSize: 14,
      maxWidth: innerR * 2,
      minFontSize: 8,
      mode: "shrink-then-truncate",
      text: totalText,
    });
    const labelFit = fitSvgSingleLineText({
      fontWeight: 400,
      initialFontSize: 14,
      maxWidth: innerR * 2,
      minFontSize: 8,
      mode: "shrink-then-truncate",
      text: "Total",
    });

    return `
      ${slices}
      <text x="${cx}" y="${cy}" text-anchor="middle" class="donut-total"${totalFit ? ` font-size="${totalFit.fontSize}"` : ""}>${escapeForXml(totalFit?.text ?? totalText)}</text>
      <text x="${cx}" y="${cy + 15}" text-anchor="middle" class="donut-label"${labelFit ? ` font-size="${labelFit.fontSize}"` : ""}>${escapeForXml(labelFit?.text ?? "Total")}</text>
    `;
  })();

  const radarChartContent = (() => {
    const statsForRadar = normalizedStats.map((stat, index) => ({
      ...stat,
      index,
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

    const axisPoints = statsForRadar.map((s, i) => {
      const angle = startAngle + i * step;
      const ax = cx + R * Math.cos(angle);
      const ay = cy + R * Math.sin(angle);
      const r = (s.count / maxCount) * R;
      const px = cx + r * Math.cos(angle);
      const py = cy + r * Math.sin(angle);

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

      const labelMargin = 10;
      const baseLabelMaxWidth = 88;
      const svgLabelX = radarChartX + lx;
      const availableLeftWidth = Math.max(
        24,
        svgLabelX - radarLegendSafeRightX - labelMargin,
      );
      const availableRightWidth = Math.max(
        24,
        radarRightEdgeX - svgLabelX - labelMargin,
      );
      const labelMaxWidth = (() => {
        if (anchor === "start") {
          return Math.max(24, Math.min(baseLabelMaxWidth, availableRightWidth));
        }

        if (anchor === "end") {
          return Math.max(24, Math.min(baseLabelMaxWidth, availableLeftWidth));
        }

        return Math.max(
          24,
          Math.min(
            baseLabelMaxWidth,
            Math.min(availableLeftWidth, availableRightWidth) * 2,
          ),
        );
      })();
      const wrappedLabelFit = fitRadarLabelLines(s.name, labelMaxWidth);
      const clampedSvgLabelX = (() => {
        if (anchor === "start") {
          return Math.min(
            svgLabelX,
            radarRightEdgeX - labelMargin - wrappedLabelFit.maxLineWidth,
          );
        }

        if (anchor === "end") {
          return Math.max(
            svgLabelX,
            radarLegendSafeRightX + labelMargin + wrappedLabelFit.maxLineWidth,
          );
        }

        const half = wrappedLabelFit.maxLineWidth / 2;
        return Math.max(
          radarLegendSafeRightX + labelMargin + half,
          Math.min(radarRightEdgeX - labelMargin - half, svgLabelX),
        );
      })();

      return {
        i,
        angle,
        ax,
        ay,
        px,
        py,
        lines: wrappedLabelFit.lines,
        lineHeight: wrappedLabelFit.lineHeight,
        lx: clampedSvgLabelX - radarChartX,
        ly,
        anchor,
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
          normalizedStats[p.i]?.name ?? "",
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
        const startY = p.ly - ((p.lines.length - 1) * p.lineHeight) / 2;
        return `
          <text x="${p.lx.toFixed(2)}" text-anchor="${p.anchor}" class="radar-label stagger" style="animation-delay: ${ANIMATION.BASE_DELAY + idx * ANIMATION.STAGGER_INCREMENT}ms">${p.lines
            .map((line, lineIndex) => {
              const lineText = escapeForXml(line.text);
              if (lineIndex === 0) {
                return `<tspan x="${p.lx.toFixed(2)}" y="${startY.toFixed(2)}" font-size="${line.fontSize}">${lineText}</tspan>`;
              }

              return `<tspan x="${p.lx.toFixed(2)}" dy="${p.lineHeight.toFixed(2)}" font-size="${line.fontSize}">${lineText}</tspan>`;
            })
            .join("")}</text>
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
        if (!normalizedStats || normalizedStats.length === 0) {
          return "";
        }

        const renderableStats = normalizedStats
          .filter((stat) => stat.count > 0)
          .slice(0, MAX_BARS_PER_COLUMN);

        if (renderableStats.length === 0) {
          return "";
        }

        const renderableCounts = renderableStats.map((s) => s.count);
        const maxCount = Math.max(1, ...renderableCounts);

        const labelToBarGap = 6;
        const barToCountGap = 10;
        const minBarW = 20;
        const barRightPadding = 10;

        const rows = renderableStats.map((stat, index) => {
          const count = stat.count;
          const isFavorite =
            showFavorites && data.favorites?.includes(stat.name);
          const fill = getColorByIndex(index, statBaseCircleColor);
          const labelText = `${stat.name}:`;
          const countText = String(count);
          const countFit = fitSvgSingleLineText({
            fontWeight: 600,
            initialFontSize: TYPOGRAPHY.STAT_SIZE,
            maxWidth: Math.max(24, svgWidth - 25),
            minFontSize: 8,
            mode: "shrink-then-truncate",
            text: countText,
          });

          return {
            count,
            countFit,
            countText,
            countW: countFit?.naturalWidth ?? 0,
            fill,
            index,
            isFavorite,
            labelText,
          };
        });

        const maxCountW = Math.max(0, ...rows.map((row) => row.countW));
        const maxLabelSlotWidth = Math.max(
          24,
          Math.floor(
            svgWidth - 25 - maxCountW - labelToBarGap - barToCountGap - minBarW,
          ),
        );
        const fittedRows = rows.map((row) => {
          const labelFit = fitSvgSingleLineText({
            fontWeight: 400,
            initialFontSize: TYPOGRAPHY.STAT_SIZE,
            maxWidth: maxLabelSlotWidth,
            minFontSize: 8,
            mode: "shrink-then-truncate",
            text: row.labelText,
          });

          return {
            ...row,
            labelFit,
            labelW: labelFit?.naturalWidth ?? 0,
          };
        });

        const widestLabelWidth = Math.min(
          maxLabelSlotWidth,
          Math.max(0, ...fittedRows.map((row) => row.labelW)),
        );
        const barStartX = Math.max(
          24,
          Math.ceil(widestLabelWidth + labelToBarGap),
        );
        const maxBarW = Math.max(
          minBarW,
          Math.floor(
            svgWidth -
              25 -
              barStartX -
              maxCountW -
              barToCountGap -
              barRightPadding,
          ),
        );

        return fittedRows
          .map((row) => {
            const labelFit = row.labelFit;
            const fittedCount = row.countFit;
            const w = Math.min(
              maxBarW,
              Math.max(2, Math.round((row.count / maxCount) * maxBarW)),
            );
            const countX = barStartX + w + barToCountGap;
            const content =
              `${row.isFavorite ? heartSVG : ""}` +
              createTextElement(
                0,
                12,
                labelFit?.text ?? row.labelText,
                "stat",
                {
                  ...(labelFit
                    ? {
                        fontSize: labelFit.fontSize,
                        ...(labelFit.truncated ||
                        labelFit.fontSize < TYPOGRAPHY.STAT_SIZE - 0.25 ||
                        labelFit.naturalWidth > widestLabelWidth - 0.25
                          ? {
                              lengthAdjust: "spacingAndGlyphs" as const,
                              textLength: widestLabelWidth,
                            }
                          : {}),
                      }
                    : {}),
                },
              ) +
              createRectElement(barStartX, 2, w, 14, {
                rx: 3,
                fill: row.fill,
              }) +
              createTextElement(
                countX,
                13,
                fittedCount?.text ?? row.countText,
                "stat",
                {
                  ...(fittedCount
                    ? { fontSize: fittedCount.fontSize, fontWeight: 600 }
                    : { fontWeight: 600 }),
                },
              );

            return createStaggeredGroup(
              `translate(0, ${row.index * SPACING.ROW_HEIGHT_LARGE})`,
              content,
              `${ANIMATION.BASE_DELAY + row.index * ANIMATION.SLOW_INCREMENT}ms`,
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
    mainStatsContent = `
        <g transform="translate(45, 0)">
          ${statsContentWithPie}
        </g>
        <g transform="translate(${radarChartX}, ${RADAR_CHART_Y_OFFSET})">
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
        ${normalizedStats.map((stat) => `${escapeForXml(stat.name)}: ${String(stat.count)}`).join(", ")}
      </desc>
      <style>
        ${generateCommonStyles(resolvedColors, titleFit.fontSize, { includeAnimations: animationsEnabled })}

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
          <text x="0" y="0" class="header" data-testid="header"${titleLengthAdjustAttrs}>
            ${safeVisibleTitle}
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
  animeEpisodeLengthPreferences: createExtraStatsTemplate(
    displayNames["animeEpisodeLengthPreferences"],
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
