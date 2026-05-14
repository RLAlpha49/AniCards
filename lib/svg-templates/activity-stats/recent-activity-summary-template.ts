import {
  buildSvgTextLengthAdjustAttributes,
  fitSvgAnchoredTextPair,
  resolveSvgTitleTextFit,
} from "@/lib/pretext/runtime";
import {
  ANIMATION,
  ROW_FIT,
  SPACING,
  TYPOGRAPHY,
} from "@/lib/svg-templates/common/constants";
import { getCardDimensions } from "@/lib/svg-templates/common/dimensions";
import type { ColorValue } from "@/lib/types/card";
import type { ActivityHistoryItem } from "@/lib/types/records";
import type { TrustedSVG } from "@/lib/types/svg";
import {
  escapeForXml,
  getCardBorderRadius,
  markTrustedSvg,
  processColorsForSVG,
} from "@/lib/utils";

import { generateSparkline } from "./shared";

/**
 * Generates a recent activity summary card with sparkline.
 * @param data - Template input with username, styles, and activity history.
 * @returns TrustedSVG string for the summary card.
 * @source
 */
export function recentActivitySummaryTemplate(data: {
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
  activityHistory: ActivityHistoryItem[];
}): TrustedSVG {
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

  const cardRadius = getCardBorderRadius(data.styles.borderRadius);
  const title = `${data.username}'s Recent Activity`;
  const safeTitle = escapeForXml(title);

  const sorted = [...data.activityHistory].sort((a, b) => a.date - b.date);
  const totalActivity = sorted.reduce((acc, curr) => acc + curr.amount, 0);
  const dayCount = sorted.length || 1;
  const avgPerDay = (totalActivity / dayCount).toFixed(1);

  const bestDay = sorted.reduce(
    (best, curr) => (curr.amount > best.amount ? curr : best),
    {
      date: 0,
      amount: 0,
    },
  );
  const bestDayStr = bestDay.date
    ? new Date(bestDay.date * 1000).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      })
    : "N/A";

  const dims = getCardDimensions("recentActivitySummary", "default");
  const titleMaxWidth = dims.w - 40;
  const titleFit = resolveSvgTitleTextFit({
    initialFontSize: TYPOGRAPHY.LARGE_TEXT_SIZE,
    maxWidth: titleMaxWidth,
    text: title,
  });
  const safeTitleFontSize =
    Number.isFinite(titleFit.fontSize) && titleFit.fontSize > 0
      ? titleFit.fontSize
      : TYPOGRAPHY.LARGE_TEXT_SIZE;
  const titleLengthAdjustAttrs = buildSvgTextLengthAdjustAttributes(titleFit, {
    initialFontSize: TYPOGRAPHY.LARGE_TEXT_SIZE,
    maxWidth: titleMaxWidth,
  });
  const safeVisibleTitle = escapeForXml(titleFit.text);

  // Generate sparkline data (last 30 points or all if less)
  const sparklineData = sorted.slice(-30).map((item) => item.amount);
  const sparklineWidth = dims.w - 40;
  const sparklineHeight = 30;
  const sparklinePath = generateSparkline(
    sparklineData,
    sparklineWidth,
    sparklineHeight,
  );

  const rowWidth = dims.w - 40;
  const statsMarkup = [
    {
      label: "Total Activities:",
      value: String(totalActivity),
    },
    {
      label: "Avg per Day:",
      value: avgPerDay,
    },
    {
      label: "Best Day:",
      value: `${bestDay.amount} (${bestDayStr})`,
    },
  ]
    .map((row, index) => {
      const rowFit = fitSvgAnchoredTextPair({
        availableWidth: rowWidth,
        gapPx: ROW_FIT.GAP_PX,
        primaryFontWeight: 400,
        primaryInitialFontSize: TYPOGRAPHY.STAT_LABEL_SIZE,
        primaryMinFontSize: ROW_FIT.MIN_FONT_SIZE,
        primaryText: row.label,
        secondaryInitialFontSize: TYPOGRAPHY.STAT_VALUE_SIZE,
        secondaryMaxWidth: ROW_FIT.SECONDARY_MAX_WIDTH,
        secondaryMinFontSize: ROW_FIT.MIN_FONT_SIZE,
        secondaryFontWeight: 600,
        secondaryText: row.value,
      });
      const labelFontSize = rowFit?.primary.fontSize;
      const valueFontSize = rowFit?.secondary.fontSize;
      const labelStyle =
        typeof labelFontSize === "number" &&
        Number.isFinite(labelFontSize) &&
        labelFontSize > 0
          ? ` style="font-size: ${labelFontSize}px;"`
          : "";
      const valueStyle =
        typeof valueFontSize === "number" &&
        Number.isFinite(valueFontSize) &&
        valueFontSize > 0
          ? ` style="font-size: ${valueFontSize}px;"`
          : "";

      return `
    <g class="stagger" style="animation-delay: ${ANIMATION.BASE_DELAY + index * ANIMATION.STAGGER_INCREMENT}ms" transform="translate(0, ${index * SPACING.ROW_HEIGHT_COMPACT})">
      <text class="stat" y="12"${labelStyle}>${escapeForXml(rowFit?.primary.text ?? row.label)}</text>
      <text class="stat-value" x="${rowWidth}" y="12" text-anchor="end"${valueStyle}>${escapeForXml(rowFit?.secondary.text ?? row.value)}</text>
    </g>`;
    })
    .join("");

  return markTrustedSvg(`
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${dims.w}"
  height="${dims.h}"
  viewBox="0 0 ${dims.w} ${dims.h}"
  fill="none"
  role="img"
  aria-labelledby="desc-id"
>
  ${gradientDefs ? `<defs>${gradientDefs}</defs>` : ""}
  <title id="title-id">${safeTitle}</title>
  <desc id="desc-id">Total: ${totalActivity}, Average: ${avgPerDay}/day, Best: ${bestDay.amount} on ${bestDayStr}</desc>
  <style>
    .header {
      fill: ${resolvedColors.titleColor};
      font: 600 ${safeTitleFontSize}px 'Segoe UI', Ubuntu, Sans-Serif;
      animation: fadeInAnimation 0.8s ease-in-out forwards;
    }
    .stat {
      fill: ${resolvedColors.textColor};
      font: 400 ${TYPOGRAPHY.STAT_LABEL_SIZE}px 'Segoe UI', Ubuntu, Sans-Serif;
    }
    .stat-value {
      fill: ${resolvedColors.circleColor};
      font: 600 ${TYPOGRAPHY.STAT_VALUE_SIZE}px 'Segoe UI', Ubuntu, Sans-Serif;
    }
    .sparkline {
      fill: none;
      stroke: ${resolvedColors.circleColor};
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      opacity: 0;
      animation: fadeInAnimation 1s ease-in-out 0.5s forwards;
    }
    .stagger {
      opacity: 0;
      animation: fadeInAnimation 0.3s ease-in-out forwards;
    }
    @keyframes fadeInAnimation {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  </style>
  <rect
    x="0.5"
    y="0.5"
    rx="${cardRadius}"
    height="${dims.h - 1}"
    width="${dims.w - 1}"
    fill="${resolvedColors.backgroundColor}"
    ${resolvedColors.borderColor ? `stroke="${resolvedColors.borderColor}"` : ""}
    stroke-width="2"
  />
  <g transform="translate(20, 30)">
    <text x="0" y="0" class="header"${titleLengthAdjustAttrs}>${safeVisibleTitle}</text>
  </g>
  <g transform="translate(20, 50)">
    ${statsMarkup}
  </g>
  ${
    sparklinePath
      ? `<g transform="translate(20, ${dims.h - 50})">
    <path class="sparkline" d="${sparklinePath}" />
  </g>`
      : ""
  }
</svg>
`);
}
