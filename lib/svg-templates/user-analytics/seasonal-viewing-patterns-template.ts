import {
  buildSvgTextLengthAdjustAttributes,
  fitSvgSingleLineText,
  resolveSvgTitleTextFit,
} from "@/lib/pretext/runtime";
import { generateCardBackground } from "@/lib/svg-templates/common/base-template-utils";
import {
  ANIMATION,
  SHAPES,
  SPACING,
  TYPOGRAPHY,
} from "@/lib/svg-templates/common/constants";
import { getCardDimensions } from "@/lib/svg-templates/common/dimensions";
import { generateCommonStyles } from "@/lib/svg-templates/common/style-generators";
import type { ColorValue } from "@/lib/types/card";
import type { ActivityHistoryItem } from "@/lib/types/records";
import type { TrustedSVG } from "@/lib/types/svg";
import {
  escapeForXml,
  getCardBorderRadius,
  markTrustedSvg,
  processColorsForSVG,
} from "@/lib/utils";

export interface SeasonalViewingPatternsTemplateInput {
  username: string;
  variant?: "default";
  styles: {
    titleColor: ColorValue;
    backgroundColor: ColorValue;
    textColor: ColorValue;
    circleColor: ColorValue;
    borderColor?: ColorValue;
    borderRadius?: number;
    animate?: boolean;
  };
  activityHistory: ActivityHistoryItem[];
}

const CHART_BAR_HEIGHT = 68;
const CHART_BASE_Y = 102;
// 6.5 px is an empirical average ASCII character width for Inter at 12 px,
// measured in a browser canvas sample; re-measure if the typography changes.
const ESTIMATED_AVG_CHAR_WIDTH = 6.5;
const FONT_FAMILY = "'Segoe UI', Ubuntu, Sans-Serif";
const STAT_MEASUREMENT_FONT = `400 ${TYPOGRAPHY.STAT_SIZE}px ${FONT_FAMILY}`;

// OffscreenCanvas is unavailable in SSR/Node.js, so this helper returns null
// there (or on canvas errors) to signal the caller to use the fallback path.
function measureTextWidthWithCanvas(text: string, font: string): number | null {
  try {
    if (typeof OffscreenCanvas !== "function") return null;
    const canvas = new OffscreenCanvas(1, 1);
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.font = font;
    return context.measureText(text).width;
  } catch {
    return null;
  }
}

function measureLabelWidth(
  text: string,
  fit?: { naturalWidth?: number | null } | null,
): number {
  const fittedWidth = fit?.naturalWidth;
  if (
    typeof fittedWidth === "number" &&
    Number.isFinite(fittedWidth) &&
    fittedWidth > 0
  ) {
    return fittedWidth;
  }

  const canvasWidth = measureTextWidthWithCanvas(text, STAT_MEASUREMENT_FONT);
  if (
    typeof canvasWidth === "number" &&
    Number.isFinite(canvasWidth) &&
    canvasWidth > 0
  ) {
    return canvasWidth;
  }

  return text.length * ESTIMATED_AVG_CHAR_WIDTH;
}

function groupBySeason(
  activityHistory: ActivityHistoryItem[],
): Map<string, number> {
  const seasons = new Map<string, number>([
    ["Winter", 0],
    ["Spring", 0],
    ["Summer", 0],
    ["Fall", 0],
  ]);

  for (const activity of activityHistory) {
    if (!activity.date || !activity.amount) continue;

    const date = new Date(activity.date * 1000);
    const month = date.getUTCMonth(); // 0-11

    let season: string;
    if (month === 11 || month === 0 || month === 1) {
      season = "Winter";
    } else if (month >= 2 && month <= 4) {
      season = "Spring";
    } else if (month >= 5 && month <= 7) {
      season = "Summer";
    } else {
      season = "Fall";
    }

    seasons.set(season, (seasons.get(season) || 0) + activity.amount);
  }

  return seasons;
}

