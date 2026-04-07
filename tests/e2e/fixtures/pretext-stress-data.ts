import type {
  MediaListCollection,
  MediaListEntry,
  UserRecord,
} from "@/lib/types/records";

import {
  mockAnimeStats,
  mockMangaStats,
  mockUserRecord,
  mockUserStatsData,
} from "./mock-data";

const PRETEXT_STRESS_USERNAME =
  "Collector 名探偵 أحمد 🚀 Archive of Impossibly Long Titles";

function createCollection(entries: MediaListEntry[]): MediaListCollection {
  return {
    count: entries.length,
    lists: [
      {
        name: "All",
        entries,
      },
    ],
    totalRepeat: entries.reduce((sum, entry) => sum + (entry.repeat ?? 0), 0),
  };
}

function createAnimeEntry(args: {
  averageScore?: number;
  episodes?: number;
  format?: string;
  genres?: string[];
  id: number;
  progress?: number;
  repeat?: number;
  score?: number;
  season?: string;
  seasonYear?: number;
  source?: string;
  studioNames?: string[];
  title: string;
}): MediaListEntry {
  return {
    id: args.id,
    progress: args.progress,
    repeat: args.repeat,
    score: args.score,
    media: {
      // Offset entry.id-derived media IDs by +10_000 / +20_000 so entry.id and entry.media.id stay distinct and anime/manga namespaces do not collide.
      averageScore: args.averageScore,
      episodes: args.episodes,
      format: args.format,
      genres: args.genres,
      id: args.id + 10_000,
      season: args.season,
      seasonYear: args.seasonYear,
      source: args.source,
      studios: {
        nodes: (args.studioNames ?? []).map((name, index) => ({
          id: args.id * 10 + index,
          name,
        })),
      },
      title: {
        romaji: args.title,
      },
    },
  };
}

function createMangaEntry(args: {
  averageScore?: number;
  chapters?: number;
  format?: string;
  genres?: string[];
  id: number;
  progress?: number;
  repeat?: number;
  score?: number;
  source?: string;
  title: string;
  volumes?: number;
}): MediaListEntry {
  return {
    id: args.id,
    progress: args.progress,
    repeat: args.repeat,
    score: args.score,
    media: {
      averageScore: args.averageScore,
      chapters: args.chapters,
      format: args.format,
      genres: args.genres,
      id: args.id + 20_000,
      source: args.source,
      title: {
        romaji: args.title,
      },
      volumes: args.volumes,
    },
  };
}

const animeCurrentEntries = [
  createAnimeEntry({
    averageScore: 88,
    episodes: 1234,
    format: "TV",
    genres: ["Psychological Thriller", "Supernatural Mystery"],
    id: 101,
    progress: 123,
    season: "WINTER",
    seasonYear: 2025,
    source: "MANGA",
    studioNames: ["Bones", "MAPPA"],
    title: "The Extremely Verbose Collector's Edition Director's Cut Anthology",
  }),
  createAnimeEntry({
    averageScore: 91,
    episodes: 88,
    format: "TV",
    genres: ["Action", "Drama"],
    id: 102,
    progress: 42,
    season: "SPRING",
    seasonYear: 2024,
    source: "ORIGINAL",
    studioNames: ["Wit Studio"],
    title: "進撃の巨人 The Final Season 完結編 Broadcast Edition",
  }),
  createAnimeEntry({
    averageScore: 77,
    episodes: 999,
    format: "ONA",
    genres: ["Science Fiction Adventure"],
    id: 103,
    progress: 500,
    season: "SUMMER",
    seasonYear: 2023,
    source: "LIGHT_NOVEL",
    studioNames: ["Studio Trigger"],
    title: "🚀 Galactic Data Archivist Chronicles Deluxe",
  }),
];

