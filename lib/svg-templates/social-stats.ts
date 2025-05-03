import { SocialStats } from "@/lib/types/card";
import { calculateDynamicFontSize } from "../utils";

export const socialStatsTemplate = (data: {
  username: string;
  styles: {
    titleColor: string;
    backgroundColor: string;
    textColor: string;
    circleColor: string;
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

  return `
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="280"
  height="195"
  viewBox="0 0 280 195"
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
    height="99%"
    stroke="#e4e2e2"
    width="279"
    fill="#141321"
    stroke-opacity="1"
  />
  <g data-testid="card-title" transform="translate(25, 35)">
    <g transform="translate(0, 0)">
      <text x="0" y="0" class="header" data-testid="header">
        ${data.username}'s Social Stats
      </text>
    </g>
  </g>
  <g data-testid="main-card-body" transform="translate(0, 55)">
    <g transform="translate(0, 0)">
      <g
        class="stagger"
        style="animation-delay: 450ms"
        transform="translate(25, 0)"
      >
        <text class="stat.bold" y="12.5">Total Followers:</text>
        <text
          class="stat.bold"
          x="199.01"
          y="12.5"
          data-testid="totalFollowers"
        >
          ${data.stats.followersPage.pageInfo.total}
        </text>
      </g>
      <g
        class="stagger"
        style="animation-delay: 600ms"
        transform="translate(25, 25)"
      >
        <text class="stat.bold" y="12.5">Total Following:</text>
        <text
          class="stat.bold"
          x="199.01"
          y="12.5"
          data-testid="totalFollowing"
        >
          ${data.stats.followingPage.pageInfo.total}
        </text>
      </g>
      <g
        class="stagger"
        style="animation-delay: 750ms"
        transform="translate(25, 50)"
      >
        <text class="stat.bold" y="12.5">Total Activity (${daysDifference} Days):</text>
        <text class="stat.bold" x="199.01" y="12.5" data-testid="totalActivity">
          ${totalActivity}
        </text>
      </g>
      <g
        class="stagger"
        style="animation-delay: 900ms"
        transform="translate(25, 75)"
      >
        <text class="stat.bold" y="12.5">Thread Posts/Comments:</text>
        <text
          class="stat.bold"
          x="199.01"
          y="12.5"
          data-testid="threadPostsCommentsCount"
        >
          ${data.stats.threadCommentsPage.pageInfo.total}
        </text>
      </g>
      <g
        class="stagger"
        style="animation-delay: 1050ms"
        transform="translate(25, 100)"
      >
        <text class="stat.bold" y="12.5">Total Reviews:</text>
        <text class="stat.bold" x="199.01" y="12.5" data-testid="totalReviews">
          ${data.stats.reviewsPage.pageInfo.total}
        </text>
      </g>
    </g>
  </g>
</svg>
`;
};
