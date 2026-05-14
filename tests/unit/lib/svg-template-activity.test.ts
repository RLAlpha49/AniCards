import { describe, expect, it } from "bun:test";

import { activityStreaksTemplate } from "@/lib/svg-templates/activity-stats/activity-streaks-template";
import { recentActivitySummaryTemplate } from "@/lib/svg-templates/activity-stats/recent-activity-summary-template";
import {
  computeStreaks,
  detectTopActivityDays,
  generateSparkline,
} from "@/lib/svg-templates/activity-stats/shared";
import { topActivityDaysTemplate } from "@/lib/svg-templates/activity-stats/top-activity-days-template";
import type { ActivityHistoryItem } from "@/lib/types/records";

const baseStyles = {
  titleColor: "#ffffff",
  backgroundColor: "#111827",
  textColor: "#e5e7eb",
  circleColor: "#38bdf8",
  borderColor: "#22d3ee",
  borderRadius: 12,
};

function getRootNumericAttribute(
  svg: string,
  attribute: "width" | "height",
): number {
  const match = new RegExp(String.raw`<svg[^>]*\s${attribute}="(\d+)"`).exec(
    svg,
  );

  if (!match) {
    throw new Error(`Missing root svg ${attribute}`);
  }

  return Number(match[1]);
}

function getCurrentUtcDateStart(): Date {
  const todayUtc = new Date().toISOString().split("T")[0];

  return new Date(`${todayUtc}T00:00:00Z`);
}

function toUnixSecondsAtUtcDayOffset(dayOffset: number): number {
  const date = getCurrentUtcDateStart();
  date.setUTCDate(date.getUTCDate() + dayOffset);
  return Math.floor(date.getTime() / 1000);
}

function formatShortUtcDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatLongUtcDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function createHistoryEntry(
  dayOffset: number,
  amount: number,
): ActivityHistoryItem {
  return {
    date: toUnixSecondsAtUtcDayOffset(dayOffset),
    amount,
  };
}

describe("svg activity helpers", () => {
  it("builds sparkline paths with stable normalized coordinates", () => {
    expect(generateSparkline([3], 100, 20)).toBe("");
    expect(generateSparkline([0, 4, 8, 4], 240, 30)).toBe(
      "M0.0,30.0 L80.0,15.0 L160.0,0.0 L240.0,15.0",
    );
  });

  it("computes current and longest streaks with the most active day", () => {
    const mostActiveDate = toUnixSecondsAtUtcDayOffset(-5);
    const history = [
      createHistoryEntry(-7, 4),
      createHistoryEntry(-6, 5),
      createHistoryEntry(-5, 25),
      createHistoryEntry(-4, 8),
      createHistoryEntry(-2, 6),
      createHistoryEntry(-1, 7),
      createHistoryEntry(0, 9),
    ];

    expect(computeStreaks(history)).toEqual({
      currentStreak: 3,
      longestStreak: 4,
      mostActiveDay: {
        date: formatShortUtcDate(mostActiveDate),
        amount: 25,
      },
    });
  });

  it("detects and sorts the top activity days above the adaptive threshold", () => {
    const history = [
      ...Array.from({ length: 15 }, (_, index) =>
        createHistoryEntry(index - 19, 0),
      ),
      createHistoryEntry(-4, 6),
      createHistoryEntry(-3, 7),
      createHistoryEntry(-2, 8),
      createHistoryEntry(-1, 9),
      createHistoryEntry(0, 10),
    ];

    const topDays = detectTopActivityDays(history);

    expect(topDays).toHaveLength(5);
    expect(topDays.map((day) => day.amount)).toEqual([10, 9, 8, 7, 6]);
    expect(topDays[0]).toEqual({
      date: formatLongUtcDate(toUnixSecondsAtUtcDayOffset(0)),
      amount: 10,
    });
    expect(topDays[4]).toEqual({
      date: formatLongUtcDate(toUnixSecondsAtUtcDayOffset(-4)),
      amount: 6,
    });
  });
});