const mangaCurrentEntries = [
  createMangaEntry({
    averageScore: 84,
    chapters: 12345,
    format: "MANGA",
    genres: ["Historical Drama", "Mystery"],
    id: 201,
    progress: 1234,
    source: "LIGHT_NOVEL",
    title: "رحلة الباحثين عن أرشيف النجوم والمجلدات المفقودة",
    volumes: 42,
  }),
  createMangaEntry({
    averageScore: 82,
    chapters: 540,
    format: "MANGA",
    genres: ["Slice of Life Healing Drama"],
    id: 202,
    progress: 212,
    source: "ORIGINAL",
    title: "The Long-Running Catalogue of Tea, Time Travel, and Tiny Miracles",
    volumes: 18,
  }),
  createMangaEntry({
    averageScore: 90,
    chapters: 980,
    format: "NOVEL",
    genres: ["Fantasy", "Adventure"],
    id: 203,
    progress: 640,
    source: "VIDEO_GAME",
    title: "資料室から始まる銀河司書の航海日誌 完全版",
    volumes: 27,
  }),
];

const animeCompletedEntries = [
  createAnimeEntry({
    averageScore: 95,
    episodes: 64,
    format: "TV",
    genres: ["Psychological Thriller", "Character Study"],
    id: 301,
    progress: 64,
    repeat: 5,
    score: 98,
    season: "FALL",
    seasonYear: 2022,
    source: "VISUAL_NOVEL",
    studioNames: ["Kyoto Animation", "Production I.G"],
    title: "The Meticulously Annotated Guide to Quiet Apocalypses",
  }),
  createAnimeEntry({
    averageScore: 89,
    episodes: 26,
    format: "TV",
    genres: ["Adventure", "Drama"],
    id: 302,
    progress: 26,
    repeat: 3,
    score: 94,
    season: "WINTER",
    seasonYear: 2021,
    source: "MANGA",
    studioNames: ["Bones", "Studio Trigger"],
    title: "Cartographers of the Last Aurora Expedition",
  }),
  createAnimeEntry({
    averageScore: 83,
    episodes: 12,
    format: "MOVIE",
    genres: ["Science Fiction Adventure"],
    id: 303,
    progress: 12,
    repeat: 2,
    score: 87,
    season: "SPRING",
    seasonYear: 2020,
    source: "ORIGINAL",
    studioNames: ["MAPPA"],
    title: "Memories of a Thousand Satellite Sunsets",
  }),
  createAnimeEntry({
    averageScore: 79,
    episodes: 148,
    format: "TV",
    genres: ["Action", "Fantasy"],
    id: 304,
    progress: 148,
    repeat: 1,
    score: 81,
    season: "SUMMER",
    seasonYear: 2019,
    source: "LIGHT_NOVEL",
    studioNames: ["Wit Studio", "MAPPA"],
    title: "Chronicles of the Starborne Cipher Brigade",
  }),
];

const mangaCompletedEntries = [
  createMangaEntry({
    averageScore: 93,
    chapters: 640,
    format: "MANGA",
    genres: ["Mystery", "Drama"],
    id: 401,
    progress: 640,
    repeat: 4,
    score: 97,
    source: "ORIGINAL",
    title: "The Secret Atlas of Forgotten Libraries and Lanterns",
    volumes: 32,
  }),
  createMangaEntry({
    averageScore: 88,
    chapters: 320,
    format: "MANGA",
    genres: ["Fantasy", "Adventure"],
    id: 402,
    progress: 320,
    repeat: 2,
    score: 91,
    source: "NOVEL",
    title: "Kingdom of Sandglass Astronomers",
    volumes: 16,
  }),
  createMangaEntry({
    averageScore: 81,
    chapters: 220,
    format: "ONE_SHOT",
    genres: ["Slice of Life Healing Drama"],
    id: 403,
    progress: 220,
    repeat: 1,
    score: 85,
    source: "LIGHT_NOVEL",
    title: "Letters to the Midnight Conservatory",
    volumes: 8,
  }),
  createMangaEntry({
    averageScore: 86,
    chapters: 510,
    format: "NOVEL",
    genres: ["Historical Drama"],
    id: 404,
    progress: 510,
    repeat: 3,
    score: 89,
    source: "VIDEO_GAME",
    title: "The Archivist Who Catalogued Every Distant Monsoon",
    volumes: 20,
  }),
];

