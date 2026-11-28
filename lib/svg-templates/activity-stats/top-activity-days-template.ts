import type { ColorValue } from "@/lib/types/card";
import type { ActivityHistoryItem } from "@/lib/types/records";
import type { TrustedSVG } from "@/lib/types/svg";
import {
  ANIMATION,
  POSITIONING,
  SPACING,
  TYPOGRAPHY,
  calculateDynamicFontSize,
  getCardDimensions,
} from "@/lib/svg-templates/common";
import { escapeForXml, markTrustedSvg } from "@/lib/svg-markup";
import { getCardBorderRadius } from "@/lib/card-style";
import { processColorsForSVG } from "@/lib/color/gradients";
import { detectTopActivityDays, fitActivityTitle } from "./activity-stats";

/**
 * Generates a Top Activity Days card showing days with the highest activity.
 * @param data - Template input with username, styles, and activity history.
 * @returns TrustedSVG string for the top activity days card.
 * @source
 */
export function topActivityDaysTemplate(data: {
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
  const title = `${data.username}'s Top Activity Days`;
  const safeTitle = escapeForXml(title);

  const topActivityDays = detectTopActivityDays(data.activityHistory);
  const topDays = topActivityDays.slice(0, 5);

  const dims = getCardDimensions("topActivityDays", "default");
  const headerFontSize = Number(
    calculateDynamicFontSize(title, TYPOGRAPHY.LARGE_TEXT_SIZE, dims.w - 40),
  );

  const activityRows =
    topDays.length > 0
      ? topDays
          .map(
            (day, i) => `
      <g class="stagger" style="animation-delay: ${ANIMATION.BASE_DELAY + i * ANIMATION.SLOW_INCREMENT}ms" transform="translate(0, ${i * SPACING.ROW_HEIGHT})">
        <text class="rank" y="12">#${i + 1}</text>
        <text class="date" x="${POSITIONING.BAR_START_X}" y="12">${day.date}</text>
        <text class="amount" x="${dims.w - 40}" y="12" text-anchor="end">${day.amount} activities</text>
        ${i < topDays.length - 1 ? `<path d="M${POSITIONING.BAR_START_X} 20 H${dims.w - 40}" stroke="${resolvedColors.textColor}" stroke-opacity="0.16" />` : ""}
      </g>
    `,
          )
          .join("")
      : `<text class="no-data" x="${dims.w / 2 - 20}" y="40">No top activity days detected</text>`;

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
  <desc id="desc-id">Top ${topDays.length} activity days</desc>
  <style>
    .header {
      fill: ${resolvedColors.titleColor};
      font: 600 ${headerFontSize}px 'Segoe UI', Ubuntu, Sans-Serif;
      animation: fadeInAnimation 0.8s ease-in-out forwards;
    }
    .rank {
      fill: ${resolvedColors.circleColor};
      font: 600 ${TYPOGRAPHY.STAT_LABEL_SIZE}px 'Segoe UI', Ubuntu, Sans-Serif;
    }
    .date {
      fill: ${resolvedColors.textColor};
      font: 500 ${TYPOGRAPHY.STAT_LABEL_SIZE}px 'Segoe UI', Ubuntu, Sans-Serif;
    }
    .amount {
      fill: ${resolvedColors.textColor};
      font: 600 ${TYPOGRAPHY.STAT_LABEL_SIZE}px 'Segoe UI', Ubuntu, Sans-Serif;
    }
    .no-data {
      fill: ${resolvedColors.textColor};
      font: 400 ${TYPOGRAPHY.STAT_LABEL_SIZE}px 'Segoe UI', Ubuntu, Sans-Serif;
      opacity: 0.9;
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
    <text x="0" y="0" class="header" ${fitActivityTitle(title, headerFontSize, dims.w - 40)}>${safeTitle}</text>
  </g>
  <g transform="translate(20, ${SPACING.CONTENT_Y})">
    ${activityRows}
  </g>
</svg>
`);
}
