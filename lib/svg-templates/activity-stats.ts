import type { TrustedSVG } from "@/lib/types/svg";
import type { ColorValue } from "@/lib/types/card";
import {
  calculateDynamicFontSize,
  processColorsForSVG,
  getCardBorderRadius,
  escapeForXml,
  markTrustedSvg,
} from "../utils";

/** Activity history item with date (epoch seconds) and amount. @source */
interface ActivityHistoryItem {
  date: number;
  amount: number;
}

/** Heatmap color palette configuration. @source */
type HeatmapPalette = "default" | "github" | "fire";

/**
 * Converts hex color to HSL.
 * @param hex - Hex color string like #rrggbb.
 * @returns [h, s, l] where h,s,l are 0-1.
 */
function hexToHsl(hex: string): [number, number, number] {
  const r = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const g = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const b = Number.parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0,
    s = 0,
    l = (max + min) / 2;

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

  return [h, s, l];
}

/**
 * Converts HSL to hex color.
 * @param h - Hue 0-1.
 * @param s - Saturation 0-1.
 * @param l - Lightness 0-1.
 * @returns Hex color string.
 */
function hslToHex(h: number, s: number, l: number): string {
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (c: number) =>
    Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Gets heatmap color based on activity intensity and palette.
 * @param intensity - Normalized intensity value between 0 and 1.
 * @param palette - Color palette to use.
 * @param baseColor - Base color for default palette.
 * @returns CSS color string.
 * @source
 */
function getHeatmapColor(
  intensity: number,
  palette: HeatmapPalette,
  baseColor: string,
): { color: string; opacity: number } {
  const level = Math.min(4, Math.ceil(intensity * 4));

  switch (palette) {
    case "github": {
      const githubColors = [
        "#ebedf0",
        "#9be9a8",
        "#40c463",
        "#30a14e",
        "#216e39",
      ];
      return { color: githubColors[level], opacity: 1 };
    }
    case "fire": {
      const fireColors = [
        "#ebedf0",
        "#ffadad",
        "#ff6b6b",
        "#ff3838",
        "#e60000",
      ];
      return { color: fireColors[level], opacity: 1 };
    }
    default: // "default"
      if (baseColor.startsWith("#")) {
        const [h, s] = hexToHsl(baseColor);
        // Vary lightness from light (0.9) to dark (0.1)
        const lightnesses = [0.9, 0.7, 0.5, 0.3, 0.1];
        const color = hslToHex(h, s, lightnesses[level]);
        return { color, opacity: 1 };
      } else {
        // For gradients, use varying opacity
        const alphas = [0.2, 0.5, 0.7, 0.9, 1];
        return { color: baseColor, opacity: alphas[level] };
      }
  }
}

/**
 * Generates a GitHub-style activity heatmap calendar.
 * @param data - Template input with username, styles, activity history, and variant.
 * @returns TrustedSVG string for the heatmap card.
 * @source
 */
export function activityHeatmapTemplate(data: {
  username: string;
  variant?: "default" | "github" | "fire";
  styles: {
    titleColor: ColorValue;
    backgroundColor: ColorValue;
    textColor: ColorValue;
    circleColor: ColorValue;
    borderColor?: ColorValue;
    borderRadius?: number;
  };
  activityHistory: ActivityHistoryItem[];
}): TrustedSVG {
  const { gradientDefs, resolvedColors } = processColorsForSVG(
    {
      titleColor: data.styles.titleColor,
      backgroundColor: data.styles.backgroundColor,
      textColor: data.styles.textColor,
      circleColor: data.styles.circleColor,
      borderColor: data.styles.borderColor,
    },
    [
      "titleColor",
      "backgroundColor",
      "textColor",
      "circleColor",
      "borderColor",
    ],
  );

  const cardRadius = getCardBorderRadius(data.styles.borderRadius);
  const palette = (data.variant as HeatmapPalette) || "default";
  const title = `${data.username}'s Activity Heatmap`;
  const safeTitle = escapeForXml(title);

  // Process activity history into a date map
  const activityMap = new Map<string, number>();
  let maxAmount = 1;

  for (const item of data.activityHistory) {
    const date = new Date(item.date * 1000);
    const key = date.toISOString().split("T")[0];
    const current = activityMap.get(key) || 0;
    const newAmount = current + item.amount;
    activityMap.set(key, newAmount);
    maxAmount = Math.max(maxAmount, newAmount);
  }

  // Generate calendar grid for the last ~90 days (13 weeks)
  const weeks = 13;
  const cellSize = 10;
  const cellGap = 2;
  const now = new Date();
  // Start from midnight UTC today
  const startDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  startDate.setUTCDate(startDate.getUTCDate() - weeks * 7 + 1);
  // Align to start of week (Sunday) in UTC
  startDate.setUTCDate(startDate.getUTCDate() - startDate.getUTCDay());

  const cells: string[] = [];
  const currentDate = new Date(startDate);

  for (let week = 0; week < weeks; week++) {
    for (let day = 0; day < 7; day++) {
      const key = currentDate.toISOString().split("T")[0];
      const amount = activityMap.get(key) || 0;
      const intensity = amount / maxAmount;
      const colorData = getHeatmapColor(
        intensity,
        palette,
        resolvedColors.titleColor,
      );
      const x = 25 + week * (cellSize + cellGap);
      const y = 55 + day * (cellSize + cellGap);

      cells.push(`
        <rect
          x="${x}"
          y="${y}"
          width="${cellSize}"
          height="${cellSize}"
          rx="2"
          fill="${colorData.color}"
          ${colorData.opacity === 1 ? "" : `fill-opacity="${colorData.opacity}"`}
          class="stagger"
          style="animation-delay: ${300 + week * 30 + day * 10}ms"
        >
          <title>${key}: ${amount} activities</title>
        </rect>
      `);

      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }
  }

  // Day labels
  const dayLabels = ["Sun", "", "Tue", "", "Thu", "", "Sat"];
  const dayLabelsSvg = dayLabels
    .map((label, i) =>
      label
        ? `<text x="10" y="${62 + i * (cellSize + cellGap)}" class="day-label">${label}</text>`
        : "",
    )
    .join("");

  const dims = { w: 220, h: 160 };

  return markTrustedSvg(`
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${dims.w}"
  height="${dims.h}"
  viewBox="0 0 ${dims.w} ${dims.h}"
  fill="none"
  role="img"
  aria-labelledby="desc-id"
>
  ${gradientDefs ? `<defs>${gradientDefs}</defs>` : ""}
  <title id="title-id">${safeTitle}</title>
  <desc id="desc-id">Activity heatmap showing ${data.activityHistory.length} activity entries</desc>
  <style>
    .header {
      fill: ${resolvedColors.titleColor};
      font: 600 ${calculateDynamicFontSize(title, 16, 180)}px 'Segoe UI', Ubuntu, Sans-Serif;
      animation: fadeInAnimation 0.8s ease-in-out forwards;
    }
    .day-label {
      fill: ${resolvedColors.textColor};
      font: 400 8px 'Segoe UI', Ubuntu, Sans-Serif;
      opacity: 0.7;
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
    x="0.5"
    y="0.5"
    rx="${cardRadius}"
    height="${dims.h - 1}"
    width="${dims.w - 1}"
    fill="${resolvedColors.backgroundColor}"
    ${resolvedColors.borderColor ? `stroke="${resolvedColors.borderColor}"` : ""}
    stroke-width="2"
  />
  <g transform="translate(15, 30)">
    <text x="0" y="0" class="header">${safeTitle}</text>
  </g>
  ${dayLabelsSvg}
  ${cells.join("")}
</svg>
`);
}

/**
 * Renders a sparkline SVG path from data points.
 * @param data - Array of numeric values.
 * @param width - Width of the sparkline area.
 * @param height - Height of the sparkline area.
 * @returns SVG path d attribute string.
 * @source
 */
function generateSparkline(
  data: number[],
  width: number,
  height: number,
): string {
  if (data.length < 2) return "";

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const step = width / (data.length - 1);

  const points = data.map((val, i) => {
    const x = i * step;
    const y = height - ((val - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return `M${points.join(" L")}`;
}

/**
 * Generates a recent activity summary card with sparkline.
 * @param data - Template input with username, styles, and activity history.
 * @returns TrustedSVG string for the summary card.
 * @source
 */
export function recentActivitySummaryTemplate(data: {
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
  activityHistory: ActivityHistoryItem[];
}): TrustedSVG {
  const { gradientDefs, resolvedColors } = processColorsForSVG(
    {
      titleColor: data.styles.titleColor,
      backgroundColor: data.styles.backgroundColor,
      textColor: data.styles.textColor,
      circleColor: data.styles.circleColor,
      borderColor: data.styles.borderColor,
    },
    [
      "titleColor",
      "backgroundColor",
      "textColor",
      "circleColor",
      "borderColor",
    ],
  );

  const cardRadius = getCardBorderRadius(data.styles.borderRadius);
  const title = `${data.username}'s Recent Activity`;
  const safeTitle = escapeForXml(title);

  // Sort activity by date and compute stats
  const sorted = [...data.activityHistory].sort((a, b) => a.date - b.date);
  const totalActivity = sorted.reduce((acc, curr) => acc + curr.amount, 0);
  const dayCount = sorted.length || 1;
  const avgPerDay = (totalActivity / dayCount).toFixed(1);

  // Find best day
  const bestDay = sorted.reduce(
    (best, curr) => (curr.amount > best.amount ? curr : best),
    { date: 0, amount: 0 },
  );
  const bestDayStr = bestDay.date
    ? new Date(bestDay.date * 1000).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      })
    : "N/A";

  const dims = { w: 280, h: 160 };

  // Generate sparkline data (last 30 points or all if less)
  const sparklineData = sorted.slice(-30).map((item) => item.amount);
  const sparklineWidth = dims.w - 40;
  const sparklineHeight = 30;
  const sparklinePath = generateSparkline(
    sparklineData,
    sparklineWidth,
    sparklineHeight,
  );

  const showSparkline = true;

  return markTrustedSvg(`
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${dims.w}"
  height="${dims.h}"
  viewBox="0 0 ${dims.w} ${dims.h}"
  fill="none"
  role="img"
  aria-labelledby="desc-id"
>
  ${gradientDefs ? `<defs>${gradientDefs}</defs>` : ""}
  <title id="title-id">${safeTitle}</title>
  <desc id="desc-id">Total: ${totalActivity}, Average: ${avgPerDay}/day, Best: ${bestDay.amount} on ${bestDayStr}</desc>
  <style>
    .header {
      fill: ${resolvedColors.titleColor};
      font: 600 ${calculateDynamicFontSize(title, 16, dims.w - 40)}px 'Segoe UI', Ubuntu, Sans-Serif;
      animation: fadeInAnimation 0.8s ease-in-out forwards;
    }
    .stat {
      fill: ${resolvedColors.textColor};
      font: 400 12px 'Segoe UI', Ubuntu, Sans-Serif;
    }
    .stat-value {
      fill: ${resolvedColors.circleColor};
      font: 600 14px 'Segoe UI', Ubuntu, Sans-Serif;
    }
    .sparkline {
      fill: none;
      stroke: ${resolvedColors.circleColor};
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      opacity: 0;
      animation: fadeInAnimation 1s ease-in-out 0.5s forwards;
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
    x="0.5"
    y="0.5"
    rx="${cardRadius}"
    height="${dims.h - 1}"
    width="${dims.w - 1}"
    fill="${resolvedColors.backgroundColor}"
    ${resolvedColors.borderColor ? `stroke="${resolvedColors.borderColor}"` : ""}
    stroke-width="2"
  />
  <g transform="translate(20, 30)">
    <text x="0" y="0" class="header">${safeTitle}</text>
  </g>
  <g transform="translate(20, 50)">
    <g class="stagger" style="animation-delay: 400ms">
      <text class="stat" y="12">Total Activities:</text>
      <text class="stat-value" x="110" y="12">${totalActivity}</text>
    </g>
    <g class="stagger" style="animation-delay: 550ms" transform="translate(0, 22)">
      <text class="stat" y="12">Avg per Day:</text>
      <text class="stat-value" x="110" y="12">${avgPerDay}</text>
    </g>
    <g class="stagger" style="animation-delay: 700ms" transform="translate(0, 44)">
      <text class="stat" y="12">Best Day:</text>
      <text class="stat-value" x="110" y="12">${bestDay.amount} (${bestDayStr})</text>
    </g>
  </g>
  ${
    showSparkline && sparklinePath
      ? `<g transform="translate(20, ${dims.h - 50})">
    <path class="sparkline" d="${sparklinePath}" />
  </g>`
      : ""
  }
</svg>
`);
}

/**
 * Generates a recent activity feed card (text-based listing).
 * Note: This is a simplified version using activity history counts.
 * For full feed with media details, additional API data would be needed.
 * @param data - Template input with username, styles, and activity history.
 * @returns TrustedSVG string for the feed card.
 * @source
 */
export function recentActivityFeedTemplate(data: {
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
  activityHistory: ActivityHistoryItem[];
}): TrustedSVG {
  const { gradientDefs, resolvedColors } = processColorsForSVG(
    {
      titleColor: data.styles.titleColor,
      backgroundColor: data.styles.backgroundColor,
      textColor: data.styles.textColor,
      circleColor: data.styles.circleColor,
      borderColor: data.styles.borderColor,
    },
    [
      "titleColor",
      "backgroundColor",
      "textColor",
      "circleColor",
      "borderColor",
    ],
  );

  const cardRadius = getCardBorderRadius(data.styles.borderRadius);
  const title = `${data.username}'s Activity Feed`;
  const safeTitle = escapeForXml(title);

  // Get most recent activities (up to 5)
  const sorted = [...data.activityHistory]
    .sort((a, b) => b.date - a.date)
    .slice(0, 5);

  const dims = { w: 280, h: 180 };

  const feedItems = sorted.map((item, i) => {
    const date = new Date(item.date * 1000);
    const dateStr = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
    return `
      <g class="stagger" style="animation-delay: ${400 + i * 150}ms" transform="translate(0, ${i * 24})">
        <circle cx="8" cy="8" r="4" fill="${resolvedColors.circleColor}" />
        <text class="feed-date" x="20" y="12">${dateStr}</text>
        <text class="feed-amount" x="${dims.w - 40}" y="12" text-anchor="end">${item.amount} activities</text>
      </g>
    `;
  });

  return markTrustedSvg(`
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${dims.w}"
  height="${dims.h}"
  viewBox="0 0 ${dims.w} ${dims.h}"
  fill="none"
  role="img"
  aria-labelledby="desc-id"
>
  ${gradientDefs ? `<defs>${gradientDefs}</defs>` : ""}
  <title id="title-id">${safeTitle}</title>
  <desc id="desc-id">Recent activity feed showing ${sorted.length} entries</desc>
  <style>
    .header {
      fill: ${resolvedColors.titleColor};
      font: 600 ${calculateDynamicFontSize(title, 16, dims.w - 40)}px 'Segoe UI', Ubuntu, Sans-Serif;
      animation: fadeInAnimation 0.8s ease-in-out forwards;
    }
    .feed-date {
      fill: ${resolvedColors.textColor};
      font: 500 11px 'Segoe UI', Ubuntu, Sans-Serif;
    }
    .feed-amount {
      fill: ${resolvedColors.textColor};
      font: 400 11px 'Segoe UI', Ubuntu, Sans-Serif;
      opacity: 0.8;
      text-anchor: end;
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
    x="0.5"
    y="0.5"
    rx="${cardRadius}"
    height="${dims.h - 1}"
    width="${dims.w - 1}"
    fill="${resolvedColors.backgroundColor}"
    ${resolvedColors.borderColor ? `stroke="${resolvedColors.borderColor}"` : ""}
    stroke-width="2"
  />
  <g transform="translate(20, 30)">
    <text x="0" y="0" class="header">${safeTitle}</text>
  </g>
  <g transform="translate(20, 50)">
    ${feedItems.join("")}
  </g>
</svg>
`);
}

/**
 * Build set of active dates and find most active day.
 * @param history - Activity history array.
 * @returns Active dates set and most active day info or null.
 */
function buildActiveDatesAndMostActive(history: ActivityHistoryItem[]): {
  activeDates: Set<string>;
  mostActive: { date: string; amount: number } | null;
} {
  const activeDates = new Set<string>();
  let mostActive: { date: string; amount: number } | null = null;

  for (const item of history) {
    const dateStr = new Date(item.date * 1000).toISOString().split("T")[0];
    activeDates.add(dateStr);
    if (!mostActive || item.amount > mostActive.amount) {
      mostActive = {
        date: new Date(item.date * 1000).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        }),
        amount: item.amount,
      };
    }
  }

  return { activeDates, mostActive };
}

/**
 * Compute the longest consecutive-day streak from sorted ISO date strings.
 * @param sortedDates - Array of ISO date strings sorted in ascending order.
 */
function computeLongestStreak(sortedDates: string[]): number {
  if (sortedDates.length === 0) return 0;
  let longest = 1;
  let temp = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    // Parse as UTC midnight to avoid timezone shifts
    const prevDate = new Date(sortedDates[i - 1] + "T00:00:00Z");
    const currDate = new Date(sortedDates[i] + "T00:00:00Z");
    const diffDays = Math.round(
      (currDate.getTime() - prevDate.getTime()) / 86400000,
    );
    if (diffDays === 1) {
      temp++;
    } else {
      longest = Math.max(longest, temp);
      temp = 1;
    }
  }
  return Math.max(longest, temp);
}

