import { calculateDynamicFontSize, processColorsForSVG } from "../utils";
import type { ColorValue } from "@/lib/types/card";

/**
 * Render an SVG card for additional anime/manga statistics including pie/bar
 * and a minimal default detail list. The function returns a string containing
 * ready-to-embed SVG markup.
 * @param data - Input shape required by the template.
 * @returns A string of SVG markup representing the card.
 * @source
 */
export const extraAnimeMangaStatsTemplate = (data: {
  username: string;
  variant?: "default" | "pie" | "bar";
  styles: {
    titleColor: ColorValue;
    backgroundColor: ColorValue;
    textColor: ColorValue;
    circleColor: ColorValue;
    borderColor?: ColorValue;
  };
  format: string;
  stats: { name: string; count: number }[];
  showPieChart?: boolean;
  favorites?: string[];
  fixedStatusColors?: boolean;
  showPiePercentages?: boolean;
}) => {
  // Process colors for gradient support
  const { gradientDefs, resolvedColors } = processColorsForSVG(
    {
      titleColor: data.styles.titleColor,
      backgroundColor: data.styles.backgroundColor,
      textColor: data.styles.textColor,
      circleColor: data.styles.circleColor,
      borderColor: data.styles.borderColor,
    },
    ["titleColor", "backgroundColor", "textColor", "circleColor", "borderColor"],
  );

  // Determine variant flags
  const isPie = data.showPieChart || data.variant === "pie";
  const isBar = data.variant === "bar";

  let svgWidth: number;
  if (isPie) {
    svgWidth = 340;
  } else if (isBar) {
    svgWidth = 360;
  } else {
    svgWidth = 280;
  }
  const viewBoxWidth = svgWidth;
  const rectWidth = svgWidth - 1;

  /** List of formats that should render hearts for favorites (pink heart). @source */
  const FAVORITE_FORMATS = [
    "Anime Voice Actors",
    "Anime Studios",
    "Anime Staff",
    "Manga Staff",
  ];
  const showFavorites = FAVORITE_FORMATS.includes(data.format);

  /** Inline SVG used to render the 'favorite' heart icon in lists and legends. @source */
  const heartSVG =
    '<svg x="-18" y="2" width="14" height="14" viewBox="0 0 20 20" fill="#fe428e" xmlns="http://www.w3.org/2000/svg"><path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"/></svg>';

  const statsContentWithoutPie = data.stats
    .map((stat, index) => {
      const isFavorite = showFavorites && data.favorites?.includes(stat.name);
      return `
      <g class="stagger" style="animation-delay: ${450 + index * 150}ms" transform="translate(25, ${
        index * 25
      })">
        ${isFavorite ? heartSVG : ""}
        <text class="stat bold" y="12.5">${stat.name}:</text>
        <text class="stat bold" x="199.01" y="12.5">${stat.count}</text>
      </g>
    `;
    })
    .join("");

  const totalForPie = data.stats.reduce((acc, s) => acc + s.count, 0) || 1;
  const statsContentWithPie = data.stats
    .map((stat, index) => {
      const isFavorite = showFavorites && data.favorites?.includes(stat.name);
      const heartLegendSVG = heartSVG.replace('x="-18"', 'x="-36"');
      const fillColor = getStatColor(
        index,
        stat.name,
        resolvedColors.circleColor,
        data.fixedStatusColors && data.format.endsWith("Statuses"),
      );
      const pct = ((stat.count / totalForPie) * 100).toFixed(0);
      return `
        <g class="stagger" style="animation-delay: ${450 + index * 150}ms" transform="translate(0, ${
          index * 25
        })">
          ${isFavorite ? heartLegendSVG : ""}
          <rect x="-20" y="2" width="12" height="12" fill="${fillColor}" />
          <text class="stat" y="12.5">${stat.name}:</text>
          <text class="stat" x="125" y="12.5">${stat.count}${data.showPiePercentages ? ` (${pct}%)` : ""}</text>
        </g>`;
    })
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
                fill="${getStatColor(
                  index,
                  stat.name,
                  resolvedColors.circleColor,
                  data.fixedStatusColors && data.format.endsWith("Statuses"),
                )}"
                stroke="${resolvedColors.backgroundColor}"
                stroke-width="1.5"
                stroke-linejoin="round"
                class="stagger"
                style="animation-delay: ${450 + index * 150}ms"
              />
            `;
      })
      .join("");
  })();

  const barsContent = isBar
    ? data.stats
        .map((stat, index) => {
          const max = Math.max(...data.stats.map((s) => s.count));
          const barWidth = ((stat.count / max) * 140).toFixed(2);
          const isFavorite =
            showFavorites && data.favorites?.includes(stat.name);
          return `
              <g class="stagger" style="animation-delay: ${450 + index * 120}ms" transform="translate(0, ${
                index * 26
              })">
                ${isFavorite ? heartSVG : ""}
                <text class="stat" y="12">${stat.name}:</text>
                <rect x="150" y="2" width="${barWidth}" height="14" rx="3" fill="${getColorByIndex(
                  index,
                  resolvedColors.circleColor,
                )}" />
                <text class="stat" x="${155 + Number(barWidth)}" y="13">${stat.count}</text>
              </g>`;
        })
        .join("")
    : "";

  let mainStatsContent: string;
  if (isPie) {
    mainStatsContent = `
        <g transform="translate(45, 0)">
          ${statsContentWithPie}
        </g>
        <g transform="translate(240, 20)">
          ${pieChartContent}
        </g>
      `;
  } else if (isBar) {
    mainStatsContent = `<g transform="translate(25, 0)">${barsContent}</g>`;
  } else {
    mainStatsContent = statsContentWithoutPie;
  }

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
      ${gradientDefs ? `<defs>${gradientDefs}</defs>` : ""}
      <title id="title-id">${data.username}'s ${data.format}</title>
      <desc id="desc-id">
        ${data.stats.map((stat) => `${stat.name}: ${stat.count}`).join(", ")}
      </desc>
      <style>
        /* stylelint-disable selector-class-pattern, keyframes-name-pattern */
        .header { 
          fill: ${resolvedColors.titleColor};
          font: 600 ${calculateDynamicFontSize(
            `${data.username}'s ${data.format}`,
          )}px 'Segoe UI', Ubuntu, Sans-Serif;
          animation: fadeInAnimation 0.8s ease-in-out forwards;
        }
        
        [data-testid="card-title"] text {
          fill: ${resolvedColors.titleColor};
        }
  
        [data-testid="main-card-body"] text {
          fill: ${resolvedColors.textColor};
        }
  
        .stat { 
          fill: ${resolvedColors.textColor};
          font: 400 13px 'Segoe UI', Ubuntu, Sans-Serif;
        }
  
        .stat.bold {
          fill: ${resolvedColors.textColor};
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
        width="${rectWidth}"
        fill="${resolvedColors.backgroundColor}"
        stroke="${resolvedColors.borderColor}"
        stroke-width="2"
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

/**
 * Generate a color variation from a base color using HSL adjustments. Colors
 * are derived deterministically by index to ensure consistent visual ordering.
 * @param index - Zero-based index used to compute a deterministic variation.
 * @param baseColor - The base hex color used to compute variations.
 * @returns A CSS HSL color string.
 * @source
 */
const getColorByIndex = (index: number, baseColor: string) => {
  // Convert base color to HSL for easy manipulation
  const hexToHSL = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)!;
    const r = Number.parseInt(result[1], 16) / 255;
    const g = Number.parseInt(result[2], 16) / 255;
    const b = Number.parseInt(result[3], 16) / 255;

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

/**
 * Selects a color for a stat entry. If `useFixed` is truthy and the stat
 * matches a known set of statuses this function returns a fixed color;
 * otherwise it returns an HSL-based variation of the base color.
 * @param index - Index used to derive color variations by position.
 * @param statName - Name of the stat (used for fixed mapping lookup).
 * @param baseColor - Base color used for non-fixed mapping.
 * @param useFixed - When true, use fixed status mapping for known statuses.
 * @returns A CSS color string.
 * @source
 */
const getStatColor = (
  index: number,
  statName: string,
  baseColor: string,
  useFixed: boolean | undefined,
) => {
  if (useFixed) {
    const key = statName.toLowerCase();
    const map: Record<string, string> = {
      current: "#16a34a", // green-600
      watching: "#16a34a",
      reading: "#16a34a",
      paused: "#ca8a04", // yellow-600
      completed: "#2563eb", // blue-600
      dropped: "#dc2626", // red-600
      planning: "#6b7280", // gray-500
      planned: "#6b7280",
      on_hold: "#ca8a04",
    };
    if (map[key]) return map[key];
  }
  return getColorByIndex(index, baseColor);
};