function findDominantSeason(seasons: Map<string, number>): string {
  let maxSeason = "—";
  let maxCount = 0;
  for (const [season, count] of seasons) {
    if (count > maxCount) {
      maxCount = count;
      maxSeason = season;
    }
  }
  return maxSeason;
}

export function seasonalViewingPatternsTemplate(
  data: SeasonalViewingPatternsTemplateInput,
): TrustedSVG {
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
  const title = `${data.username}'s Seasonal Activity`;
  const safeTitle = escapeForXml(title);
  const animationsEnabled = data.styles.animate !== false;

  const dims = getCardDimensions("seasonalViewingPatterns", "default");
  const titleMaxWidth = dims.w - 40;
  const titleFit = resolveSvgTitleTextFit({
    maxWidth: titleMaxWidth,
    text: title,
  });
  const titleLengthAdjustAttrs = buildSvgTextLengthAdjustAttributes(titleFit, {
    initialFontSize: TYPOGRAPHY.HEADER_SIZE,
    maxWidth: titleMaxWidth,
  });
  const safeVisibleTitle = escapeForXml(titleFit.text);
  const seasons = groupBySeason(data.activityHistory);
  const total = [...seasons.values()].reduce((a, b) => a + b, 0);
  const dominant = findDominantSeason(seasons);

  const seasonOrder = ["Winter", "Spring", "Summer", "Fall"];
  const maxCount = Math.max(1, ...seasons.values());

  const barWidth = (dims.w - 60) / 4;
  const barHeight = CHART_BAR_HEIGHT;
  const chartBaseY = CHART_BASE_Y;

  const bars = seasonOrder
    .map((season, i) => {
      const count = seasons.get(season) || 0;
      const height = Math.max(4, Math.round((count / maxCount) * barHeight));
      const x = 30 + i * barWidth + barWidth / 2 - 15;
      const y = chartBaseY + (barHeight - height);
      const percent = total > 0 ? Math.round((count / total) * 100) : 0;
      const seasonLabelFit = fitSvgSingleLineText({
        fontWeight: 400,
        initialFontSize: TYPOGRAPHY.STAT_SIZE,
        maxWidth: Math.max(24, barWidth - 8),
        minFontSize: 8,
        mode: "shrink-then-truncate",
        text: season,
      });
      const percentText = `${percent}%`;
      const percentFit = fitSvgSingleLineText({
        fontWeight: 600,
        initialFontSize: TYPOGRAPHY.STAT_VALUE_SIZE,
        maxWidth: Math.max(24, barWidth - 8),
        minFontSize: 8,
        mode: "shrink-then-truncate",
        text: percentText,
      });

      return `
        <g class="stagger" style="animation-delay: ${ANIMATION.CHART_BASE_DELAY + i * ANIMATION.CHART_INCREMENT}ms">
          <rect x="${x}" y="${y}" width="30" height="${height}" rx="${SHAPES.BAR_RADIUS}" fill="${resolvedColors.circleColor}" opacity="0.85"/>
          <text class="stat" x="${x + 15}" y="${y + height + 14}" text-anchor="middle"${seasonLabelFit ? ` font-size="${seasonLabelFit.fontSize}"` : ""}>${escapeForXml(seasonLabelFit?.text ?? season)}</text>
          <text class="stat-value" x="${x + 15}" y="${y - 6}" text-anchor="middle"${percentFit ? ` font-size="${percentFit.fontSize}"` : ""}>${escapeForXml(percentFit?.text ?? percentText)}</text>
        </g>
      `;
    })
    .join("");

  const summaryWidth = dims.w - 40;
  const dominantLabelText = "Dominant Season:";
  const dominantValueText = dominant;
  const dominantLabelFit = fitSvgSingleLineText({
    fontWeight: 400,
    initialFontSize: TYPOGRAPHY.STAT_SIZE,
    maxWidth: summaryWidth - 48,
    minFontSize: 8,
    mode: "shrink-then-truncate",
    text: dominantLabelText,
  });
  const dominantLabelWidth = Math.max(
    0,
    measureLabelWidth(dominantLabelText, dominantLabelFit),
  );
  const dominantValueX = Math.min(
    summaryWidth - 32,
    Math.ceil(dominantLabelWidth + 6),
  );
  const dominantValueFit = fitSvgSingleLineText({
    fontWeight: 600,
    initialFontSize: TYPOGRAPHY.STAT_VALUE_SIZE,
    maxWidth: Math.max(40, summaryWidth - dominantValueX),
    minFontSize: 8,
    mode: "shrink-then-truncate",
    text: dominantValueText,
  });
  const totalLabelText = "Total Activity:";
  const totalValueText = total.toLocaleString("en-US");
  const totalLabelFit = fitSvgSingleLineText({
    fontWeight: 400,
    initialFontSize: TYPOGRAPHY.STAT_SIZE,
    maxWidth: summaryWidth - 48,
    minFontSize: 8,
    mode: "shrink-then-truncate",
    text: totalLabelText,
  });
  const totalLabelWidth = Math.max(
    0,
    measureLabelWidth(totalLabelText, totalLabelFit),
  );
  const totalValueX = Math.min(
    summaryWidth - 32,
    Math.ceil(totalLabelWidth + 6),
  );
  const totalValueFit = fitSvgSingleLineText({
    fontWeight: 600,
    initialFontSize: TYPOGRAPHY.STAT_VALUE_SIZE,
    maxWidth: Math.max(40, summaryWidth - totalValueX),
    minFontSize: 8,
    mode: "shrink-then-truncate",
    text: totalValueText,
  });

  return markTrustedSvg(`
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${dims.w}"
  height="${dims.h}"
  viewBox="0 0 ${dims.w} ${dims.h}"
  fill="none"
  role="img"
  aria-labelledby="title-id"
>
  ${gradientDefs ? `<defs>${gradientDefs}</defs>` : ""}
  <title id="title-id">${safeTitle}</title>
  <style>
    ${generateCommonStyles(resolvedColors, titleFit.fontSize, { includeAnimations: animationsEnabled })}
    ${
      animationsEnabled
        ? `.stagger {
      opacity: 0;
      animation: fadeInAnimation 0.3s ease-in-out forwards;
    }
    @keyframes fadeInAnimation {
      from { opacity: 0; }
      to { opacity: 1; }
    }`
        : `.stagger {
      opacity: 1;
      animation: none;
    }`
    }
  </style>
  ${generateCardBackground(dims, cardRadius, resolvedColors)}
  <g transform="translate(20, ${SPACING.HEADER_Y})">
    <text class="header"${titleLengthAdjustAttrs}>${safeVisibleTitle}</text>
  </g>
  <g transform="translate(20, 50)">
    <text class="stat" y="0"${dominantLabelFit ? ` font-size="${dominantLabelFit.fontSize}"` : ""}>${escapeForXml(dominantLabelFit?.text ?? dominantLabelText)}</text>
    <text class="stat-value" x="${dominantValueX}" y="0"${dominantValueFit ? ` font-size="${dominantValueFit.fontSize}"` : ""}>${escapeForXml(dominantValueFit?.text ?? dominantValueText)}</text>
    <text class="stat" y="18"${totalLabelFit ? ` font-size="${totalLabelFit.fontSize}"` : ""}>${escapeForXml(totalLabelFit?.text ?? totalLabelText)}</text>
    <text class="stat-value" x="${totalValueX}" y="18"${totalValueFit ? ` font-size="${totalValueFit.fontSize}"` : ""}>${escapeForXml(totalValueFit?.text ?? totalValueText)}</text>
  </g>
  <g>
    ${bars}
  </g>
</svg>
`);
}
