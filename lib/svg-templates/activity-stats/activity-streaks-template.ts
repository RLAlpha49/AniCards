import {
  buildSvgTextLengthAdjustAttributes,
  fitSvgAnchoredTextPair,
  resolveSvgTitleTextFit,
} from "@/lib/pretext/runtime";
import {
  ACTIVITY_STREAK,
  ANIMATION,
  MIN_FONT_SIZE,
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

import { computeStreaks } from "./shared";

const HORIZONTAL_MARGIN = 40;

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
  const titleMaxWidth = dims.w - HORIZONTAL_MARGIN;
  const titleFit = resolveSvgTitleTextFit({
    initialFontSize: TYPOGRAPHY.LARGE_TEXT_SIZE,
    maxWidth: titleMaxWidth,
    text: title,
  });
  const titleFontSize = Number.isFinite(titleFit.fontSize)
    ? titleFit.fontSize
    : TYPOGRAPHY.LARGE_TEXT_SIZE;
  const titleLengthAdjustAttrs = buildSvgTextLengthAdjustAttributes(titleFit, {
    initialFontSize: TYPOGRAPHY.LARGE_TEXT_SIZE,
    maxWidth: titleMaxWidth,
  });
  const safeVisibleTitle = escapeForXml(titleFit.text);

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
    .map((stat, i) => {
      const rowFit = fitSvgAnchoredTextPair({
        availableWidth: dims.w - HORIZONTAL_MARGIN,
        gapPx: ACTIVITY_STREAK.GAP_PX,
        primaryFontWeight: 400,
        primaryInitialFontSize: TYPOGRAPHY.STAT_LABEL_SIZE,
        primaryMinFontSize: MIN_FONT_SIZE,
        primaryText: stat.label,
        secondaryInitialFontSize: TYPOGRAPHY.LARGE_TEXT_SIZE,
        secondaryMaxWidth: Math.max(
          ACTIVITY_STREAK.SECONDARY_MAX_WIDTH_BASE,
          Math.floor(
            (dims.w - HORIZONTAL_MARGIN) *
              ACTIVITY_STREAK.SECONDARY_MAX_WIDTH_RATIO,
          ),
        ),
        secondaryMinFontSize: MIN_FONT_SIZE,
        secondaryFontWeight: 600,
        secondaryText: stat.value,
      });
      const labelFontSizeStyle =
        rowFit && Number.isFinite(rowFit.primary.fontSize)
          ? ` style="font-size:${rowFit.primary.fontSize}px;"`
          : "";
      const valueFontSizeStyle =
        rowFit && Number.isFinite(rowFit.secondary.fontSize)
          ? ` style="font-size:${rowFit.secondary.fontSize}px;"`
          : "";
      const primaryText = rowFit ? rowFit.primary.text : stat.label;
      const secondaryText = rowFit ? rowFit.secondary.text : stat.value;

      return `
    <g class="stagger" style="animation-delay: ${ANIMATION.BASE_DELAY + i * ANIMATION.STAGGER_INCREMENT}ms" transform="translate(0, ${i * SPACING.ROW_HEIGHT})">
      <text class="stat" y="12"${labelFontSizeStyle}>${escapeForXml(primaryText)}</text>
      <text class="stat-value" x="${dims.w - HORIZONTAL_MARGIN}" y="12" text-anchor="end"${valueFontSizeStyle}>${escapeForXml(secondaryText)}</text>
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
  <desc id="desc-id">Current streak: ${streakInfo.currentStreak} days, Longest: ${streakInfo.longestStreak} days</desc>
  <style>
    .header {
      fill: ${resolvedColors.titleColor};
      font: 600 ${titleFontSize}px 'Segoe UI', Ubuntu, Sans-Serif;
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
    <text x="0" y="0" class="header"${titleLengthAdjustAttrs}>${safeVisibleTitle}</text>
  </g>
  <g transform="translate(20, 55)">
    ${statsContent}
  </g>
</svg>
`);
}
