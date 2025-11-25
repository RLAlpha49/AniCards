import { AnimeStats, MangaStats, ColorValue } from "@/lib/types/card";
import { calculateDynamicFontSize, processColorsForSVG } from "../utils";

/** Media type used by the media stats templates — either anime or manga. @source */
type MediaType = "anime" | "manga";

/**
 * Renders an SVG circular progress indicator and rim used by rank visuals.
 * @param cx - Circle center X coordinate.
 * @param cy - Circle center Y coordinate.
 * @param radius - Circle radius.
 * @param strokeColor - Color used for the progress stroke.
 * @param scaledDasharray - Dasharray applied for circumference.
 * @param scaledDashoffset - Dashoffset to animate progress.
 * @param strokeWidth - Optional stroke width.
 * @returns SVG markup string for the circle visuals.
 * @source
 */
function renderCircle(
  cx: number,
  cy: number,
  radius: number,
  strokeColor: string,
  scaledDasharray: string,
  scaledDashoffset: string,
  strokeWidth: number = 6,
): string {
  return `
    <circle class="rank-circle-rim" cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${strokeColor}" stroke-opacity="0.2" stroke-width="${strokeWidth}"></circle>
    <g transform="rotate(-90 ${cx} ${cy})">
      <circle class="rank-circle" cx="${cx}" cy="${cy}" r="${radius}" stroke-width="${strokeWidth}" stroke-dasharray="${scaledDasharray}" stroke-dashoffset="${scaledDashoffset}"></circle>
    </g>
  `;
}

/**
 * Render a list of labeled stats as an SVG fragment.
 * @param stats - Array of label/value pairs to render.
 * @param transform - SVG transform applied to the container group.
 * @param xOffset - X offset for numbers.
 * @param ySpacing - Vertical spacing between rows.
 * @param animationDelay - Initial animation delay in ms.
 * @param animationIncrement - Incremental animation delay per row in ms.
 * @returns SVG markup string for the stats list.
 * @source
 */
function renderStatsList(
  stats: Array<{ label: string; value: number | undefined }>,
  transform: string = "translate(25, 0)",
  xOffset: number = 160,
  ySpacing: number = 25,
  animationDelay: number = 450,
  animationIncrement: number = 150,
): string {
  return `
    <g transform="${transform}">
      ${stats
        .filter((stat) => stat.value !== undefined)
        .map(
          (stat, index) => `
        <g
          class="stagger"
          style="animation-delay: ${animationDelay + index * animationIncrement}ms"
          transform="translate(25, ${index * ySpacing})"
        >
          <text class="stat" y="12.5">${stat.label}</text>
          <text class="stat" x="${xOffset}" y="12.5">${stat.value}</text>
        </g>
      `,
        )
        .join("")}
    </g>
  `;
}

/**
 * Generate the variant-specific SVG content for media stats template.
 * Handles default/compact/vertical/minimal variants with different layouts.
 * @param data - The template input with stats and styles.
 * @param config - Derived configuration for the main stat and title.
 * @param dims - Width and height for the card.
 * @param scaledDasharray - Pre-scaled dasharray for rank visualization.
 * @param scaledDashoffset - Pre-scaled dashoffset for rank visualization.
 * @param resolvedColors - Pre-processed color values as strings.
 * @returns SVG markup fragment appropriate for the chosen variant.
 * @source
 */