describe("svg activity renderers", () => {
  it("renders activity streak cards with escaped titles and computed streak stats", () => {
    const mostActiveDate = toUnixSecondsAtUtcDayOffset(-5);
    const history = [
      createHistoryEntry(-7, 4),
      createHistoryEntry(-6, 5),
      createHistoryEntry(-5, 25),
      createHistoryEntry(-4, 8),
      createHistoryEntry(-2, 6),
      createHistoryEntry(-1, 7),
      createHistoryEntry(0, 9),
    ];

    const svg = activityStreaksTemplate({
      username: "Test & <User>",
      styles: baseStyles,
      activityHistory: history,
    });

    expect(svg.startsWith("<!--ANICARDS_TRUSTED_SVG-->")).toBe(true);
    expect(getRootNumericAttribute(svg, "width")).toBe(280);
    expect(getRootNumericAttribute(svg, "height")).toBe(160);
    expect(svg).toContain("Test &amp; &lt;User&gt;&apos;s Activity Streaks");
    expect(svg).toContain("Current Streak:");
    expect(svg).toContain(">3 days<");
    expect(svg).toContain("Longest Streak:");
    expect(svg).toContain(">4 days<");
    expect(svg).toContain(`>25 (${formatShortUtcDate(mostActiveDate)})<`);
  });

  it("renders recent activity summary cards with aggregate metrics and sparkline markup", () => {
    const bestDayDate = toUnixSecondsAtUtcDayOffset(-2);
    const history = [
      createHistoryEntry(-4, 0),
      createHistoryEntry(-3, 4),
      createHistoryEntry(-2, 8),
      createHistoryEntry(-1, 4),
    ];

    const svg = recentActivitySummaryTemplate({
      username: "TestUser",
      styles: baseStyles,
      activityHistory: history,
    });

    expect(getRootNumericAttribute(svg, "width")).toBe(280);
    expect(getRootNumericAttribute(svg, "height")).toBe(160);
    expect(svg).toContain("TestUser&apos;s Recent Activity");
    expect(svg).toContain("Total Activities:");
    expect(svg).toContain(">16<");
    expect(svg).toContain("Avg per Day:");
    expect(svg).toContain(">4.0<");
    expect(svg).toContain(`>8 (${formatShortUtcDate(bestDayDate)})<`);
    expect(svg).toContain(
      '<path class="sparkline" d="M0.0,30.0 L80.0,15.0 L160.0,0.0 L240.0,15.0" />',
    );
  });

  it("renders top activity day rankings and empty-state fallbacks", () => {
    const rankedHistory = [
      ...Array.from({ length: 15 }, (_, index) =>
        createHistoryEntry(index - 19, 0),
      ),
      createHistoryEntry(-4, 6),
      createHistoryEntry(-3, 7),
      createHistoryEntry(-2, 8),
      createHistoryEntry(-1, 9),
      createHistoryEntry(0, 10),
    ];

    const rankedSvg = topActivityDaysTemplate({
      username: "TestUser",
      styles: baseStyles,
      activityHistory: rankedHistory,
    });
    const emptySvg = topActivityDaysTemplate({
      username: "TestUser",
      styles: baseStyles,
      activityHistory: [],
    });

    expect(getRootNumericAttribute(rankedSvg, "width")).toBe(320);
    expect(getRootNumericAttribute(rankedSvg, "height")).toBe(180);
    expect(rankedSvg).toContain("TestUser&apos;s Top Activity Days");
    expect(rankedSvg).toContain(">#1<");
    expect(rankedSvg).toContain(
      formatLongUtcDate(toUnixSecondsAtUtcDayOffset(0)),
    );
    expect(rankedSvg).toContain(">10 activities<");
    expect(emptySvg).toContain("No top activity days detected");
  });
});
