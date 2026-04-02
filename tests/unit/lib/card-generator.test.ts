import { describe, expect, it } from "bun:test";

const expectedSvg =
  '<!--ANICARDS_TRUSTED_SVG--><svg data-template="media">Anime Stats</svg>';

const cardConfig = {
  cardName: "animeStats",
  variation: "default",
  titleColor: "#3cc8ff",
  backgroundColor: "#0b1622",
  textColor: "#E8E8E8",
  circleColor: "#3cc8ff",
};

const userRecord = {
  userId: "542244",
  username: "testUser",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  stats: {
    User: {
      statistics: {
        anime: {
          count: 1,
          episodesWatched: 12,
          minutesWatched: 24,
          meanScore: 80,
          standardDeviation: 0,
          genres: [],
          tags: [],
          voiceActors: [],
          studios: [],
          staff: [],
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
        },
      },
      favourites: {
        staff: { nodes: [] },
        studios: { nodes: [] },
      },
      stats: {
        activityHistory: [],
      },
    },
    followersPage: { pageInfo: { total: 0 }, followers: [] },
    followingPage: { pageInfo: { total: 0 }, following: [] },
    threadsPage: { pageInfo: { total: 0 }, threads: [] },
    threadCommentsPage: { pageInfo: { total: 0 }, threadComments: [] },
    reviewsPage: { pageInfo: { total: 0 }, reviews: [] },
  },
};

