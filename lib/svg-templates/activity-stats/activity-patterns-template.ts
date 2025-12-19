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
import { computeActivityPatterns } from "./shared";

/**
 * Generates an activity patterns card showing day/month distribution.
 * @param data - Template input with username, styles, and activity history.
 * @returns TrustedSVG string for the patterns card.
 * @source
 */
export function activityPatternsTemplate(data: {
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
  const title = `${data.username}'s Activity Patterns`;
  const safeTitle = escapeForXml(title);

  const patterns = computeActivityPatterns(data.activityHistory);
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const maxDayValue = Math.max(...patterns.byDayOfWeek, 1);

  const dims = getCardDimensions("activityPatterns", "default");
  const barWidth = 32;
  const barMaxHeight = 70;

  // Generate day-of-week bar chart
  const dayBars = patterns.byDayOfWeek
    .map((count, i) => {
      const height = (count / maxDayValue) * barMaxHeight;
      const x = 30 + i * (barWidth + 8);
      const y = dims.h - 30 - height;

      return `
      <g class="stagger" style="animation-delay: ${ANIMATION.BASE_DELAY + i * ANIMATION.MEDIUM_INCREMENT}ms">
        <rect x="${x}" y="${y}" width="${barWidth}" height="${height}" rx="3" fill="${resolvedColors.circleColor}" opacity="0.85" />
        <text class="day-label" x="${x + barWidth / 2}" y="${dims.h - 15}" text-anchor="middle">${dayNames[i]}</text>
        <text class="count-label" x="${x + barWidth / 2}" y="${y - 5}" text-anchor="middle">${count}</text>
      </g>
    `;
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
  <desc id="desc-id">Most active day: ${patterns.mostActiveDay}, Most active month: ${patterns.mostActiveMonth}</desc>
  <style>
    .header {
      fill: ${resolvedColors.titleColor};
      font: 600 ${calculateDynamicFontSize(title, TYPOGRAPHY.LARGE_TEXT_SIZE, dims.w - 40)}px 'Segoe UI', Ubuntu, Sans-Serif;
      animation: fadeInAnimation 0.8s ease-in-out forwards;
    }
    .day-label {
      fill: ${resolvedColors.textColor};
      font: 400 ${TYPOGRAPHY.SMALL_TEXT_SIZE}px 'Segoe UI', Ubuntu, Sans-Serif;
    }
    .count-label {
      fill: ${resolvedColors.textColor};
      font: 400 ${TYPOGRAPHY.SMALL_TEXT_SIZE}px 'Segoe UI', Ubuntu, Sans-Serif;
      opacity: 0.8;
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
  <g transform="translate(20, 28)">
    <text x="0" y="0" class="header">${safeTitle}</text>
  </g>
  ${dayBars}
</svg>
`);
}
