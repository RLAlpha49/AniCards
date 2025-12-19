import type { StyleOptions } from "@/lib/svg-templates/common/types";
import { TYPOGRAPHY } from "@/lib/svg-templates/common/constants";

export function generateFadeInKeyframes(): string {
  return `
    @keyframes fadeInAnimation {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `;
}

export function generateRankCircleStyles(
  circleColor: string,
  scaledDasharray: string | null,
  scaledDashoffset: string | null,
): string {
  const hasDash = Boolean(scaledDasharray && scaledDashoffset);

  const rankCircle = hasDash
    ? `
    .rank-circle {
      stroke-dasharray: ${scaledDasharray};
      stroke: ${circleColor};
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
  `
    : `
    .rank-circle {
      stroke: ${circleColor};
      fill: none;
      stroke-width: 6;
      stroke-linecap: round;
      opacity: 0.5;
      animation: none;
    }
  `;

  return `
    .rank-circle-rim {
      fill: none;
      stroke-width: 6;
    }

    ${rankCircle}
  `;
}

export function generateCommonStyles(
  resolvedColors: Record<string, string>,
  titleFontSize: number,
  options?: StyleOptions,
): string {
  const includeRankCircle = options?.includeRankCircle ?? false;
  const includeStagger = options?.includeStagger ?? true;
  const includeFadeIn = options?.includeFadeIn ?? true;

  return `
    /* stylelint-disable selector-class-pattern, keyframes-name-pattern */
    .header {
      fill: ${resolvedColors.titleColor};
      font: 600 ${titleFontSize}px 'Segoe UI', Ubuntu, Sans-Serif;
      animation: fadeInAnimation 0.8s ease-in-out forwards;
    }

    [data-testid="card-title"] text {
      fill: ${resolvedColors.titleColor};
    }

    [data-testid="main-card-body"] circle {
      stroke: ${resolvedColors.circleColor};
    }

    [data-testid="card-bg"] {
      fill: ${resolvedColors.backgroundColor};
    }

    [data-testid="main-card-body"] text {
      fill: ${resolvedColors.textColor};
    }

    .stat {
      fill: ${resolvedColors.textColor};
      font: 400 ${TYPOGRAPHY.STAT_SIZE}px 'Segoe UI', Ubuntu, Sans-Serif;
    }

    .stat-label {
      fill: ${resolvedColors.textColor};
      font: 600 ${TYPOGRAPHY.STAT_LABEL_SIZE}px 'Segoe UI', Ubuntu, Sans-Serif;
    }

    .stat-value {
      fill: ${resolvedColors.circleColor};
      font: 700 ${TYPOGRAPHY.STAT_VALUE_SIZE}px 'Segoe UI', Ubuntu, Sans-Serif;
    }

    .section-title {
      fill: ${resolvedColors.circleColor};
      font: 600 ${TYPOGRAPHY.SECTION_TITLE_SIZE}px 'Segoe UI', Ubuntu, Sans-Serif;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    ${
      includeStagger
        ? `
    .stagger {
      opacity: 0;
      animation: fadeInAnimation 0.3s ease-in-out forwards;
    }
    `
        : ""
    }

    ${
      includeRankCircle
        ? `
    .rank-circle-rim {
      fill: none;
      stroke-width: 6;
    }
    `
        : ""
    }

    ${includeFadeIn ? generateFadeInKeyframes() : ""}
  `;
}