const animePlanningEntries = [
  createAnimeEntry({
    averageScore: 91,
    episodes: 24,
    format: "TV",
    id: 501,
    source: "MANGA",
    title: "A Future Symposium on Dragons, Data, and Delayed Trains",
  }),
  createAnimeEntry({
    averageScore: 84,
    episodes: 12,
    format: "ONA",
    id: 502,
    source: "ORIGINAL",
    title: "The Polite Invasion of the Moonlit Librarians",
  }),
  createAnimeEntry({
    averageScore: 88,
    episodes: 48,
    format: "TV",
    id: 503,
    source: "LIGHT_NOVEL",
    title: "Quantized Hearts in the Department of Miracles",
  }),
];

const mangaPlanningEntries = [
  createMangaEntry({
    averageScore: 87,
    chapters: 180,
    format: "MANGA",
    id: 601,
    source: "NOVEL",
    title: "The Quiet Geometry of Rain and Revolutions",
    volumes: 12,
  }),
  createMangaEntry({
    averageScore: 90,
    chapters: 90,
    format: "NOVEL",
    id: 602,
    source: "LIGHT_NOVEL",
    title: "Blueprints for the Last Museum in Orbit",
    volumes: 6,
  }),
  createMangaEntry({
    averageScore: 82,
    chapters: 75,
    format: "ONE_SHOT",
    id: 603,
    source: "ORIGINAL",
    title: "Notes from the Department of Very Small Catastrophes",
    volumes: 4,
  }),
];

const animeDroppedEntries = [
  createAnimeEntry({
    averageScore: 61,
    episodes: 12,
    format: "TV",
    id: 701,
    progress: 3,
    score: 55,
    source: "MANGA",
    title: "Overproduced Heroes and the Taxonomy of Beige Explosions",
  }),
  createAnimeEntry({
    averageScore: 58,
    episodes: 24,
    format: "TV",
    id: 702,
    progress: 7,
    score: 50,
    source: "ORIGINAL",
    title: "Even the Villains Begged for a Rewrite",
  }),
];

const mangaDroppedEntries = [
  createMangaEntry({
    averageScore: 59,
    chapters: 90,
    format: "MANGA",
    id: 801,
    progress: 15,
    score: 48,
    source: "NOVEL",
    title: "Appendix C: The Plot Went Missing Here",
    volumes: 5,
  }),
  createMangaEntry({
    averageScore: 62,
    chapters: 140,
    format: "NOVEL",
    id: 802,
    progress: 22,
    score: 53,
    source: "ORIGINAL",
    title: "The Bureau of Excessive Foreshadowing",
    volumes: 7,
  }),
];

const animeRewatchedEntries = [
  createAnimeEntry({
    averageScore: 96,
    episodes: 64,
    format: "TV",
    id: 901,
    progress: 64,
    repeat: 8,
    score: 99,
    source: "MANGA",
    title: "The Meticulously Annotated Guide to Quiet Apocalypses",
  }),
  createAnimeEntry({
    averageScore: 90,
    episodes: 26,
    format: "TV",
    id: 902,
    progress: 26,
    repeat: 6,
    score: 94,
    source: "ORIGINAL",
    title: "Cartographers of the Last Aurora Expedition",
  }),
  createAnimeEntry({
    averageScore: 88,
    episodes: 12,
    format: "MOVIE",
    id: 903,
    progress: 12,
    repeat: 4,
    score: 91,
    source: "LIGHT_NOVEL",
    title: "Memories of a Thousand Satellite Sunsets",
  }),
];

const mangaRereadEntries = [
  createMangaEntry({
    averageScore: 94,
    chapters: 640,
    format: "MANGA",
    id: 1001,
    progress: 640,
    repeat: 7,
    score: 98,
    source: "ORIGINAL",
    title: "The Secret Atlas of Forgotten Libraries and Lanterns",
    volumes: 32,
  }),
  createMangaEntry({
    averageScore: 89,
    chapters: 320,
    format: "MANGA",
    id: 1002,
    progress: 320,
    repeat: 5,
    score: 93,
    source: "NOVEL",
    title: "Kingdom of Sandglass Astronomers",
    volumes: 16,
  }),
];