/**
 * Compute the current streak by counting backwards from today or yesterday.
 * @param activeDates - Set of ISO date strings that had activity.
 */
function computeCurrentStreak(activeDates: Set<string>): number {
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  let start: Date | null = null;
  if (activeDates.has(today)) {
    // Start at UTC midnight for today
    start = new Date(today + "T00:00:00Z");
  } else if (activeDates.has(yesterday)) {
    // Start at UTC midnight for yesterday
    start = new Date(yesterday + "T00:00:00Z");
  } else {
    return 0;
  }

  let streak = 0;
  const checkDate = new Date(start);
  while (activeDates.has(checkDate.toISOString().split("T")[0])) {
    streak++;
    checkDate.setUTCDate(checkDate.getUTCDate() - 1);
  }
  return streak;
}

/**
 * Computes streak information from activity history.
 * @param history - Sorted activity history array.
 * @returns Object with current streak, longest streak, and most active day.
 * @source
 */
function computeStreaks(history: ActivityHistoryItem[]): {
  currentStreak: number;
  longestStreak: number;
  mostActiveDay: { date: string; amount: number };
} {
  if (history.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      mostActiveDay: { date: "N/A", amount: 0 },
    };
  }

  const { activeDates, mostActive } = buildActiveDatesAndMostActive(history);
  const sortedDates = [...activeDates].sort((a, b) => a.localeCompare(b));
  const longestStreak = computeLongestStreak(sortedDates);
  const currentStreak = computeCurrentStreak(activeDates);

  return {
    currentStreak,
    longestStreak,
    mostActiveDay: mostActive ?? { date: "N/A", amount: 0 },
  };
}

