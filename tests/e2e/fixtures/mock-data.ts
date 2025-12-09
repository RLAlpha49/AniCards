import type {
  UserRecord,
  CardsRecord,
  UserStatsData,
  AnimeStats,
  MangaStats,
} from "../../../lib/types/records";

/**
 * Mock anime statistics for E2E tests.
 * Provides realistic data structure matching the AniList API response.
 */
export const mockAnimeStats: AnimeStats = {
  count: 250,
  episodesWatched: 3500,
  minutesWatched: 84000,
  meanScore: 75.5,
  standardDeviation: 12.3,
  genres: [
    { genre: "Action", count: 85 },
    { genre: "Adventure", count: 62 },
    { genre: "Comedy", count: 78 },
    { genre: "Drama", count: 55 },
    { genre: "Fantasy", count: 48 },
    { genre: "Sci-Fi", count: 32 },
    { genre: "Romance", count: 28 },
    { genre: "Slice of Life", count: 24 },
  ],
  tags: [
    { tag: { name: "Shounen" }, count: 45 },
    { tag: { name: "Super Power" }, count: 38 },
    { tag: { name: "Isekai" }, count: 22 },
    { tag: { name: "School" }, count: 35 },
    { tag: { name: "Magic" }, count: 28 },
    { tag: { name: "Mecha" }, count: 15 },
  ],
  voiceActors: [
    { voiceActor: { name: { full: "Kaji Yuki" } }, count: 18 },
    { voiceActor: { name: { full: "Hanazawa Kana" } }, count: 15 },
    { voiceActor: { name: { full: "Kamiya Hiroshi" } }, count: 14 },
    { voiceActor: { name: { full: "Hayami Saori" } }, count: 12 },
    { voiceActor: { name: { full: "Sakurai Takahiro" } }, count: 11 },
  ],
  studios: [
    { studio: { name: "ufotable" }, count: 8 },
    { studio: { name: "MAPPA" }, count: 12 },
    { studio: { name: "Bones" }, count: 10 },
    { studio: { name: "Kyoto Animation" }, count: 7 },
    { studio: { name: "Wit Studio" }, count: 6 },
  ],
  staff: [
    { staff: { name: { full: "Ufotable Staff" } }, count: 5 },
    { staff: { name: { full: "Hiroyuki Sawano" } }, count: 8 },
    { staff: { name: { full: "Yuki Kajiura" } }, count: 6 },
  ],
  statuses: [
    { status: "COMPLETED", count: 180 },
    { status: "WATCHING", count: 15 },
    { status: "PLANNING", count: 45 },
    { status: "DROPPED", count: 10 },
  ],
  formats: [
    { format: "TV", count: 150 },
    { format: "MOVIE", count: 35 },
    { format: "OVA", count: 25 },
    { format: "SPECIAL", count: 20 },
    { format: "ONA", count: 20 },
  ],
  scores: [
    { score: 10, count: 8 },
    { score: 9, count: 22 },
    { score: 8, count: 45 },
    { score: 7, count: 58 },
    { score: 6, count: 32 },
    { score: 5, count: 18 },
  ],
  releaseYears: [
    { releaseYear: 2024, count: 25 },
    { releaseYear: 2023, count: 42 },
    { releaseYear: 2022, count: 38 },
    { releaseYear: 2021, count: 30 },
    { releaseYear: 2020, count: 28 },
  ],
  countries: [
    { country: "JP", count: 235 },
    { country: "CN", count: 10 },
    { country: "KR", count: 5 },
  ],
};

/**
 * Mock manga statistics for E2E tests.
 */
export const mockMangaStats: MangaStats = {
  count: 120,
  chaptersRead: 5200,
  volumesRead: 180,
  meanScore: 78.2,
  standardDeviation: 10.5,
  genres: [
    { genre: "Action", count: 45 },
    { genre: "Adventure", count: 38 },
    { genre: "Comedy", count: 32 },
    { genre: "Drama", count: 28 },
    { genre: "Fantasy", count: 35 },
    { genre: "Romance", count: 22 },
  ],
  tags: [
    { tag: { name: "Shounen" }, count: 35 },
    { tag: { name: "Seinen" }, count: 28 },
    { tag: { name: "Isekai" }, count: 15 },
    { tag: { name: "School" }, count: 20 },
  ],
  staff: [
    { staff: { name: { full: "Eiichiro Oda" } }, count: 1 },
    { staff: { name: { full: "Akira Toriyama" } }, count: 2 },
    { staff: { name: { full: "Hajime Isayama" } }, count: 1 },
  ],
  statuses: [
    { status: "COMPLETED", count: 85 },
    { status: "READING", count: 12 },
    { status: "PLANNING", count: 18 },
    { status: "DROPPED", count: 5 },
  ],
  formats: [
    { format: "MANGA", count: 95 },
    { format: "ONE_SHOT", count: 15 },
    { format: "NOVEL", count: 10 },
  ],
  scores: [
    { score: 10, count: 5 },
    { score: 9, count: 15 },
    { score: 8, count: 32 },
    { score: 7, count: 38 },
    { score: 6, count: 20 },
  ],
  releaseYears: [
    { releaseYear: 2024, count: 12 },
    { releaseYear: 2023, count: 18 },
    { releaseYear: 2022, count: 22 },
  ],
  countries: [
    { country: "JP", count: 110 },
    { country: "KR", count: 8 },
    { country: "CN", count: 2 },
  ],
};

