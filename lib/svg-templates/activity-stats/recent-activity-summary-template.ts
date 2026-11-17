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
import { ANIMATION, TYPOGRAPHY } from "@/lib/svg-templates/common/constants";
import { getCardDimensions } from "@/lib/svg-templates/common/dimensions";
import { estimateCardTextWidth } from "@/lib/svg-templates/common/text-metrics";
import { fitActivityTitle, generateSparkline } from "./shared";

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
  const headerFontSize = Number(
    calculateDynamicFontSize(title, TYPOGRAPHY.LARGE_TEXT_SIZE, dims.w - 40),
  );

  // Generate sparkline data (last 30 points or all if less)
  const sparklineData = sorted.slice(-30).map((item) => item.amount);
  const sparklinePadding = cardRadius > 70 ? 40 : 20;
  const sparklineWidth = dims.w - sparklinePadding * 2;
  const sparklineHeight = 24;
  const sparklinePath = generateSparkline(
    sparklineData,
    sparklineWidth,
    sparklineHeight,
  );

  const metrics = [
    { label: "Total activity", value: String(totalActivity), x: 0, width: 80 },
    { label: "Daily avg.", value: avgPerDay, x: 85, width: 65 },
    {
      label: "Best day",
      value: `${bestDay.amount} (${bestDayStr})`,
      x: 155,
      width: 85,
    },
  ];

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
      font: 600 ${headerFontSize}px 'Segoe UI', Ubuntu, Sans-Serif;
      animation: fadeInAnimation 0.8s ease-in-out forwards;
    }
    .stat {
      fill: ${resolvedColors.textColor};
      font: 500 11px 'Segoe UI', Ubuntu, Sans-Serif;
    }
    .stat-value {
      fill: ${resolvedColors.circleColor};
      font: 600 ${TYPOGRAPHY.STAT_VALUE_SIZE}px 'Segoe UI', Ubuntu, Sans-Serif;
    }
    .chart-label {
      fill: ${resolvedColors.textColor};
      font: 500 10px 'Segoe UI', Ubuntu, Sans-Serif;
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
  <g transform="translate(${cardRadius > 70 ? 40 : 20}, 30)">
    <text x="0" y="0" class="header" ${fitActivityTitle(title, headerFontSize, dims.w - (cardRadius > 70 ? 80 : 40))}>${safeTitle}</text>
  </g>
  <g transform="translate(20, 50)">
    ${metrics
      .map(
        (
          metric,
          i,
        ) => `<g class="stagger" style="animation-delay: ${ANIMATION.BASE_DELAY + i * ANIMATION.STAGGER_INCREMENT}ms" transform="translate(${metric.x}, 0)">
      <text class="stat" y="10">${metric.label}</text>
      <text class="stat-value" y="29" ${estimateCardTextWidth(metric.value, 14, 700) > metric.width ? `style="font-size:${Math.max(6, (14 * metric.width) / estimateCardTextWidth(metric.value, 14, 700)).toFixed(2)}px"` : ""}>${metric.value}</text>
    </g>`,
      )
      .join("")}
  </g>
  ${
    sparklinePath
      ? `<g transform="translate(${sparklinePadding}, ${dims.h - 45})">
    <text class="chart-label" y="-7">Last ${sparklineData.length} entries</text>
    <path class="sparkline" d="${sparklinePath}" />
  </g>`
      : ""
  }
</svg>
`);
}
