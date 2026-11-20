import type { ColorValue } from "@/lib/types/card";
import type { ActivityHistoryItem } from "@/lib/types/records";
import type { TrustedSVG } from "@/lib/types/svg";
import {
  ANIMATION,
  TYPOGRAPHY,
  calculateDynamicFontSize,
  getCardDimensions,
} from "@/lib/svg-templates/common";
import { escapeForXml, markTrustedSvg } from "@/lib/svg-markup";
import { getCardBorderRadius } from "@/lib/card-style";
import { processColorsForSVG } from "@/lib/color/gradients";
import { computeStreaks, fitActivityTitle } from "./shared";

/**
 * Generates an activity streaks card showing current/longest streaks.
 * @param data - Template input with username, styles, and activity history.
 * @returns TrustedSVG string for the streaks card.
 * @source
 */
export function activityStreaksTemplate(data: {
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
  const title = `${data.username}'s Activity Streaks`;
  const safeTitle = escapeForXml(title);

  const streakInfo = computeStreaks(data.activityHistory);

  const dims = getCardDimensions("activityStreaks", "default");
  const headerFontSize = Number(
    calculateDynamicFontSize(title, TYPOGRAPHY.LARGE_TEXT_SIZE, dims.w - 40),
  );

  const stats = [
    {
      label: "Current Streak:",
      value: `${streakInfo.currentStreak} days`,
    },
    {
      label: "Longest Streak:",
      value: `${streakInfo.longestStreak} days`,
    },
    {
      label: "Most Active Day:",
      value: `${streakInfo.mostActiveDay.amount} (${streakInfo.mostActiveDay.date})`,
    },
  ];

  const statsContent = stats
    .map(
      (stat, i) => `
    <g class="stagger" style="animation-delay: ${ANIMATION.BASE_DELAY + i * ANIMATION.STAGGER_INCREMENT}ms" transform="translate(0, ${i * 31})">
      <text class="stat" y="12">${stat.label}</text>
      <text class="stat-value" x="${dims.w - 40}" y="12" text-anchor="end">${stat.value}</text>
      ${i < stats.length - 1 ? `<path d="M0 22 H${dims.w - 40}" stroke="${resolvedColors.textColor}" stroke-opacity="0.16" />` : ""}
    </g>
  `,
    )
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
  <desc id="desc-id">Current streak: ${streakInfo.currentStreak} days, Longest: ${streakInfo.longestStreak} days</desc>
  <style>
    .header {
      fill: ${resolvedColors.titleColor};
      font: 600 ${headerFontSize}px 'Segoe UI', Ubuntu, Sans-Serif;
      animation: fadeInAnimation 0.8s ease-in-out forwards;
    }
    .stat {
      fill: ${resolvedColors.textColor};
      font: 400 ${TYPOGRAPHY.STAT_LABEL_SIZE}px 'Segoe UI', Ubuntu, Sans-Serif;
    }
    .stat-value {
      fill: ${resolvedColors.circleColor};
      font: 600 ${TYPOGRAPHY.LARGE_TEXT_SIZE}px 'Segoe UI', Ubuntu, Sans-Serif;
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
  <g transform="translate(20, 55)">
    ${statsContent}
  </g>
</svg>
`);
}
