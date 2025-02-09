import { AnimeStats } from "@/lib/types/card";

export const animeStatsTemplate = (data: {
	username: string;
	styles: {
		titleColor: string;
		backgroundColor: string;
		textColor: string;
		circleColor: string;
	};
	stats: AnimeStats & {
		previousMilestone: number;
		currentMilestone: number;
		dasharray: string;
		dashoffset: string;
	};
}) => `
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="450"
  height="195"
  viewBox="0 0 450 195"
  fill="none"
  role="img"
  aria-labelledby="desc-id"
  style="overflow: visible"
>
  <title id="title-id">${data.username}'s Anime Stats</title>
  <desc id="desc-id">
    Count: ${data.stats.count}, Episodes Watched: ${data.stats.episodesWatched},
    Minutes Watched: ${data.stats.minutesWatched}, 
    Mean Score: ${data.stats.meanScore},
    Standard Deviation: ${data.stats.standardDeviation}
  </desc>
  <style>
    /* stylelint-disable selector-class-pattern, keyframes-name-pattern */
    .header { 
      fill: ${data.styles.titleColor};
      font: 600 18px 'Segoe UI', Ubuntu, Sans-Serif;
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
    x="0.5"
    y="0.5"
    rx="4.5"
    height="99%"
    stroke="#e4e2e2"
    width="449"
    fill="${data.styles.backgroundColor}"
    stroke-opacity="1"
  />
  <g data-testid="card-title" transform="translate(25, 35)">
    <g transform="translate(0, 0)">
      <text x="0" y="0" class="header" data-testid="header">
        ${data.username}'s Anime Stats
      </text>
    </g>
  </g>

  <g data-testid="main-card-body" transform="translate(0, 55)">
    <g transform="translate(375, 37.5)">
      <text
        x="-10"
        y="-50"
        class="milestone"
        text-anchor="middle"
        alignment-baseline="middle"
        fill="#a9fef7"
        font-size="15"
        style="animation: scaleInAnimation 0.5s"
      >
        ${data.stats.currentMilestone}
      </text>
      <text
        x="-10"
        y="10"
        class="episodes-watched"
        text-anchor="middle"
        alignment-baseline="middle"
        fill="#fe428e"
        font-size="15"
        style="animation: scaleInAnimation 0.5s"
      >
        ${data.stats.episodesWatched}
      </text>
      <text
        x="-10"
        y="70"
        class="label"
        text-anchor="middle"
        alignment-baseline="middle"
        fill="#a9fef7"
        font-size="15"
        style="animation: scaleInAnimation 0.5s"
      >
        Episodes Watched
      </text>
      <circle class="rank-circle-rim" cx="-10" cy="8" r="40"></circle>
      <circle class="rank-circle" cx="-10" cy="8" r="40"></circle>
    </g>
    <svg x="0" y="0">
      <g transform="translate(0, 0)">
        <g
          class="stagger"
          style="animation-delay: 450ms"
          transform="translate(25, 0)"
        >
          <text class="stat.bold" y="12.5">Count:</text>
          <text class="stat.bold" x="199.01" y="12.5" data-testid="count">
            ${data.stats.count}
          </text>
        </g>
        <g
          class="stagger"
          style="animation-delay: 600ms"
          transform="translate(25, 25)"
        >
          <text class="stat.bold" y="12.5">Episodes Watched:</text>
          <text
            class="stat.bold"
            x="199.01"
            y="12.5"
            data-testid="episodesWatched"
          >
            ${data.stats.episodesWatched}
          </text>
        </g>
        <g
          class="stagger"
          style="animation-delay: 750ms"
          transform="translate(25, 50)"
        >
          <text class="stat.bold" y="12.5">Minutes Watched:</text>
          <text
            class="stat.bold"
            x="199.01"
            y="12.5"
            data-testid="minutesWatched"
          >
            ${data.stats.minutesWatched}
          </text>
        </g>
        <g
          class="stagger"
          style="animation-delay: 900ms"
          transform="translate(25, 75)"
        >
          <text class="stat.bold" y="12.5">Mean Score:</text>
          <text class="stat.bold" x="199.01" y="12.5" data-testid="meanScore">
            ${data.stats.meanScore}
          </text>
        </g>
        <g
          class="stagger"
          style="animation-delay: 1050ms"
          transform="translate(25, 100)"
        >
          <text class="stat.bold" y="12.5">Standard Deviation:</text>
          <text
            class="stat.bold"
            x="199.01"
            y="12.5"
            data-testid="standardDeviation"
          >
            ${data.stats.standardDeviation}
          </text>
        </g>
      </g>
    </svg>
  </g>
</svg>
`;
