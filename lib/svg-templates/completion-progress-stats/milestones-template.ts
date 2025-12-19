import type { ColorValue } from "@/lib/types/card";
import type { TrustedSVG } from "@/lib/types/svg";
import {
  calculateDynamicFontSize,
  escapeForXml,
  getCardBorderRadius,
  markTrustedSvg,
  processColorsForSVG,
} from "@/lib/utils";
import { MILESTONES } from "@/lib/svg-templates/common/constants";
import { getCardDimensions } from "@/lib/svg-templates/common/dimensions";
import { toSvgIdFragment } from "./shared";

/** Milestones card input structure. @source */
interface MilestonesInput {
  username: string;
  variant?: "default";
  styles: {
    titleColor: ColorValue;
    backgroundColor: ColorValue;
    textColor: ColorValue;
    circleColor: ColorValue;
    borderColor?: ColorValue;
    borderRadius?: number;
  };
  stats: {
    animeCount?: number;
    episodesWatched?: number;
    minutesWatched?: number;
    mangaCount?: number;
    chaptersRead?: number;
    volumesRead?: number;
  };
}

type MilestoneMetric = "episodes" | "chapters" | "volumes" | "days" | "count";

const MILESTONE_CONFIG: Record<
  MilestoneMetric,
  { minStep: number; targetSpan: number; niceMultipliers?: number[] }
> = {
  episodes: { minStep: 100, targetSpan: 0.2 },
  chapters: { minStep: 100, targetSpan: 0.2 },
  volumes: { minStep: 25, targetSpan: 0.2 },
  days: { minStep: 10, targetSpan: 0.2 },
  count: { minStep: 25, targetSpan: 0.2 },
};

function toNiceStepSize(
  rawStep: number,
  multipliers: number[] = [1, 2, 2.5, 5, 10],
): number {
  const v = Math.max(1, Math.floor(rawStep));
  // Very small steps look fine as-is.
  if (v < 10) return v;

  const exponent = Math.floor(Math.log10(v));
  const base = 10 ** exponent;
  const fraction = v / base;

  const m = multipliers.find((x) => fraction <= x) ?? multipliers.at(-1) ?? 10;
  return Math.round(m * base);
}

function getDynamicMilestoneProgress(
  value: number,
  metric: MilestoneMetric,
): { current: number; next: number; progress: number } {
  const cfg = MILESTONE_CONFIG[metric];
  const safeValue = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

  const rawStep = Math.max(cfg.minStep, Math.ceil(safeValue * cfg.targetSpan));
  const step = toNiceStepSize(rawStep, cfg.niceMultipliers);
  const next = Math.max(step, Math.ceil(safeValue / step) * step);
  const current = Math.max(0, next - step);

  const progress =
    next > current ? ((safeValue - current) / (next - current)) * 100 : 100;

  return { current, next, progress: Math.min(100, Math.max(0, progress)) };
}

/** Options for generating a milestone bar. @source */
interface MilestoneBarOptions {
  value: number;
  metric: MilestoneMetric;
  label: string;
  unit: string;
  x: number;
  y: number;
  width: number;
  barHeight: number;
  idPrefix: string;
  circleColor: string;
  textColor: string;
  backgroundColor: string;
  delay: number;
}

/**
 * Generate a milestone progress bar with label.
 * @source
 */
