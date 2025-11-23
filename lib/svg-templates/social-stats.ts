import { SocialStats } from "@/lib/types/card";
import { calculateDynamicFontSize } from "../utils";

export const socialStatsTemplate = (data: {
  username: string;
  variant?: "default" | "compact" | "minimal";
  styles: {
    titleColor: string;
    backgroundColor: string;
    textColor: string;
    circleColor: string;
    borderColor?: string;
  };
  stats: SocialStats;
  activityHistory: { date: number; amount: number }[];
}) => {
  // Calculate total activity amount
  const totalActivity = data.activityHistory.reduce(
    (acc, curr) => acc + curr.amount,
    0,
  );

  // Calculate the number of days between the earliest and latest activity
  const dates = data.activityHistory.map((entry) => entry.date * 1000);
  const earliestDate = Math.min(...dates);
  const latestDate = Math.max(...dates);
  const daysDifference = Math.ceil(
    (latestDate - earliestDate) / (1000 * 60 * 60 * 24),
  );

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

  return `
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${dims.w}"
  height="${dims.h}"
  viewBox="0 0 ${dims.w} ${dims.h}"
  fill="none"
  role="img"
  aria-labelledby="desc-id"
>
  <title id="title-id">${data.username}'s Social Stats</title>
  <desc id="desc-id">
    Total Followers: ${data.stats.followersPage.pageInfo.total},
    Total Following: ${data.stats.followingPage.pageInfo.total}, Total
    Activity: ${totalActivity} over ${daysDifference} days,
    Thread Posts/Comments Count: ${data.stats.threadCommentsPage.pageInfo.total},
    Total Reviews: ${data.stats.reviewsPage.pageInfo.total}
  </desc>

  <style>
    /* stylelint-disable selector-class-pattern, keyframes-name-pattern */
    .header { 
      fill: ${data.styles.titleColor};
      font: 600 ${calculateDynamicFontSize(
        `${data.username}'s Social Stats`,
      )}px 'Segoe UI', Ubuntu, Sans-Serif;
      animation: fadeInAnimation 0.8s ease-in-out forwards;
    }

    
    [data-testid="card-title"] text {
      fill: ${data.styles.titleColor};
    }

    [data-testid="main-card-body"] circle {
      stroke: ${data.styles.circleColor};
    }

    [data-testid="card-bg"] {
      fill: ${data.styles.backgroundColor};
    }

    [data-testid="main-card-body"] text {
      fill: ${data.styles.textColor};
    }

    .stat { 
      fill: ${data.styles.textColor};
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
    rx="4.5"
    height="${dims.h - 1}"
    width="${dims.w - 1}"
    fill="${data.styles.backgroundColor}"
    stroke="${data.styles.borderColor ?? "none"}"
    stroke-width="2"
  />
  <g data-testid="card-title" transform="translate(25, 35)">
    <g transform="translate(0, 0)">
      <text x="0" y="0" class="header" data-testid="header">
        ${data.username}'s Social Stats
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
          label: `Total Activity (${daysDifference} Days):`,
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
`;
};
