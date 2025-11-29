import { SocialStats, ColorValue } from "@/lib/types/card";
import type { TrustedSVG } from "@/lib/types/svg";

import {
  calculateDynamicFontSize,
  processColorsForSVG,
  getCardBorderRadius,
  escapeForXml,
  markTrustedSvg,
} from "../utils";

/**
 * Renders an SVG string visualizing a user's social metrics: followers,
 * following, activity span, threads and reviews. The function returns
 * a ready-to-embed SVG string for the card endpoint.
 * @param data - Template input including username, styles, metrics and optional activity history.
 * @returns The generated SVG markup as a string.
 * @source
 */
export const socialStatsTemplate = (data: {
  username: string;
  variant?: "default" | "compact" | "minimal";
  styles: {
    titleColor: ColorValue;
    backgroundColor: ColorValue;
    textColor: ColorValue;
    circleColor: ColorValue;
    borderColor?: ColorValue;
    borderRadius?: number;
  };
  stats: SocialStats;
  activityHistory?: { date: number; amount: number }[];
}): TrustedSVG => {
  // Process colors for gradient support
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

  // Defensive handling for activityHistory: can be undefined or empty
  const activityHistory = data.activityHistory ?? [];
  // Calculate total activity amount
  const totalActivity = activityHistory.length
    ? activityHistory.reduce((acc, curr) => acc + curr.amount, 0)
    : 0;

  // Calculate the number of days between the earliest and latest activity
  const dates = activityHistory.map((entry) => entry.date * 1000);
  let earliestDate = 0;
  let latestDate = 0;
  let daysDifference = 0;
  const hasActivity = dates.length > 0;
  if (hasActivity) {
    earliestDate = Math.min(...dates);
    latestDate = Math.max(...dates);
    daysDifference = Math.ceil(
      (latestDate - earliestDate) / (1000 * 60 * 60 * 24),
    );
    // If there's a single day, show 1 day for readability
    if (daysDifference === 0) daysDifference = 1;
  }
  const dayLabel = daysDifference === 1 ? "day" : "days";

  const dims = (() => {
    switch (data.variant) {
      case "compact":
        return { w: 280, h: 160 };
      case "minimal":
        return { w: 280, h: 130 };
      default:
        return { w: 280, h: 195 };
    }
  })();
  const cardRadius = getCardBorderRadius(data.styles.borderRadius);

  const title = `${data.username}'s Social Stats`;
  const safeTitle = escapeForXml(title);

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
  ${(() => {
    const activityTimespanStr = hasActivity
      ? `${totalActivity} over ${daysDifference} ${dayLabel}`
      : "Unknown";
    const safeActivityTimespanStr = escapeForXml(activityTimespanStr);

    return `
    <desc id="desc-id">
      Total Followers: ${data.stats.followersPage.pageInfo.total},
      Total Following: ${data.stats.followingPage.pageInfo.total},
      Total Activity: ${safeActivityTimespanStr},
      Thread Posts/Comments Count: ${data.stats.threadCommentsPage.pageInfo.total},
      Total Reviews: ${data.stats.reviewsPage.pageInfo.total}
    </desc>`;
  })()}

  <style>
    /* stylelint-disable selector-class-pattern, keyframes-name-pattern */
    .header { 
      fill: ${resolvedColors.titleColor};
      font: 600 ${calculateDynamicFontSize(title)}px 'Segoe UI', Ubuntu, Sans-Serif;
      animation: fadeInAnimation 0.8s ease-in-out forwards;
    }

    
    [data-testid="card-title"] text {
      fill: ${resolvedColors.titleColor};
    }

    [data-testid="main-card-body"] circle {
      stroke: ${resolvedColors.circleColor};
    }

    [data-testid="card-bg"] {
      fill: ${resolvedColors.backgroundColor};
    }

    [data-testid="main-card-body"] text {
      fill: ${resolvedColors.textColor};
    }

    .stat { 
      fill: ${resolvedColors.textColor};
      font: 400 13px 'Segoe UI', Ubuntu, Sans-Serif;
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
    data-testid="card-bg"
    x="0.5"
    y="0.5"
    rx="${cardRadius}"
    height="${dims.h - 1}"
    width="${dims.w - 1}"
    fill="${resolvedColors.backgroundColor}"
    ${resolvedColors.borderColor ? `stroke="${resolvedColors.borderColor}"` : ""}
    stroke-width="2"
  />
  <g data-testid="card-title" transform="translate(25, 35)">
    <g transform="translate(0, 0)">
      <text x="0" y="0" class="header" data-testid="header">
        ${safeTitle}
      </text>
    </g>
  </g>
  <g data-testid="main-card-body" transform="translate(0, 55)">
    ${(() => {
      const rows = [
        {
          id: "followers",
          label: "Total Followers:",
          value: data.stats.followersPage.pageInfo.total,
        },
        {
          id: "following",
          label: "Total Following:",
          value: data.stats.followingPage.pageInfo.total,
        },
        {
          id: "activity",
          label: (() => {
            return hasActivity
              ? `Total Activity (${daysDifference} ${dayLabel}):`
              : `Total Activity (Unknown):`;
          })(),
          value: totalActivity,
        },
        {
          id: "threads",
          label: "Thread Posts/Comments:",
          value: data.stats.threadCommentsPage.pageInfo.total,
        },
        {
          id: "reviews",
          label: "Total Reviews:",
          value: data.stats.reviewsPage.pageInfo.total,
        },
      ];

      let filtered = rows;
      if (data.variant === "compact") {
        // Remove reviews only
        filtered = rows.filter((r) => r.id !== "reviews");
      } else if (data.variant === "minimal") {
        // Remove thread posts/comments AND reviews
        filtered = rows.filter((r) => r.id !== "threads" && r.id !== "reviews");
      }

      return `
        <g transform="translate(0, 0)">
          ${filtered
            .map(
              (stat, index) => `
            <g
              class="stagger"
              style="animation-delay: ${450 + index * 150}ms"
              transform="translate(25, ${index * 25})"
            >
              <text class="stat.bold" y="12.5">${stat.label}</text>
              <text class="stat.bold" x="199.01" y="12.5">${stat.value}</text>
            </g>`,
            )
            .join("")}
        </g>`;
    })()}
  </g>
</svg>
`);
};
