import { SocialStats, ColorValue } from "@/lib/types/card";
import type { TrustedSVG } from "@/lib/types/svg";
import {
  ANIMATION,
  POSITIONING,
  SPACING,
  TYPOGRAPHY,
} from "@/lib/svg-templates/common/constants";
import { getCardDimensions } from "@/lib/svg-templates/common/dimensions";

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
  variant?: "default" | "compact" | "minimal" | "badges";
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
  const variant = data.variant ?? "default";

  const toSafeInt = (n: unknown): number => {
    if (typeof n !== "number" || !Number.isFinite(n)) return 0;
    return Math.max(0, Math.round(n));
  };

  const formatCompact = (n: number): string => {
    if (!Number.isFinite(n)) return "0";
    if (n < 1000) return n.toLocaleString("en-US");
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);
  };

  const followers = toSafeInt(data.stats.followersPage?.pageInfo?.total);
  const following = toSafeInt(data.stats.followingPage?.pageInfo?.total);
  const threads = toSafeInt(data.stats.threadsPage?.pageInfo?.total);
  const threadComments = toSafeInt(
    data.stats.threadCommentsPage?.pageInfo?.total,
  );
  const reviews = toSafeInt(data.stats.reviewsPage?.pageInfo?.total);
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

  const dims = getCardDimensions("socialStats", variant);
  const cardRadius = getCardBorderRadius(data.styles.borderRadius);

  const title = `${data.username}'s Social Stats`;
  const safeTitle = escapeForXml(title);

  const activityTimespanStr = hasActivity
    ? `${totalActivity} over ${daysDifference} ${dayLabel}`
    : "Unknown";
  const safeActivityTimespanStr = escapeForXml(activityTimespanStr);

  const descMarkup = `
    <desc id="desc-id">
      Total Followers: ${escapeForXml(followers)},
      Total Following: ${escapeForXml(following)},
      Total Activity: ${safeActivityTimespanStr},
      Thread Posts Count: ${escapeForXml(threads)},
      Thread Comments Count: ${escapeForXml(threadComments)},
      Total Reviews: ${escapeForXml(reviews)}
    </desc>`;

  const renderBadges = (): string => {
    const items = [
      { label: "Followers", value: followers },
      { label: "Following", value: following },
      { label: "Threads", value: threads },
      { label: "Comments", value: threadComments },
      { label: "Reviews", value: reviews },
    ];

    const gridX = SPACING.CARD_PADDING;
    const gridY = 6;
    const gapX = 10;
    const gapY = 10;
    const cellW = Math.floor((dims.w - gridX * 2 - gapX) / 2);
    const cellH = 42;

    const safeValue = (n: number) => escapeForXml(formatCompact(n));
    const safeLabel = (s: string) => escapeForXml(s);

    return `
          <style>
            .kpi-box {
              fill: ${resolvedColors.circleColor};
              fill-opacity: 0.10;
              stroke: ${resolvedColors.circleColor};
              stroke-opacity: 0.45;
              stroke-width: 1;
            }
            .kpi-label {
              fill: ${resolvedColors.textColor};
              opacity: 0.82;
              font: 600 10px 'Segoe UI', Ubuntu, Sans-Serif;
              letter-spacing: 0.4px;
            }
            .kpi-value {
              fill: ${resolvedColors.textColor};
              font: 700 16px 'Segoe UI', Ubuntu, Sans-Serif;
            }
          </style>

          <g transform="translate(0, ${gridY})">
            ${items
              .map((it, idx) => {
                const col = idx % 2;
                const row = Math.floor(idx / 2);

                const isLast = idx === items.length - 1;
                const x = gridX + (isLast ? 0 : col * (cellW + gapX));
                const y = row * (cellH + gapY);
                const w = isLast ? dims.w - gridX * 2 : cellW;

                return `
                  <g class="stagger" style="animation-delay: ${ANIMATION.BASE_DELAY + idx * ANIMATION.STAGGER_INCREMENT}ms" transform="translate(${x}, ${y})">
                    <rect class="kpi-box" rx="10" ry="10" width="${w}" height="${cellH}" />
                    <text class="kpi-label" x="12" y="15">${safeLabel(it.label)}</text>
                    <text class="kpi-value" x="12" y="34">${safeValue(it.value)}</text>
                  </g>`;
              })
              .join("")}
          </g>`;
  };

  const renderDefaultRows = (): string => {
    const rows = [
      {
        id: "followers",
        label: "Total Followers:",
        value: followers,
      },
      {
        id: "following",
        label: "Total Following:",
        value: following,
      },
      {
        id: "activity",
        label: hasActivity
          ? `Total Activity (${daysDifference} ${dayLabel}):`
          : "Total Activity (Unknown):",
        value: totalActivity,
      },
      {
        id: "threads",
        label: "Thread Posts/Comments:",
        value: threads + threadComments,
      },
      {
        id: "reviews",
        label: "Total Reviews:",
        value: reviews,
      },
    ];

    let filtered = rows;
    if (variant === "compact") {
      filtered = rows.filter((r) => r.id !== "reviews");
    } else if (variant === "minimal") {
      filtered = rows.filter((r) => r.id !== "threads" && r.id !== "reviews");
    }

    return `
        <g transform="translate(0, 0)">
          ${filtered
            .map(
              (stat, index) => `
            <g
              class="stagger"
              style="animation-delay: ${ANIMATION.BASE_DELAY + index * ANIMATION.STAGGER_INCREMENT}ms"
              transform="translate(${SPACING.CARD_PADDING}, ${index * SPACING.ROW_HEIGHT})"
            >
              <text class="stat.bold" y="12.5">${escapeForXml(stat.label)}</text>
              <text class="stat.bold" x="${POSITIONING.STAT_VALUE_X_DEFAULT}" y="12.5">${escapeForXml(String(stat.value))}</text>
            </g>`,
            )
            .join("")}
        </g>`;
  };

  const renderBodyMarkup = (): string => {
    if (variant === "badges") return renderBadges();
    return renderDefaultRows();
  };

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
  ${descMarkup}

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
      font: 400 ${TYPOGRAPHY.STAT_SIZE}px 'Segoe UI', Ubuntu, Sans-Serif;
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
  <g data-testid="card-title" transform="translate(${SPACING.CARD_PADDING}, ${SPACING.HEADER_Y})">
    <g transform="translate(0, 0)">
      <text x="0" y="0" class="header" data-testid="header">
        ${safeTitle}
      </text>
    </g>
  </g>
  <g data-testid="main-card-body" transform="translate(0, ${SPACING.CONTENT_Y})">
    ${renderBodyMarkup()}
  </g>
</svg>
`);
};
