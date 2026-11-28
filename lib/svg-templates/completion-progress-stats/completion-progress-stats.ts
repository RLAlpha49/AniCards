import type { MediaListEntry } from "@/lib/types/records";
import { escapeForXml } from "@/lib/svg-markup";
import {
  ANIMATION,
  CARD_DIMENSIONS,
  estimateCardTextWidth,
  getCardDimensions,
} from "@/lib/svg-templates/common";

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
  return (
    String(value ?? "")
      .trim()
      .toLowerCase()
      // Any run of unsupported characters becomes a single hyphen.
      .replaceAll(/[^a-z0-9_-]+/g, "-")
      // Hyphens are legal in the class above, so collapse runs of them here.
      .replaceAll(/-{2,}/g, "-")
      // Anchored single-character strips, so no trailing quantifier has to backtrack.
      .replace(/^-/, "")
      .replace(/-$/, "")
      .slice(0, 48)
  );
}

/**
 * Get dimensions based on variant and card type.
 * @source
 */
export function getDimensions(
  cardType: string,
  variant: string,
): { w: number; h: number } {
  if (cardType in CARD_DIMENSIONS) {
    return getCardDimensions(cardType as keyof typeof CARD_DIMENSIONS, variant);
  }

  return { w: 400, h: 200 };
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
interface StackedBarOptions {
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
      return `<rect x="${segmentX.toFixed(2)}" y="${y}" width="${segmentWidth.toFixed(2)}" height="${height}" fill="${color}" class="stagger" style="animation-delay:${ANIMATION.BASE_DELAY + i * ANIMATION.FAST_INCREMENT}ms"/>`;
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
 * Fit long text within the available space by shrinking the font size.
 *
 * Widths come from advances measured from the card font. The previous
 * per-character guess over-measured prose, so labels shrank further than the
 * available room required. The size is emitted as an inline style because a
 * `font-size` attribute loses to a stylesheet's `font:` shorthand.
 * @source
 */
export function fitStatusText(
  text: string,
  width: number,
  fontSize: number,
): string {
  const measured = estimateCardTextWidth(text, fontSize, 400);
  if (measured <= width) return "";
  return `style="font-size:${Math.max(6, (fontSize * width) / measured).toFixed(2)}px"`;
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
  width: number,
): string {
  const visibleStatuses = normalizeStatusCounts(statuses)
    .filter((s) => s.count > 0)
    .slice(0, 6);
  if (visibleStatuses.length === 0) {
    return `<text x="${x}" y="${y}" class="legend-text" fill="${textColor}">No entries</text>`;
  }

  const columnWidth = width / 2;
  return visibleStatuses
    .map((s, i) => {
      const color = STATUS_COLORS[s.status] ?? "#95a5a6";
      const name = STATUS_NAMES[s.status] ?? s.status;
      const label = `${name}: ${s.count}`;
      const row = Math.floor(i / 2);
      const col = i % 2;
      const itemX = x + col * columnWidth;
      const itemY = y + row * 17;
      return `
        <g transform="translate(${itemX}, ${itemY})" class="stagger" style="animation-delay:${ANIMATION.LEGEND_BASE_DELAY + i * ANIMATION.LEGEND_INCREMENT}ms">
          <rect x="0" y="-8" width="10" height="10" rx="2" fill="${color}"/>
          <text x="14" y="0" class="legend-text" fill="${textColor}" ${fitStatusText(label, columnWidth - 22, 12)}>${escapeForXml(label)}</text>
        </g>
      `;
    })
    .join("");
}

/**
 * Deduplicate a list of MediaListEntry items by media.id, keeping the entry
 * with the highest `repeat` value. Entries without a numeric `media.id`
 * are skipped.
 */
export function dedupeByMediaIdKeepHighestRepeat(
  entries: MediaListEntry[],
): MediaListEntry[] {
  const byId = new Map<number, MediaListEntry>();
  for (const entry of entries ?? []) {
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
}

/**
 * Get media title with fallback.
 * @source
 */
export function getMediaTitle(entry: MediaListEntry): string {
  const title = entry.media.title;
  const pick = (...candidates: Array<string | null | undefined>): string => {
    for (const c of candidates) {
      const s = typeof c === "string" ? c.trim() : "";
      if (s) return s;
    }
    return "Unknown";
  };
  return pick(title.english, title.romaji, title.native);
}
