import { AnimeStats, MangaStats } from "@/lib/types/card";
import { calculateDynamicFontSize } from "../utils";

type MediaType = "anime" | "manga";

export const mediaStatsTemplate = (data: {
  mediaType: MediaType;
  username: string;
  variant?: "default" | "vertical" | "compact" | "minimal";
  styles: {
    titleColor: string;
    backgroundColor: string;
    textColor: string;
    circleColor: string;
  };
  stats: (AnimeStats | MangaStats) & {
    previousMilestone: number;
    currentMilestone: number;
    dasharray: string;
    dashoffset: string;
  };
}) => {
  const config = {
    anime: {
      title: `${data.username}'s Anime Stats`,
      mainStat: {
        label: "Episodes Watched",
        value: (data.stats as AnimeStats).episodesWatched,
        secondary: {
          label: "Minutes Watched",
          value: (data.stats as AnimeStats).minutesWatched,
        },
      },
    },
    manga: {
      title: `${data.username}'s Manga Stats`,
      mainStat: {
        label: "Chapters Read",
        value: (data.stats as MangaStats).chaptersRead,
        secondary: {
          label: "Volumes Read",
          value: (data.stats as MangaStats).volumesRead,
        },
      },
    },
  }[data.mediaType];

  // Dimensions per variant
  const dims = (() => {
    switch (data.variant) {
      case "vertical":
        return { w: 260, h: 350 };
      case "compact":
        return { w: 300, h: 130 };
      case "minimal":
        return { w: 220, h: 140 };
      default:
        return { w: 450, h: 195 };
    }
  })();

  // Circle radius per variant
  const circleRadius = (() => {
    switch (data.variant) {
      case "compact":
        return 30;
      case "minimal":
        return 28;
      case "vertical":
      default:
        return 40;
    }
  })();

  // Scale dasharray & dashoffset relative to base radius 40 to avoid overfill on smaller circles
  const baseRadius = 40;
  const scale = circleRadius / baseRadius;
  const originalDasharray = parseFloat(String(data.stats.dasharray));
  const originalDashoffset = parseFloat(String(data.stats.dashoffset));
  const scaledDasharray = isFinite(originalDasharray)
    ? (originalDasharray * scale).toFixed(2)
    : String(data.stats.dasharray);
  const scaledDashoffset = isFinite(originalDashoffset)
    ? (originalDashoffset * scale).toFixed(2)
    : String(data.stats.dashoffset);

  return `
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${dims.w}"
  height="${dims.h}"
  viewBox="0 0 ${dims.w} ${dims.h}"
  fill="none"
  role="img"
  aria-labelledby="desc-id"
  style="overflow: visible"
>
  <title id="title-id">${config.title}</title>
  <desc id="desc-id">
    Count: ${data.stats.count}, 
    ${config.mainStat.label}: ${config.mainStat.value},
    ${config.mainStat.secondary.label}: ${config.mainStat.secondary.value}, 
    Mean Score: ${data.stats.meanScore},
    Standard Deviation: ${data.stats.standardDeviation}
  </desc>
  <style>
    /* stylelint-disable selector-class-pattern, keyframes-name-pattern */
    .header { 
      fill: ${data.styles.titleColor};
      font: 600 ${calculateDynamicFontSize(config.title)}px 'Segoe UI', Ubuntu, Sans-Serif;
      animation: fadeInAnimation 0.8s ease-in-out forwards;
    }
    
    [data-testid="card-title"] text { fill: ${data.styles.titleColor}; }
    [data-testid="main-card-body"] circle { stroke: ${data.styles.circleColor}; }
    [data-testid="card-bg"] { fill: ${data.styles.backgroundColor}; }
    [data-testid="main-card-body"] text { fill: ${data.styles.textColor}; }

    .stat { 
      fill: ${data.styles.textColor};
      font: 400 13px 'Segoe UI', Ubuntu, Sans-Serif;
    }

    .stagger {
      opacity: 0;
      animation: fadeInAnimation 0.3s ease-in-out forwards;
    }

    .rank-circle-rim {
      fill: none;
      stroke-width: 6;
    }

    .rank-circle {
      stroke-dasharray: ${scaledDasharray};
      stroke: ${data.styles.circleColor};
      fill: none;
      stroke-width: 6;
      stroke-linecap: round;
      opacity: 0.8;
      animation: rankAnimation 1s forwards ease-in-out;
    }

    @keyframes rankAnimation {
      from { stroke-dashoffset: ${scaledDasharray}; }
      to { stroke-dashoffset: ${scaledDashoffset}; }
    }

    @keyframes scaleInAnimation {
      from { transform: translate(0, 0) scale(0); }
      to { transform: translate(0, 0) scale(1); }
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
    stroke="#e4e2e2"
    width="${dims.w - 1}"
    fill="${data.styles.backgroundColor}"
    stroke-opacity="1"
  />
  <g data-testid="card-title" transform="translate(25, 35)">
    <g transform="translate(0, 0)">
      <text x="0" y="0" class="header" data-testid="header">${config.title}</text>
    </g>
  </g>
  <g data-testid="main-card-body" transform="translate(0, 55)">
    ${
      data.variant === "vertical"
        ? `
      <g transform="translate(230, 140)">
        <text x="-100" y="-130" class="milestone" text-anchor="middle">${
          data.stats.currentMilestone
        }</text>
        <text x="-100" y="-70" class="main-stat" text-anchor="middle">${
          config.mainStat.value
        }</text>
        <text x="-100" y="-10" class="label" text-anchor="middle">${config.mainStat.label}</text>
        <circle class="rank-circle-rim" cx="-100" cy="-72" r="40" fill="none" stroke="${data.styles.circleColor}" stroke-opacity="0.2" stroke-width="6"></circle>
        <g transform="rotate(-90 -100 -72)">
          <circle class="rank-circle" cx="-100" cy="-72" r="40" stroke-dasharray="${scaledDasharray}" stroke-dashoffset="${scaledDashoffset}"></circle>
        </g>
      </g>
      <svg x="0" y="0">
        <g transform="translate(0, 150)">
          ${[
            { label: "Count:", value: data.stats.count },
            {
              label: `${config.mainStat.label}:`,
              value: config.mainStat.value,
            },
            {
              label: `${config.mainStat.secondary.label}:`,
              value: config.mainStat.secondary.value,
            },
            { label: "Mean Score:", value: data.stats.meanScore },
            {
              label: "Standard Deviation:",
              value: data.stats.standardDeviation,
            },
          ]
            .map(
              (stat, index) => `
            <g
              class="stagger"
              style="animation-delay: ${450 + index * 150}ms"
              transform="translate(25, ${index * 25})"
            >
              <text class="stat" y="12.5">${stat.label}</text>
              <text class="stat" x="160" y="12.5">${stat.value}</text>
            </g>
          `,
            )
            .join("")}
        </g>
      </svg>
    `
        : data.variant === "compact"
          ? `
      <g transform="translate(${dims.w - 50}, 20)">
        <text x="-10" y="15" class="main-stat" text-anchor="middle" fill="${
          data.styles.textColor
        }" font-size="16">${config.mainStat.value}</text>
        <circle class="rank-circle-rim" cx="-10" cy="10" r="30" fill="none" stroke="${data.styles.textColor}" stroke-opacity="0.2" stroke-width="5"></circle>
        <g transform="rotate(-90 -10 10)">
          <circle class="rank-circle" cx="-10" cy="10" r="30" stroke-width="5" stroke-dasharray="${scaledDasharray}" stroke-dashoffset="${scaledDashoffset}"></circle>
        </g>
      </g>
      <svg x="0" y="0">
        <g transform="translate(0, 0)">
          ${[
            { label: "Count:", value: data.stats.count },
            {
              label: `${config.mainStat.secondary.label}:`,
              value: config.mainStat.secondary.value,
            },
            { label: "Mean Score:", value: data.stats.meanScore },
          ]
            .filter((s) => s.value !== undefined)
            .map(
              (stat, index) => `
            <g
              class="stagger"
              style="animation-delay: ${450 + index * 120}ms"
              transform="translate(25, ${index * 22})"
            >
              <text class="stat" y="12.5">${stat.label}</text>
              <text class="stat" x="120" y="12.5">${stat.value}</text>
            </g>
          `,
            )
            .join("")}
        </g>
      </svg>
    `
          : data.variant === "minimal"
            ? `
      <g transform="translate(${Math.round(dims.w / 2)}, 20)">
        <text x="0" y="5" class="main-stat" text-anchor="middle" fill="${
          data.styles.textColor
        }" font-size="16">${config.mainStat.value}</text>
        <text x="0" y="50" class="label" text-anchor="middle" fill="${
          data.styles.circleColor
        }" font-size="14">${config.mainStat.label}</text>
        <circle class="rank-circle-rim" cx="0" cy="0" r="28" fill="none" stroke="${data.styles.textColor}" stroke-opacity="0.2" stroke-width="5"></circle>
        <g transform="rotate(-90 0 0)">
          <circle class="rank-circle" cx="0" cy="0" r="28" stroke-width="5" stroke-dasharray="${scaledDasharray}" stroke-dashoffset="${scaledDashoffset}"></circle>
        </g>
      </g>
    `
            : `
      <g transform="translate(375, 37.5)">
        <text x="-10" y="-50" class="milestone" text-anchor="middle" fill="${
          data.styles.circleColor
        }">
          ${data.stats.currentMilestone}
        </text>
        <text x="-10" y="10" class="main-stat" text-anchor="middle" fill="${data.styles.textColor}">
          ${config.mainStat.value}
        </text>
        <text x="-10" y="70" class="label" text-anchor="middle" fill="${data.styles.circleColor}">
          ${config.mainStat.label}
        </text>
        <circle class="rank-circle-rim" cx="-10" cy="8" r="40" fill="none" stroke="${data.styles.textColor}" stroke-opacity="0.2" stroke-width="6"></circle>
        <g transform="rotate(-90 -10 8)">
          <circle class="rank-circle" cx="-10" cy="8" r="40" stroke-dasharray="${scaledDasharray}" stroke-dashoffset="${scaledDashoffset}"></circle>
        </g>
      </g>
      <svg x="0" y="0">
        <g transform="translate(0, 0)">
          ${[
            { label: "Count:", value: data.stats.count },
            {
              label: `${config.mainStat.label}:`,
              value: config.mainStat.value,
            },
            {
              label: `${config.mainStat.secondary.label}:`,
              value: config.mainStat.secondary.value,
            },
            { label: "Mean Score:", value: data.stats.meanScore },
            {
              label: "Standard Deviation:",
              value: data.stats.standardDeviation,
            },
          ]
            .map(
              (stat, index) => `
            <g
              class="stagger"
              style="animation-delay: ${450 + index * 150}ms"
              transform="translate(25, ${index * 25})"
            >
              <text class="stat" y="12.5">${stat.label}</text>
              <text class="stat" x="199.01" y="12.5">${stat.value}</text>
            </g>
          `,
            )
            .join("")}
        </g>
      </svg>
    `
    }
  </g>
</svg>`;
};
