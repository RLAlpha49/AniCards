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

/**
 * Generates a recent activity feed card (text-based listing).
 * Note: This is a simplified version using activity history counts.
 * For full feed with media details, additional API data would be needed.
 * @param data - Template input with username, styles, and activity history.
 * @returns TrustedSVG string for the feed card.
 * @source
 */
export function recentActivityFeedTemplate(data: {
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
  const title = `${data.username}'s Activity Feed`;
  const safeTitle = escapeForXml(title);

  // Get most recent activities (up to 5)
  const sorted = [...data.activityHistory]
    .sort((a, b) => b.date - a.date)
    .slice(0, 5);

  const dims = { w: 280, h: 180 };

  const feedItems = sorted.map((item, i) => {
    const date = new Date(item.date * 1000);
    const dateStr = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
    return `
      <g class="stagger" style="animation-delay: ${400 + i * 150}ms" transform="translate(0, ${i * 24})">
        <circle cx="8" cy="8" r="4" fill="${resolvedColors.circleColor}" />
        <text class="feed-date" x="20" y="12">${dateStr}</text>
        <text class="feed-amount" x="${dims.w - 40}" y="12" text-anchor="end">${item.amount} activities</text>
      </g>
    `;
  });

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
  <desc id="desc-id">Recent activity feed showing ${sorted.length} entries</desc>
  <style>
    .header {
      fill: ${resolvedColors.titleColor};
      font: 600 ${calculateDynamicFontSize(title, 16, dims.w - 40)}px 'Segoe UI', Ubuntu, Sans-Serif;
      animation: fadeInAnimation 0.8s ease-in-out forwards;
    }
    .feed-date {
      fill: ${resolvedColors.textColor};
      font: 500 11px 'Segoe UI', Ubuntu, Sans-Serif;
    }
    .feed-amount {
      fill: ${resolvedColors.textColor};
      font: 400 11px 'Segoe UI', Ubuntu, Sans-Serif;
      opacity: 0.8;
      text-anchor: end;
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
    ${feedItems.join("")}
  </g>
</svg>
`);
}