/**
 * Generates an activity streaks card showing current/longest streaks.
 * @param data - Template input with username, styles, and activity history.
 * @returns TrustedSVG string for the streaks card.
 * @source
 */
export function activityStreaksTemplate(data: {
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
  activityHistory: ActivityHistoryItem[];
}): TrustedSVG {
  const { gradientDefs, resolvedColors } = processColorsForSVG(
    {
      titleColor: data.styles.titleColor,
      backgroundColor: data.styles.backgroundColor,
      textColor: data.styles.textColor,
      circleColor: data.styles.circleColor,
      borderColor: data.styles.borderColor,
    },
    [
      "titleColor",
      "backgroundColor",
      "textColor",
      "circleColor",
      "borderColor",
    ],
  );

  const cardRadius = getCardBorderRadius(data.styles.borderRadius);
  const title = `${data.username}'s Activity Streaks`;
  const safeTitle = escapeForXml(title);

  const streakInfo = computeStreaks(data.activityHistory);

  const dims = { w: 280, h: 160 };

  const stats = [
    {
      label: "Current Streak:",
      value: `${streakInfo.currentStreak} days`,
    },
    {
      label: "Longest Streak:",
      value: `${streakInfo.longestStreak} days`,
    },
    {
      label: "Most Active Day:",
      value: `${streakInfo.mostActiveDay.amount} (${streakInfo.mostActiveDay.date})`,
    },
  ];

  const statsContent = stats
    .map(
      (stat, i) => `
    <g class="stagger" style="animation-delay: ${400 + i * 150}ms" transform="translate(0, ${i * 25})">
      <text class="stat" y="12">${stat.label}</text>
      <text class="stat-value" x="${dims.w - 40}" y="12" text-anchor="end">${stat.value}</text>
    </g>
  `,
    )
    .join("");

  return markTrustedSvg(`
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${dims.w}"
  height="${dims.h}"
  viewBox="0 0 ${dims.w} ${dims.h}"
  fill="none"
  role="img"
  aria-labelledby="desc-id"
>
  ${gradientDefs ? `<defs>${gradientDefs}</defs>` : ""}
  <title id="title-id">${safeTitle}</title>
  <desc id="desc-id">Current streak: ${streakInfo.currentStreak} days, Longest: ${streakInfo.longestStreak} days</desc>
  <style>
    .header {
      fill: ${resolvedColors.titleColor};
      font: 600 ${calculateDynamicFontSize(title, 16, dims.w - 40)}px 'Segoe UI', Ubuntu, Sans-Serif;
      animation: fadeInAnimation 0.8s ease-in-out forwards;
    }
    .stat {
      fill: ${resolvedColors.textColor};
      font: 400 12px 'Segoe UI', Ubuntu, Sans-Serif;
    }
    .stat-value {
      fill: ${resolvedColors.circleColor};
      font: 600 12px 'Segoe UI', Ubuntu, Sans-Serif;
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
    x="0.5"
    y="0.5"
    rx="${cardRadius}"
    height="${dims.h - 1}"
    width="${dims.w - 1}"
    fill="${resolvedColors.backgroundColor}"
    ${resolvedColors.borderColor ? `stroke="${resolvedColors.borderColor}"` : ""}
    stroke-width="2"
  />
  <g transform="translate(20, 30)">
    <text x="0" y="0" class="header">${safeTitle}</text>
  </g>
  <g transform="translate(20, 55)">
    ${statsContent}
  </g>
</svg>
`);
}

