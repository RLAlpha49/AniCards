import type { ColorValue } from "@/lib/types/card";
import type { TrustedSVG } from "@/lib/types/svg";

import {
  ANIMATION,
  SHAPES,
  SPACING,
  TYPOGRAPHY,
  getCardDimensions,
  estimateCardTextWidth,
  fitCardFontSize,
  type CardFontWeight,
} from "@/lib/svg-templates/common";
import { generateCardBackground } from "@/lib/svg-templates/common/base-template-utils";
import { generateCommonStyles } from "@/lib/svg-templates/common/style-generators";
import {
  createRectElement,
  createStaggeredGroup,
  createTextElement,
} from "@/lib/svg-templates/common/svg-primitives";
import { calculateDynamicFontSize } from "@/lib/svg-templates/common/text-metrics";
import { escapeForXml, markTrustedSvg } from "@/lib/svg-markup";
import { getCardBorderRadius } from "@/lib/card-style";
import { processColorsForSVG } from "@/lib/color/gradients";

export type ComparativeMetricRow = {
  label: string;
  value: string;
};

export type ComparativeBarRow = {
  label: string;
  count: number;
};

export interface ComparativeTwoColumnTemplateInput {
  /** Card type key used to resolve dimensions. */
  cardType: Parameters<typeof getCardDimensions>[0];
  username: string;
  title: string;
  variant?: string;
  styles: {
    titleColor: ColorValue;
    backgroundColor: ColorValue;
    textColor: ColorValue;
    circleColor: ColorValue;
    borderColor?: ColorValue;
    borderRadius?: number;
  };
  left: {
    title: string;
    metrics?: ComparativeMetricRow[];
    bars?: ComparativeBarRow[];
  };
  right: {
    title: string;
    metrics?: ComparativeMetricRow[];
    bars?: ComparativeBarRow[];
  };
}

const MAX_BARS_PER_COLUMN = 8;

function countRenderableBars(bars: ComparativeBarRow[]): number {
  return Math.min(
    MAX_BARS_PER_COLUMN,
    bars.filter((b) => typeof b.label === "string" && b.label.trim().length > 0)
      .length,
  );
}

function estimateColumnBodyHeight(
  metricsCount: number,
  barsCount: number,
  sectionStartY: number,
  metricsGap: number,
): number {
  const safeMetricsCount = Math.max(0, metricsCount);
  const safeBarsCount = Math.max(0, Math.min(MAX_BARS_PER_COLUMN, barsCount));

  const metricsHeight =
    safeMetricsCount > 0 ? safeMetricsCount * SPACING.ROW_HEIGHT_COMPACT : 0;
  const barsHeight =
    safeBarsCount > 0 ? (safeBarsCount - 1) * SPACING.ITEM_GAP + 12 : 0;
  const gapBetween = safeMetricsCount > 0 && safeBarsCount > 0 ? metricsGap : 0;

  return sectionStartY + metricsHeight + gapBetween + barsHeight;
}

function formatInt(n: number | undefined | null): string {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : 0;
  return v.toLocaleString("en-US");
}

function estimateTextWidthPx(
  text: string,
  fontSizePx: number,
  weight: CardFontWeight = 400,
): number {
  return estimateCardTextWidth(text, fontSizePx, weight);
}

/**
 * Render `text` inside `maxWidth`, shrinking the font size when it overflows.
 *
 * The previous implementation wrapped the text in `scale(sx, 1)`, which
 * compresses glyph advances horizontally and visibly warps letters. Scaling the
 * font size keeps glyph proportions intact.
 *
 * The size is emitted as an inline `style`, not a `font-size` attribute:
 * presentation attributes lose to the stylesheet's `font:` shorthand, so an
 * attribute would be silently ignored.
 * @source
 */
export function renderFittedText(
  x: number,
  y: number,
  text: string,
  className: string,
  maxWidth: number,
  fontSize: number,
  textAnchor?: "end",
  weight: CardFontWeight = 600,
): string {
  const fittedSize = fitCardFontSize(
    text,
    maxWidth,
    fontSize,
    weight,
    fontSize * 0.6,
  );
  const element = createTextElement(x, y, text, className, { textAnchor });
  if (fittedSize >= fontSize) return element;
  return element.replace(
    "<text ",
    `<text style="font-size:${fittedSize.toFixed(2)}px" `,
  );
}

