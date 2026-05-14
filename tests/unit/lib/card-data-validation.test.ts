import { describe, expect, it } from "bun:test";

import {
  getFavoritesForCardType,
  isValidCardType,
  validateAndNormalizeUserRecord,
  validateUserRecordForCardRender,
} from "@/lib/card-data/validation";
import type { MediaListEntry, UserRecord } from "@/lib/types/records";
import {
  mockAnimeStats,
  mockMangaStats,
  mockUserRecord,
  mockUserStatsData,
} from "@/tests/e2e/fixtures/mock-data";

function createRawUserRecord(): UserRecord {
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

function createGroupedCollection(name: string, entries: MediaListEntry[]) {
  return {
    lists: [{ name, entries }],
    count: entries.length,
  };
}

function expectNormalized(
  result: ReturnType<typeof validateAndNormalizeUserRecord>,
) {
  if ("error" in result) {
    throw new Error(`Expected normalized record, got: ${result.error}`);
  }

  return result.normalized;
}

describe("card-data validation helpers", () => {
  it("validates known card types, including suffixed variants", () => {
    expect(isValidCardType("animeStats")).toBe(true);
    expect(isValidCardType("animeStats-vertical")).toBe(true);
    expect(isValidCardType("unknownCard")).toBe(false);
    expect(isValidCardType("")).toBe(false);
    expect(isValidCardType(null)).toBe(false);
  });

  it("extracts favorites for each supported card family", () => {
    const favourites = mockUserStatsData.User.favourites;

    expect(getFavoritesForCardType(favourites, "animeVoiceActors")).toEqual([
      "Levi Ackerman",
      "Killua Zoldyck",
      "Edward Elric",
    ]);
    expect(getFavoritesForCardType(favourites, "animeStudios")).toEqual([
      "ufotable",
      "MAPPA",
      "Bones",
    ]);
    expect(getFavoritesForCardType(favourites, "animeStaff")).toEqual([
      "Hiroyuki Sawano",
      "Yuki Kajiura",
      "Kevin Penkin",
    ]);
    expect(getFavoritesForCardType(favourites, "animeStats")).toEqual([]);
  });

  it("rejects invalid roots and records without statistics", () => {
    expect(validateAndNormalizeUserRecord(null)).toEqual({
      error: "Invalid user record: not an object",
    });
    expect(validateAndNormalizeUserRecord({ userId: "1" })).toEqual({
      error: "Invalid user record: missing statistics",
    });
  });

  it("normalizes activity history and malformed nested statistic fields", () => {
    const raw = createRawUserRecord();
    const recentTimestamp = Math.floor(Date.now() / 1000) - 60 * 60;
    const oldTimestamp = Math.floor(Date.now() / 1000) - 400 * 24 * 60 * 60;

    raw.stats = {
      ...structuredClone(mockUserStatsData),
      User: {
        ...structuredClone(mockUserStatsData.User),
        stats: {
          activityHistory: [
            { date: recentTimestamp, amount: "7" },
            { date: "not-a-number", amount: "still-not-a-number" },
            { date: oldTimestamp, amount: 5 },
          ] as never,
        },
        statistics: {
          anime: {
            ...structuredClone(mockAnimeStats),
            genres: "not-an-array",
            tags: [
              { tag: { name: "Mystery", category: "Genre" }, count: "3" },
              { broken: true },
            ],
            statuses: [
              { status: "COMPLETED", count: "12" },
              { status: "", count: 4 },
            ],
            voiceActors: [
              { voiceActor: { name: { full: "Actor One" } }, count: "4" },
              {},
            ],
          } as never,
          manga: structuredClone(mockMangaStats),
        },
      },
    };

    const normalized = expectNormalized(validateAndNormalizeUserRecord(raw));

    expect(normalized.stats.User.stats.activityHistory).toEqual([
      { date: recentTimestamp, amount: 7 },
    ]);
    expect(normalized.stats.User.statistics.anime?.genres).toEqual([]);
    expect(normalized.stats.User.statistics.anime?.tags).toEqual([
      { tag: { name: "Mystery", category: "Genre" }, count: 3 },
    ]);
    expect(normalized.stats.User.statistics.anime?.statuses).toEqual([
      { status: "COMPLETED", count: 12 },
    ]);
    expect(normalized.stats.User.statistics.anime?.voiceActors).toEqual([
      {
        voiceActor: { name: { full: "Actor One" } },
        count: 4,
      },
    ]);
  });

  it("computes aggregates from the full write-time lists before pruning them", () => {
    const raw = createRawUserRecord();

    raw.stats = {
      ...structuredClone(mockUserStatsData),
      User: {
        ...structuredClone(mockUserStatsData.User),
        statistics: {
          anime: structuredClone(mockAnimeStats),
          manga: structuredClone(mockMangaStats),
        },
      },
      animeCurrent: createGroupedCollection("Watching", [
        createMediaEntry(1, { media: { source: "MANGA", season: "WINTER" } }),
        createMediaEntry(2, {
          media: { source: "ORIGINAL", season: "SPRING" },
        }),
        createMediaEntry(3, {
          media: { source: "LIGHT_NOVEL", season: "SUMMER" },
        }),
        createMediaEntry(4, { media: { source: "VIDEO_GAME" } }),
        createMediaEntry(5, { media: { source: "ANIME" } }),
        createMediaEntry(6, { media: { season: "FALL" } }),
        createMediaEntry(7, {
          media: { source: "WEB_NOVEL", season: "FALL" },
        }),
      ]),
      animeCompleted: createGroupedCollection("Completed", [
        createMediaEntry(100, {
          score: 95,
          media: {
            source: "MANGA",
            season: "WINTER",
            episodes: 12,
            genres: ["Action", "Drama"],
            studios: {
              nodes: [
                { id: 1, name: "Bones" },
                { id: 2, name: "MAPPA" },
              ],
            },
          },
        }),
        createMediaEntry(101, {
          score: 90,
          media: {
            source: "ORIGINAL",
            season: "SPRING",
            episodes: 24,
            genres: ["Action", "Drama", "Comedy"],
            studios: {
              nodes: [
                { id: 1, name: "Bones" },
                { id: 2, name: "MAPPA" },
              ],
            },
          },
        }),
        createMediaEntry(102, {
          score: 80,
          media: {
            season: "SUMMER",
            episodes: 36,
            genres: ["Drama", "Fantasy"],
            studios: {
              nodes: [
                { id: 1, name: "Bones" },
                { id: 3, name: "Wit Studio" },
              ],
            },
          },
        }),
      ]),
    };

    const normalized = expectNormalized(validateAndNormalizeUserRecord(raw));

    expect(normalized.stats.animeCurrent?.lists[0]?.entries).toHaveLength(6);
    expect(
      normalized.aggregates?.animeSourceMaterialDistributionTotals,
    ).toContainEqual({ source: "WEB_NOVEL", count: 1 });
    expect(normalized.aggregates?.animeSeasonalPreferenceTotals).toContainEqual(
      {
        season: "FALL",
        count: 2,
      },
    );
    expect(normalized.aggregates?.animeGenreSynergyTotals).toContainEqual({
      a: "Action",
      b: "Drama",
      count: 2,
    });
    expect(normalized.aggregates?.studioCollaborationTotals).toContainEqual({
      a: "Bones",
      b: "MAPPA",
      count: 2,
    });
  });

  it("preserves stored render-time slices and canonicalizes stored pair aggregates", () => {
    const raw = createRawUserRecord();

    raw.stats = {
      ...structuredClone(mockUserStatsData),
      User: {
        ...structuredClone(mockUserStatsData.User),
        statistics: {
          anime: structuredClone(mockAnimeStats),
          manga: structuredClone(mockMangaStats),
        },
      },
      animeCurrent: {
        lists: [
          {
            name: "All",
            entries: [createMediaEntry(1, { media: { source: "MANGA" } })],
          },
        ],
        count: 1,
      },
      animeCompleted: {
        lists: [
          {
            name: "All",
            entries: [
              createMediaEntry(2, {
                media: {
                  source: "ORIGINAL",
                  genres: ["Action", "Drama"],
                  studios: {
                    nodes: [
                      { id: 1, name: "Bones" },
                      { id: 2, name: "MAPPA" },
                    ],
                  },
                },
              }),
            ],
          },
        ],
        count: 1,
      },
    };
    raw.aggregates = {
      animeSourceMaterialDistributionTotals: [
        { source: "LIGHT_NOVEL", count: 99 },
      ],
      animeSeasonalPreferenceTotals: [{ season: "summer", count: 7 }],
      animeGenreSynergyTotals: [
        { a: "Drama", b: "Action", count: 2 },
        { a: "Action", b: "Drama", count: 1 },
        { a: "Comedy", b: "Comedy", count: 5 },
      ],
      studioCollaborationTotals: [
        { a: "MAPPA", b: "Bones", count: 3 },
        { a: "Bones", b: "MAPPA", count: 1 },
        { a: "Bones", b: "Bones", count: 9 },
      ],
    };

    const result = validateUserRecordForCardRender(raw);
    const normalized = expectNormalized(result);

    expect(normalized.stats.animeCurrent?.lists[0]?.entries).toHaveLength(1);
    expect(
      normalized.aggregates?.animeSourceMaterialDistributionTotals,
    ).toEqual([{ source: "LIGHT_NOVEL", count: 99 }]);
    expect(normalized.aggregates?.animeSeasonalPreferenceTotals).toEqual([
      { season: "summer", count: 7 },
    ]);
    expect(normalized.aggregates?.animeGenreSynergyTotals).toEqual([
      { a: "Action", b: "Drama", count: 2 },
    ]);
    expect(normalized.aggregates?.studioCollaborationTotals).toEqual([
      { a: "Bones", b: "MAPPA", count: 3 },
    ]);
  });

  it("returns a 404-style validation error when both anime and manga stats are missing", () => {
    const raw = createRawUserRecord();
    raw.stats = {
      ...structuredClone(mockUserStatsData),
      User: {
        ...structuredClone(mockUserStatsData.User),
        statistics: {} as never,
      },
    };

    expect(validateAndNormalizeUserRecord(raw)).toEqual({
      error: "Missing statistics: no anime or manga stats present",
      status: 404,
    });
  });
});
