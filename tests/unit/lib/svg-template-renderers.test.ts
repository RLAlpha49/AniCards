import { describe, expect, it } from "bun:test";

import { comparativeTwoColumnTemplate } from "@/lib/svg-templates/comparative-distribution-stats/shared";
import { extraAnimeMangaStatsTemplate } from "@/lib/svg-templates/extra-anime-manga-stats/shared";
import { mediaStatsTemplate } from "@/lib/svg-templates/media-stats/shared";
import { socialStatsTemplate } from "@/lib/svg-templates/social-stats";
import { mockUserRecord } from "@/tests/e2e/fixtures/mock-data";
import { allowConsoleWarningsAndErrors } from "@/tests/unit/__setup__";

const baseStyles = {
  titleColor: "#ffffff",
  backgroundColor: "#111827",
  textColor: "#e5e7eb",
  circleColor: "#38bdf8",
  borderColor: "#22d3ee",
  borderRadius: 12,
};
const testUsername = mockUserRecord.username ?? "TestUser";

function countMatches(input: string, pattern: RegExp): number {
  const regex = new RegExp(pattern.source, pattern.flags);
  let matchCount = 0;

  while (regex.exec(input)) {
    matchCount += 1;
  }

  return matchCount;
}

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

function createMediaStatsInput(): Parameters<typeof mediaStatsTemplate>[0] {
  const animeStats = mockUserRecord.stats.User.statistics.anime;

  return {
    mediaType: "anime",
    username: testUsername,
    styles: baseStyles,
    stats: {
      count: animeStats.count,
      episodesWatched: animeStats.episodesWatched,
      minutesWatched: animeStats.minutesWatched,
      meanScore: animeStats.meanScore,
      standardDeviation: animeStats.standardDeviation,
      previousMilestone: 3000,
      currentMilestone: animeStats.episodesWatched ?? 0,
      dasharray: "100",
      dashoffset: "25",
    },
  };
}

