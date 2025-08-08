import { calculateDynamicFontSize } from "../utils";

interface DistributionDatum {
  value: number;
  count: number;
}

interface DistributionTemplateInput {
  username: string;
  mediaType: "anime" | "manga";
  kind: "score" | "year";
  styles: {
    titleColor: string;
    backgroundColor: string;
    textColor: string;
    circleColor: string;
  };
  variant?: "default" | "horizontal";
  data: DistributionDatum[];
}

/*
Variants:
- default: Horizontal list of proportional bars (like previous score default)
- horizontal: Condensed mini vertical bars (like previous horizontal score variant)
*/
export function distributionTemplate(input: DistributionTemplateInput) {
  const { username, mediaType, styles, variant = "default", kind } = input;

  // Normalize & fill
  const provided = [...input.data];
  const existing = new Set(provided.map((d) => d.value));
  if (kind === "score") {
    const maxVal = Math.max(...provided.map((d) => d.value), 0);
    if (maxVal <= 10) {
      for (let v = 1; v <= 10; v++)
        if (!existing.has(v)) provided.push({ value: v, count: 0 });
    } else if (maxVal <= 100 && provided.every((d) => d.value % 10 === 0)) {
      for (let v = 10; v <= 100; v += 10)
        if (!existing.has(v)) provided.push({ value: v, count: 0 });
    }
  } else if (kind === "year") {
    // Do not fill missing years; use only provided data.
  }

  const data = provided.sort((a, b) => b.value - a.value);
  const maxCount = Math.max(1, ...data.map((d) => d.count));

  const baseTitle =
    kind === "score" ? "Score Distribution" : "Year Distribution";
  const title = `${username}'s ${capitalize(mediaType)} ${baseTitle}`;

  const dims = (() => {
    switch (variant) {
      case "horizontal":
        return { w: 320, h: 150 };
      default:
        return { w: 350, h: 260 };
    }
  })();

  const barColor = styles.circleColor;

  // layout constants
  const rightPadding = 60;
  const barStartX = 30;
  const countBaseX = 35;
  const maxBarWidth = Math.max(10, dims.w - countBaseX - rightPadding);

  const barItems = data
    .map((d, i) => {
      const width = (d.count / maxCount) * maxBarWidth;
      const safeWidth = Math.max(2, width);
      return `<g class="stagger" style="animation-delay:${400 + i * 90}ms" transform="translate(0, ${i * 18})">
      <text class="score-label" x="0" y="12">${d.value}</text>
      <rect x="${barStartX}" y="4" rx="3" height="10" width="${safeWidth.toFixed(2)}" fill="${barColor}" opacity="0.85" />
      <text class="score-count" x="${countBaseX + safeWidth}" y="12">${d.count}</text>
    </g>`;
    })
    .join("");

  const verticalBars =
    variant === "horizontal"
      ? data
          .slice(0, 15)
          .map((d, i) => {
            const height = ((d.count / maxCount) * 70).toFixed(2);
            const x = i * 28 + 35;
            const barTop = 90 - Number(height);
            return `<g class="stagger" style="animation-delay:${350 + i * 70}ms" transform="translate(${x},0)">
      <text class="h-count" text-anchor="middle" x="0" y="${barTop - 6}" font-size="10">${d.count}</text>
      <rect x="-6" y="${barTop}" width="12" height="${height}" rx="2" fill="${barColor}" />
      <text class="h-score" text-anchor="middle" x="0" y="104" font-size="10">${d.value}</text>
    </g>`;
          })
          .join("")
      : "";

  const mainContent =
    variant === "horizontal"
      ? `<g transform="translate(0,40)">${verticalBars}</g>`
      : `<g transform="translate(30,70)">${barItems}</g>`;

  const headerFontSize = calculateDynamicFontSize(title, 18, 300);

  return `<svg
    xmlns="http://www.w3.org/2000/svg"
    width="${dims.w}"
    height="${dims.h}"
    viewBox="0 0 ${dims.w} ${dims.h}"
    fill="none"
    role="img"
    aria-labelledby="desc-id"
  >
    <title id="title-id">${title}</title>
    <desc id="desc-id">${data.map((d) => `${d.value}:${d.count}`).join(", ")}</desc>
    <style>
      /* stylelint-disable selector-class-pattern, keyframes-name-pattern */
      .header { 
        fill: ${styles.titleColor};
        font: 600 ${headerFontSize}px 'Segoe UI', Ubuntu, Sans-Serif;
        animation: fadeInAnimation 0.8s ease-in-out forwards;
      }
      .score-label,.score-count,.h-score,.h-count { fill:${styles.textColor}; font:400 12px 'Segoe UI', Ubuntu, Sans-Serif; }
      .score-count { font-size:11px; }
      .h-score,.h-count { font-size:10px; }
      .stagger { opacity:0; animation: fadeInAnimation 0.6s ease forwards; }
      @keyframes fadeInAnimation { from { opacity:0 } to { opacity:1 } }
    </style>
    <rect x="0.5" y="0.5" width="${dims.w - 1}" height="${dims.h - 1}" rx="4.5" fill="${styles.backgroundColor}" stroke="#e4e2e2"/>
    <g transform="translate(20,35)"><text class="header">${title}</text></g>
    ${mainContent}
  </svg>`;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
