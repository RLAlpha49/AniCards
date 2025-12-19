import type { ActivityHistoryItem } from "@/lib/types/records";
export {
  getHeatmapColor,
  type HeatmapPalette,
} from "@/lib/svg-templates/common";

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