/**
 * Computes activity patterns by day of week and month.
 * @param history - Activity history array.
 * @returns Object with day-of-week and month distributions.
 * @source
 */
function computeActivityPatterns(history: ActivityHistoryItem[]): {
  byDayOfWeek: number[];
  byMonth: number[];
  mostActiveDay: string;
  mostActiveMonth: string;
} {
  const dayOfWeek = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
  const byMonth = new Array(12).fill(0); // Jan-Dec
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  for (const item of history) {
    const date = new Date(item.date * 1000);
    dayOfWeek[date.getUTCDay()] += item.amount;
    byMonth[date.getUTCMonth()] += item.amount;
  }

  const maxDayIdx = dayOfWeek.indexOf(Math.max(...dayOfWeek));
  const maxMonthIdx = byMonth.indexOf(Math.max(...byMonth));

  return {
    byDayOfWeek: dayOfWeek,
    byMonth,
    mostActiveDay: dayNames[maxDayIdx],
    mostActiveMonth: monthNames[maxMonthIdx],
  };
}

/**
 * Generates an activity patterns card showing day/month distribution.
 * @param data - Template input with username, styles, and activity history.
 * @returns TrustedSVG string for the patterns card.
 * @source
 */
export function activityPatternsTemplate(data: {
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
  activityHistory: ActivityHistoryItem[];
}): TrustedSVG {
  const { gradientDefs, resolvedColors } = processColorsForSVG(
    {
      titleColor: data.styles.titleColor,
      backgroundColor: data.styles.backgroundColor,
      textColor: data.styles.textColor,
      circleColor: data.styles.circleColor,
      borderColor: data.styles.borderColor,
    },
    [
      "titleColor",
      "backgroundColor",
      "textColor",
      "circleColor",
      "borderColor",
    ],
  );

  const cardRadius = getCardBorderRadius(data.styles.borderRadius);
  const title = `${data.username}'s Activity Patterns`;
  const safeTitle = escapeForXml(title);

  const patterns = computeActivityPatterns(data.activityHistory);
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const maxDayValue = Math.max(...patterns.byDayOfWeek, 1);

  const dims = { w: 320, h: 180 };
  const barWidth = 32;
  const barMaxHeight = 70;

  // Generate day-of-week bar chart
  const dayBars = patterns.byDayOfWeek
    .map((count, i) => {
      const height = (count / maxDayValue) * barMaxHeight;
      const x = 30 + i * (barWidth + 8);
      const y = dims.h - 30 - height;

      return `
      <g class="stagger" style="animation-delay: ${400 + i * 100}ms">
        <rect x="${x}" y="${y}" width="${barWidth}" height="${height}" rx="3" fill="${resolvedColors.circleColor}" opacity="0.85" />
        <text class="day-label" x="${x + barWidth / 2}" y="${dims.h - 15}" text-anchor="middle">${dayNames[i]}</text>
        <text class="count-label" x="${x + barWidth / 2}" y="${y - 5}" text-anchor="middle">${count}</text>
      </g>
    `;
    })
    .join("");

  return markTrustedSvg(`
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${dims.w}"
  height="${dims.h}"
  viewBox="0 0 ${dims.w} ${dims.h}"
  fill="none"
  role="img"
  aria-labelledby="desc-id"
>
  ${gradientDefs ? `<defs>${gradientDefs}</defs>` : ""}
  <title id="title-id">${safeTitle}</title>
  <desc id="desc-id">Most active day: ${patterns.mostActiveDay}, Most active month: ${patterns.mostActiveMonth}</desc>
  <style>
    .header {
      fill: ${resolvedColors.titleColor};
      font: 600 ${calculateDynamicFontSize(title, 16, dims.w - 40)}px 'Segoe UI', Ubuntu, Sans-Serif;
      animation: fadeInAnimation 0.8s ease-in-out forwards;
    }
    .day-label {
      fill: ${resolvedColors.textColor};
      font: 400 10px 'Segoe UI', Ubuntu, Sans-Serif;
    }
    .count-label {
      fill: ${resolvedColors.textColor};
      font: 400 9px 'Segoe UI', Ubuntu, Sans-Serif;
      opacity: 0.8;
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
    x="0.5"
    y="0.5"
    rx="${cardRadius}"
    height="${dims.h - 1}"
    width="${dims.w - 1}"
    fill="${resolvedColors.backgroundColor}"
    ${resolvedColors.borderColor ? `stroke="${resolvedColors.borderColor}"` : ""}
    stroke-width="2"
  />
  <g transform="translate(20, 28)">
    <text x="0" y="0" class="header">${safeTitle}</text>
  </g>
  ${dayBars}
</svg>
`);
}

