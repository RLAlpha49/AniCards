import { describe, expect, it } from "bun:test";

import { comparativeTwoColumnTemplate } from "@/lib/svg-templates/comparative-distribution-stats/shared";
import { currentlyWatchingReadingTemplate } from "@/lib/svg-templates/completion-progress-stats/currently-watching-reading-template";
import { extraAnimeMangaStatsTemplate } from "@/lib/svg-templates/extra-anime-manga-stats/shared";
import { mediaStatsTemplate } from "@/lib/svg-templates/media-stats/shared";
import { favoritesGridTemplate } from "@/lib/svg-templates/profile-favorite-stats/favorites-grid-template";
import { profileOverviewTemplate } from "@/lib/svg-templates/profile-favorite-stats/profile-overview-template";
import { socialStatsTemplate } from "@/lib/svg-templates/social-stats";
import type { MediaListEntry, UserFavourites } from "@/lib/types/records";
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

  it("omits remote avatar URLs from profile overview SVGs", () => {
    const svg = profileOverviewTemplate({
      username: testUsername,
      styles: baseStyles,
      statistics: mockUserRecord.stats.User.statistics,
      avatar: {
        medium: "https://s4.anilist.co/file/anilistcdn/user/avatar/test.png",
      } as Parameters<typeof profileOverviewTemplate>[0]["avatar"],
    });

    expect(svg).not.toContain(
      "https://s4.anilist.co/file/anilistcdn/user/avatar/test.png",
    );
    expect(svg).not.toContain("<image");
    expect(svg).toContain("<circle");
  });

  it("uses stable clip ids for profile overview avatars", () => {
    const embeddedAvatar =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9p2f6WQAAAAASUVORK5CYII=";
    const firstSvg = profileOverviewTemplate({
      username: "名探偵",
      styles: baseStyles,
      statistics: mockUserRecord.stats.User.statistics,
      avatarDataUrl: embeddedAvatar,
    });
    const secondSvg = profileOverviewTemplate({
      username: "名探偵",
      styles: baseStyles,
      statistics: mockUserRecord.stats.User.statistics,
      avatarDataUrl: embeddedAvatar,
    });

    const clipIdPattern = /avatar-clip-[a-z0-9-]+/;
    const firstClipId = firstSvg.match(clipIdPattern)?.[0];
    const secondClipId = secondSvg.match(clipIdPattern)?.[0];

    expect(firstClipId).toBeTruthy();
    expect(secondClipId).toBe(firstClipId);
  });

  it("omits remote cover URLs from favorites grid SVGs", () => {
    const favourites = {
      anime: {
        nodes: [
          {
            id: 1,
            title: { english: "Anime One" },
            coverImage: {
              large: "https://s4.anilist.co/file/anilistcdn/media/anime/1.jpg",
            },
          },
        ],
      },
      manga: { nodes: [] },
      characters: { nodes: [] },
      staff: { nodes: [] },
      studios: { nodes: [] },
    } as UserFavourites;

    const svg = favoritesGridTemplate({
      username: testUsername,
      variant: "anime",
      styles: baseStyles,
      favourites,
      gridCols: 1,
      gridRows: 1,
    });

    expect(svg).not.toContain(
      "https://s4.anilist.co/file/anilistcdn/media/anime/1.jpg",
    );
    expect(svg).not.toContain("<image");
    expect(svg).toContain("item-placeholder");
  });

  it("keeps studios in the mixed favorites round-robin order", () => {
    const favourites = {
      anime: {
        nodes: [
          {
            id: 1,
            title: { english: "Anime One" },
            coverImage: { large: "data:image/png;base64,anime-one" },
          },
          {
            id: 2,
            title: { english: "Anime Two" },
            coverImage: { large: "data:image/png;base64,anime-two" },
          },
        ],
      },
      manga: {
        nodes: [
          {
            id: 3,
            title: { english: "Manga One" },
            coverImage: { large: "data:image/png;base64,manga-one" },
          },
          {
            id: 4,
            title: { english: "Manga Two" },
            coverImage: { large: "data:image/png;base64,manga-two" },
          },
        ],
      },
      characters: {
        nodes: [
          {
            id: 5,
            name: { full: "Character One" },
            image: { large: "data:image/png;base64,character-one" },
          },
          {
            id: 6,
            name: { full: "Character Two" },
            image: { large: "data:image/png;base64,character-two" },
          },
        ],
      },
      staff: {
        nodes: [
          {
            id: 7,
            name: { full: "Staff One" },
            image: { large: "data:image/png;base64,staff-one" },
          },
          {
            id: 8,
            name: { full: "Staff Two" },
            image: { large: "data:image/png;base64,staff-two" },
          },
        ],
      },
      studios: {
        nodes: [
          { id: 9, name: "Studio One" },
          { id: 10, name: "Studio Two" },
        ],
      },
    } as UserFavourites;

    const svg = favoritesGridTemplate({
      username: testUsername,
      variant: "mixed",
      styles: baseStyles,
      favourites,
      gridCols: 3,
      gridRows: 2,
    });

    expect(svg).toContain(
      "Anime One, Manga One, Character One, Staff One, Studio One, Manga Two.",
    );
    expect(svg).not.toContain(
      "Anime Two, Character Two, Staff Two, Studio Two",
    );
  });

  it("omits remote cover URLs from currently watching cards", () => {
    const animeCurrent = [
      {
        id: 1,
        progress: 3,
        media: {
          id: 10,
          title: { romaji: "Anime One" },
          episodes: 12,
          coverImage: {
            large: "https://s4.anilist.co/file/anilistcdn/media/anime/10.jpg",
          },
        },
      },
    ] as MediaListEntry[];

    const svg = currentlyWatchingReadingTemplate({
      username: testUsername,
      styles: baseStyles,
      animeCurrent,
      mangaCurrent: [],
      animeCount: 1,
      mangaCount: 0,
    });

    expect(svg).not.toContain(
      "https://s4.anilist.co/file/anilistcdn/media/anime/10.jpg",
    );
    expect(svg).not.toContain("<image");
    expect(svg).toContain("<rect");
  });
});
