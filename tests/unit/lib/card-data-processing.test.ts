import { describe, expect, it } from "bun:test";

import {
  buildCommonTemplateFields,
  mapCategoryItem,
  processFavorites,
  toTemplateAnimeEpisodeLengthPreferences,
  toTemplateAnimeGenreSynergy,
  toTemplateAnimeSeasonalPreference,
  toTemplateAnimeSourceMaterialDistribution,
  toTemplateAnimeStats,
  toTemplateMangaStats,
  toTemplateSocialStats,
  toTemplateStudioCollaboration,
} from "@/lib/card-data/processing";
import type { MediaListEntry, UserRecord } from "@/lib/types/records";
import {
  mockAnimeStats,
  mockMangaStats,
  mockUserRecord,
  mockUserStatsData,
} from "@/tests/e2e/fixtures/mock-data";

const milestoneData = {
  previousMilestone: 100,
  currentMilestone: 250,
  percentage: 60,
  dasharray: "60 40",
  dashoffset: "10",
} as const;

function createUserRecord(): UserRecord {
  return structuredClone(mockUserRecord);
}

type MediaEntryOverrides = Partial<Omit<MediaListEntry, "media">> & {
  media?: Partial<MediaListEntry["media"]>;
};

function createMediaEntry(
  id: number,
  overrides: MediaEntryOverrides = {},
): MediaListEntry {
  const base: MediaListEntry = {
    id,
    score: 0,
    progress: 0,
    repeat: 0,
    media: {
      id,
      title: { romaji: `Title ${id}` },
    },
  };

  return {
    ...base,
    ...overrides,
    media: {
      ...base.media,
      ...overrides.media,
      title: {
        ...base.media.title,
        ...overrides.media?.title,
      },
    },
  };
}

function createCollection(entries: MediaListEntry[]) {
  return {
    lists: [{ name: "All", entries }],
  };
}

