/* eslint-disable no-var */
/**
 * This test file covers the GET handler for the card SVG endpoint.
 * It mocks external dependencies such as the rate limiter, Redis, and external utility/template functions.
 */

// Declare mockLimit in the outer scope so tests can access it.
var mockLimit = jest.fn().mockResolvedValue({ success: true });
var mockRedisGet = jest.fn();

jest.mock("@upstash/redis", () => {
  return {
    Redis: {
      fromEnv: jest.fn(() => ({
        get: mockRedisGet,
        incr: jest.fn(() => Promise.resolve(1)),
      })),
    },
  };
});

import { GET } from "./route";

// --- Mocks for external dependencies --- //
jest.mock("@upstash/ratelimit", () => {
  const RatelimitMock = jest.fn().mockImplementation(() => ({
    limit: mockLimit,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  })) as any;
  RatelimitMock.slidingWindow = jest.fn();
  return {
    Ratelimit: RatelimitMock,
  };
});

jest.mock("@/lib/utils/milestones", () => ({
  calculateMilestones: jest.fn(() => ({ milestone: 100 })),
}));

jest.mock("@/lib/svg-templates/media-stats", () => ({
  mediaStatsTemplate: jest.fn(() => "<svg>Anime Stats</svg>"),
}));

// NEW: Added mock for social stats template.
jest.mock("@/lib/svg-templates/social-stats", () => ({
  socialStatsTemplate: jest.fn(() => "<svg>Social Stats</svg>"),
}));

// NEW: Added mock for extra anime/manga stats template.
jest.mock("@/lib/svg-templates/extra-anime-manga-stats", () => ({
  extraAnimeMangaStatsTemplate: jest.fn(() => "<svg>Extra Stats</svg>"),
}));

jest.mock("@/lib/utils", () => ({
  safeParse: (str: string) => JSON.parse(str),
  // Keep calculateMilestones from the dedicated module above.
}));

// Helper functions to reduce code duplication
async function getResponseText(response: Response): Promise<string> {
  return response.text();
}

// Helper to create mock card data
function createMockCardData(cardName: string, variation = "default") {
  return JSON.stringify({
    cards: [
      {
        cardName,
        variation,
        titleColor: "#3cc8ff",
        backgroundColor: "#0b1622",
        textColor: "#E8E8E8",
        circleColor: "#3cc8ff",
      },
    ],
  });
}

// Helper to create mock user data with different stat structures
function createMockUserData(
  userId: number,
  username: string,
  statsOverride?: Record<string, unknown>,
) {
  const defaultStats = {
    User: {
      statistics: {
        anime: {},
        manga: {},
      },
      stats: {
        activityHistory: [{ date: 1, amount: 1 }],
      },
    },
    followersPage: { pageInfo: { total: 1 }, followers: [{ id: 1 }] },
    followingPage: { pageInfo: { total: 1 }, following: [{ id: 1 }] },
    threadsPage: { pageInfo: { total: 1 }, threads: [{ id: 1 }] },
    threadCommentsPage: {
      pageInfo: { total: 1 },
      threadComments: [{ id: 1 }],
    },
    reviewsPage: { pageInfo: { total: 1 }, reviews: [{ id: 1 }] },
  };

  return JSON.stringify({
    userId,
    username,
    stats: statsOverride || defaultStats,
  });
}

// Helper to create request URL
function createRequestUrl(baseUrl: string, params: Record<string, string>) {
  const url = new URL(baseUrl);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return url.toString();
}

// Helper to setup successful mocks
function setupSuccessfulMocks(cardsData: string, userData: string) {
  mockRedisGet.mockResolvedValueOnce(cardsData).mockResolvedValueOnce(userData);
}

// Helper to validate successful SVG response
async function expectSuccessfulSvgResponse(res: Response, expectedSvg: string) {
  expect(res.status).toBe(200);
  expect(res.headers.get("Content-Type")).toBe("image/svg+xml");
  const text = await getResponseText(res);
  expect(text).toBe(expectedSvg);
}

// Helper to validate error response
async function expectErrorResponse(res: Response, expectedError: string) {
  expect(res.status).toBe(200);
  const text = await getResponseText(res);
  expect(text).toContain(expectedError);
}