describe("card-generator lazy template loading", () => {
  it("defers unrelated template families until they are requested", async () => {
    const probeScript = `
import { mock } from "bun:test";

mock.module("@/lib/utils/milestones", () => ({
  calculateMilestones: mock(() => ({ milestone: 100 })),
}));

const mediaStatsTemplate = mock(() => ${JSON.stringify(expectedSvg)});
const loadMediaStatsModule = mock(() => ({ mediaStatsTemplate }));
const loadCurrentlyWatchingReadingModule = mock(() => ({
  currentlyWatchingReadingTemplate: mock(
    () => ${JSON.stringify(
      '<!--ANICARDS_TRUSTED_SVG--><svg data-template="current">Current</svg>',
    )},
  ),
}));

mock.module("@/lib/svg-templates/media-stats/shared", loadMediaStatsModule);
mock.module(
  "@/lib/svg-templates/completion-progress-stats/currently-watching-reading-template",
  loadCurrentlyWatchingReadingModule,
);

const { default: generateCardSvg } = await import("@/lib/card-generator");

const svg = await generateCardSvg(
  ${JSON.stringify(cardConfig)},
  ${JSON.stringify(userRecord)},
  "default",
);

console.log(
  JSON.stringify({
    svg,
    mediaLoaderCalls: loadMediaStatsModule.mock.calls.length,
    mediaTemplateCalls: mediaStatsTemplate.mock.calls.length,
    unrelatedLoaderCalls: loadCurrentlyWatchingReadingModule.mock.calls.length,
  }),
);
`;

    const subprocess = Bun.spawnSync({
      cmd: [process.execPath, "run", "-"],
      cwd: process.cwd(),
      stdin: new Blob([probeScript]),
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdout = new TextDecoder().decode(subprocess.stdout).trim();
    const stderr = new TextDecoder().decode(subprocess.stderr).trim();

    expect(subprocess.exitCode).toBe(0);
    expect(stderr).toBe("");

    const result = JSON.parse(stdout) as {
      mediaLoaderCalls: number;
      mediaTemplateCalls: number;
      svg: string;
      unrelatedLoaderCalls: number;
    };

    expect(result.mediaLoaderCalls).toBe(1);
    expect(result.mediaTemplateCalls).toBe(1);
    expect(result.unrelatedLoaderCalls).toBe(0);
    expect(result.svg).toContain('data-template="media"');
  });

  it("uses cache-only image preparation helpers for image-heavy cards", async () => {
    const profileOverviewConfig = {
      ...cardConfig,
      cardName: "profileOverview",
    };
    const favoritesGridConfig = {
      ...cardConfig,
      cardName: "favoritesGrid",
      gridCols: 1,
      gridRows: 1,
    };
    const currentlyWatchingReadingConfig = {
      ...cardConfig,
      cardName: "currentlyWatchingReading",
    };
    const renderHeavyUserRecord = {
      ...userRecord,
      stats: {
        ...userRecord.stats,
        User: {
          ...userRecord.stats.User,
          avatar: {
            medium:
              "https://s4.anilist.co/file/anilistcdn/user/avatar/test.png",
          },
          favourites: {
            anime: { nodes: [] },
            manga: { nodes: [] },
            characters: { nodes: [] },
            staff: {
              nodes: [
                {
                  id: 1,
                  image: {
                    large: "https://s4.anilist.co/file/anilistcdn/staff/1.jpg",
                  },
                  name: { full: "Staff One" },
                },
                {
                  id: 2,
                  image: {
                    large: "https://s4.anilist.co/file/anilistcdn/staff/2.jpg",
                  },
                  name: { full: "Staff Two" },
                },
              ],
            },
            studios: { nodes: [] },
          },
        },
        animeCurrent: {
          count: 1,
          lists: [
            {
              entries: [
                {
                  id: 10,
                  media: {
                    coverImage: {
                      large:
                        "https://s4.anilist.co/file/anilistcdn/media/anime/10.jpg",
                    },
                    id: 110,
                    title: { romaji: "Anime One" },
                  },
                  progress: 3,
                },
              ],
            },
          ],
        },
        mangaCurrent: {
          count: 1,
          lists: [
            {
              entries: [
                {
                  id: 20,
                  media: {
                    coverImage: {
                      large:
                        "https://s4.anilist.co/file/anilistcdn/media/manga/20.jpg",
                    },
                    id: 220,
                    title: { romaji: "Manga One" },
                  },
                  progress: 5,
                },
              ],
            },
          ],
        },
      },
    };

    const probeScript = `
import { mock } from "bun:test";

const fetchImageAsDataUrl = mock(async (_url, options) => {
  if (options?.cacheOnly) {
    return null;
  }

  return "data:image/png;base64,embedded";
});
const embedFavoritesGridImages = mock(async (favourites, variant, rows, cols, options) => {
  return favourites;
});
const embedMediaListCoverImages = mock(async (entries, options) => entries);

mock.module("@/lib/image-utils", () => ({
  embedFavoritesGridImages,
  embedMediaListCoverImages,
  fetchImageAsDataUrl,
}));

mock.module("@/lib/svg-templates/profile-favorite-stats/favorites-grid-template", () => ({
  favoritesGridTemplate: mock(() => '<!--ANICARDS_TRUSTED_SVG--><svg data-template="favorites" />'),
}));
mock.module("@/lib/svg-templates/profile-favorite-stats/favorites-summary-template", () => ({
  favoritesSummaryTemplate: mock(() => '<!--ANICARDS_TRUSTED_SVG--><svg data-template="favorites-summary" />'),
}));
mock.module("@/lib/svg-templates/profile-favorite-stats/profile-overview-template", () => ({
  profileOverviewTemplate: mock(() => '<!--ANICARDS_TRUSTED_SVG--><svg data-template="profile" />'),
}));

mock.module("@/lib/svg-templates/completion-progress-stats/currently-watching-reading-template", () => ({
  currentlyWatchingReadingTemplate: mock(() => '<!--ANICARDS_TRUSTED_SVG--><svg data-template="current" />'),
}));
mock.module("@/lib/svg-templates/completion-progress-stats/milestones-template", () => ({
  milestonesTemplate: mock(() => '<!--ANICARDS_TRUSTED_SVG--><svg data-template="milestones" />'),
}));
mock.module("@/lib/svg-templates/completion-progress-stats/most-rewatched-template", () => ({
  mostRewatchedTemplate: mock(() => '<!--ANICARDS_TRUSTED_SVG--><svg data-template="most-rewatched" />'),
}));
mock.module("@/lib/svg-templates/completion-progress-stats/personal-records-template", () => ({
  personalRecordsTemplate: mock(() => '<!--ANICARDS_TRUSTED_SVG--><svg data-template="personal-records" />'),
}));
mock.module("@/lib/svg-templates/completion-progress-stats/planning-backlog-template", () => ({
  planningBacklogTemplate: mock(() => '<!--ANICARDS_TRUSTED_SVG--><svg data-template="planning-backlog" />'),
}));
mock.module("@/lib/svg-templates/completion-progress-stats/status-completion-overview-template", () => ({
  statusCompletionOverviewTemplate: mock(() => '<!--ANICARDS_TRUSTED_SVG--><svg data-template="status-completion" />'),
}));

const { default: generateCardSvg } = await import("@/lib/card-generator");

await generateCardSvg(
  ${JSON.stringify(profileOverviewConfig)},
  ${JSON.stringify(renderHeavyUserRecord)},
  "default",
);
await generateCardSvg(
  ${JSON.stringify(favoritesGridConfig)},
  ${JSON.stringify(renderHeavyUserRecord)},
  "staff",
);
await generateCardSvg(
  ${JSON.stringify(currentlyWatchingReadingConfig)},
  ${JSON.stringify(renderHeavyUserRecord)},
  "default",
);

console.log(
  JSON.stringify({
    currentEmbedCalls: embedMediaListCoverImages.mock.calls,
    favoritesEmbedCalls: embedFavoritesGridImages.mock.calls,
    fetchCalls: fetchImageAsDataUrl.mock.calls,
  }),
);
`;

    const subprocess = Bun.spawnSync({
      cmd: [process.execPath, "run", "-"],
      cwd: process.cwd(),
      stdin: new Blob([probeScript]),
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdout = new TextDecoder().decode(subprocess.stdout).trim();
    const stderr = new TextDecoder().decode(subprocess.stderr).trim();

    expect(subprocess.exitCode).toBe(0);
    expect(stderr).toBe("");

    const result = JSON.parse(stdout) as {
      currentEmbedCalls: Array<[unknown[], { cacheOnly?: boolean }]>;
      favoritesEmbedCalls: Array<
        [unknown, string, number, number, { cacheOnly?: boolean }]
      >;
      fetchCalls: Array<[string, { cacheOnly?: boolean }]>;
    };

    expect(result.fetchCalls).toEqual([
      [
        "https://s4.anilist.co/file/anilistcdn/user/avatar/test.png",
        { cacheOnly: true },
      ],
    ]);
    expect(result.favoritesEmbedCalls).toHaveLength(1);
    expect(result.favoritesEmbedCalls[0]?.[1]).toBe("staff");
    expect(result.favoritesEmbedCalls[0]?.[2]).toBe(1);
    expect(result.favoritesEmbedCalls[0]?.[3]).toBe(1);
    expect(result.favoritesEmbedCalls[0]?.[4]).toEqual({ cacheOnly: true });
    expect(result.currentEmbedCalls).toHaveLength(2);
    expect(result.currentEmbedCalls[0]?.[1]).toEqual({ cacheOnly: true });
    expect(result.currentEmbedCalls[1]?.[1]).toEqual({ cacheOnly: true });
  });

  it("injects a static render override when animations are disabled", async () => {
    const probeScript = `
const { default: generateCardSvg } = await import("@/lib/card-generator");

const svg = await generateCardSvg(
  ${JSON.stringify(cardConfig)},
  ${JSON.stringify(userRecord)},
  "default",
  undefined,
  { animationsEnabled: false },
);

console.log(JSON.stringify({ svg }));
`;

    const subprocess = Bun.spawnSync({
      cmd: [process.execPath, "run", "-"],
      cwd: process.cwd(),
      stdin: new Blob([probeScript]),
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdout = new TextDecoder().decode(subprocess.stdout).trim();
    const stderr = new TextDecoder().decode(subprocess.stderr).trim();

    expect(subprocess.exitCode).toBe(0);
    expect(stderr).toBe("");

    const result = JSON.parse(stdout) as { svg: string };

    expect(result.svg).toContain('data-anicards-render-mode="static"');
    expect(result.svg).toContain("animation: none !important");
    expect(result.svg).not.toContain("@keyframes rankAnimation");
  });
});
