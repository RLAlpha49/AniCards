import { AnimeStats, MangaStats } from "@/lib/types/card";
import { calculateDynamicFontSize } from "../utils";

type MediaType = "anime" | "manga";

export const mediaStatsTemplate = (data: {
	mediaType: MediaType;
	username: string;
	variant?: "default" | "vertical";
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

	return `
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${data.variant === "vertical" ? 260 : 450}"
  height="${data.variant === "vertical" ? 350 : 195}"
  viewBox="0 0 ${data.variant === "vertical" ? 260 : 450} ${
		data.variant === "vertical" ? 350 : 195
	}"
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
      opacity: 0.2;
    }

    .rank-circle {
      stroke-dasharray: ${data.stats.dasharray};
      stroke: ${data.styles.circleColor};
      fill: none;
      stroke-width: 6;
      stroke-linecap: round;
      opacity: 0.8;
      transform-origin: -10px 8px;
      transform: rotate(-90deg);
      animation: rankAnimation 1s forwards ease-in-out;
    }

    @keyframes rankAnimation {
      from { stroke-dashoffset: ${data.stats.dasharray}; }
      to { stroke-dashoffset: ${data.stats.dashoffset}; }
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
    height="99%"
    stroke="#e4e2e2"
    width="${data.variant === "vertical" ? 259 : 449}"
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
        <circle class="rank-circle-rim" cx="-100" cy="-72" r="40"></circle>
        <circle class="rank-circle" style="transform-origin: -100px -72px" cx="-100" cy="-72" r="40"></circle>
      </g>
      <svg x="0" y="0">
        <g transform="translate(0, 150)">
          ${[
				{ label: "Count:", value: data.stats.count },
				{ label: `${config.mainStat.label}:`, value: config.mainStat.value },
				{
					label: `${config.mainStat.secondary.label}:`,
					value: config.mainStat.secondary.value,
				},
				{ label: "Mean Score:", value: data.stats.meanScore },
				{ label: "Standard Deviation:", value: data.stats.standardDeviation },
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
          `
				)
				.join("")}
        </g>
      </svg>
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
        <circle class="rank-circle-rim" cx="-10" cy="8" r="40"></circle>
        <circle class="rank-circle" cx="-10" cy="8" r="40"></circle>
      </g>
      <svg x="0" y="0">
        <g transform="translate(0, 0)">
          ${[
				{ label: "Count:", value: data.stats.count },
				{ label: `${config.mainStat.label}:`, value: config.mainStat.value },
				{
					label: `${config.mainStat.secondary.label}:`,
					value: config.mainStat.secondary.value,
				},
				{ label: "Mean Score:", value: data.stats.meanScore },
				{ label: "Standard Deviation:", value: data.stats.standardDeviation },
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
          `
				)
				.join("")}
        </g>
      </svg>
    `
	}
  </g>
</svg>`;
};