describe("card-data processing helpers", () => {
  it("maps the normalized user record into social template stats", () => {
    const result = toTemplateSocialStats(createUserRecord());

    expect(result.followersPage).toEqual(mockUserStatsData.followersPage);
    expect(result.followingPage).toEqual(mockUserStatsData.followingPage);
    expect(result.threadCommentsPage).toEqual(
      mockUserStatsData.threadCommentsPage,
    );
    expect(result.activityHistory).toEqual(
      mockUserStatsData.User.stats.activityHistory as Array<{
        date: number;
        amount: number;
      }>,
    );
  });

  it("builds the shared anime/manga template fields and milestone data", () => {
    const result = buildCommonTemplateFields(mockAnimeStats, milestoneData);

    expect(result).toMatchObject({
      count: 250,
      meanScore: 75.5,
      standardDeviation: 12.3,
      previousMilestone: 100,
      currentMilestone: 250,
      percentage: 60,
      dasharray: "60 40",
      dashoffset: "10",
    });
    expect(result.statuses).toContainEqual({
      status: "COMPLETED",
      amount: 180,
    });
    expect(result.staff?.[0]).toEqual({
      staff: { name: { full: "Ufotable Staff" } },
      count: 5,
    });
  });

  it("maps anime statistics into the template shape", () => {
    const result = toTemplateAnimeStats(mockAnimeStats, milestoneData);

    expect(result.episodesWatched).toBe(3500);
    expect(result.minutesWatched).toBe(84000);
    expect(result.voice_actors?.[0]).toEqual({
      voice_actor: { name: { full: "Kaji Yuki" } },
      count: 18,
    });
    expect(result.studios).toEqual(mockAnimeStats.studios);
  });

  it("maps manga statistics into the template shape", () => {
    const result = toTemplateMangaStats(mockMangaStats, milestoneData);

    expect(result.chaptersRead).toBe(5200);
    expect(result.volumesRead).toBe(180);
    expect(result.genres?.[0]).toEqual({ genre: "Action", count: 45 });
  });

  it("maps category items by key and falls back for unsupported keys", () => {
    expect(mapCategoryItem(mockAnimeStats.genres[0], "genres")).toEqual({
      name: "Action",
      count: 85,
    });
    expect(mapCategoryItem(mockAnimeStats.tags[0], "tags")).toEqual({
      name: "Shounen",
      count: 45,
    });
    expect(
      mapCategoryItem(mockAnimeStats.voiceActors[0], "voiceActors"),
    ).toEqual({ name: "Kaji Yuki", count: 18 });
    expect(mapCategoryItem(mockAnimeStats.studios[0], "studios")).toEqual({
      name: "ufotable",
      count: 8,
    });
    expect(mapCategoryItem(mockAnimeStats.staff[0], "staff")).toEqual({
      name: "Ufotable Staff",
      count: 5,
    });
    expect(mapCategoryItem(mockAnimeStats.genres[0], "unknown")).toEqual({
      name: "",
      count: 0,
    });
  });

  it("returns favorites only for favorite-aware card types when enabled", () => {
    const userRecord = createUserRecord();

    expect(processFavorites("animeStaff", null, true, userRecord)).toEqual([
      "Hiroyuki Sawano",
      "Yuki Kajiura",
      "Kevin Penkin",
    ]);
    expect(processFavorites("animeStaff", "false", true, userRecord)).toEqual(
      [],
    );
    expect(processFavorites("animeStats", "true", true, userRecord)).toEqual(
      [],
    );
  });

  it("prefers stored source-material totals and collapses long tails into Other", () => {
    const userRecord = createUserRecord();
    userRecord.aggregates = {
      animeSourceMaterialDistributionTotals: [
        { source: "ORIGINAL", count: 10 },
        { source: "LIGHT_NOVEL", count: 9 },
        { source: "WEB_NOVEL", count: 8 },
        { source: "VIDEO_GAME", count: 7 },
        { source: "MULTIMEDIA_PROJECT", count: 6 },
        { source: "MANGA", count: 5 },
        { source: "NOVEL", count: 4 },
        { source: "COMIC", count: 3 },
        { source: "ANIME", count: 2 },
        { source: "DOUJINSHI", count: 1 },
        { source: "UNKNOWN", count: 1 },
      ],
    };

    const result = toTemplateAnimeSourceMaterialDistribution(userRecord);

    expect(result).toHaveLength(10);
    expect(result[0]).toEqual({ name: "Original", count: 10 });
    expect(result).toContainEqual({ name: "Web Novel", count: 8 });
    expect(result).toContainEqual({
      name: "Multimedia Project",
      count: 6,
    });
    expect(result.at(-1)).toEqual({ name: "Other", count: 2 });
  });

  it("falls back to current and completed lists for source-material distributions", () => {
    const userRecord = createUserRecord();
    delete userRecord.aggregates;
    userRecord.stats.animeCurrent = createCollection([
      createMediaEntry(1, { media: { source: "MANGA" } }),
      createMediaEntry(2, { media: {} }),
    ]);
    userRecord.stats.animeCompleted = createCollection([
      createMediaEntry(1, { media: { source: "MANGA" } }),
      createMediaEntry(3, { media: { source: "ORIGINAL" } }),
    ]);

    const result = toTemplateAnimeSourceMaterialDistribution(userRecord);

    expect(result).toContainEqual({ name: "Manga", count: 1 });
    expect(result).toContainEqual({ name: "Original", count: 1 });
    expect(result).toContainEqual({ name: "Unknown", count: 1 });
  });

  it("normalizes stored seasonal totals into template labels", () => {
    const userRecord = createUserRecord();
    userRecord.aggregates = {
      animeSeasonalPreferenceTotals: [
        { season: "winter", count: 5 },
        { season: "fall", count: 2 },
        { season: "mystery", count: 1 },
      ],
    };

    expect(toTemplateAnimeSeasonalPreference(userRecord)).toEqual([
      { name: "Winter", count: 5 },
      { name: "Spring", count: 0 },
      { name: "Summer", count: 0 },
      { name: "Fall", count: 2 },
      { name: "Unknown", count: 1 },
    ]);
  });

  it("buckets anime episode length preferences and ignores invalid entries", () => {
    const userRecord = createUserRecord();
    userRecord.stats.User.statistics.anime.lengths = [
      { length: "12", count: 2 },
      { length: "24", count: 3 },
      { length: "45", count: 4 },
      { length: "not-a-number", count: 5 },
      { length: "15", count: -1 },
    ];

    expect(toTemplateAnimeEpisodeLengthPreferences(userRecord)).toEqual([
      { name: "Short (<15 min)", count: 2 },
      { name: "Standard (~25 min)", count: 3 },
      { name: "Long (>30 min)", count: 4 },
    ]);
  });

  it("sorts genre synergy totals and formats pair labels", () => {
    const userRecord = createUserRecord();
    userRecord.aggregates = {
      animeGenreSynergyTotals: [
        { a: "Comedy", b: "Drama", count: 2 },
        { a: "Action", b: "Drama", count: 5 },
        { a: "Fantasy", b: "Mystery", count: 1 },
      ],
    };

    expect(toTemplateAnimeGenreSynergy(userRecord)).toEqual([
      { name: "Action + Drama", count: 5 },
      { name: "Comedy + Drama", count: 2 },
      { name: "Fantasy + Mystery", count: 1 },
    ]);
  });

  it("sorts studio collaboration totals and formats pair labels", () => {
    const userRecord = createUserRecord();
    userRecord.aggregates = {
      studioCollaborationTotals: [
        { a: "Bones", b: "MAPPA", count: 3 },
        { a: "Madhouse", b: "Wit Studio", count: 1 },
        { a: "Kyoto Animation", b: "PA Works", count: 2 },
      ],
    };

    expect(toTemplateStudioCollaboration(userRecord)).toEqual([
      { name: "Bones + MAPPA", count: 3 },
      { name: "Kyoto Animation + PA Works", count: 2 },
      { name: "Madhouse + Wit Studio", count: 1 },
    ]);
  });
});