/**
 * Detects top activity days from activity history.
 * A top day is defined as a day with activity significantly above average.
 * @param history - Activity history array.
 * @returns Array of top activity day data.
 * @source
 */
function detectTopActivityDays(
  history: ActivityHistoryItem[],
): { date: string; amount: number }[] {
  if (history.length === 0) return [];

  const avg =
    history.reduce((acc, curr) => acc + curr.amount, 0) / history.length;
  const threshold = Math.max(avg * 2, 5); // At least 2x average or 5

  return history
    .filter((item) => item.amount >= threshold)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map((item) => ({
      date: new Date(item.date * 1000).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }),
      amount: item.amount,
    }));
}

/**
 * Generates a Top Activity Days card showing days with the highest activity.
 * @param data - Template input with username, styles, and activity history.
 * @returns TrustedSVG string for the top activity days card.
 * @source
 */
export function topActivityDaysTemplate(data: {
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
  activityHistory: ActivityHistoryItem[];
}): TrustedSVG {
  const { gradientDefs, resolvedColors } = processColorsForSVG(
    {
      titleColor: data.styles.titleColor,
      backgroundColor: data.styles.backgroundColor,
      textColor: data.styles.textColor,
      circleColor: data.styles.circleColor,
      borderColor: data.styles.borderColor,
    },
    [
      "titleColor",
      "backgroundColor",
      "textColor",
      "circleColor",
      "borderColor",
    ],
  );

  const cardRadius = getCardBorderRadius(data.styles.borderRadius);
  const title = `${data.username}'s Top Activity Days`;
  const safeTitle = escapeForXml(title);

  const topActivityDays = detectTopActivityDays(data.activityHistory);
  const topDays = topActivityDays.slice(0, 5);

  const dims = { w: 320, h: 180 };

  const activityRows =
    topDays.length > 0
      ? topDays
          .map(
            (day, i) => `
      <g class="stagger" style="animation-delay: ${400 + i * 120}ms" transform="translate(0, ${i * 24})">
        <text class="rank" y="12">#${i + 1}</text>
        <text class="date" x="30" y="12">${day.date}</text>
        <text class="amount" x="${dims.w - 40}" y="12" text-anchor="end">${day.amount} activities</text>
      </g>
    `,
          )
          .join("")
      : `<text class="no-data" x="${dims.w / 2 - 20}" y="40">No top activity days detected</text>`;

  return markTrustedSvg(`
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${dims.w}"
  height="${dims.h}"
  viewBox="0 0 ${dims.w} ${dims.h}"
  fill="none"
  role="img"
  aria-labelledby="desc-id"
>
  ${gradientDefs ? `<defs>${gradientDefs}</defs>` : ""}
  <title id="title-id">${safeTitle}</title>
  <desc id="desc-id">Top ${topDays.length} activity days</desc>
  <style>
    .header {
      fill: ${resolvedColors.titleColor};
      font: 600 ${calculateDynamicFontSize(title, 16, dims.w - 40)}px 'Segoe UI', Ubuntu, Sans-Serif;
      animation: fadeInAnimation 0.8s ease-in-out forwards;
    }
    .rank {
      fill: ${resolvedColors.circleColor};
      font: 600 11px 'Segoe UI', Ubuntu, Sans-Serif;
    }
    .date {
      fill: ${resolvedColors.textColor};
      font: 400 11px 'Segoe UI', Ubuntu, Sans-Serif;
    }
    .amount {
      fill: ${resolvedColors.textColor};
      font: 500 11px 'Segoe UI', Ubuntu, Sans-Serif;
      opacity: 0.9;
    }
    .no-data {
      fill: ${resolvedColors.textColor};
      font: 400 12px 'Segoe UI', Ubuntu, Sans-Serif;
      opacity: 0.6;
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
    x="0.5"
    y="0.5"
    rx="${cardRadius}"
    height="${dims.h - 1}"
    width="${dims.w - 1}"
    fill="${resolvedColors.backgroundColor}"
    ${resolvedColors.borderColor ? `stroke="${resolvedColors.borderColor}"` : ""}
    stroke-width="2"
  />
  <g transform="translate(20, 30)">
    <text x="0" y="0" class="header">${safeTitle}</text>
  </g>
  <g transform="translate(20, 55)">
    ${activityRows}
  </g>
</svg>
`);
}