function renderMetricsBlock(
  metrics: ComparativeMetricRow[],
  colW: number,
): string {
  return metrics
    .map((m, i) => {
      const valueWidth = Math.min(
        estimateTextWidthPx(m.value, TYPOGRAPHY.STAT_VALUE_SIZE),
        colW * 0.72,
      );
      const labelWidth = colW - valueWidth - 8;
      const content =
        renderFittedText(
          0,
          12,
          m.label,
          "stat",
          labelWidth,
          TYPOGRAPHY.STAT_SIZE,
        ) +
        renderFittedText(
          colW,
          12,
          m.value,
          "stat-value",
          valueWidth,
          TYPOGRAPHY.STAT_VALUE_SIZE,
          "end",
        );

      return createStaggeredGroup(
        `translate(0, ${i * SPACING.ROW_HEIGHT_COMPACT})`,
        content,
        `${ANIMATION.BASE_DELAY + i * ANIMATION.FAST_INCREMENT}ms`,
      );
    })
    .join("");
}

function renderBarsBlock(
  bars: ComparativeBarRow[],
  colW: number,
  barColor: string,
): string {
  const sanitized = bars
    .map((b) => ({
      label: b.label,
      count:
        typeof b.count === "number" && Number.isFinite(b.count) ? b.count : 0,
    }))
    .filter((b) => b.label.trim().length > 0);

  const maxCount = Math.max(1, ...sanitized.map((b) => b.count));
  const labelToBarGap = 8;
  const barToCountGap = 8;
  const minBarW = 20;

  const rows = sanitized.slice(0, MAX_BARS_PER_COLUMN).map((b) => {
    const countText = formatInt(b.count);
    const labelW = estimateTextWidthPx(b.label, TYPOGRAPHY.STAT_SIZE);
    const countW = estimateTextWidthPx(countText, TYPOGRAPHY.STAT_SIZE);
    return { ...b, countText, labelW, countW };
  });

  const maxLabelW = Math.max(0, ...rows.map((r) => r.labelW));
  const maxCountW = Math.min(
    Math.max(0, ...rows.map((r) => r.countW)),
    colW * 0.35,
  );
  const labelWidth = Math.min(
    maxLabelW,
    colW - maxCountW - labelToBarGap - barToCountGap - minBarW,
  );
  const barStartX = Math.ceil(labelWidth + labelToBarGap);
  const maxBarW = Math.max(
    minBarW,
    Math.floor(colW - maxCountW - barToCountGap - barStartX),
  );

  return rows
    .map((b, i) => {
      const w = Math.min(
        maxBarW,
        Math.max(2, Math.round((Math.max(0, b.count) / maxCount) * maxBarW)),
      );
      const content =
        renderFittedText(
          0,
          12,
          b.label,
          "stat",
          labelWidth,
          TYPOGRAPHY.STAT_SIZE,
        ) +
        createRectElement(barStartX, 4, maxBarW, SHAPES.BAR_HEIGHT_SMALL, {
          rx: SHAPES.BAR_RADIUS,
          fill: barColor,
          opacity: 0.16,
        }) +
        createRectElement(barStartX, 4, w, SHAPES.BAR_HEIGHT_SMALL, {
          rx: SHAPES.BAR_RADIUS,
          fill: barColor,
        }) +
        renderFittedText(
          colW,
          12,
          b.countText,
          "stat",
          maxCountW,
          TYPOGRAPHY.STAT_SIZE,
          "end",
        );

      return createStaggeredGroup(
        `translate(0, ${i * SPACING.ITEM_GAP})`,
        content,
        `${ANIMATION.CHART_BASE_DELAY + i * ANIMATION.CHART_INCREMENT}ms`,
      );
    })
    .join("");
}

