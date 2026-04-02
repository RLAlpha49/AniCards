import { TYPOGRAPHY } from "@/lib/svg-templates/common/constants";
import type { StyleOptions } from "@/lib/svg-templates/common/types";

export function generateFadeInKeyframes(): string {
  return `
    @keyframes fadeInAnimation {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `;
}

export function generateStaticRenderStyles(): string {
  return `
    * {
      animation: none !important;
      transition: none !important;
    }

    .stagger {
      opacity: 1 !important;
    }

    [style*="opacity:0"],
    [style*="opacity: 0"] {
      opacity: 1 !important;
    }

    [style*="visibility:hidden"],
    [style*="visibility: hidden"] {
      visibility: visible !important;
    }
  `;
}

export function generateRankCircleStyles(
  circleColor: string,
  scaledDasharray: string | null,
  scaledDashoffset: string | null,
  options?: {
    includeAnimations?: boolean;
  },
): string {
  const hasDash = Boolean(scaledDasharray && scaledDashoffset);
  const includeAnimations = options?.includeAnimations ?? true;
  const rankCircleDashoffset = includeAnimations
    ? scaledDasharray
    : scaledDashoffset;
  const rankCircleAnimation = includeAnimations
    ? "rankAnimation 1s forwards ease-in-out"
    : "none";
  const rankCircleKeyframes = includeAnimations
    ? `@keyframes rankAnimation {
      from { stroke-dashoffset: ${scaledDasharray}; }
      to { stroke-dashoffset: ${scaledDashoffset}; }
    }`
    : "";

  const rankCircle = hasDash
    ? `
    .rank-circle {
      stroke-dasharray: ${scaledDasharray};
      stroke-dashoffset: ${rankCircleDashoffset};
      stroke: ${circleColor};
      fill: none;
      stroke-width: 6;
      stroke-linecap: round;
      opacity: 0.8;
      animation: ${rankCircleAnimation};
    }

    ${rankCircleKeyframes}
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
  const includeAnimations = options?.includeAnimations ?? true;
  const shouldAnimateHeader = includeAnimations && includeFadeIn;
  const shouldAnimateStagger = includeAnimations && includeFadeIn;
  const headerAnimation = shouldAnimateHeader
    ? "fadeInAnimation 0.8s ease-in-out forwards"
    : "none";
  const staggerOpacity = shouldAnimateStagger ? "0" : "1";
  const staggerAnimation = shouldAnimateStagger
    ? "fadeInAnimation 0.3s ease-in-out forwards"
    : "none";

  return `
    /* stylelint-disable selector-class-pattern, keyframes-name-pattern */
    .header {
      fill: ${resolvedColors.titleColor};
      font: 600 ${titleFontSize}px 'Segoe UI', Ubuntu, Sans-Serif;
      animation: ${headerAnimation};
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
      opacity: ${staggerOpacity};
      animation: ${staggerAnimation};
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

    ${shouldAnimateHeader || shouldAnimateStagger ? generateFadeInKeyframes() : ""}
  `;
}
