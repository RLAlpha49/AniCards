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
});