function getVariantContent(
  data: {
    variant?: "default" | "vertical" | "compact" | "minimal";
    styles: {
      titleColor: ColorValue;
      backgroundColor: ColorValue;
      textColor: ColorValue;
      circleColor: ColorValue;
      borderColor?: ColorValue;
    };
    stats: (AnimeStats | MangaStats) & {
      previousMilestone: number;
      currentMilestone: number;
      dasharray: string;
      dashoffset: string;
    };
  },
  config: {
    title: string;
    mainStat: {
      label: string;
      value: number | undefined;
      secondary: {
        label: string;
        value: number | undefined;
      };
    };
  },
  dims: { w: number; h: number },
  scaledDasharray: string,
  scaledDashoffset: string,
  resolvedColors: Record<string, string>,
): string {
  if (data.variant === "vertical") {
    const stats = [
      { label: "Count:", value: data.stats.count },
      { label: `${config.mainStat.label}:`, value: config.mainStat.value },
      {
        label: `${config.mainStat.secondary.label}:`,
        value: config.mainStat.secondary.value,
      },
      { label: "Mean Score:", value: data.stats.meanScore },
      { label: "Standard Deviation:", value: data.stats.standardDeviation },
    ];

    return `
      <g transform="translate(230, 140)">
        <text x="-100" y="-130" class="milestone" text-anchor="middle">${data.stats.currentMilestone}</text>
        <text x="-100" y="-70" class="main-stat" text-anchor="middle">${config.mainStat.value}</text>
        <text x="-100" y="-10" class="label" text-anchor="middle">${config.mainStat.label}</text>
        ${renderCircle(-100, -72, 40, resolvedColors.circleColor, scaledDasharray, scaledDashoffset)}
      </g>
      <svg x="0" y="0">
        ${renderStatsList(stats, "translate(0, 150)")}
      </svg>
    `;
  } else if (data.variant === "compact") {
    const stats = [
      { label: "Count:", value: data.stats.count },
      {
        label: `${config.mainStat.secondary.label}:`,
        value: config.mainStat.secondary.value,
      },
      { label: "Mean Score:", value: data.stats.meanScore },
    ];

    return `
      <g transform="translate(${dims.w - 50}, 20)">
        <text x="-10" y="15" class="main-stat" text-anchor="middle" fill="${resolvedColors.textColor}" font-size="16">${config.mainStat.value}</text>
        ${renderCircle(-10, 10, 30, resolvedColors.textColor, scaledDasharray, scaledDashoffset, 5)}
      </g>
      <svg x="0" y="0">
        ${renderStatsList(stats, "translate(0, 0)", 120, 22, 450, 120)}
      </svg>
    `;
  } else if (data.variant === "minimal") {
    return `
      <g transform="translate(${Math.round(dims.w / 2)}, 20)">
        <text x="0" y="5" class="main-stat" text-anchor="middle" fill="${resolvedColors.textColor}" font-size="16">${config.mainStat.value}</text>
        <text x="0" y="50" class="label" text-anchor="middle" fill="${resolvedColors.circleColor}" font-size="14">${config.mainStat.label}</text>
        ${renderCircle(0, 0, 28, resolvedColors.textColor, scaledDasharray, scaledDashoffset, 5)}
      </g>
    `;
  } else {
    // Default variant
    const stats = [
      { label: "Count:", value: data.stats.count },
      { label: `${config.mainStat.label}:`, value: config.mainStat.value },
      {
        label: `${config.mainStat.secondary.label}:`,
        value: config.mainStat.secondary.value,
      },
      { label: "Mean Score:", value: data.stats.meanScore },
      { label: "Standard Deviation:", value: data.stats.standardDeviation },
    ];

    return `
      <g transform="translate(375, 37.5)">
        <text x="-10" y="-50" class="milestone" text-anchor="middle" fill="${resolvedColors.circleColor}">
          ${data.stats.currentMilestone}
        </text>
        <text x="-10" y="10" class="main-stat" text-anchor="middle" fill="${resolvedColors.textColor}">
          ${config.mainStat.value}
        </text>
        <text x="-10" y="70" class="label" text-anchor="middle" fill="${resolvedColors.circleColor}">
          ${config.mainStat.label}
        </text>
        ${renderCircle(-10, 8, 40, resolvedColors.textColor, scaledDasharray, scaledDashoffset)}
      </g>
      <svg x="0" y="0">
        ${renderStatsList(stats, "translate(0, 0)", 199.01)}
      </svg>
    `;
  }
}

/**
 * Renders an SVG string that visualizes anime or manga statistics. The
 * function returns a fully formed SVG markup string that can be embedded
 * as an image or served as the response to the SVG card endpoint.
 * @param data - Template input including mediaType, username, styles and stats.
 * @returns A string containing the SVG markup for the card.
 * @source
 */
export const mediaStatsTemplate = (data: {
  mediaType: MediaType;
  username: string;
  variant?: "default" | "vertical" | "compact" | "minimal";
  styles: {
    titleColor: ColorValue;
    backgroundColor: ColorValue;
    textColor: ColorValue;
    circleColor: ColorValue;
    borderColor?: ColorValue;
  };
  stats: (AnimeStats | MangaStats) & {
    previousMilestone: number;
    currentMilestone: number;
    dasharray: string;
    dashoffset: string;
  };
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
  const originalDasharray =
    Number.parseFloat(String(data.stats.dasharray)) ?? 0;
  const originalDashoffset =
    Number.parseFloat(String(data.stats.dashoffset)) ?? 0;
  const scaledDasharray = Number.isFinite(originalDasharray)
    ? (originalDasharray * scale).toFixed(2)
    : (0 * scale).toFixed(2);
  const scaledDashoffset = Number.isFinite(originalDashoffset)
    ? (originalDashoffset * scale).toFixed(2)
    : (0 * scale).toFixed(2);

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
  ${gradientDefs ? `<defs>${gradientDefs}</defs>` : ""}
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
      fill: ${resolvedColors.titleColor};
      font: 600 ${calculateDynamicFontSize(config.title)}px 'Segoe UI', Ubuntu, Sans-Serif;
      animation: fadeInAnimation 0.8s ease-in-out forwards;
    }
    
    [data-testid="card-title"] text { fill: ${resolvedColors.titleColor}; }
    [data-testid="main-card-body"] circle { stroke: ${resolvedColors.circleColor}; }
    [data-testid="card-bg"] { fill: ${resolvedColors.backgroundColor}; }
    [data-testid="main-card-body"] text { fill: ${resolvedColors.textColor}; }

    .stat { 
      fill: ${resolvedColors.textColor};
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
      stroke: ${resolvedColors.circleColor};
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
    width="${dims.w - 1}"
    fill="${resolvedColors.backgroundColor}"
    stroke="${resolvedColors.borderColor}"
    stroke-width="2"
  />
  <g data-testid="card-title" transform="translate(25, 35)">
    <g transform="translate(0, 0)">
      <text x="0" y="0" class="header" data-testid="header">${config.title}</text>
    </g>
  </g>
  <g data-testid="main-card-body" transform="translate(0, 55)">
    ${getVariantContent(data, config, dims, scaledDasharray, scaledDashoffset, resolvedColors)}
  </g>
</svg>`;
};