export function comparativeTwoColumnTemplate(
  input: ComparativeTwoColumnTemplateInput,
): TrustedSVG {
  const { username, title, styles, variant = "default" } = input;
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

  const baseDims = getCardDimensions(input.cardType, variant);
  const cardRadius = getCardBorderRadius(styles.borderRadius);

  const fullTitle = `${username}'s ${title}`;
  const safeTitle = escapeForXml(fullTitle);
  const headerFontSize =
    Number.parseFloat(
      calculateDynamicFontSize(fullTitle, 18, baseDims.w - 40),
    ) || TYPOGRAPHY.HEADER_SIZE;

  const padding = SPACING.CARD_PADDING;
  const colGap = 20;
  const colW = (baseDims.w - padding * 2 - colGap) / 2;
  const col1X = padding;
  const col2X = padding + colW + colGap;

  const metricsGap = 10;
  const sectionTitleY = 12;
  const sectionStartY = 26;

  const leftMetrics = input.left.metrics ?? [];
  const rightMetrics = input.right.metrics ?? [];
  const leftBars = input.left.bars ?? [];
  const rightBars = input.right.bars ?? [];

  const leftBarsCount = countRenderableBars(leftBars);
  const rightBarsCount = countRenderableBars(rightBars);
  const leftBodyHeight = estimateColumnBodyHeight(
    leftMetrics.length,
    leftBarsCount,
    sectionStartY,
    metricsGap,
  );
  const rightBodyHeight = estimateColumnBodyHeight(
    rightMetrics.length,
    rightBarsCount,
    sectionStartY,
    metricsGap,
  );

  const minRequiredHeight =
    SPACING.CONTENT_Y +
    Math.max(leftBodyHeight, rightBodyHeight) +
    SPACING.CARD_PADDING;

  const dims = {
    ...baseDims,
    h: Math.max(baseDims.h, minRequiredHeight),
  };

  const leftMetricsBlock = leftMetrics.length
    ? `<g transform="translate(0, ${sectionStartY})">${renderMetricsBlock(leftMetrics, colW)}</g>`
    : "";

  const rightMetricsBlock = rightMetrics.length
    ? `<g transform="translate(0, ${sectionStartY})">${renderMetricsBlock(rightMetrics, colW)}</g>`
    : "";

  const leftBarsY =
    sectionStartY +
    (leftMetrics.length ? leftMetrics.length * SPACING.ROW_HEIGHT_COMPACT : 0) +
    (leftMetrics.length && leftBars.length ? metricsGap : 0);
  const rightBarsY =
    sectionStartY +
    (rightMetrics.length
      ? rightMetrics.length * SPACING.ROW_HEIGHT_COMPACT
      : 0) +
    (rightMetrics.length && rightBars.length ? metricsGap : 0);

  const leftBarsBlock = leftBars.length
    ? `<g transform="translate(0, ${leftBarsY})">${renderBarsBlock(leftBars, colW, resolvedColors.circleColor)}</g>`
    : "";
  const rightBarsBlock = rightBars.length
    ? `<g transform="translate(0, ${rightBarsY})">${renderBarsBlock(rightBars, colW, resolvedColors.titleColor)}</g>`
    : "";

  const leftEmpty =
    !leftMetrics.length && !leftBars.length
      ? `<text class="stat" x="0" y="${sectionStartY + 12}">No data</text>`
      : "";
  const rightEmpty =
    !rightMetrics.length && !rightBars.length
      ? `<text class="stat" x="0" y="${sectionStartY + 12}">No data</text>`
      : "";

  return markTrustedSvg(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${dims.w}" height="${dims.h}" viewBox="0 0 ${dims.w} ${dims.h}" fill="none" role="img" aria-labelledby="title-id">
      ${gradientDefs ? `<defs>${gradientDefs}</defs>` : ""}
      <title id="title-id">${safeTitle}</title>
      <style>
        ${generateCommonStyles(resolvedColors, headerFontSize)}
        .col-title { fill: ${resolvedColors.textColor}; font: 700 ${TYPOGRAPHY.STAT_VALUE_SIZE}px 'Segoe UI', Ubuntu, Sans-Serif; }
      </style>
      ${generateCardBackground(dims, cardRadius, resolvedColors)}
      <g transform="translate(20, ${SPACING.HEADER_Y})" data-testid="card-title">
        ${renderFittedText(0, 0, fullTitle, "header", dims.w - 40, headerFontSize, undefined, 600)}
      </g>

      <g data-testid="main-card-body">
        ${createRectElement(dims.w / 2, SPACING.CONTENT_Y, 1, dims.h - SPACING.CONTENT_Y - padding, { fill: resolvedColors.textColor, opacity: 0.12 })}
        <g transform="translate(${col1X}, ${SPACING.CONTENT_Y})">
          ${createRectElement(0, 1, 3, 13, { rx: 1, fill: resolvedColors.circleColor })}
          ${renderFittedText(10, sectionTitleY, input.left.title, "col-title", colW - 10, TYPOGRAPHY.STAT_VALUE_SIZE)}
          ${createRectElement(0, 19, colW, 1, { fill: resolvedColors.circleColor, opacity: 0.35 })}
          ${leftMetricsBlock}
          ${leftBarsBlock}
          ${leftEmpty}
        </g>

        <g transform="translate(${col2X}, ${SPACING.CONTENT_Y})">
          ${createRectElement(0, 1, 3, 13, { rx: 1, fill: resolvedColors.titleColor })}
          ${renderFittedText(10, sectionTitleY, input.right.title, "col-title", colW - 10, TYPOGRAPHY.STAT_VALUE_SIZE)}
          ${createRectElement(0, 19, colW, 1, { fill: resolvedColors.titleColor, opacity: 0.35 })}
          ${rightMetricsBlock}
          ${rightBarsBlock}
          ${rightEmpty}
        </g>
      </g>
    </svg>
  `);
}
