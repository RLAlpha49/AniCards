/**
 * This test file covers the GET handler for the card SVG endpoint.
 * It mocks external dependencies such as the rate limiter, Redis, and external utility/template functions.
 * @source
 */

/**
 * Mock implementation of the rate limiter's limit method.
 * @source
 */
let mockLimit = jest.fn().mockResolvedValue({ success: true });

/**
 * Mock for Redis GET operations.
 * @source
 */
let mockRedisGet = jest.fn();

/**
 * Mock for Redis SET operations.
 * @source
 */
let mockRedisSet = jest.fn();

function createRedisFromEnvMock() {
  return {
    get: mockRedisGet,
    set: mockRedisSet,
    incr: jest.fn(async () => 1),
  };
}

jest.mock("@upstash/redis", () => ({
  Redis: {
    fromEnv: jest.fn(createRedisFromEnvMock),
  },
}));

import { GET } from "./route";

// --- Mocks for external dependencies --- //
jest.mock("@upstash/ratelimit", () => {
  class RatelimitMock {
    static readonly slidingWindow = jest.fn();
    public limit = mockLimit;
  }
  return {
    Ratelimit: RatelimitMock,
  };
});

jest.mock("@/lib/utils/milestones", () => ({
  calculateMilestones: jest.fn(() => ({ milestone: 100 })),
}));

jest.mock("@/lib/svg-templates/media-stats", () => ({
  mediaStatsTemplate: jest.fn(
    (data: { styles?: { borderColor?: string } }) =>
      `<!--ANICARDS_TRUSTED_SVG-->` +
      `<svg data-template="media" stroke="${data.styles?.borderColor ?? "none"}">Anime Stats</svg>`,
  ),
}));

// NEW: Added mock for social stats template.
jest.mock("@/lib/svg-templates/social-stats", () => ({
  socialStatsTemplate: jest.fn(
    (data: { styles?: { borderColor?: string } }) =>
      `<svg data-template="social" stroke="${data.styles?.borderColor ?? "none"}">Social Stats</svg>`,
  ),
}));

// NEW: Added mock for extra anime/manga stats template.
jest.mock("@/lib/svg-templates/extra-anime-manga-stats", () => ({
  extraAnimeMangaStatsTemplate: jest.fn(
    (data: {
      styles?: { borderColor?: string };
      fixedStatusColors?: boolean;
      showPiePercentages?: boolean;
    }) =>
      `<svg data-template="extra" stroke="${data.styles?.borderColor ?? "none"}" fixedStatusColors="${data.fixedStatusColors ?? false}" showPiePercentages="${data.showPiePercentages ?? false}">Extra Stats</svg>`,
  ),
}));

jest.mock("@/lib/svg-templates/distribution", () => ({
  distributionTemplate: jest.fn(
    (data: { styles?: { borderColor?: string } }) =>
      `<svg data-template="distribution" stroke="${data.styles?.borderColor ?? "none"}">Distribution</svg>`,
  ),
}));

// Import the mocked template to assert call arguments
import { extraAnimeMangaStatsTemplate } from "@/lib/svg-templates/extra-anime-manga-stats";
import { mediaStatsTemplate } from "@/lib/svg-templates/media-stats";
// distributionTemplate may be mocked in tests above; no direct import needed here
import { POST as storeCardsPOST } from "@/app/api/store-cards/route";

jest.mock("@/lib/utils", () => {
  const actual = jest.requireActual("@/lib/utils");
  return {
    ...actual,
    safeParse: (str: string) => JSON.parse(str),
    extractStyles: jest.fn((cardConfig: Partial<Record<string, unknown>>) => ({
      titleColor: cardConfig.titleColor,
      backgroundColor: cardConfig.backgroundColor,
      textColor: cardConfig.textColor,
      circleColor: cardConfig.circleColor,
      borderColor: cardConfig.borderColor,
    })),
  };
});

/**
 * Reads the text body from a Response for later assertion.
 * @param response - Response object to extract text from.
 * @returns Promise resolving to the response body string.
 * @source
 */
async function getResponseText(response: Response): Promise<string> {
  return response.text();
}

/**
 * Builds a serialized card configuration payload for Redis mocks.
 * @param cardName - Name of the card to simulate.
 * @param variation - Optional variation string.
 * @param extra - Additional fields to merge into the generated card.
 * @returns JSON string matching the stored card document shape.
 * @source
 */
