import type { MediaListEntry } from "@/lib/types/records";
import { escapeForXml } from "@/lib/utils";

/** Status color mapping for list statuses. @source */
export const STATUS_COLORS: Record<string, string> = {
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
export const STATUS_NAMES: Record<string, string> = {
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

export type StatusCount = { status: string; count: number };

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

export function normalizeStatusCounts(statuses: StatusCount[]): StatusCount[] {
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

export function toSvgIdFragment(value: string): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .slice(0, 48);
}

/**
 * Get dimensions based on variant and card type.
 * @source
 */
export function getDimensions(
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
export function truncateWithEllipsis(text: string, maxChars: number): string {
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
export function calculateCompletionRatio(
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
export interface StackedBarOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  textColor: string;
  trackColor: string;
}

export function generateStackedBar(
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
export function generateStatusLegend(
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
 * Get media title with fallback.
 * @source
 */
export function getMediaTitle(entry: MediaListEntry): string {
  const title = entry.media.title;
  return title.english ?? title.romaji ?? title.native ?? "Unknown";
}
