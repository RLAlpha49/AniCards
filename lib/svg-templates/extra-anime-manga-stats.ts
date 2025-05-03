import { calculateDynamicFontSize } from "../utils";

export const extraAnimeMangaStatsTemplate = (data: {
  username: string;
  styles: {
    titleColor: string;
    backgroundColor: string;
    textColor: string;
    circleColor: string;
  };
  format: string;
  stats: { name: string; count: number }[];
  showPieChart?: boolean;
}) => {
  const svgWidth = data.showPieChart ? 340 : 280;
  const viewBoxWidth = data.showPieChart ? 340 : 280;
  const rectWidth = data.showPieChart ? 339 : 279;

  const statsContentWithoutPie = data.stats
    .map(
      (stat, index) => `
      <g class="stagger" style="animation-delay: ${450 + index * 150}ms" transform="translate(25, ${
        index * 25
      })">
        <text class="stat.bold" y="12.5">${stat.name}:</text>
        <text class="stat.bold" x="199.01" y="12.5">${stat.count}</text>
      </g>
    `,
    )
    .join("");

  const statsContentWithPie = data.stats
    .map(
      (stat, index) => `
          <g class="stagger" style="animation-delay: ${
            450 + index * 150
          }ms" transform="translate(0, ${index * 25})">
            <rect x="-20" y="2" width="12" height="12" fill="${getColorByIndex(
              index,
              data.styles.circleColor,
            )}" />
            <text class="stat" y="12.5">${stat.name}:</text>
            <text class="stat" x="125" y="12.5">${stat.count}</text>
          </g>
        `,
    )
    .join("");

  const pieChartContent = (() => {
    const total = data.stats.reduce((acc, stat) => acc + stat.count, 0);
    let currentAngle = 0;
    return data.stats
      .map((stat, index) => {
        const angle = (stat.count / total) * 360;
        const startAngle = currentAngle;
        currentAngle += angle;

        const cx = 40,
          cy = 40,
          r = 40;
        const startRadians = ((startAngle - 90) * Math.PI) / 180;
        const endRadians = ((currentAngle - 90) * Math.PI) / 180;
        const largeArc = angle > 180 ? 1 : 0;

        return `
              <path
                d="M ${cx} ${cy}
                  L ${cx + r * Math.cos(startRadians)} ${cy + r * Math.sin(startRadians)}
                  A ${r} ${r} 0 ${largeArc} 1 
                  ${cx + r * Math.cos(endRadians)} ${cy + r * Math.sin(endRadians)}
                  Z"
                fill="${getColorByIndex(index, data.styles.circleColor)}"
                stroke="${data.styles.backgroundColor}"
                stroke-width="1.5"
                stroke-linejoin="round"
                class="stagger"
                style="animation-delay: ${450 + index * 150}ms"
              />
            `;
      })
      .join("");
  })();

  const mainStatsContent = data.showPieChart
    ? `
        <g transform="translate(45, 0)">
          ${statsContentWithPie}
        </g>
        <g transform="translate(225, 20)">
          ${pieChartContent}
        </g>
      `
    : statsContentWithoutPie;

  return `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="${svgWidth}"
      height="195"
      viewBox="0 0 ${viewBoxWidth} 195"
      fill="none"
      role="img"
      aria-labelledby="desc-id"
    >
      <title id="title-id">${data.username}'s ${data.format}</title>
      <desc id="desc-id">
        ${data.stats.map((stat) => `${stat.name}: ${stat.count}`).join(", ")}
      </desc>
      <style>
        /* stylelint-disable selector-class-pattern, keyframes-name-pattern */
        .header { 
          fill: ${data.styles.titleColor};
          font: 600 ${calculateDynamicFontSize(
            `${data.username}'s ${data.format}`,
          )}px 'Segoe UI', Ubuntu, Sans-Serif;
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
  
        .stat.bold {
          fill: ${data.styles.textColor};
          font: 600 13px 'Segoe UI', Ubuntu, Sans-Serif;
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
        width="${rectWidth}"
        fill="${data.styles.backgroundColor}"
        stroke-opacity="1"
      />
      <g data-testid="card-title" transform="translate(25, 35)">
        <g transform="translate(0, 0)">
          <text x="0" y="0" class="header" data-testid="header">
            ${data.username}'s ${data.format}
          </text>
        </g>
      </g>
      <g data-testid="main-card-body" transform="translate(0, 55)">
        ${mainStatsContent}
      </g>
    </svg>
  `;
};

const getColorByIndex = (index: number, baseColor: string) => {
  // Convert base color to HSL for easy manipulation
  const hexToHSL = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)!;
    const r = parseInt(result[1], 16) / 255;
    const g = parseInt(result[2], 16) / 255;
    const b = parseInt(result[3], 16) / 255;

    const max = Math.max(r, g, b),
      min = Math.min(r, g, b);
    let h = 0,
      s = 0;

    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }
      h /= 6;
    }
    return [h * 360, s * 100, l * 100];
  };

  const [h, s, l] = hexToHSL(baseColor);
  const variations = [
    { s: s * 0.8, l: l * 1.2 }, // Lightest
    { s: s, l: l }, // Base
    { s: s * 1.2, l: l * 0.8 },
    { s: s * 1.4, l: l * 0.6 },
    { s: s * 1.6, l: l * 0.4 }, // Darkest
  ];

  const variation = variations[index % variations.length];
  return `hsl(${h}, ${Math.min(variation.s, 100)}%, ${Math.min(variation.l, 100)}%)`;
};
