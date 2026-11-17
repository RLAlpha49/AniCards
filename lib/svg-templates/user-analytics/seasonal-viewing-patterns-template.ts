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

// Semibold Segoe UI advance widths in em; unknown glyphs use a wider fallback.
function estimateTitleWidth(text: string, fontSize: number): number {
  const uppercase = [
    0.6714, 0.604, 0.6211, 0.7173, 0.5176, 0.5024, 0.6973, 0.7354, 0.2915,
    0.3965, 0.6108, 0.4888, 0.9243, 0.7671, 0.7559, 0.5845, 0.7559, 0.6226,
    0.5444, 0.5518, 0.7031, 0.6416, 0.9658, 0.6191, 0.5771, 0.5869,
  ];
  const lowercase = [
    0.522, 0.6025, 0.4702, 0.6025, 0.5313, 0.3447, 0.6025, 0.582, 0.2612,
    0.2612, 0.5249, 0.2612, 0.8857, 0.5835, 0.5972, 0.6025, 0.6025, 0.3701,
    0.4312, 0.3613, 0.5835, 0.5073, 0.7563, 0.501, 0.5083, 0.4644,
  ];
  const digits = [
    0.5552, 0.4023, 0.5552, 0.5552, 0.5762, 0.5552, 0.5581, 0.5361, 0.5552,
    0.5581,
  ];
  return Array.from(text).reduce((width, character) => {
    const originalCode = character.codePointAt(0) ?? 0;
    const code = originalCode <= 0x024f
      ? (character.normalize("NFD").codePointAt(0) ?? originalCode)
      : originalCode;
    const factor = code >= 65 && code <= 90
      ? uppercase[code - 65]
      : code >= 97 && code <= 122
        ? lowercase[code - 97]
        : code >= 48 && code <= 57
          ? digits[code - 48]
          : /[ .,':;]/u.test(character)
            ? 0.275
            : (code >= 0x2e80 && code <= 0xd7ff) ||
                (code >= 0xf900 && code <= 0xfaff) ||
                (code >= 0x20000 && code <= 0x3ffff)
              ? 1
              : code > 0x7f
                ? 1.5
                : 1;
    return width + factor * fontSize;
  }, 0);
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
  const baseTitleFontSize = Number.parseFloat(calculateDynamicFontSize(title));
  const titleWidth = dims.w - 40;
  // The suffix width includes kerning at the header's semibold weight.
  const estimatedTitleWidth =
    estimateTitleWidth(data.username, baseTitleFontSize) +
    8.5943 * baseTitleFontSize;
  const titleFontSize =
    baseTitleFontSize *
    (estimatedTitleWidth > titleWidth
      ? (titleWidth * 0.98) / estimatedTitleWidth
      : 1);
  const seasons = groupBySeason(data.activityHistory);
  const total = [...seasons.values()].reduce((a, b) => a + b, 0);
  const dominant = findDominantSeason(seasons);

  const seasonOrder = ["Winter", "Spring", "Summer", "Fall"];
  const maxCount = Math.max(1, ...seasons.values());

  const barWidth = (dims.w - 60) / 4;
  const barHeight = 58;

  const bars = seasonOrder
    .map((season, i) => {
      const count = seasons.get(season) || 0;
      const height = Math.max(4, Math.round((count / maxCount) * barHeight));
      const x = 30 + i * barWidth + barWidth / 2 - 15;
      const y = 105 + (barHeight - height);
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
    ${generateCommonStyles(resolvedColors, titleFontSize)}
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
  <g transform="translate(20, ${SPACING.HEADER_Y - 5})">
    <text class="header">${safeTitle}</text>
  </g>
  <g transform="translate(20, 52)">
    <text class="stat">Dominant Season: <tspan class="stat-value">${dominant}</tspan></text>
    <text class="stat" y="18">Total Activity: <tspan class="stat-value">${total.toLocaleString("en-US")}</tspan></text>
  </g>
  <g>
    ${bars}
  </g>
</svg>
`);
}