function createMockCardData(
  cardName: string,
  variation = "default",
  extra: Record<string, unknown> = {},
) {
  return JSON.stringify({
    cards: [
      {
        cardName,
        variation,
        titleColor: "#3cc8ff",
        backgroundColor: "#0b1622",
        textColor: "#E8E8E8",
        circleColor: "#3cc8ff",
        // Include optional persisted flags that are part of the runtime card shape
        borderColor: undefined,
        useStatusColors: undefined,
        showPiePercentages: undefined,
        ...extra,
      },
    ],
  });
}

/**
 * Builds a serialized AniList user document with customizable statistics.
 * @param userId - AniList user ID used by Redis keys.
 * @param username - Username returned in the mocked record.
 * @param statsOverride - Optional stats overrides for the mock.
 * @returns JSON string matching the stored user record shape.
 * @source
 */
function createMockUserData(
  userId: number | string,
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
    userId: String(userId),
    username,
    stats: statsOverride || defaultStats,
    ip: "127.0.0.1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Constructs a URL string with query parameters for the test requests.
 * @param baseUrl - Base endpoint for the card SVG API.
 * @param params - Key/value pairs to include as query parameters.
 * @returns Fully qualified URL string ready for Request objects.
 * @source
 */
function createRequestUrl(baseUrl: string, params: Record<string, string>) {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

/**
 * Configures Redis GET to return the provided cards and user payloads.
 * @param cardsData - Serialized cards document returned first.
 * @param userData - Serialized user document returned second.
 * @source
 */
function setupSuccessfulMocks(cardsData: string, userData: string) {
  mockRedisGet.mockResolvedValueOnce(cardsData).mockResolvedValueOnce(userData);
}

/**
 * Asserts an SVG response succeeded and optionally matches the expected text.
 * @param res - Response returned by the GET handler.
 * @param expectedSvg - Expected SVG markup to compare against.
 * @param bodyText - Optional pre-read body text to reuse.
 * @returns Promise that resolves once assertions complete.
 * @source
 */
async function expectSuccessfulSvgResponse(
  res: Response,
  expectedSvg: string,
  bodyText?: string,
) {
  expect(res.status).toBe(200);
  expect(res.headers.get("Content-Type")).toBe("image/svg+xml");
  expect(res.headers.get("Vary")).toBe("Origin");
  const text = bodyText ?? (await getResponseText(res));
  expect(text).toBe(expectedSvg);
}

/**
 * Asserts a response contains the expected SVG error message.
 * @param res - Response returned by the GET handler.
 * @param expectedError - Substring expected inside the SVG error
 * @param expectedStatus - HTTP status code expected for the error.
 * @returns Promise that resolves once assertions complete.
 * @source
 */
async function expectErrorResponse(
  res: Response,
  expectedError: string,
  expectedStatus = 400,
) {
  expect(res.status).toBe(expectedStatus);
  expect(res.headers.get("Content-Type")).toBe("image/svg+xml");
  expect(res.headers.get("Vary")).toBe("Origin");
  const text = await getResponseText(res);
  expect(text).toContain(expectedError);
}

describe("Card SVG GET Endpoint", () => {
  /**
   * Base URL used for constructing test requests.
   * @source
   */
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
    await expectErrorResponse(res, "Too many requests - try again later", 429);
  });

  it("should return error for missing parameters", async () => {
    // Missing cardType.
    const req = new Request(createRequestUrl(baseUrl, { userId: "542244" }));

    const res = await GET(req);
    await expectErrorResponse(res, "Missing parameters", 400);
  });

  it("should return error for invalid card type", async () => {
    // Provide a cardType that is not allowed.
    const req = new Request(
      createRequestUrl(baseUrl, { userId: "542244", cardType: "invalidType" }),
    );

    const res = await GET(req);
    await expectErrorResponse(res, "Invalid card type", 400);
  });

  it("should return error for invalid user ID format", async () => {
    // userId that cannot be parsed as a number.
    const req = new Request(
      createRequestUrl(baseUrl, { userId: "abc", cardType: "animeStats" }),
    );
    const res = await GET(req);
    await expectErrorResponse(res, "Invalid user ID", 400);
  });

  it("should return error if user data is not found in Redis", async () => {
    // Simulate Redis missing one of the keys.
    const userData = createMockUserData(542244, "testUser");
    mockRedisGet.mockResolvedValueOnce(null).mockResolvedValueOnce(userData);

    const req = new Request(
      createRequestUrl(baseUrl, { userId: "542244", cardType: "animeStats" }),
    );
    const res = await GET(req);
    await expectErrorResponse(res, "User data not found", 404);
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
    await expectErrorResponse(res, "Card config not found", 404);
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
    const body = await getResponseText(res);
    await expectSuccessfulSvgResponse(
      res,
      `<svg data-template="media" stroke="none">Anime Stats</svg>`,
      body,
    );

    // Assert the template is called with only style subset (no persisted flags)
    expect(mediaStatsTemplate).toHaveBeenCalled();
    const callArgs = (mediaStatsTemplate as jest.Mock).mock.calls[0][0];
    expect(callArgs.styles).toHaveProperty("titleColor");
    expect(callArgs.styles).toHaveProperty("backgroundColor");
    expect(callArgs.styles).toHaveProperty("textColor");
    expect(callArgs.styles).toHaveProperty("circleColor");

    expect(callArgs.styles.showPiePercentages).toBeUndefined();
    expect(callArgs.styles.useStatusColors).toBeUndefined();

    const templateReturn = (mediaStatsTemplate as jest.Mock).mock.results[0]
      .value as string;
    expect(
      templateReturn.startsWith("<!--ANICARDS_TRUSTED_SVG-->"),
    ).toBeTruthy();
    expect(body).not.toContain("ANICARDS_TRUSTED_SVG");
  });

  it("should include stroke attribute when card has borderColor set", async () => {
    const cardsData = createMockCardData("animeStats", "default", {
      borderColor: "#ff00ff",
    });
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
    const body = await getResponseText(res);
    expect(res.status).toBe(200);
    expect(body).toContain('stroke="#ff00ff"');

    // The template should have been invoked with the borderColor set
    expect(mediaStatsTemplate).toHaveBeenCalled();
    const callArgs = (mediaStatsTemplate as jest.Mock).mock.calls[0][0];
    expect(callArgs.styles.borderColor).toBe("#ff00ff");
  });

  it("should propagate statusColors and piePercentages flags to extra template for status distribution cards", async () => {
    const cardsData = createMockCardData("animeStatusDistribution", "pie", {
      // Persisted flags start false; query params will set them true
      useStatusColors: false,
      showPiePercentages: false,
      circleColor: "#3cc8ff",
      backgroundColor: "#0b1622",
      textColor: "#E8E8E8",
    });
    // Provide minimal status distribution data
    const userData = createMockUserData(542244, "testUser", {
      User: {
        statistics: {
          anime: {
            statuses: [
              { status: "current", count: 2 },
              { status: "completed", count: 5 },
            ],
          },
        },
        stats: { activityHistory: [{ date: 1, amount: 1 }] },
      },
    });
    setupSuccessfulMocks(cardsData, userData);

    const req = new Request(
      createRequestUrl(baseUrl, {
        userId: "542244",
        cardType: "animeStatusDistribution",
        variation: "pie",
        statusColors: "true",
        piePercentages: "true",
      }),
    );
    const res = await GET(req);
    const body = await getResponseText(res);
    expect(res.status).toBe(200);

    // Template should be invoked with the flags applied
    expect(extraAnimeMangaStatsTemplate).toHaveBeenCalled();
    const callArgs = (extraAnimeMangaStatsTemplate as jest.Mock).mock
      .calls[0][0];
    expect(callArgs.fixedStatusColors).toBeTruthy();
    expect(callArgs.showPiePercentages).toBeTruthy();
    // Confirm that the generated SVG includes the mocked flags in attributes
    expect(body).toContain('fixedStatusColors="true"');
    expect(body).toContain('showPiePercentages="true"');
  });

  it("should store cards via store-cards and use persisted flags when generating card.svg", async () => {
    // Build a cards payload that resembles what the frontend would submit
    const cardsPayload = [
      {
        cardName: "animeStatusDistribution",
        variation: "pie",
        titleColor: "#3cc8ff",
        backgroundColor: "#0b1622",
        textColor: "#E8E8E8",
        circleColor: "#3cc8ff",
        borderColor: "#abcdef",
        borderRadius: 6.25,
        showPiePercentages: true,
        useStatusColors: true,
      },
    ];

    // Expect store-cards to set Redis key
    mockRedisSet.mockResolvedValueOnce("OK");

    const postReq = new Request("http://localhost/api/store-cards", {
      method: "POST",
      body: JSON.stringify({ userId: 542244, cards: cardsPayload }),
      headers: { "Content-Type": "application/json" },
    });

    const postRes = await storeCardsPOST(postReq);
    expect(postRes.status).toBe(200);
    const json = await postRes.json();
    expect(json.success).toBe(true);

    // Assert that Redis set was called with the correct key and payload
    expect(mockRedisSet).toHaveBeenCalled();
    expect(mockRedisSet.mock.calls[0][0]).toBe("cards:542244");
    expect(mockRedisSet.mock.calls[0][1]).toContain('"borderColor":"#abcdef"');

    // Capture what was stored and make it available via GET
    const expectedCardsRecord = {
      userId: 542244,
      cards: cardsPayload,
      updatedAt: expect.any(String),
    };
    // We need to ensure subsequent GET uses this persisted card data - the first redis GET returns cards record
    const userData = createMockUserData(542244, "testUser", {
      User: {
        statistics: { anime: { statuses: [{ status: "current", count: 2 }] } },
      },
    });
    const cardsStr = JSON.stringify({
      ...expectedCardsRecord,
      updatedAt: new Date().toISOString(),
    });

    mockRedisGet
      .mockResolvedValueOnce(cardsStr)
      .mockResolvedValueOnce(userData);

    const req = new Request(
      createRequestUrl(baseUrl, {
        userId: "542244",
        cardType: "animeStatusDistribution",
        variation: "pie",
      }),
    );
    const res = await GET(req);
    const body = await getResponseText(res);
    expect(res.status).toBe(200);
    // Ensure the persisted borderColor is present in the generated SVG
    expect(body).toContain('stroke="#abcdef"');
    // Ensure template was invoked and flags passed
    expect(extraAnimeMangaStatsTemplate).toHaveBeenCalled();
    const callArgs = (extraAnimeMangaStatsTemplate as jest.Mock).mock
      .calls[0][0];
    expect(callArgs.fixedStatusColors).toBeTruthy();
    expect(callArgs.showPiePercentages).toBeTruthy();
  });

  it("should pass favourites/staff to extraAnimeMangaStatsTemplate for animeStaff card", async () => {
    const cardsData = createMockCardData("animeStaff", "default", {
      showFavorites: true,
    });
    const userData = createMockUserData(542244, "testUser", {
      User: {
        favourites: {
          staff: { nodes: [{ id: 1, name: { full: "Favorite Staff" } }] },
          studios: { nodes: [{ id: 1, name: "Studio One" }] },
          characters: { nodes: [{ id: 1, name: { full: "Character One" } }] },
        },
        statistics: {
          anime: {
            staff: [{ staff: { name: { full: "Favorite Staff" } }, count: 10 }],
          },
          manga: {},
        },
        stats: { activityHistory: [{ date: 1, amount: 1 }] },
      },
      followersPage: { pageInfo: { total: 0 }, followers: [] },
      followingPage: { pageInfo: { total: 0 }, following: [] },
      threadsPage: { pageInfo: { total: 0 }, threads: [] },
      threadCommentsPage: { pageInfo: { total: 0 }, threadComments: [] },
      reviewsPage: { pageInfo: { total: 0 }, reviews: [] },
    });
    setupSuccessfulMocks(cardsData, userData);

    const req = new Request(
      createRequestUrl(baseUrl, {
        userId: "542244",
        cardType: "animeStaff",
        variation: "default",
      }),
    );
    let res: Response | undefined;
    // Debug: log the URL and Redis mock return values (handy only during debugging)
    try {
      res = await GET(req);
    } catch (err) {
      console.error("[TEST DEBUG] GET threw:", err);
      throw err;
    }
    if (!res) throw new Error("No response returned");
    const bodyText = await getResponseText(res);
    // check the response
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/svg+xml");
    expect(bodyText).toBe(
      `<svg data-template="extra" stroke="none" fixedStatusColors="false" showPiePercentages="false">Extra Stats</svg>`,
    );

    // Ensure the template was called with favorites including 'Favorite Staff'
    expect(extraAnimeMangaStatsTemplate).toHaveBeenCalled();
    const callArgs = (extraAnimeMangaStatsTemplate as jest.Mock).mock
      .calls[0][0];
    // template call args
    expect(callArgs.favorites).toContain("Favorite Staff");

    // Ensure styles passed are narrow (don't include persisted flags)
    expect(callArgs.styles).toHaveProperty("titleColor");
    expect(callArgs.styles).toHaveProperty("backgroundColor");
    expect(callArgs.styles).toHaveProperty("textColor");
    expect(callArgs.styles.showPiePercentages).toBeUndefined();
    expect(callArgs.styles.useStatusColors).toBeUndefined();
  });

  it("should set CORS Access-Control-Allow-Origin to the request origin when present in dev", async () => {
    const cardsData = createMockCardData("animeStats", "default");
    const userData = createMockUserData(542244, "testUser", {
      User: { statistics: { anime: {} } },
    });
    setupSuccessfulMocks(cardsData, userData);

    const req = new Request(
      createRequestUrl(baseUrl, {
        userId: "542244",
        cardType: "animeStats",
      }),
      { headers: { origin: "http://example.dev" } },
    );
    const res = await GET(req);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://example.dev",
    );
  });

  it("should use configured NEXT_PUBLIC_CARD_SVG_ALLOWED_ORIGIN when set (overrides request origin)", async () => {
    const prev = process.env.NEXT_PUBLIC_CARD_SVG_ALLOWED_ORIGIN;
    (process.env as Record<string, string | undefined>)[
      "NEXT_PUBLIC_CARD_SVG_ALLOWED_ORIGIN"
    ] = "https://configured.example";
    const cardsData = createMockCardData("animeStats", "default");
    const userData = createMockUserData(542244, "testUser", {
      User: { statistics: { anime: {} } },
    });
    setupSuccessfulMocks(cardsData, userData);

    const req = new Request(
      createRequestUrl(baseUrl, {
        userId: "542244",
        cardType: "animeStats",
      }),
      { headers: { origin: "http://ignored-origin" } },
    );
    const res = await GET(req);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://configured.example",
    );
    // restore
    (process.env as Record<string, string | undefined>)[
      "NEXT_PUBLIC_CARD_SVG_ALLOWED_ORIGIN"
    ] = prev;
  });

  it("should default to https://anilist.co in production when no env var set", async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevConfig = process.env.NEXT_PUBLIC_CARD_SVG_ALLOWED_ORIGIN;
    (process.env as Record<string, string | undefined>)["NODE_ENV"] =
      "production";
    delete (process.env as Record<string, string | undefined>)[
      "NEXT_PUBLIC_CARD_SVG_ALLOWED_ORIGIN"
    ];

    const cardsData = createMockCardData("animeStats", "default");
    const userData = createMockUserData(542244, "testUser", {
      User: { statistics: { anime: {} } },
    });
    setupSuccessfulMocks(cardsData, userData);

    const req = new Request(
      createRequestUrl(baseUrl, {
        userId: "542244",
        cardType: "animeStats",
      }),
      { headers: { origin: "http://localhost:3000" } },
    );
    const res = await GET(req);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://anilist.co",
    );
    expect(res.headers.get("Access-Control-Allow-Origin")).not.toBe("*");

    // restore env
    (process.env as Record<string, string | undefined>)["NODE_ENV"] =
      prevNodeEnv;
    (process.env as Record<string, string | undefined>)[
      "NEXT_PUBLIC_CARD_SVG_ALLOWED_ORIGIN"
    ] = prevConfig;
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
    await expectErrorResponse(
      res,
      "Missing card configuration or stats data",
      404,
    );
  });

  it("should return server error when an outer error occurs", async () => {
    // Simulate Redis throwing an error.
    mockRedisGet.mockRejectedValueOnce(new Error("Redis error"));
    const req = new Request(
      createRequestUrl(baseUrl, { userId: "123", cardType: "animeStats" }),
    );
    const res = await GET(req);
    await expectErrorResponse(res, "Server Error", 500);
  });
});