const pretextStressFavourites = {
  ...mockUserStatsData.User.favourites,
  anime: {
    nodes: [
      {
        id: 11,
        title: {
          romaji: "The Collected Proceedings of Starlight Archivists",
        },
        coverImage: {
          color: "#4f46e5",
          large: "",
          medium: "",
        },
      },
      {
        id: 12,
        title: {
          romaji: "When Libraries Learn to Dream in Binary",
        },
        coverImage: {
          color: "#0ea5e9",
          large: "",
          medium: "",
        },
      },
    ],
    pageInfo: { total: 2 },
  },
  manga: {
    nodes: [
      {
        id: 21,
        title: {
          romaji: "Field Notes from the Cartographers of Yesterday",
        },
        coverImage: {
          color: "#9333ea",
          large: "",
          medium: "",
        },
      },
      {
        id: 22,
        title: {
          romaji: "The Bureau of Vanishing Constellations",
        },
        coverImage: {
          color: "#ec4899",
          large: "",
          medium: "",
        },
      },
    ],
    pageInfo: { total: 2 },
  },
  characters: {
    nodes: [
      {
        id: 31,
        name: { full: "Levi Ackerman, Reluctant Archivist of the Walls" },
        image: { large: "", medium: "" },
      },
      {
        id: 32,
        name: { full: "Killua Zoldyck of the Lightning-Fast Card Catalog" },
        image: { large: "", medium: "" },
      },
    ],
    pageInfo: { total: 2 },
  },
  staff: {
    nodes: [
      {
        id: 41,
        name: { full: "Hiroyuki Sawano and the Orchestra of Impending Doom" },
        image: { large: "", medium: "" },
      },
      {
        id: 42,
        name: { full: "Yuki Kajiura of the Thousand Echoed Motifs" },
        image: { large: "", medium: "" },
      },
      {
        id: 43,
        name: { full: "Kevin Penkin, Cartographer of Impossible Atmospheres" },
        image: { large: "", medium: "" },
      },
    ],
    pageInfo: { total: 3 },
  },
  studios: {
    nodes: [
      { id: 51, name: "Bones" },
      { id: 52, name: "Studio Trigger" },
      { id: 53, name: "Kyoto Animation" },
    ],
    pageInfo: { total: 3 },
  },
};

const pretextStressStatistics = {
  ...mockUserStatsData.User.statistics,
  anime: {
    ...mockAnimeStats,
    genres: [
      { genre: "Psychological Thriller", count: 88 },
      { genre: "Science Fiction Adventure", count: 64 },
      { genre: "Slice of Life Healing Drama", count: 42 },
      { genre: "Historical Mystery", count: 27 },
      { genre: "Experimental Music Documentary", count: 18 },
    ],
    tags: [
      { tag: { name: "Found Family With Cosmic Consequences" }, count: 29 },
      { tag: { name: "Meticulous Worldbuilding" }, count: 22 },
      { tag: { name: "Archivists And Lost Civilizations" }, count: 18 },
      { tag: { name: "Time Loop Shenanigans" }, count: 14 },
    ],
    voiceActors: [
      {
        voiceActor: {
          name: { full: "Hanazawa Kana of the Midnight Reading Room" },
        },
        count: 14,
      },
      {
        voiceActor: {
          name: { full: "Kamiya Hiroshi, Keeper of the Skyborne Index" },
        },
        count: 12,
      },
      {
        voiceActor: {
          name: { full: "Hayami Saori and the Orchestra of Snowfall" },
        },
        count: 10,
      },
    ],
    studios: [
      { studio: { name: "Kyoto Animation" }, count: 14 },
      { studio: { name: "Studio Trigger" }, count: 11 },
      { studio: { name: "Production I.G" }, count: 9 },
      { studio: { name: "Wit Studio" }, count: 7 },
    ],
    staff: [
      {
        staff: {
          name: { full: "Hiroyuki Sawano and the Orchestra of Impending Doom" },
        },
        count: 8,
      },
      {
        staff: { name: { full: "Yuki Kajiura of the Thousand Echoed Motifs" } },
        count: 6,
      },
      {
        staff: {
          name: {
            full: "Kevin Penkin, Cartographer of Impossible Atmospheres",
          },
        },
        count: 5,
      },
    ],
    lengths: [
      { length: "12", count: 18 },
      { length: "24", count: 96 },
      { length: "48", count: 24 },
    ],
  },
  manga: {
    ...mockMangaStats,
    genres: [
      { genre: "Historical Drama", count: 46 },
      { genre: "Mystery", count: 39 },
      { genre: "Fantasy Adventure", count: 34 },
      { genre: "Slice of Life Healing Drama", count: 21 },
    ],
    tags: [
      { tag: { name: "Slow Burn Political Intrigue" }, count: 26 },
      { tag: { name: "Intergenerational Grief And Recovery" }, count: 20 },
      { tag: { name: "Catastrophically Reliable Narrators" }, count: 14 },
    ],
    staff: [
      {
        staff: {
          name: { full: "A Mangaka With A Surprisingly Long Pen Name" },
        },
        count: 3,
      },
      {
        staff: {
          name: { full: "Another Creator of Overly Elaborate Marginalia" },
        },
        count: 2,
      },
      {
        staff: { name: { full: "The Last Cartographer of Monochrome Storms" } },
        count: 2,
      },
    ],
  },
};

