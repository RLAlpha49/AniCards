import type { TrustedSVG } from "@/lib/types/svg";
import type { ColorValue } from "@/lib/types/card";
import type { MediaListEntry } from "@/lib/types/records";
import {
  calculateDynamicFontSize,
  getCardBorderRadius,
  processColorsForSVG,
  escapeForXml,
  markTrustedSvg,
} from "../utils";

/** Status color mapping for list statuses. @source */
const STATUS_COLORS: Record<string, string> = {
  COMPLETED: "#2ecc71",
  CURRENT: "#3498db",
  WATCHING: "#3498db",
  READING: "#3498db",
  PLANNING: "#9b59b6",
  PAUSED: "#f39c12",
  ON_HOLD: "#f39c12",
  DROPPED: "#e74c3c",
  REPEATING: "#1abc9c",
};

/** Status display names. @source */
const STATUS_NAMES: Record<string, string> = {
  COMPLETED: "Completed",
  CURRENT: "Current",
  WATCHING: "Watching",
  READING: "Reading",
  PLANNING: "Planning",
  PAUSED: "Paused",
  ON_HOLD: "On Hold",
  DROPPED: "Dropped",
  REPEATING: "Repeating",
};

type StatusCount = { status: string; count: number };

const STATUS_SORT_WEIGHT: Record<string, number> = {
  COMPLETED: 10,
  CURRENT: 20,
  PLANNING: 30,
  PAUSED: 40,
  DROPPED: 50,
  REPEATING: 60,
};

function canonicalizeStatusKey(status: string): string {
  const key = String(status ?? "")
    .trim()
    .toUpperCase();
  if (key === "WATCHING" || key === "READING") return "CURRENT";
  if (key === "ON_HOLD") return "PAUSED";
  return key;
}

function normalizeStatusCounts(statuses: StatusCount[]): StatusCount[] {
  const counts = new Map<string, number>();
  for (const s of statuses ?? []) {
    const key = canonicalizeStatusKey(s.status);
    const count = Number(s.count ?? 0);
    if (!Number.isFinite(count)) continue;
    counts.set(key, (counts.get(key) ?? 0) + count);
  }
  return [...counts.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => {
      const wa = STATUS_SORT_WEIGHT[a.status] ?? 999;
      const wb = STATUS_SORT_WEIGHT[b.status] ?? 999;
      return wa - wb || b.count - a.count || a.status.localeCompare(b.status);
    });
}

function toSvgIdFragment(value: string): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .slice(0, 48);
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

/** Status completion input structure. @source */
interface StatusCompletionInput {
  username: string;
  variant?: "combined" | "split";
  styles: {
    titleColor: ColorValue;
    backgroundColor: ColorValue;
    textColor: ColorValue;
    circleColor: ColorValue;
    borderColor?: ColorValue;
    borderRadius?: number;
  };
  animeStatuses: { status: string; count: number }[];
  mangaStatuses: { status: string; count: number }[];
}

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

/** Personal records card input structure. @source */
interface PersonalRecordsInput {
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
  animeCompleted: MediaListEntry[];
  mangaCompleted: MediaListEntry[];
  animeRewatched: MediaListEntry[];
  mangaReread: MediaListEntry[];
}

/** Planning backlog card input structure. @source */
interface PlanningBacklogInput {
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
  animePlanning: MediaListEntry[];
  mangaPlanning: MediaListEntry[];
  animeCount?: number;
  mangaCount?: number;
}

/** Most rewatched card input structure. @source */
interface MostRewatchedInput {
  username: string;
  variant?: "default" | "anime" | "manga";
  styles: {
    titleColor: ColorValue;
    backgroundColor: ColorValue;
    textColor: ColorValue;
    circleColor: ColorValue;
    borderColor?: ColorValue;
    borderRadius?: number;
  };
  animeRewatched: MediaListEntry[];
  mangaReread: MediaListEntry[];
  totalRewatches?: number;
  totalRereads?: number;
}

/**
 * Get dimensions based on variant and card type.
 * @source
 */
