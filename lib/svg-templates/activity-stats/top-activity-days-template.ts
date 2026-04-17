import {
  buildSvgTextLengthAdjustAttributes,
  fitSvgAnchoredTextPair,
  fitSvgSingleLineText,
  resolveSvgTitleTextFit,
} from "@/lib/pretext/runtime";
import {
  ANIMATION,
  CARD_HORIZONTAL_PADDING,
  MIN_FONT_SIZE,
  POSITIONING,
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

import { detectTopActivityDays } from "./shared";

const DATE_AMOUNT_GAP = 12;
const AMOUNT_MAX_WIDTH = 96;
const RANK_MIN_WIDTH = Math.max(20, POSITIONING.BAR_START_X - 8);
const CONTENT_LEFT_OFFSET = 20;

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
  const titleMaxWidth = dims.w - CARD_HORIZONTAL_PADDING;
  const titleFit = resolveSvgTitleTextFit({
    initialFontSize: TYPOGRAPHY.LARGE_TEXT_SIZE,
    maxWidth: titleMaxWidth,
    text: title,
  });
  const titleLengthAdjustAttrs = buildSvgTextLengthAdjustAttributes(titleFit, {
    initialFontSize: TYPOGRAPHY.LARGE_TEXT_SIZE,
    maxWidth: titleMaxWidth,
  });
  const safeVisibleTitle = escapeForXml(titleFit.text);

  let activityRows: string;

  if (topDays.length > 0) {
    activityRows = topDays
      .map((day, i) => {
        const amountText = `${day.amount} activities`;
        const dateFit = fitSvgAnchoredTextPair({
          availableWidth:
            dims.w - CARD_HORIZONTAL_PADDING - POSITIONING.BAR_START_X,
          gapPx: DATE_AMOUNT_GAP,
          primaryFontWeight: 400,
          primaryInitialFontSize: TYPOGRAPHY.SECTION_TITLE_SIZE,
          primaryMinFontSize: MIN_FONT_SIZE,
          primaryText: day.date,
          secondaryInitialFontSize: TYPOGRAPHY.SECTION_TITLE_SIZE,
          secondaryMaxWidth: AMOUNT_MAX_WIDTH,
          secondaryMinFontSize: MIN_FONT_SIZE,
          secondaryFontWeight: 500,
          secondaryText: amountText,
        });
        const rankFit = fitSvgSingleLineText({
          fontWeight: 600,
          initialFontSize: TYPOGRAPHY.SECTION_TITLE_SIZE,
          maxWidth: RANK_MIN_WIDTH,
          minFontSize: MIN_FONT_SIZE,
          mode: "shrink-then-truncate",
          text: `#${i + 1}`,
        });
        const dateFontSize = dateFit
          ? ` font-size="${dateFit.primary.fontSize}"`
          : "";
        const amountFontSize = dateFit
          ? ` font-size="${dateFit.secondary.fontSize}"`
          : "";

        return `
      <g class="stagger" style="animation-delay: ${ANIMATION.BASE_DELAY + i * ANIMATION.SLOW_INCREMENT}ms" transform="translate(0, ${i * SPACING.ROW_HEIGHT})">
        <text class="rank" y="12"${rankFit ? ` font-size="${rankFit.fontSize}"` : ""}>${escapeForXml(rankFit?.text ?? `#${i + 1}`)}</text>
        <text class="date" x="${POSITIONING.BAR_START_X}" y="12"${dateFontSize}>${escapeForXml(dateFit?.primary.text ?? day.date)}</text>
        <text class="amount" x="${dims.w - CARD_HORIZONTAL_PADDING}" y="12" text-anchor="end"${amountFontSize}>${escapeForXml(dateFit?.secondary.text ?? amountText)}</text>
      </g>
    `;
      })
      .join("");
  } else {
    const noDataFit = fitSvgSingleLineText({
      fontWeight: 400,
      initialFontSize: TYPOGRAPHY.STAT_LABEL_SIZE,
      maxWidth: dims.w - CARD_HORIZONTAL_PADDING * 2,
      minFontSize: MIN_FONT_SIZE,
      mode: "shrink-then-truncate",
      text: "No top activity days detected",
    });
    const noDataFontSize = noDataFit
      ? ` font-size="${noDataFit.fontSize}"`
      : "";
    const noDataText = escapeForXml(
      noDataFit?.text ?? "No top activity days detected",
    );

    activityRows = `<text class="no-data" x="${dims.w / 2 - CONTENT_LEFT_OFFSET}" y="40" text-anchor="middle"${noDataFontSize}>${noDataText}</text>`;
  }

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
      font: 600 ${titleFit.fontSize}px 'Segoe UI', Ubuntu, Sans-Serif;
      animation: fadeInAnimation 0.8s ease-in-out forwards;
    }
    .rank {
      fill: ${resolvedColors.circleColor};
      font: 600 ${TYPOGRAPHY.SECTION_TITLE_SIZE}px 'Segoe UI', Ubuntu, Sans-Serif;
    }
    .date {
      fill: ${resolvedColors.textColor};
      font: 400 ${TYPOGRAPHY.SECTION_TITLE_SIZE}px 'Segoe UI', Ubuntu, Sans-Serif;
    }
    .amount {
      fill: ${resolvedColors.textColor};
      font: 500 ${TYPOGRAPHY.SECTION_TITLE_SIZE}px 'Segoe UI', Ubuntu, Sans-Serif;
      opacity: 0.9;
    }
    .no-data {
      fill: ${resolvedColors.textColor};
      font: 400 ${TYPOGRAPHY.STAT_LABEL_SIZE}px 'Segoe UI', Ubuntu, Sans-Serif;
      opacity: 0.6;
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
  <g transform="translate(${CONTENT_LEFT_OFFSET}, ${SPACING.CONTENT_Y})">
    ${activityRows}
  </g>
</svg>
`);
}
