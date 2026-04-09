/**
 * Shared layout engine for the comparative analytics cards.
 *
 * Individual comparative cards only provide labels and metric/bar data; this
 * module owns the two-column sizing and rendering rules so those cards keep a
 * consistent structure without duplicating layout math.
 */
import {
  buildSvgTextLengthAdjustAttributes,
  fitSvgAnchoredTextPair,
  fitSvgSingleLineText,
  measureSvgSingleLineText,
  resolveSvgTitleTextFit,
} from "@/lib/pretext/runtime";
import {
  ANIMATION,
  getCardDimensions,
  SHAPES,
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
  noDataText?: string;
  variant?: string;
  styles: {
    titleColor: ColorValue;
    backgroundColor: ColorValue;
    textColor: ColorValue;
    circleColor: ColorValue;
    borderColor?: ColorValue;
    borderRadius?: number;
    animate?: boolean;
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
const EFFECTIVE_MAX_TEXT_WIDTH = 100_000; // Effectively unlimited width for measurement purposes.

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

function measureTextWidthPx(
  text: string,
  fontSizePx: number,
  fontWeight: number = 400,
): number {
  const measurement = measureSvgSingleLineText({
    fontSize: fontSizePx,
    fontWeight,
    maxWidth: EFFECTIVE_MAX_TEXT_WIDTH,
    text,
  });

  return measurement?.naturalWidth ?? estimateTextWidthPx(text, fontSizePx);
}

function renderMetricsBlock(
  metrics: ComparativeMetricRow[],
  colW: number,
): string {
  return metrics
    .map((m, i) => {
      const rowFit = fitSvgAnchoredTextPair({
        availableWidth: colW,
        gapPx: 12,
        mode: "shrink",
        primaryFontWeight: 400,
        primaryInitialFontSize: TYPOGRAPHY.STAT_SIZE,
        primaryMinFontSize: 8,
        primaryText: m.label,
        secondaryInitialFontSize: TYPOGRAPHY.STAT_VALUE_SIZE,
        secondaryMaxWidth: Math.max(42, Math.floor(colW * 0.42)),
        secondaryMinFontSize: 8,
        secondaryFontWeight: 700,
        secondaryMode: "shrink",
        secondaryText: m.value,
      });
      const content =
        createTextElement(0, 12, rowFit?.primary.text ?? m.label, "stat", {
          ...(rowFit ? { fontSize: rowFit.primary.fontSize } : {}),
        }) +
        createTextElement(
          colW,
          12,
          rowFit?.secondary.text ?? m.value,
          "stat-value",
          {
            textAnchor: "end",
            ...(rowFit ? { fontSize: rowFit.secondary.fontSize } : {}),
          },
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
  const labelToBarGap = 6;
  const barToCountGap = 10;
  const minBarW = 20;

  const rows = sanitized.slice(0, MAX_BARS_PER_COLUMN).map((b) => {
    const countText = formatInt(b.count);
    const countW = measureTextWidthPx(countText, TYPOGRAPHY.STAT_SIZE, 600);
    return { ...b, countText, countW };
  });

  const maxCountW = Math.max(0, ...rows.map((r) => r.countW));
  const maxLabelSlotWidth = Math.max(
    24,
    Math.floor(colW - maxCountW - labelToBarGap - barToCountGap - minBarW),
  );
  const fittedRows = rows.map((row) => {
    const labelFit = fitSvgSingleLineText({
      fontWeight: 400,
      initialFontSize: TYPOGRAPHY.STAT_SIZE,
      maxWidth: maxLabelSlotWidth,
      minFontSize: 8,
      mode: "shrink-then-truncate",
      text: row.label,
    });

    return {
      ...row,
      labelFit,
      labelW:
        labelFit?.naturalWidth ??
        measureTextWidthPx(
          labelFit?.text ?? row.label,
          labelFit?.fontSize ?? TYPOGRAPHY.STAT_SIZE,
        ),
    };
  });

  const widestLabelWidth = Math.min(
    maxLabelSlotWidth,
    Math.max(0, ...fittedRows.map((row) => row.labelW)),
  );
  const barStartX = Math.max(24, Math.ceil(widestLabelWidth + labelToBarGap));
  const maxBarW = Math.max(
    minBarW,
    Math.floor(colW - barStartX - maxCountW - barToCountGap),
  );

  return fittedRows
    .map((b, i) => {
      const countFit = fitSvgSingleLineText({
        fontWeight: 600,
        initialFontSize: TYPOGRAPHY.STAT_SIZE,
        maxWidth: Math.max(24, Math.ceil(maxCountW)),
        minFontSize: 8,
        mode: "shrink-then-truncate",
        text: b.countText,
      });
      const w = Math.min(
        maxBarW,
        Math.max(2, Math.round((Math.max(0, b.count) / maxCount) * maxBarW)),
      );
      const content =
        createTextElement(0, 12, b.labelFit?.text ?? b.label, "stat", {
          ...(b.labelFit ? { fontSize: b.labelFit.fontSize } : {}),
        }) +
        createRectElement(barStartX, 4, w, SHAPES.BAR_HEIGHT_SMALL, {
          rx: SHAPES.BAR_RADIUS,
          fill: barColor,
          opacity: 0.85,
        }) +
        createTextElement(colW, 12, countFit?.text ?? b.countText, "stat", {
          textAnchor: "end",
          fontWeight: 600,
          ...(countFit ? { fontSize: countFit.fontSize } : {}),
        });

      return createStaggeredGroup(
        `translate(0, ${i * SPACING.ITEM_GAP})`,
        content,
        `${ANIMATION.CHART_BASE_DELAY + i * ANIMATION.CHART_INCREMENT}ms`,
      );
    })
    .join("");
}

function renderOptionalColumnBlock(content: string, y: number): string {
  if (!content) {
    return "";
  }

  return `<g transform="translate(0, ${y})">${content}</g>`;
}

function resolveColumnBarsY(
  metricsCount: number,
  hasBars: boolean,
  sectionStartY: number,
  metricsGap: number,
): number {
  return (
    sectionStartY +
    metricsCount * SPACING.ROW_HEIGHT_COMPACT +
    (metricsCount > 0 && hasBars ? metricsGap : 0)
  );
}

function buildComparativeColumnSection(args: {
  bars: ComparativeBarRow[];
  circleColor: string;
  colW: number;
  metrics: ComparativeMetricRow[];
  noDataText?: string;
  sectionStartY: number;
  sectionTitleY: number;
  title: string;
  titleFontSize?: number;
  x: number;
}): string {
  const noDataText = args.noDataText ?? "No data";
  const metricsMarkup = renderOptionalColumnBlock(
    args.metrics.length > 0 ? renderMetricsBlock(args.metrics, args.colW) : "",
    args.sectionStartY,
  );
  const barsMarkup = renderOptionalColumnBlock(
    args.bars.length > 0
      ? renderBarsBlock(args.bars, args.colW, args.circleColor)
      : "",
    resolveColumnBarsY(
      args.metrics.length,
      args.bars.length > 0,
      args.sectionStartY,
      10,
    ),
  );
  let emptyMarkup = "";
  if (args.metrics.length === 0 && args.bars.length === 0) {
    const emptyFit = fitSvgSingleLineText({
      fontWeight: 400,
      initialFontSize: TYPOGRAPHY.STAT_SIZE,
      maxWidth: args.colW,
      minFontSize: 8,
      mode: "shrink-then-truncate",
      text: noDataText,
    });
    emptyMarkup = createTextElement(
      0,
      args.sectionStartY + 12,
      emptyFit?.text ?? noDataText,
      "stat",
      {
        ...(emptyFit ? { fontSize: emptyFit.fontSize } : {}),
      },
    );
  }

  return `
        <g transform="translate(${args.x}, ${SPACING.CONTENT_Y})">
          <text class="col-title" x="0" y="${args.sectionTitleY}"${typeof args.titleFontSize === "number" ? ` font-size="${args.titleFontSize}"` : ""}>${escapeForXml(args.title)}</text>
          ${metricsMarkup}
          ${barsMarkup}
          ${emptyMarkup}
        </g>`;
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
  const titleMaxWidth = baseDims.w - 40;
  const titleFit = resolveSvgTitleTextFit({
    maxWidth: titleMaxWidth,
    text: fullTitle,
  });
  const titleLengthAdjustAttrs = buildSvgTextLengthAdjustAttributes(titleFit, {
    initialFontSize: 18,
    maxWidth: titleMaxWidth,
  });
  const safeVisibleTitle = escapeForXml(titleFit.text);
  const animationsEnabled = styles.animate !== false; // Default on when styles.animate is undefined; only false disables animations.

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
  const leftTitleFit = fitSvgSingleLineText({
    fontWeight: 600,
    initialFontSize: TYPOGRAPHY.STAT_VALUE_SIZE,
    maxWidth: colW,
    minFontSize: 8,
    mode: "shrink-then-truncate",
    text: input.left.title,
  });
  const rightTitleFit = fitSvgSingleLineText({
    fontWeight: 600,
    initialFontSize: TYPOGRAPHY.STAT_VALUE_SIZE,
    maxWidth: colW,
    minFontSize: 8,
    mode: "shrink-then-truncate",
    text: input.right.title,
  });
  const leftColumnMarkup = buildComparativeColumnSection({
    bars: leftBars,
    circleColor: resolvedColors.circleColor,
    colW,
    metrics: leftMetrics,
    noDataText: input.noDataText,
    sectionStartY,
    sectionTitleY,
    title: leftTitleFit?.text ?? input.left.title,
    titleFontSize: leftTitleFit?.fontSize,
    x: col1X,
  });
  const rightColumnMarkup = buildComparativeColumnSection({
    bars: rightBars,
    circleColor: resolvedColors.circleColor,
    colW,
    metrics: rightMetrics,
    noDataText: input.noDataText,
    sectionStartY,
    sectionTitleY,
    title: rightTitleFit?.text ?? input.right.title,
    titleFontSize: rightTitleFit?.fontSize,
    x: col2X,
  });

  return markTrustedSvg(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${dims.w}" height="${dims.h}" viewBox="0 0 ${dims.w} ${dims.h}" fill="none" role="img" aria-labelledby="title-id">
      ${gradientDefs ? `<defs>${gradientDefs}</defs>` : ""}
      <title id="title-id">${safeTitle}</title>
      <style>
        ${generateCommonStyles(resolvedColors, titleFit.fontSize, { includeAnimations: animationsEnabled })}
        .col-title { fill: ${resolvedColors.circleColor}; font: 600 ${TYPOGRAPHY.STAT_VALUE_SIZE}px 'Segoe UI', Ubuntu, Sans-Serif; }
      </style>
      ${generateCardBackground(dims, cardRadius, resolvedColors)}
      <g transform="translate(20, ${SPACING.HEADER_Y})" data-testid="card-title">
        <text class="header"${titleLengthAdjustAttrs}>${safeVisibleTitle}</text>
      </g>

      <g data-testid="main-card-body">
        ${leftColumnMarkup}
        ${rightColumnMarkup}
      </g>
    </svg>
  `);
}
