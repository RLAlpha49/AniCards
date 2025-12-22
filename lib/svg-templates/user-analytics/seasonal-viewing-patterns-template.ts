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
  SHAPES,
  SPACING,
} from "@/lib/svg-templates/common/constants";
import { getCardDimensions } from "@/lib/svg-templates/common/dimensions";
import { generateCardBackground } from "@/lib/svg-templates/common/base-template-utils";
import { generateCommonStyles } from "@/lib/svg-templates/common/style-generators";

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
  };
  activityHistory: ActivityHistoryItem[];
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

  const dims = getCardDimensions("seasonalViewingPatterns", "default");
  const seasons = groupBySeason(data.activityHistory);
  const total = [...seasons.values()].reduce((a, b) => a + b, 0);
  const dominant = findDominantSeason(seasons);

  const seasonOrder = ["Winter", "Spring", "Summer", "Fall"];
  const maxCount = Math.max(1, ...seasons.values());

  const barWidth = (dims.w - 60) / 4;
  const barHeight = 80;

  const bars = seasonOrder
    .map((season, i) => {
      const count = seasons.get(season) || 0;
      const height = Math.max(4, Math.round((count / maxCount) * barHeight));
      const x = 30 + i * barWidth + barWidth / 2 - 15;
      const y = 80 + (barHeight - height);
      const percent = total > 0 ? Math.round((count / total) * 100) : 0;

      return `
        <g class="stagger" style="animation-delay: ${ANIMATION.CHART_BASE_DELAY + i * ANIMATION.CHART_INCREMENT}ms">
          <rect x="${x}" y="${y}" width="30" height="${height}" rx="${SHAPES.BAR_RADIUS}" fill="${resolvedColors.circleColor}" opacity="0.85"/>
          <text class="stat" x="${x + 15}" y="${y + height + 14}" text-anchor="middle">${season}</text>
          <text class="stat-value" x="${x + 15}" y="${y - 6}" text-anchor="middle">${percent}%</text>
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
  aria-labelledby="title-id"
>
  ${gradientDefs ? `<defs>${gradientDefs}</defs>` : ""}
  <title id="title-id">${safeTitle}</title>
  <style>
    ${generateCommonStyles(resolvedColors, Number.parseFloat(calculateDynamicFontSize(title)))}
    .stagger {
      opacity: 0;
      animation: fadeInAnimation 0.3s ease-in-out forwards;
    }
    @keyframes fadeInAnimation {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  </style>
  ${generateCardBackground(dims, cardRadius, resolvedColors)}
  <g transform="translate(20, ${SPACING.HEADER_Y})">
    <text class="header">${safeTitle}</text>
  </g>
  <g transform="translate(20, 50)">
    <text class="stat">Dominant Season: <tspan class="stat-value">${dominant}</tspan></text>
    <text class="stat" y="18">Total Activity: <tspan class="stat-value">${total.toLocaleString("en-US")}</tspan></text>
  </g>
  <g>
    ${bars}
  </g>
</svg>
`);
}
