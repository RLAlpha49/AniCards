export const extraAnimeMangaStatsTemplate = (data: {
	username: string;
	styles: {
		titleColor: string;
		backgroundColor: string;
		textColor: string;
		circleColor: string;
	};
	format: "anime" | "manga";
	stats: { name: string; count: number }[];
}) => `
    <svg
  xmlns="http://www.w3.org/2000/svg"
  width="280"
  height="195"
  viewBox="0 0 280 195"
  fill="none"
  role="img"
  aria-labelledby="desc-id"
>
  <title id="title-id">${data.username}'s ${data.format} Stats</title>
  <desc id="desc-id">
    ${data.stats.map((stat) => `${stat.name}: ${stat.count}`).join(", ")}
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
    fill="${data.styles.backgroundColor}"
    stroke-opacity="1"
  />
  <g data-testid="card-title" transform="translate(25, 35)">
    <g transform="translate(0, 0)">
      <text x="0" y="0" class="header" data-testid="header">
        ${data.username}'s ${data.format} Stats
      </text>
    </g>
  </g>
  <g data-testid="main-card-body" transform="translate(0, 55)">
    ${data.stats
		.map(
			(stat, index) => `
      <g class="stagger" style="animation-delay: ${450 + index * 150}ms" transform="translate(25, ${
				index * 25
			})">
        <text class="stat.bold" y="12.5">${stat.name}:</text>
        <text class="stat.bold" x="199.01" y="12.5">${stat.count}</text>
      </g>
    `
		)
		.join("")}
  </g>
</svg>
`;
