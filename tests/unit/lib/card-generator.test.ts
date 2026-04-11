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

  it("loads only the requested template module inside split families and caches it once", async () => {
    const comparativeCardConfig = {
      ...cardConfig,
      cardName: "animeMangaOverview",
    };
    const milestonesCardConfig = {
      ...cardConfig,
      cardName: "milestones",
    };
    const profileOverviewCardConfig = {
      ...cardConfig,
      cardName: "profileOverview",
    };

    const probeScript = `
import { mock } from "bun:test";

mock.module("@/lib/utils/milestones", () => ({
  calculateMilestones: mock(() => ({ milestone: 100 })),
}));

const loadAnimeMangaOverviewModule = mock(() => ({
  animeMangaOverviewTemplate: mock(
    () => '<!--ANICARDS_TRUSTED_SVG--><svg data-template="anime-manga-overview" />',
  ),
}));
const loadCountryDiversityModule = mock(() => ({
  countryDiversityTemplate: mock(
    () => '<!--ANICARDS_TRUSTED_SVG--><svg data-template="country-diversity" />',
  ),
}));
const loadMilestonesModule = mock(() => ({
  milestonesTemplate: mock(
    () => '<!--ANICARDS_TRUSTED_SVG--><svg data-template="milestones" />',
  ),
}));
const loadCurrentlyWatchingReadingModule = mock(() => ({
  currentlyWatchingReadingTemplate: mock(
    () => '<!--ANICARDS_TRUSTED_SVG--><svg data-template="current" />',
  ),
}));
const loadProfileOverviewModule = mock(() => ({
  profileOverviewTemplate: mock(
    () => '<!--ANICARDS_TRUSTED_SVG--><svg data-template="profile-overview" />',
  ),
}));
const loadFavoritesGridModule = mock(() => ({
  favoritesGridTemplate: mock(
    () => '<!--ANICARDS_TRUSTED_SVG--><svg data-template="favorites-grid" />',
  ),
}));

mock.module(
  "@/lib/svg-templates/comparative-distribution-stats/anime-manga-overview-template",
  loadAnimeMangaOverviewModule,
);
mock.module(
  "@/lib/svg-templates/comparative-distribution-stats/country-diversity-template",
  loadCountryDiversityModule,
);
mock.module(
  "@/lib/svg-templates/completion-progress-stats/milestones-template",
  loadMilestonesModule,
);
mock.module(
  "@/lib/svg-templates/completion-progress-stats/currently-watching-reading-template",
  loadCurrentlyWatchingReadingModule,
);
mock.module(
  "@/lib/svg-templates/profile-favorite-stats/profile-overview-template",
  loadProfileOverviewModule,
);
mock.module(
  "@/lib/svg-templates/profile-favorite-stats/favorites-grid-template",
  loadFavoritesGridModule,
);

const { default: generateCardSvg } = await import("@/lib/card-generator");

const comparativeSvg1 = await generateCardSvg(
  ${JSON.stringify(comparativeCardConfig)},
  ${JSON.stringify(userRecord)},
  "default",
);
const comparativeSvg2 = await generateCardSvg(
  ${JSON.stringify(comparativeCardConfig)},
  ${JSON.stringify(userRecord)},
  "default",
);
const milestonesSvg1 = await generateCardSvg(
  ${JSON.stringify(milestonesCardConfig)},
  ${JSON.stringify(userRecord)},
  "default",
);
const milestonesSvg2 = await generateCardSvg(
  ${JSON.stringify(milestonesCardConfig)},
  ${JSON.stringify(userRecord)},
  "default",
);
const profileSvg1 = await generateCardSvg(
  ${JSON.stringify(profileOverviewCardConfig)},
  ${JSON.stringify(userRecord)},
  "default",
);
const profileSvg2 = await generateCardSvg(
  ${JSON.stringify(profileOverviewCardConfig)},
  ${JSON.stringify(userRecord)},
  "default",
);

console.log(
  JSON.stringify({
    comparativeRequestedCalls: loadAnimeMangaOverviewModule.mock.calls.length,
    comparativeSiblingCalls: loadCountryDiversityModule.mock.calls.length,
    completionRequestedCalls: loadMilestonesModule.mock.calls.length,
    completionSiblingCalls: loadCurrentlyWatchingReadingModule.mock.calls.length,
    profileRequestedCalls: loadProfileOverviewModule.mock.calls.length,
    profileSiblingCalls: loadFavoritesGridModule.mock.calls.length,
    comparativeSvg1,
    comparativeSvg2,
    milestonesSvg1,
    milestonesSvg2,
    profileSvg1,
    profileSvg2,
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
      comparativeRequestedCalls: number;
      comparativeSiblingCalls: number;
      completionRequestedCalls: number;
      completionSiblingCalls: number;
      profileRequestedCalls: number;
      profileSiblingCalls: number;
      comparativeSvg1: string;
      comparativeSvg2: string;
      milestonesSvg1: string;
      milestonesSvg2: string;
      profileSvg1: string;
      profileSvg2: string;
    };

    expect(result.comparativeRequestedCalls).toBe(1);
    expect(result.comparativeSiblingCalls).toBe(0);
    expect(result.completionRequestedCalls).toBe(1);
    expect(result.completionSiblingCalls).toBe(0);
    expect(result.profileRequestedCalls).toBe(1);
    expect(result.profileSiblingCalls).toBe(0);
    expect(result.comparativeSvg1).toContain(
      'data-template="anime-manga-overview"',
    );
    expect(result.comparativeSvg2).toContain(
      'data-template="anime-manga-overview"',
    );
    expect(result.milestonesSvg1).toContain('data-template="milestones"');
    expect(result.milestonesSvg2).toContain('data-template="milestones"');
    expect(result.profileSvg1).toContain('data-template="profile-overview"');
    expect(result.profileSvg2).toContain('data-template="profile-overview"');
  });

  it("initializes the server pretext runtime before rendering cards", async () => {
    const probeScript = `
import { mock } from "bun:test";

mock.module("@/lib/utils/milestones", () => ({
  calculateMilestones: mock(() => ({ milestone: 100 })),
}));

const events = [];
const initializeServerPretext = mock(async () => {
  events.push("init");
  return true;
});
mock.module("@/lib/pretext/server", () => ({
  initializeServerPretext,
}));

const mediaStatsTemplate = mock(() => {
  events.push("render");
  return ${JSON.stringify(expectedSvg)};
});
mock.module("@/lib/svg-templates/media-stats/shared", () => ({
  mediaStatsTemplate,
}));

const { default: generateCardSvg } = await import("@/lib/card-generator");

const svg = await generateCardSvg(
  ${JSON.stringify(cardConfig)},
  ${JSON.stringify(userRecord)},
  "default",
);

console.log(
  JSON.stringify({
    initCalls: initializeServerPretext.mock.calls.length,
    events,
    svg,
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
      events: string[];
      initCalls: number;
      svg: string;
    };

    expect(result.initCalls).toBe(1);
    expect(result.events[0]).toBe("init");
    expect(result.events).toContain("render");
    expect(result.svg).toContain('data-template="media"');
  });

  it("embeds image-heavy cards without cache-only fallbacks", async () => {
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
      fetchCalls: Array<[string, { cacheOnly?: boolean }?]>;
    };

    expect(result.fetchCalls).toEqual([
      ["https://s4.anilist.co/file/anilistcdn/user/avatar/test.png"],
    ]);
    expect(result.favoritesEmbedCalls).toHaveLength(1);
    expect(result.favoritesEmbedCalls[0]?.[1]).toBe("staff");
    expect(result.favoritesEmbedCalls[0]?.[2]).toBe(1);
    expect(result.favoritesEmbedCalls[0]?.[3]).toBe(1);
    expect(result.favoritesEmbedCalls[0]?.[4]).toBeUndefined();
    expect(result.currentEmbedCalls).toHaveLength(2);
    expect(result.currentEmbedCalls[0]?.[1]).toBeUndefined();
    expect(result.currentEmbedCalls[1]?.[1]).toBeUndefined();
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