function generateMilestoneBar(opts: MilestoneBarOptions): string {
  const {
    value,
    metric,
    label,
    unit,
    x,
    y,
    width,
    barHeight,
    idPrefix,
    circleColor,
    textColor,
    backgroundColor,
    delay,
  } = opts;
  const safeValue = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  const { progress, next } = getDynamicMilestoneProgress(safeValue, metric);
  const barWidth = (progress / 100) * width;
  const barRadius = Math.max(4, Math.min(barHeight / 2, 10));
  const clipId = `${idPrefix}-ms-clip-${toSvgIdFragment(label)}-${Math.round(x)}-${Math.round(y)}`;
  const labelY = MILESTONES.LABEL_Y_OFFSET;
  const valueY = barHeight + MILESTONES.VALUE_Y_OFFSET;
  const rowY = MILESTONES.ROW_Y_OFFSET;
  const rowHeight = barHeight + MILESTONES.ROW_HEIGHT;

  return `
    <g transform="translate(${x}, ${y})" class="stagger" style="animation-delay:${delay}ms">
      <rect x="-12" y="${rowY}" width="${width + 24}" height="${rowHeight}" rx="12" opacity="0.08"/>
      <text x="0" y="${labelY}" class="milestone-label" fill="${textColor}">${escapeForXml(label)}</text>
      <text x="${width}" y="${labelY}" text-anchor="end" class="milestone-target" fill="${textColor}">→ ${next.toLocaleString()} ${unit}</text>
      <defs>
        <clipPath id="${clipId}">
          <rect x="0" y="0" width="${width}" height="${barHeight}" rx="${barRadius}"/>
        </clipPath>
      </defs>
      <rect x="0" y="0" width="${width}" height="${barHeight}" rx="${barRadius}" fill="${circleColor}" opacity="0.16"/>
      <g clip-path="url(#${clipId})">
        <rect x="0" y="0" width="${barWidth.toFixed(2)}" height="${barHeight}" fill="${circleColor}"/>
        <rect x="0" y="0" width="${barWidth.toFixed(2)}" height="${Math.max(1, Math.floor(barHeight / 2))}" fill="#ffffff" opacity="0.12"/>
      </g>
      <text x="${width / 2}" y="${valueY}" text-anchor="middle" class="milestone-value" fill="${textColor}" stroke="${backgroundColor}" stroke-width="3" paint-order="stroke">${safeValue.toLocaleString()} ${unit}</text>
    </g>
  `;
}

/**
 * Renders the Milestones card celebrating consumption achievements.
 * @source
 */