describe("Card SVG GET Endpoint", () => {
  const baseUrl = "http://localhost/api/card.svg";

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return rate limit error when limit exceeded", async () => {
    // Simulate rate limiter failure.
    mockLimit.mockResolvedValueOnce({ success: false });
    mockRedisGet.mockClear();

    const req = new Request(createRequestUrl(baseUrl, { userId: "542244" }));

    const res = await GET(req);
    await expectErrorResponse(res, "Too many requests - try again later");
  });

  it("should return error for missing parameters", async () => {
    // Missing cardType.
    const req = new Request(createRequestUrl(baseUrl, { userId: "542244" }));

    const res = await GET(req);
    await expectErrorResponse(res, "Missing parameters");
  });

  it("should return error for invalid card type", async () => {
    // Provide a cardType that is not allowed.
    const req = new Request(
      createRequestUrl(baseUrl, { userId: "542244", cardType: "invalidType" }),
    );

    const res = await GET(req);
    await expectErrorResponse(res, "Invalid card type");
  });

  it("should return error for invalid user ID format", async () => {
    // userId that cannot be parsed as a number.
    const req = new Request(
      createRequestUrl(baseUrl, { userId: "abc", cardType: "animeStats" }),
    );
    const res = await GET(req);
    await expectErrorResponse(res, "Invalid user ID");
  });

  it("should return error if user data is not found in Redis", async () => {
    // Simulate Redis missing one of the keys.
    const userData = createMockUserData(542244, "testUser");
    mockRedisGet.mockResolvedValueOnce(null).mockResolvedValueOnce(userData);

    const req = new Request(
      createRequestUrl(baseUrl, { userId: "542244", cardType: "animeStats" }),
    );
    const res = await GET(req);
    await expectErrorResponse(res, "User data not found");
  });

  it("should return error when card config is not found", async () => {
    // Return valid user record.
    const userData = createMockUserData(542244, "testUser");
    // Return a cards record that does not include the requested card config.
    const cardsData = JSON.stringify({
      cards: [
        {
          cardName: "otherCard",
          titleColor: "#000",
          backgroundColor: "#fff",
          textColor: "#333",
          circleColor: "#f00",
        },
      ],
    });
    mockRedisGet
      .mockResolvedValueOnce(cardsData)
      .mockResolvedValueOnce(userData);

    const req = new Request(
      createRequestUrl(baseUrl, { userId: "542244", cardType: "animeStats" }),
    );
    const res = await GET(req);
    await expectErrorResponse(res, "Card config not found");
  });

  it("should successfully generate SVG content", async () => {
    const cardsData = createMockCardData("animeStats", "default");
    const userData = createMockUserData(542244, "testUser", {
      User: { statistics: { anime: {} } },
    });
    setupSuccessfulMocks(cardsData, userData);

    const req = new Request(
      createRequestUrl(baseUrl, {
        userId: "542244",
        cardType: "animeStats",
        variation: "default",
      }),
    );
    const res = await GET(req);
    await expectSuccessfulSvgResponse(res, "<svg>Anime Stats</svg>");
  });

  it("should return server error when SVG generation fails (inner try)", async () => {
    // Provide a valid cards record.
    const cardsData = createMockCardData("animeStats", "default");
    // Provide a user record missing the required stats (will cause generateCardSVG to throw).
    const userData = createMockUserData(123, "testUser", {}); // missing User.statistics.anime
    setupSuccessfulMocks(cardsData, userData);

    const req = new Request(
      createRequestUrl(baseUrl, {
        userId: "123",
        cardType: "animeStats",
        variation: "default",
      }),
      {
        headers: { "x-forwarded-for": "127.0.0.1" },
      },
    );
    const res = await GET(req);
    await expectErrorResponse(res, "Server Error");
  });

  it("should return server error when an outer error occurs", async () => {
    // Simulate Redis throwing an error.
    mockRedisGet.mockRejectedValueOnce(new Error("Redis error"));
    const req = new Request(
      createRequestUrl(baseUrl, { userId: "123", cardType: "animeStats" }),
    );
    const res = await GET(req);
    await expectErrorResponse(res, "Server Error");
  });
});
