import type { ActivityHistoryItem } from "@/lib/types/records";

/** Heatmap color palette configuration. @source */
export type HeatmapPalette = "default" | "github" | "fire";

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
export function getHeatmapColor(
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
    default:
      if (baseColor.startsWith("#")) {
        const [h, s] = hexToHsl(baseColor);
        // Vary lightness from light (0.9) to dark (0.1)
        const lightnesses = [0.9, 0.7, 0.5, 0.3, 0.1];
        const color = hslToHex(h, s, lightnesses[level]);
        return { color, opacity: 1 };
      }

      // For gradients, use varying opacity
      {
        const alphas = [0.2, 0.5, 0.7, 0.9, 1];
        return { color: baseColor, opacity: alphas[level] };
      }
  }
}

/**
 * Renders a sparkline SVG path from data points.
 * @param data - Array of numeric values.
 * @param width - Width of the sparkline area.
 * @param height - Height of the sparkline area.
 * @returns SVG path d attribute string.
 * @source
 */
export function generateSparkline(
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

function computeCurrentStreak(activeDates: Set<string>): number {
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  let start: Date | null = null;
  if (activeDates.has(today)) {
    start = new Date(today + "T00:00:00Z");
  } else if (activeDates.has(yesterday)) {
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
export function computeStreaks(history: ActivityHistoryItem[]): {
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
 * Computes activity patterns by day of week and month.
 * @param history - Activity history array.
 * @returns Object with day-of-week and month distributions.
 * @source
 */
export function computeActivityPatterns(history: ActivityHistoryItem[]): {
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
 * Detects top activity days from activity history.
 * A top day is defined as a day with activity significantly above average.
 * @param history - Activity history array.
 * @returns Array of top activity day data.
 * @source
 */
export function detectTopActivityDays(
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