function getDimensions(
  cardType: string,
  variant: string,
): { w: number; h: number } {
  const dims: Record<string, Record<string, { w: number; h: number }>> = {
    statusCompletionOverview: {
      combined: { w: 400, h: 150 },
      split: { w: 450, h: 220 },
    },
    milestones: {
      default: { w: 350, h: 180 },
    },
    personalRecords: {
      default: { w: 280, h: 260 },
    },
    planningBacklog: {
      default: { w: 350, h: 260 },
    },
    mostRewatched: {
      default: { w: 320, h: 220 },
      anime: { w: 330, h: 190 },
      manga: { w: 330, h: 190 },
    },
  };
  return (
    dims[cardType]?.[variant] ?? dims[cardType]?.default ?? { w: 400, h: 200 }
  );
}

/**
 * Truncate a string to a maximum character count, appending an ellipsis when needed.
 * Keep truncation deterministic and do not escape here; callers should escape right
 * before embedding into SVG.
 */
function truncateWithEllipsis(text: string, maxChars: number): string {
  const s = String(text ?? "").trim();
  if (maxChars <= 0) return "";
  if (s.length <= maxChars) return s;
  if (maxChars === 1) return "…";
  return `${s.slice(0, maxChars - 1)}…`;
}

/**
 * Calculate completion ratio and format as percentage.
 * @source
 */
function calculateCompletionRatio(
  statuses: { status: string; count: number }[],
): { completedCount: number; totalCount: number; percentage: string } {
  const completedCount =
    statuses.find((s) => s.status === "COMPLETED")?.count ?? 0;
  const totalCount = statuses.reduce((sum, s) => sum + s.count, 0);
  const percentage =
    totalCount > 0 ? ((completedCount / totalCount) * 100).toFixed(1) : "0.0";
  return { completedCount, totalCount, percentage };
}

/**
 * Generate a stacked bar representation of status distribution.
 * @source
 */
interface StackedBarOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  textColor: string;
  trackColor: string;
}

function generateStackedBar(
  statuses: StatusCount[],
  opts: StackedBarOptions,
): string {
  const { x, y, width, height, label, textColor, trackColor } = opts;
  const normalized = normalizeStatusCounts(statuses).filter((s) => s.count > 0);
  const total = normalized.reduce((sum, s) => sum + s.count, 0);
  if (total === 0) return "";

  const barRadius = Math.max(2, Math.min(height / 2, 10));
  const clipId = `bar-clip-${toSvgIdFragment(label)}-${Math.round(x)}-${Math.round(y)}-${Math.round(width)}-${Math.round(height)}`;

  let usedWidth = 0;
  const bars = normalized
    .map((s, i) => {
      const isLast = i === normalized.length - 1;
      const rawWidth = (s.count / total) * width;
      const segmentWidth = isLast ? Math.max(0, width - usedWidth) : rawWidth;
      const segmentX = x + usedWidth;
      usedWidth += segmentWidth;

      const color = STATUS_COLORS[s.status] ?? "#95a5a6";
      return `<rect x="${segmentX.toFixed(2)}" y="${y}" width="${segmentWidth.toFixed(2)}" height="${height}" fill="${color}" class="stagger" style="animation-delay:${400 + i * 80}ms"/>`;
    })
    .join("");

  return `
    <defs>
      <clipPath id="${clipId}">
        <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${barRadius}"/>
      </clipPath>
    </defs>
    <text x="${x}" y="${y - 8}" class="bar-label" fill="${textColor}">${escapeForXml(label)}</text>
    <g clip-path="url(#${clipId})">
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${barRadius}" fill="${trackColor}" opacity="0.18"/>
      ${bars}
    </g>
  `;
}

/**
 * Generate a legend for status colors.
 * @source
 */
function generateStatusLegend(
  statuses: StatusCount[],
  x: number,
  y: number,
  textColor: string,
): string {
  return normalizeStatusCounts(statuses)
    .filter((s) => s.count > 0)
    .slice(0, 6)
    .map((s, i) => {
      const color = STATUS_COLORS[s.status] ?? "#95a5a6";
      const name = STATUS_NAMES[s.status] ?? s.status;
      const row = Math.floor(i / 3);
      const col = i % 3;
      const itemX = x + col * 110;
      const itemY = y + row * 18;
      return `
        <g transform="translate(${itemX}, ${itemY})" class="stagger" style="animation-delay:${600 + i * 50}ms">
          <rect x="0" y="-8" width="10" height="10" rx="2" fill="${color}"/>
          <text x="14" y="0" class="legend-text" fill="${textColor}">${escapeForXml(name)}: ${s.count}</text>
        </g>
      `;
    })
    .join("");
}