export const mockPretextStressUserRecord: UserRecord = {
  ...mockUserRecord,
  userId: "654321",
  username: PRETEXT_STRESS_USERNAME,
  createdAt: "2018-01-15T10:00:00.000Z",
  updatedAt: "2026-04-03T10:00:00.000Z",
  stats: {
    ...mockUserStatsData,
    User: {
      ...mockUserStatsData.User,
      favourites: { ...pretextStressFavourites },
      statistics: { ...pretextStressStatistics },
      stats: {
        activityHistory: [
          { date: 1_704_067_200, amount: 8 },
          { date: 1_704_153_600, amount: 5 },
          { date: 1_704_240_000, amount: 13 },
          { date: 1_704_326_400, amount: 7 },
          { date: 1_704_412_800, amount: 16 },
          { date: 1_704_499_200, amount: 11 },
          { date: 1_704_585_600, amount: 19 },
        ],
      },
    },
    followersPage: {
      pageInfo: { total: 12_345 },
      followers: [{ id: 1 }, { id: 2 }, { id: 3 }],
    },
    followingPage: {
      pageInfo: { total: 9_876 },
      following: [{ id: 4 }, { id: 5 }, { id: 6 }],
    },
    threadsPage: {
      pageInfo: { total: 432 },
      threads: [{ id: 100 }, { id: 101 }],
    },
    threadCommentsPage: {
      pageInfo: { total: 7_654 },
      threadComments: [{ id: 200 }, { id: 201 }],
    },
    reviewsPage: {
      pageInfo: { total: 128 },
      reviews: [{ id: 300 }, { id: 301 }],
    },
    animePlanning: createCollection(animePlanningEntries),
    mangaPlanning: createCollection(mangaPlanningEntries),
    animeCurrent: createCollection(animeCurrentEntries),
    mangaCurrent: createCollection(mangaCurrentEntries),
    animeRewatched: createCollection(animeRewatchedEntries),
    mangaReread: createCollection(mangaRereadEntries),
    animeCompleted: createCollection(animeCompletedEntries),
    mangaCompleted: createCollection(mangaCompletedEntries),
    animeDropped: createCollection(animeDroppedEntries),
    mangaDropped: createCollection(mangaDroppedEntries),
  },
  aggregates: {
    animeSourceMaterialDistributionTotals: [
      { source: "MANGA", count: 84 },
      { source: "LIGHT_NOVEL", count: 52 },
      { source: "ORIGINAL", count: 39 },
      { source: "VIDEO_GAME", count: 18 },
    ],
    animeSeasonalPreferenceTotals: [
      { season: "WINTER", count: 48 },
      { season: "SPRING", count: 37 },
      { season: "SUMMER", count: 31 },
      { season: "FALL", count: 22 },
    ],
    animeGenreSynergyTotals: [
      {
        a: "Psychological Thriller",
        b: "Supernatural Mystery",
        count: 22,
      },
      {
        a: "Science Fiction Adventure",
        b: "Character Study",
        count: 16,
      },
      {
        a: "Slice of Life Healing Drama",
        b: "Historical Mystery",
        count: 11,
      },
    ],
    studioCollaborationTotals: [
      { a: "Bones", b: "Studio Trigger", count: 12 },
      { a: "Kyoto Animation", b: "Production I.G", count: 9 },
      { a: "MAPPA", b: "Wit Studio", count: 7 },
    ],
  },
};

export const pretextStressMatrixUsername = PRETEXT_STRESS_USERNAME;