export function milestonesTemplate(input: MilestonesInput): TrustedSVG {
  const { username, styles, variant = "default", stats } = input;

  const { gradientDefs, resolvedColors } = processColorsForSVG(
    {
      titleColor: styles.titleColor,
      backgroundColor: styles.backgroundColor,
      textColor: styles.textColor,
      circleColor: styles.circleColor,
      borderColor: styles.borderColor,
    },
    [
      "titleColor",
      "backgroundColor",
      "textColor",
      "circleColor",
      "borderColor",
    ],
  );

  const cardRadius = getCardBorderRadius(styles.borderRadius);
  const baseDims = getCardDimensions("milestones", variant);
  const title = `${username}'s Milestones`;
  const safeTitle = escapeForXml(title);
  const headerFontSize = calculateDynamicFontSize(title, 18, baseDims.w - 40);

  const idPrefix = `ms-${toSvgIdFragment(username)}-${toSvgIdFragment(variant)}`;
  const daysWatched = Math.floor((stats.minutesWatched ?? 0) / 1440);
  const barWidth = baseDims.w - 40;
  const barSpacing = MILESTONES.BAR_SPACING;
  const barHeight = MILESTONES.BAR_HEIGHT;

  const milestoneBars: string[] = [];
  let yOffset = 70;
  let barIndex = 0;

  const nextDelay = () =>
    MILESTONES.BASE_DELAY + barIndex++ * MILESTONES.DELAY_INCREMENT;

  if (stats.episodesWatched !== undefined && stats.episodesWatched > 0) {
    milestoneBars.push(
      generateMilestoneBar({
        value: stats.episodesWatched,
        metric: "episodes",
        label: "Episodes Watched",
        unit: "ep",
        x: 20,
        y: yOffset,
        width: barWidth,
        barHeight,
        idPrefix,
        circleColor: resolvedColors.circleColor,
        textColor: resolvedColors.textColor,
        backgroundColor: resolvedColors.backgroundColor,
        delay: nextDelay(),
      }),
    );
    yOffset += barSpacing;
  }

  if (daysWatched > 0) {
    milestoneBars.push(
      generateMilestoneBar({
        value: daysWatched,
        metric: "days",
        label: "Days Watched",
        unit: "days",
        x: 20,
        y: yOffset,
        width: barWidth,
        barHeight,
        idPrefix,
        circleColor: resolvedColors.circleColor,
        textColor: resolvedColors.textColor,
        backgroundColor: resolvedColors.backgroundColor,
        delay: nextDelay(),
      }),
    );
    yOffset += barSpacing;
  }

  if (stats.chaptersRead !== undefined && stats.chaptersRead > 0) {
    milestoneBars.push(
      generateMilestoneBar({
        value: stats.chaptersRead,
        metric: "chapters",
        label: "Chapters Read",
        unit: "ch",
        x: 20,
        y: yOffset,
        width: barWidth,
        barHeight,
        idPrefix,
        circleColor: resolvedColors.circleColor,
        textColor: resolvedColors.textColor,
        backgroundColor: resolvedColors.backgroundColor,
        delay: nextDelay(),
      }),
    );
    yOffset += barSpacing;
  }

  if (stats.volumesRead !== undefined && stats.volumesRead > 0) {
    milestoneBars.push(
      generateMilestoneBar({
        value: stats.volumesRead,
        metric: "volumes",
        label: "Volumes Read",
        unit: "vol",
        x: 20,
        y: yOffset,
        width: barWidth,
        barHeight,
        idPrefix,
        circleColor: resolvedColors.circleColor,
        textColor: resolvedColors.textColor,
        backgroundColor: resolvedColors.backgroundColor,
        delay: nextDelay(),
      }),
    );
    yOffset += barSpacing;
  }

  if ((stats.animeCount ?? 0) + (stats.mangaCount ?? 0) > 0) {
    const totalCount = (stats.animeCount ?? 0) + (stats.mangaCount ?? 0);
    milestoneBars.push(
      generateMilestoneBar({
        value: totalCount,
        metric: "count",
        label: "Total Entries",
        unit: "titles",
        x: 20,
        y: yOffset,
        width: barWidth,
        barHeight,
        idPrefix,
        circleColor: resolvedColors.circleColor,
        textColor: resolvedColors.textColor,
        backgroundColor: resolvedColors.backgroundColor,
        delay: nextDelay(),
      }),
    );
  }

  const barCount = milestoneBars.length;
  const lastBarY = barCount > 0 ? 40 + (barCount - 1) * barSpacing : 0;
  const requiredHeight = barCount > 0 ? lastBarY + barHeight + 52 : baseDims.h;
  const svgHeight = Math.max(baseDims.h, requiredHeight);

  return markTrustedSvg(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${baseDims.w}" height="${svgHeight}" viewBox="0 0 ${baseDims.w} ${svgHeight}" fill="none" role="img" aria-labelledby="title-id">
      ${gradientDefs ? `<defs>${gradientDefs}</defs>` : ""}
      <title id="title-id">${safeTitle}</title>
      <style>
        .header { fill: ${resolvedColors.titleColor}; font: 600 ${headerFontSize}px 'Segoe UI', Ubuntu, Sans-Serif; }
        .milestone-label { font: 600 12px 'Segoe UI', Ubuntu, Sans-Serif; }
        .milestone-target { font: 500 11px 'Segoe UI', Ubuntu, Sans-Serif; opacity: 0.78; }
        .milestone-value { font: 700 10px 'Segoe UI', Ubuntu, Sans-Serif; }
        .stagger { opacity: 0; animation: fadeIn 0.5s ease forwards; }
        @keyframes fadeIn { to { opacity: 1; } }
      </style>
      <rect x="0.5" y="0.5" width="${baseDims.w - 1}" height="${svgHeight - 1}" rx="${cardRadius}" fill="${resolvedColors.backgroundColor}" ${resolvedColors.borderColor ? `stroke="${resolvedColors.borderColor}"` : ""} stroke-width="2"/>
      <g transform="translate(20, 35)">
        <text class="header">${safeTitle}</text>
      </g>
      ${milestoneBars.join("")}
    </svg>
  `);
}