describe("svg template renderers", () => {
  it("renders media stats variants with escaped titles and scaled dash math", () => {
    const svg = mediaStatsTemplate({
      ...createMediaStatsInput(),
      username: "Test & <User>",
      variant: "compact",
    });

    expect(svg.startsWith("<!--ANICARDS_TRUSTED_SVG-->")).toBe(true);
    expect(svg).toContain("Test &amp; &lt;User&gt;&apos;s Anime Stats");
    expect(getRootNumericAttribute(svg, "width")).toBe(300);
    expect(getRootNumericAttribute(svg, "height")).toBe(130);
    expect(svg).toContain("stroke-dasharray: 75.00");
    expect(svg).toContain("to { stroke-dashoffset: 18.75; }");
  });

  it("falls back cleanly when media dash values are invalid", () => {
    const { consoleWarn } = allowConsoleWarningsAndErrors();

    const svg = mediaStatsTemplate({
      mediaType: "manga",
      username: testUsername,
      variant: "minimal",
      styles: {
        ...baseStyles,
        borderColor: undefined,
      },
      stats: {
        count: mockUserRecord.stats.User.statistics.manga.count,
        chaptersRead: mockUserRecord.stats.User.statistics.manga.chaptersRead,
        volumesRead: mockUserRecord.stats.User.statistics.manga.volumesRead,
        meanScore: mockUserRecord.stats.User.statistics.manga.meanScore,
        standardDeviation:
          mockUserRecord.stats.User.statistics.manga.standardDeviation,
        previousMilestone: 120,
        currentMilestone:
          mockUserRecord.stats.User.statistics.manga.chaptersRead ?? 0,
        dasharray: "oops",
        dashoffset: "still-oops",
      },
    });

    expect(getRootNumericAttribute(svg, "width")).toBe(220);
    expect(getRootNumericAttribute(svg, "height")).toBe(140);
    expect(svg).toContain("animation: none;");
    expect(svg).not.toContain("stroke-dasharray:");
    expect(svg).toContain("Chapters Read");
    expect(consoleWarn.mock.calls.length).toBe(2);
  });

  it("renders donut extra stats empty states without NaN artifacts", () => {
    const svg = extraAnimeMangaStatsTemplate({
      username: testUsername,
      variant: "donut",
      styles: baseStyles,
      format: "Anime Statuses",
      stats: [
        { name: "COMPLETED", count: 0 },
        { name: "WATCHING", count: 0 },
      ],
      fixedStatusColors: true,
      showPiePercentages: true,
    });

    expect(getRootNumericAttribute(svg, "width")).toBe(340);
    expect(getRootNumericAttribute(svg, "height")).toBe(195);
    expect(svg).toContain('class="donut-total">0</text>');
    expect(svg).toContain('class="donut-label">Total</text>');
    expect(svg).not.toContain("NaN");
  });

  it("expands bar extra stats layouts and preserves favorite markers", () => {
    const svg = extraAnimeMangaStatsTemplate({
      username: testUsername,
      variant: "bar",
      styles: baseStyles,
      format: "Anime Voice Actors",
      favorites: ["Performer 1"],
      stats: Array.from({ length: 8 }, (_, index) => ({
        name: `Performer ${index + 1}`,
        count: index === 0 ? 12 : index + 2,
      })),
    });

    expect(getRootNumericAttribute(svg, "width")).toBe(360);
    expect(getRootNumericAttribute(svg, "height")).toBeGreaterThan(195);
    expect(svg).toContain('fill="#fe428e"');
    expect(svg).toContain("Performer 1");
  });

  it("renders comparative two-column templates with bars and empty-column fallbacks", () => {
    const svg = comparativeTwoColumnTemplate({
      cardType: "animeMangaOverview",
      username: testUsername,
      title: "Format Overview",
      styles: baseStyles,
      left: {
        title: "Anime",
        metrics: [
          { label: "Completed", value: "180" },
          { label: "Mean Score", value: "75.5" },
        ],
        bars: [
          {
            label: "Ridiculously Long Format Label That Should Still Fit",
            count: 120,
          },
          { label: "Movie", count: 35 },
          { label: "OVA", count: 25 },
          { label: "Special", count: 20 },
          { label: "ONA", count: 18 },
          { label: "TV Short", count: 16 },
          { label: "Music", count: 8 },
          { label: "Other", count: 4 },
        ],
      },
      right: {
        title: "Manga",
      },
    });

    expect(getRootNumericAttribute(svg, "width")).toBe(450);
    expect(getRootNumericAttribute(svg, "height")).toBeGreaterThan(220);
    expect(svg).toContain(
      ">Ridiculously Long Format Label That Should Still Fit<",
    );
    expect(svg).toContain(">No data<");
    expect(countMatches(svg, /class="stagger"/g)).toBeGreaterThan(8);
  });

  it("renders social badge cards with compact KPI values and unknown activity text", () => {
    const stats = {
      ...mockUserRecord.stats,
      followersPage: {
        pageInfo: { total: 1200 },
        followers: [],
      },
      followingPage: {
        pageInfo: { total: 2400 },
        following: [],
      },
      threadsPage: {
        pageInfo: { total: 50 },
        threads: [],
      },
      threadCommentsPage: {
        pageInfo: { total: 300 },
        threadComments: [],
      },
      reviewsPage: {
        pageInfo: { total: 25 },
        reviews: [],
      },
    } as Parameters<typeof socialStatsTemplate>[0]["stats"];

    const svg = socialStatsTemplate({
      username: testUsername,
      variant: "badges",
      styles: baseStyles,
      stats,
      activityHistory: [],
    });

    expect(getRootNumericAttribute(svg, "width")).toBe(280);
    expect(getRootNumericAttribute(svg, "height")).toBe(220);
    expect(countMatches(svg, /class="kpi-box"/g)).toBe(5);
    expect(svg).toContain(">1.2K<");
    expect(svg).toContain("Total Activity: Unknown");
  });

  it("aggregates social thread and activity metrics in the default layout", () => {
    const activityHistoryEntries = (mockUserRecord.stats.User.stats
      .activityHistory ?? []) as Array<{ amount: number; date: number }>;
    const activityHistory = activityHistoryEntries.map((entry) => ({
      amount: entry.amount,
      date: entry.date,
    }));

    const svg = socialStatsTemplate({
      username: testUsername,
      styles: baseStyles,
      stats: mockUserRecord.stats,
      activityHistory,
    });

    expect(getRootNumericAttribute(svg, "width")).toBe(280);
    expect(getRootNumericAttribute(svg, "height")).toBe(195);
    expect(svg).toContain("Thread Posts/Comments:");
    expect(svg).toContain(">257<");
    expect(svg).toContain("Total Activity (4 days):");
  });
});