/**
 * Renders the Status Completion Overview card showing cross-media completion stats.
 * @source
 */
export function statusCompletionOverviewTemplate(
  input: StatusCompletionInput,
): TrustedSVG {
  const { username, styles, variant = "combined" } = input;
  const animeStatuses = normalizeStatusCounts(input.animeStatuses ?? []);
  const mangaStatuses = normalizeStatusCounts(input.mangaStatuses ?? []);

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
  const dims = getDimensions("statusCompletionOverview", variant);
  const title = `${username}'s Completion Overview`;
  const safeTitle = escapeForXml(title);
  const headerFontSize = calculateDynamicFontSize(title, 18, dims.w - 40);

  const animeRatio = calculateCompletionRatio(animeStatuses);
  const mangaRatio = calculateCompletionRatio(mangaStatuses);

  let content: string;

  if (variant === "split") {
    content = `
      <g transform="translate(25, 65)">
        ${generateStackedBar(animeStatuses, {
          x: 0,
          y: 0,
          width: dims.w - 50,
          height: 20,
          label: `Anime (${animeRatio.percentage}% completed)`,
          textColor: resolvedColors.textColor,
          trackColor: resolvedColors.circleColor,
        })}
        ${generateStatusLegend(animeStatuses, 0, 34, resolvedColors.textColor)}
        ${generateStackedBar(mangaStatuses, {
          x: 0,
          y: 80,
          width: dims.w - 50,
          height: 20,
          label: `Manga (${mangaRatio.percentage}% completed)`,
          textColor: resolvedColors.textColor,
          trackColor: resolvedColors.circleColor,
        })}
        ${generateStatusLegend(mangaStatuses, 0, 114, resolvedColors.textColor)}
      </g>
    `;
  } else {
    // Combined variant - merge anime and manga statuses
    const combinedStatuses = normalizeStatusCounts([
      ...animeStatuses,
      ...mangaStatuses,
    ]);
    const combinedRatio = calculateCompletionRatio(combinedStatuses);

    content = `
      <g transform="translate(25, 65)">
        ${generateStackedBar(combinedStatuses, {
          x: 0,
          y: 0,
          width: dims.w - 50,
          height: 24,
          label: `All Media (${combinedRatio.percentage}% completed)`,
          textColor: resolvedColors.textColor,
          trackColor: resolvedColors.circleColor,
        })}
        ${generateStatusLegend(combinedStatuses, 0, 40, resolvedColors.textColor)}
      </g>
    `;
  }

  return markTrustedSvg(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${dims.w}" height="${dims.h}" viewBox="0 0 ${dims.w} ${dims.h}" fill="none" role="img" aria-labelledby="title-id">
      ${gradientDefs ? `<defs>${gradientDefs}</defs>` : ""}
      <title id="title-id">${safeTitle}</title>
      <style>
        .header { fill: ${resolvedColors.titleColor}; font: 600 ${headerFontSize}px 'Segoe UI', Ubuntu, Sans-Serif; }
        .bar-label { font: 500 12px 'Segoe UI', Ubuntu, Sans-Serif; }
        .legend-text { font: 400 11px 'Segoe UI', Ubuntu, Sans-Serif; }
        .stagger { opacity: 0; animation: fadeIn 0.5s ease forwards; }
        @keyframes fadeIn { to { opacity: 1; } }
      </style>
      <rect x="0.5" y="0.5" width="${dims.w - 1}" height="${dims.h - 1}" rx="${cardRadius}" fill="${resolvedColors.backgroundColor}" ${resolvedColors.borderColor ? `stroke="${resolvedColors.borderColor}"` : ""} stroke-width="2"/>
      <g transform="translate(20, 35)">
        <text class="header">${safeTitle}</text>
      </g>
      ${content}
    </svg>
  `);
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
  const labelY = -8;
  const valueY = barHeight - 3;
  const rowY = -22;
  const rowHeight = barHeight + 34;

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
  const baseDims = getDimensions("milestones", variant);
  const title = `${username}'s Milestones`;
  const safeTitle = escapeForXml(title);
  const headerFontSize = calculateDynamicFontSize(title, 18, baseDims.w - 40);

  const idPrefix = `ms-${toSvgIdFragment(username)}-${toSvgIdFragment(variant)}`;
  const daysWatched = Math.floor((stats.minutesWatched ?? 0) / 1440);
  const barWidth = baseDims.w - 40;
  const barSpacing = 42;
  const barHeight = 14;

  const milestoneBars: string[] = [];
  let yOffset = 70;

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
        delay: 400,
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
        delay: 500,
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
        delay: 600,
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
        delay: 700,
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
        delay: 800,
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

/**
 * Get media title with fallback.
 * @source
 */
function getMediaTitle(entry: MediaListEntry): string {
  const title = entry.media.title;
  return title.english ?? title.romaji ?? title.native ?? "Unknown";
}

/**
 * Renders the Personal Records card showing user's personal bests.
 * @source
 */
export function personalRecordsTemplate(
  input: PersonalRecordsInput,
): TrustedSVG {
  const { username, styles, variant = "default" } = input;
  const animeCompleted = input.animeCompleted ?? [];
  const mangaCompleted = input.mangaCompleted ?? [];
  const animeRewatched =
    input.animeRewatched?.filter((e) => e.repeat && e.repeat > 0) ?? [];
  const mangaReread =
    input.mangaReread?.filter((e) => e.repeat && e.repeat > 0) ?? [];

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
  const dims = getDimensions("personalRecords", variant);
  const title = `${username}'s Personal Records`;
  const safeTitle = escapeForXml(title);
  const headerFontSize = calculateDynamicFontSize(title, 18, dims.w - 40);

  // Find records
  const longestAnime = [...animeCompleted].sort(
    (a, b) => (b.media.episodes ?? 0) - (a.media.episodes ?? 0),
  )[0];
  const longestManga = [...mangaCompleted].sort(
    (a, b) => (b.media.chapters ?? 0) - (a.media.chapters ?? 0),
  )[0];
  const topRatedAnime = [...animeCompleted].sort(
    (a, b) => (b.score ?? 0) - (a.score ?? 0),
  )[0];
  const topRatedManga = [...mangaCompleted].sort(
    (a, b) => (b.score ?? 0) - (a.score ?? 0),
  )[0];
  const mostRewatched = [...animeRewatched].sort(
    (a, b) => (b.repeat ?? 0) - (a.repeat ?? 0),
  )[0];
  const mostReread = [...mangaReread].sort(
    (a, b) => (b.repeat ?? 0) - (a.repeat ?? 0),
  )[0];

  const maxTitleChars = 42;

  const formatMediaValue = (
    entry: MediaListEntry | undefined,
    suffix: string,
  ): { value: string; missing: boolean } => {
    if (!entry) return { value: "—", missing: true };
    const titleText = getMediaTitle(entry);
    const clipped = truncateWithEllipsis(titleText, maxTitleChars);
    return { value: `${escapeForXml(clipped)} ${suffix}`, missing: false };
  };

  const formatScoreValue = (
    entry: MediaListEntry | undefined,
  ): { value: string; missing: boolean } => {
    const score = entry?.score ?? 0;
    if (!entry || score <= 0) return { value: "—", missing: true };
    const titleText = getMediaTitle(entry);
    const clipped = truncateWithEllipsis(titleText, maxTitleChars);
    return {
      value: `${escapeForXml(clipped)} (${escapeForXml(score)}/10)`,
      missing: false,
    };
  };

  const longestAnimeRow = longestAnime?.media.episodes
    ? {
        label: "Longest Anime",
        ...formatMediaValue(
          longestAnime,
          `(${longestAnime.media.episodes} ep)`,
        ),
      }
    : { label: "Longest Anime", value: "—", missing: true };

  const longestMangaRow = (() => {
    if (longestManga?.media.chapters) {
      return {
        label: "Longest Manga",
        ...formatMediaValue(
          longestManga,
          `(${longestManga.media.chapters} ch)`,
        ),
      };
    }
    if (longestManga?.media.volumes) {
      return {
        label: "Longest Manga",
        ...formatMediaValue(
          longestManga,
          `(${longestManga.media.volumes} vol)`,
        ),
      };
    }
    return { label: "Longest Manga", value: "—", missing: true };
  })();

  const mostRewatchedRow =
    mostRewatched?.repeat && mostRewatched.repeat > 0
      ? {
          label: "Most Rewatched",
          ...formatMediaValue(mostRewatched, `(${mostRewatched.repeat}x)`),
        }
      : { label: "Most Rewatched", value: "—", missing: true };

  const mostRereadRow =
    mostReread?.repeat && mostReread.repeat > 0
      ? {
          label: "Most Reread",
          ...formatMediaValue(mostReread, `(${mostReread.repeat}x)`),
        }
      : { label: "Most Reread", value: "—", missing: true };

  // Always render the full set of record rows (using placeholders when data is missing)
  const rows: { label: string; value: string; missing: boolean }[] = [
    longestAnimeRow,
    longestMangaRow,
    { label: "Top Rated Anime", ...formatScoreValue(topRatedAnime) },
    { label: "Top Rated Manga", ...formatScoreValue(topRatedManga) },
    mostRewatchedRow,
    mostRereadRow,
  ];

  const rowHeight = 34;
  const startY = 62;
  const bottomPad = 22;
  const svgHeight = Math.max(
    180,
    startY + (rows.length - 1) * rowHeight + 26 + bottomPad,
  );

  const recordsContent = rows
    .map((r, i) => {
      const valueFill = r.missing
        ? resolvedColors.textColor
        : resolvedColors.circleColor;
      const valueOpacity = r.missing ? 0.65 : 1;
      return `
      <g transform="translate(25, ${startY + i * rowHeight})" class="stagger" style="animation-delay:${400 + i * 100}ms">
        <text class="record-label" x="0" y="0" fill="${resolvedColors.textColor}">${escapeForXml(r.label)}:</text>
        <text class="record-value" x="0" y="16" fill="${valueFill}" opacity="${valueOpacity}">${r.value}</text>
      </g>
    `;
    })
    .join("");

  return markTrustedSvg(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${dims.w}" height="${svgHeight}" viewBox="0 0 ${dims.w} ${svgHeight}" fill="none" role="img" aria-labelledby="title-id">
      ${gradientDefs ? `<defs>${gradientDefs}</defs>` : ""}
      <title id="title-id">${safeTitle}</title>
      <style>
        .header { fill: ${resolvedColors.titleColor}; font: 600 ${headerFontSize}px 'Segoe UI', Ubuntu, Sans-Serif; }
        .record-label { font-family: 'Segoe UI', Ubuntu, Sans-Serif; font-weight: 500; font-size: 12px; }
        .record-value { font-family: 'Segoe UI', Ubuntu, Sans-Serif; font-weight: 400; font-size: 11px; }
        .stagger { opacity: 0; animation: fadeIn 0.5s ease forwards; }
        @keyframes fadeIn { to { opacity: 1; } }
      </style>
      <rect x="0.5" y="0.5" width="${dims.w - 1}" height="${svgHeight - 1}" rx="${cardRadius}" fill="${resolvedColors.backgroundColor}" ${resolvedColors.borderColor ? `stroke="${resolvedColors.borderColor}"` : ""} stroke-width="2"/>
      <g transform="translate(20, 35)">
        <text class="header">${safeTitle}</text>
      </g>
      ${recordsContent}
    </svg>
  `);
}

/**
 * Renders the Planning Backlog card showing planned titles.
 * @source
 */
export function planningBacklogTemplate(
  input: PlanningBacklogInput,
): TrustedSVG {
  const { username, styles, variant = "default" } = input;
  const animePlanning = input.animePlanning ?? [];
  const mangaPlanning = input.mangaPlanning ?? [];

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
  const dims = getDimensions("planningBacklog", variant);
  const title = `${username}'s Planning Backlog`;
  const safeTitle = escapeForXml(title);
  const headerFontSize = calculateDynamicFontSize(title, 18, dims.w - 40);

  const allPlanning = [...animePlanning, ...mangaPlanning];
  const animeCount = input.animeCount ?? animePlanning.length;
  const mangaCount = input.mangaCount ?? mangaPlanning.length;

  let displayEntries: MediaListEntry[];

  displayEntries = [...allPlanning]
    .sort((a, b) => (b.media.averageScore ?? 0) - (a.media.averageScore ?? 0))
    .slice(0, 5);

  const statsLine = `📺 ${animeCount} anime | 📚 ${mangaCount} manga planned`;

  const entriesContent = displayEntries
    .map((entry, i) => {
      const mediaTitle = getMediaTitle(entry);
      const format = entry.media.format ?? "?";
      const score = entry.media.averageScore
        ? `${entry.media.averageScore}%`
        : "N/A";
      return `
        <g transform="translate(25, ${85 + i * 32})" class="stagger" style="animation-delay:${400 + i * 80}ms">
          <text class="entry-title" fill="${resolvedColors.textColor}">${escapeForXml(mediaTitle.slice(0, 50))}${mediaTitle.length > 50 ? "..." : ""}</text>
          <text class="entry-meta" x="0" y="14" fill="${resolvedColors.circleColor}">${format} • Score: ${score}</text>
        </g>
      `;
    })
    .join("");

  return markTrustedSvg(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${dims.w}" height="${dims.h}" viewBox="0 0 ${dims.w} ${dims.h}" fill="none" role="img" aria-labelledby="title-id">
      ${gradientDefs ? `<defs>${gradientDefs}</defs>` : ""}
      <title id="title-id">${safeTitle}</title>
      <style>
        .header { fill: ${resolvedColors.titleColor}; font: 600 ${headerFontSize}px 'Segoe UI', Ubuntu, Sans-Serif; }
        .stats-line { font: 400 12px 'Segoe UI', Ubuntu, Sans-Serif; }
        .entry-title { font: 500 12px 'Segoe UI', Ubuntu, Sans-Serif; }
        .entry-meta { font: 400 10px 'Segoe UI', Ubuntu, Sans-Serif; opacity: 0.8; }
        .stagger { opacity: 0; animation: fadeIn 0.5s ease forwards; }
        @keyframes fadeIn { to { opacity: 1; } }
      </style>
      <rect x="0.5" y="0.5" width="${dims.w - 1}" height="${dims.h - 1}" rx="${cardRadius}" fill="${resolvedColors.backgroundColor}" ${resolvedColors.borderColor ? `stroke="${resolvedColors.borderColor}"` : ""} stroke-width="2"/>
      <g transform="translate(20, 35)">
        <text class="header">${safeTitle}</text>
      </g>
      <g transform="translate(25, 58)">
        <text class="stats-line" fill="${resolvedColors.textColor}">${statsLine}</text>
      </g>
      ${entriesContent}
    </svg>
  `);
}

/**
 * Renders the Most Rewatched/Reread card showing titles the user revisits.
 * @source
 */
export function mostRewatchedTemplate(input: MostRewatchedInput): TrustedSVG {
  const { username, styles, variant = "default" } = input;
  const dedupeByMediaIdKeepHighestRepeat = (
    entries: MediaListEntry[],
  ): MediaListEntry[] => {
    const byId = new Map<number, MediaListEntry>();
    for (const entry of entries) {
      const mediaId = entry.media?.id;
      if (!mediaId) continue;

      const existing = byId.get(mediaId);
      if (!existing) {
        byId.set(mediaId, entry);
        continue;
      }

      const existingRepeat = existing.repeat ?? 0;
      const nextRepeat = entry.repeat ?? 0;
      if (nextRepeat > existingRepeat) byId.set(mediaId, entry);
    }
    return [...byId.values()];
  };

  const animeRewatched = dedupeByMediaIdKeepHighestRepeat(
    input.animeRewatched?.filter((e) => (e.repeat ?? 0) > 0) ?? [],
  );
  const mangaReread = dedupeByMediaIdKeepHighestRepeat(
    input.mangaReread?.filter((e) => (e.repeat ?? 0) > 0) ?? [],
  );

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
  const dims = getDimensions("mostRewatched", variant);

  let title: string;
  let displayEntries: { entry: MediaListEntry; type: "anime" | "manga" }[];

  if (variant === "anime") {
    title = `${username}'s Most Rewatched Anime`;
    displayEntries = animeRewatched
      .toSorted((a, b) => (b.repeat ?? 0) - (a.repeat ?? 0))
      .slice(0, 5)
      .map((e) => ({ entry: e, type: "anime" as const }));
  } else if (variant === "manga") {
    title = `${username}'s Most Reread Manga`;
    displayEntries = mangaReread
      .toSorted((a, b) => (b.repeat ?? 0) - (a.repeat ?? 0))
      .slice(0, 5)
      .map((e) => ({ entry: e, type: "manga" as const }));
  } else {
    title = `${username}'s Most Revisited`;
    const combined = [
      ...animeRewatched.map((e) => ({ entry: e, type: "anime" as const })),
      ...mangaReread.map((e) => ({ entry: e, type: "manga" as const })),
    ];
    displayEntries = combined
      .toSorted((a, b) => (b.entry.repeat ?? 0) - (a.entry.repeat ?? 0))
      .slice(0, 5);
  }

  const safeTitle = escapeForXml(title);
  const headerFontSize = calculateDynamicFontSize(title, 18, dims.w - 40);

  // Reduce empty space when there are fewer than 5 entries by shrinking the SVG
  // height to fit the rendered rows. Keep a sensible minimum so the card still
  // looks intentional.
  const svgHeight = Math.max(
    150,
    displayEntries.length === 0
      ? dims.h
      : 85 + Math.max(0, displayEntries.length - 1) * 28 + 23,
  );

  const totalRewatches =
    input.totalRewatches ??
    animeRewatched.reduce((sum, e) => sum + (e.repeat ?? 0), 0);
  const totalRereads =
    input.totalRereads ??
    mangaReread.reduce((sum, e) => sum + (e.repeat ?? 0), 0);
  const statsLine = `🔄 ${totalRewatches} rewatches | 📖 ${totalRereads} rereads`;

  const entriesContent = displayEntries
    .map(({ entry, type }, i) => {
      const mediaTitle = getMediaTitle(entry);
      const repeatCount = entry.repeat ?? 0;
      const icon = type === "anime" ? "📺" : "📚";
      return `
        <g transform="translate(25, ${85 + i * 28})" class="stagger" style="animation-delay:${400 + i * 80}ms">
          <text class="entry-icon" fill="${resolvedColors.textColor}">${icon}</text>
          <text class="entry-title" x="22" fill="${resolvedColors.textColor}">${escapeForXml(mediaTitle.slice(0, 32))}${mediaTitle.length > 32 ? "..." : ""}</text>
          <text class="entry-count" x="${dims.w - 45}" fill="${resolvedColors.circleColor}" text-anchor="end">${repeatCount}x</text>
        </g>
      `;
    })
    .join("");

  const noDataMessage =
    displayEntries.length === 0
      ? `<text x="${dims.w / 2}" y="${svgHeight / 2}" text-anchor="middle" fill="${resolvedColors.textColor}" class="stats-line">No rewatched or reread titles found</text>`
      : "";

  return markTrustedSvg(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${dims.w}" height="${svgHeight}" viewBox="0 0 ${dims.w} ${svgHeight}" fill="none" role="img" aria-labelledby="title-id">
      ${gradientDefs ? `<defs>${gradientDefs}</defs>` : ""}
      <title id="title-id">${safeTitle}</title>
      <style>
        .header { fill: ${resolvedColors.titleColor}; font: 600 ${headerFontSize}px 'Segoe UI', Ubuntu, Sans-Serif; }
        .stats-line { font: 400 12px 'Segoe UI', Ubuntu, Sans-Serif; }
        .entry-icon { font-size: 14px; }
        .entry-title { font: 500 12px 'Segoe UI', Ubuntu, Sans-Serif; }
        .entry-count { font: 600 12px 'Segoe UI', Ubuntu, Sans-Serif; }
        .stagger { opacity: 0; animation: fadeIn 0.5s ease forwards; }
        @keyframes fadeIn { to { opacity: 1; } }
      </style>
      <rect x="0.5" y="0.5" width="${dims.w - 1}" height="${svgHeight - 1}" rx="${cardRadius}" fill="${resolvedColors.backgroundColor}" ${resolvedColors.borderColor ? `stroke="${resolvedColors.borderColor}"` : ""} stroke-width="2"/>
      <g transform="translate(20, 35)">
        <text class="header">${safeTitle}</text>
      </g>
      <g transform="translate(25, 58)">
        <text class="stats-line" fill="${resolvedColors.textColor}">${statsLine}</text>
      </g>
      ${entriesContent}
      ${noDataMessage}
    </svg>
  `);
}