/**
 * Mock user stats data matching AniList GraphQL response structure.
 */
export const mockUserStatsData: UserStatsData = {
  User: {
    stats: {
      activityHistory: [
        { date: 1700000000, amount: 5 },
        { date: 1700086400, amount: 3 },
        { date: 1700172800, amount: 8 },
        { date: 1700259200, amount: 2 },
        { date: 1700345600, amount: 6 },
      ],
    },
    favourites: {
      staff: {
        nodes: [
          { id: 95185, name: { full: "Hiroyuki Sawano" } },
          { id: 96413, name: { full: "Yuki Kajiura" } },
          { id: 95586, name: { full: "Kevin Penkin" } },
        ],
      },
      studios: {
        nodes: [
          { id: 43, name: "ufotable" },
          { id: 569, name: "MAPPA" },
          { id: 4, name: "Bones" },
        ],
      },
      characters: {
        nodes: [
          { id: 40882, name: { full: "Levi Ackerman" } },
          { id: 36765, name: { full: "Killua Zoldyck" } },
          { id: 71, name: { full: "Edward Elric" } },
        ],
      },
    },
    statistics: {
      anime: mockAnimeStats,
      manga: mockMangaStats,
    },
  },
  followersPage: {
    pageInfo: { total: 156 },
    followers: [{ id: 1 }, { id: 2 }, { id: 3 }],
  },
  followingPage: {
    pageInfo: { total: 89 },
    following: [{ id: 4 }, { id: 5 }, { id: 6 }],
  },
  threadsPage: {
    pageInfo: { total: 12 },
    threads: [{ id: 100 }, { id: 101 }],
  },
  threadCommentsPage: {
    pageInfo: { total: 245 },
    threadComments: [{ id: 200 }, { id: 201 }],
  },
  reviewsPage: {
    pageInfo: { total: 8 },
    reviews: [{ id: 300 }],
  },
};

/**
 * Mock user record for a test user.
 * This is the structure stored in Redis as `user:{userId}`.
 */
export const mockUserRecord: UserRecord = {
  userId: "123456",
  username: "TestUser",
  stats: mockUserStatsData,
  ip: "127.0.0.1",
  createdAt: "2024-01-15T10:00:00.000Z",
  updatedAt: "2024-12-01T15:30:00.000Z",
};

/**
 * Mock cards record for a test user.
 * This is the structure stored in Redis as `cards:{userId}`.
 */
export const mockCardsRecord: CardsRecord = {
  userId: 123456,
  cards: [
    {
      cardName: "animeStats",
      variation: "default",
      colorPreset: "default",
      titleColor: "#ffffff",
      backgroundColor: "#1a1a2e",
      textColor: "#eaeaea",
      circleColor: "#4a9eff",
    },
    {
      cardName: "socialStats",
      variation: "default",
      colorPreset: "default",
      titleColor: "#ffffff",
      backgroundColor: "#1a1a2e",
      textColor: "#eaeaea",
      circleColor: "#4a9eff",
    },
  ],
  updatedAt: "2024-12-01T15:30:00.000Z",
};

/**
 * Mock user record for a user with no data (edge case testing).
 */
export const mockEmptyUserRecord: UserRecord = {
  userId: "999999",
  username: "EmptyUser",
  stats: {
    User: {
      stats: {
        activityHistory: [],
      },
      favourites: {
        staff: { nodes: [] },
        studios: { nodes: [] },
        characters: { nodes: [] },
      },
      statistics: {
        anime: {
          count: 0,
          episodesWatched: 0,
          minutesWatched: 0,
          meanScore: 0,
          standardDeviation: 0,
          genres: [],
          tags: [],
          voiceActors: [],
          studios: [],
          staff: [],
          statuses: [],
          formats: [],
          scores: [],
          releaseYears: [],
          countries: [],
        },
        manga: {
          count: 0,
          chaptersRead: 0,
          volumesRead: 0,
          meanScore: 0,
          standardDeviation: 0,
          genres: [],
          tags: [],
          staff: [],
          statuses: [],
          formats: [],
          scores: [],
          releaseYears: [],
          countries: [],
        },
      },
    },
    followersPage: { pageInfo: { total: 0 }, followers: [] },
    followingPage: { pageInfo: { total: 0 }, following: [] },
    threadsPage: { pageInfo: { total: 0 }, threads: [] },
    threadCommentsPage: { pageInfo: { total: 0 }, threadComments: [] },
    reviewsPage: { pageInfo: { total: 0 }, reviews: [] },
  },
  ip: "127.0.0.1",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

/**
 * Mock error response for rate limiting.
 */
export const mockRateLimitError = {
  error: "Rate limit exceeded",
  message: "Too many requests. Please wait before trying again.",
  retryAfter: 60,
};

/**
 * Mock error response for user not found.
 */
export const mockUserNotFoundError = {
  error: "User not found",
  message: "The AniList username could not be found.",
};

/**
 * Mock error response for network/server errors.
 */
export const mockServerError = {
  error: "Server error",
  message: "An unexpected error occurred. Please try again later.",
};
