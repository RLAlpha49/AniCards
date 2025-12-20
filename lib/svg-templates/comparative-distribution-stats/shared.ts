import type { ColorValue } from "@/lib/types/card";
import type { TrustedSVG } from "@/lib/types/svg";

import {
  ANIMATION,
  SHAPES,
  SPACING,
  TYPOGRAPHY,
  getCardDimensions,
} from "@/lib/svg-templates/common";
import { generateCardBackground } from "@/lib/svg-templates/common/base-template-utils";
import { generateCommonStyles } from "@/lib/svg-templates/common/style-generators";
import {
  createRectElement,
  createStaggeredGroup,
  createTextElement,
} from "@/lib/svg-templates/common/svg-primitives";
import {
  calculateDynamicFontSize,
  escapeForXml,
  getCardBorderRadius,
  markTrustedSvg,
  processColorsForSVG,
} from "@/lib/utils";

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

function estimateTextWidthPx(text: string, fontSizePx: number): number {
  const t = typeof text === "string" ? text : "";
  if (!t) return 0;

  const charWidthMultiplier = Math.max(0.4, 0.6 - t.length * 0.003);
  return t.length * fontSizePx * charWidthMultiplier;
}

function renderMetricsBlock(
  metrics: ComparativeMetricRow[],
  colW: number,
): string {
  return metrics
    .map((m, i) => {
      const content =
        createTextElement(0, 12, m.label, "stat") +
        createTextElement(colW, 12, m.value, "stat-value", {
          textAnchor: "end",
        });

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
  const labelToBarGap = 10;
  const barToCountGap = 10;
  const minBarW = 20;

  const fallbackBarStartX = 74;
  const fallbackCountPad = 36;

  const rows = sanitized.slice(0, 8).map((b) => {
    const countText = formatInt(b.count);
    const labelW = estimateTextWidthPx(b.label, TYPOGRAPHY.STAT_SIZE);
    const countW = estimateTextWidthPx(countText, TYPOGRAPHY.STAT_SIZE);
    return { ...b, countText, labelW, countW };
  });

  const maxLabelW = Math.max(0, ...rows.map((r) => r.labelW));
  const maxCountW = Math.max(0, ...rows.map((r) => r.countW));

  let barStartX = Math.ceil(maxLabelW + labelToBarGap);
  let barEndX = Math.floor(colW - maxCountW - barToCountGap);
  let maxBarW = barEndX - barStartX;

  if (!Number.isFinite(barStartX) || !Number.isFinite(maxBarW)) {
    barStartX = fallbackBarStartX;
    maxBarW = colW - fallbackBarStartX - fallbackCountPad;
  }

  if (maxBarW < minBarW) {
    barStartX = fallbackBarStartX;
    maxBarW = colW - fallbackBarStartX - fallbackCountPad;
  }

  maxBarW = Math.max(minBarW, Math.floor(maxBarW));
  barStartX = Math.min(
    Math.max(0, barStartX),
    Math.max(0, Math.floor(colW - maxBarW)),
  );

  return rows
    .map((b, i) => {
      const w = Math.min(
        maxBarW,
        Math.max(2, Math.round((Math.max(0, b.count) / maxCount) * maxBarW)),
      );
      const content =
        createTextElement(0, 12, b.label, "stat") +
        createRectElement(barStartX, 4, w, SHAPES.BAR_HEIGHT_SMALL, {
          rx: SHAPES.BAR_RADIUS,
          fill: barColor,
          opacity: 0.85,
        }) +
        createTextElement(colW, 12, b.countText, "stat", {
          textAnchor: "end",
        });

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
    ? `<g transform="translate(0, ${rightBarsY})">${renderBarsBlock(rightBars, colW, resolvedColors.circleColor)}</g>`
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
        .col-title { fill: ${resolvedColors.circleColor}; font: 600 ${TYPOGRAPHY.STAT_VALUE_SIZE}px 'Segoe UI', Ubuntu, Sans-Serif; }
      </style>
      ${generateCardBackground(dims, cardRadius, resolvedColors)}
      <g transform="translate(20, ${SPACING.HEADER_Y})" data-testid="card-title">
        <text class="header">${safeTitle}</text>
      </g>

      <g data-testid="main-card-body">
        <g transform="translate(${col1X}, ${SPACING.CONTENT_Y})">
          <text class="col-title" x="0" y="${sectionTitleY}">${escapeForXml(input.left.title)}</text>
          ${leftMetricsBlock}
          ${leftBarsBlock}
          ${leftEmpty}
        </g>

        <g transform="translate(${col2X}, ${SPACING.CONTENT_Y})">
          <text class="col-title" x="0" y="${sectionTitleY}">${escapeForXml(input.right.title)}</text>
          ${rightMetricsBlock}
          ${rightBarsBlock}
          ${rightEmpty}
        </g>
      </g>
    </svg>
  `);
}
