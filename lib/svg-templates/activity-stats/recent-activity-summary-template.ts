import type { ColorValue } from "@/lib/types/card";
import type { ActivityHistoryItem } from "@/lib/types/records";
import type { TrustedSVG } from "@/lib/types/svg";
import {
  calculateDynamicFontSize,
  escapeForXml,
  getCardBorderRadius,
  markTrustedSvg,
  processColorsForSVG,
} from "@/lib/utils";
import {
  ANIMATION,
  SPACING,
  TYPOGRAPHY,
} from "@/lib/svg-templates/common/constants";
import { getCardDimensions } from "@/lib/svg-templates/common/dimensions";
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

  // Sort activity by date and compute stats
  const sorted = [...data.activityHistory].sort((a, b) => a.date - b.date);
  const totalActivity = sorted.reduce((acc, curr) => acc + curr.amount, 0);
  const dayCount = sorted.length || 1;
  const avgPerDay = (totalActivity / dayCount).toFixed(1);

  // Find best day
  const bestDay = sorted.reduce(
    (best, curr) => (curr.amount > best.amount ? curr : best),
    { date: 0, amount: 0 },
  );
  const bestDayStr = bestDay.date
    ? new Date(bestDay.date * 1000).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      })
    : "N/A";

  const dims = getCardDimensions("recentActivitySummary", "default");

  // Generate sparkline data (last 30 points or all if less)
  const sparklineData = sorted.slice(-30).map((item) => item.amount);
  const sparklineWidth = dims.w - 40;
  const sparklineHeight = 30;
  const sparklinePath = generateSparkline(
    sparklineData,
    sparklineWidth,
    sparklineHeight,
  );

  const showSparkline = true;

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
      font: 600 ${calculateDynamicFontSize(title, TYPOGRAPHY.LARGE_TEXT_SIZE, dims.w - 40)}px 'Segoe UI', Ubuntu, Sans-Serif;
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
    <text x="0" y="0" class="header">${safeTitle}</text>
  </g>
  <g transform="translate(20, 50)">
    <g class="stagger" style="animation-delay: ${ANIMATION.BASE_DELAY}ms">
      <text class="stat" y="12">Total Activities:</text>
      <text class="stat-value" x="110" y="12">${totalActivity}</text>
    </g>
    <g class="stagger" style="animation-delay: ${ANIMATION.BASE_DELAY + ANIMATION.STAGGER_INCREMENT}ms" transform="translate(0, ${SPACING.ROW_HEIGHT_COMPACT})">
      <text class="stat" y="12">Avg per Day:</text>
      <text class="stat-value" x="110" y="12">${avgPerDay}</text>
    </g>
    <g class="stagger" style="animation-delay: ${ANIMATION.BASE_DELAY + 2 * ANIMATION.STAGGER_INCREMENT}ms" transform="translate(0, ${SPACING.ROW_HEIGHT_COMPACT * 2})">
      <text class="stat" y="12">Best Day:</text>
      <text class="stat-value" x="110" y="12">${bestDay.amount} (${bestDayStr})</text>
    </g>
  </g>
  ${
    showSparkline && sparklinePath
      ? `<g transform="translate(20, ${dims.h - 50})">
    <path class="sparkline" d="${sparklinePath}" />
  </g>`
      : ""
  }
</svg>
`);
}
