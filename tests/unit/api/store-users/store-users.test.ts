/**
 * Exercises the `store-users` route's validation and Redis persistence contract.
 * The aggregate assertions stay here because several downstream card routes read
 * split keys directly instead of recalculating totals at render time.
 */

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test";

import {
  createRequestProofToken,
  REQUEST_PROOF_COOKIE_NAME,
} from "@/lib/api/request-proof";
import { flushScheduledTelemetryTasksForTests } from "@/lib/api/telemetry";
import { mockUserStatsData } from "@/tests/e2e/fixtures/mock-data";
import {
  allowConsoleWarningsAndErrors,
  captureSharedRedisIncrCalls,
  sharedRatelimitMockLimit,
  sharedRedisMockDel,
  sharedRedisMockEval,
  sharedRedisMockGet,
  sharedRedisMockIncr,
  sharedRedisMockMget,
  sharedRedisMockPipelineExec,
  sharedRedisMockSadd,
  sharedRedisMockSet,
  sharedRedisMockSmembers,
  sharedRedisMockZadd,
} from "@/tests/unit/__setup__";

const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
const originalApiSecretToken = process.env.API_SECRET_TOKEN;
const TEST_APP_URL = "http://localhost";

let POST: typeof import("@/app/api/store-users/route").POST;
let OPTIONS: typeof import("@/app/api/store-users/route").OPTIONS;

beforeAll(async () => {
  const module = await import("@/app/api/store-users/route");
  POST = module.POST;
  OPTIONS = module.OPTIONS;
});

afterAll(() => {
  if (originalAppUrl === undefined) {
    delete process.env.NEXT_PUBLIC_APP_URL;
  } else {
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  }
});

/**
 * Creates a POST request for the store-users API with the given payload and optional origin header.
 * @param reqBody - JSON payload to serialize for the request body.
 * @param origin - Optional origin header used to simulate cross-origin behavior.
 * @returns A configured Request object for the store-users endpoint.
 * @source
 */
function createTestRequest(reqBody: object, origin?: string): Request {
  return new Request("http://localhost/api/store-users", {
    method: "POST",
    headers: {
      "x-forwarded-for": "127.0.0.1",
      "x-vercel-forwarded-for": "127.0.0.1",
      ...(origin && { origin }),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(reqBody),
  });
}

function createTestRequestWithHeaders(
  reqBody: object,
  origin: string | undefined,
  extraHeaders: Record<string, string>,
): Request {
  return new Request("http://localhost/api/store-users", {
    method: "POST",
    headers: {
      "x-forwarded-for": "127.0.0.1",
      "x-vercel-forwarded-for": "127.0.0.1",
      ...(origin && { origin }),
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify(reqBody),
  });
}

async function getJsonResponse(res: Response) {
  return res.clone().json();
}

function findSetCall(key: string) {
  const call = sharedRedisMockSet.mock.calls.find((entry) => entry[0] === key);
  expect(call).toBeTruthy();
  return call!;
}

function parseJsonSetCall(key: string) {
  return JSON.parse(String(findSetCall(key)[1]));
}

function cloneMockUserStatsData() {
  return structuredClone(mockUserStatsData);
}

/**
 * MGET helpers to simulate Redis responses of string or null values.
 */
async function mgetReturnNulls(...keys: string[]): Promise<(string | null)[]> {
  return keys.map(() => null);
}

describe("Store Users API", () => {
  beforeEach(() => {
    allowConsoleWarningsAndErrors();
    process.env = {
      ...process.env,
      NEXT_PUBLIC_APP_URL: TEST_APP_URL,
      NODE_ENV: "test",
    };
  });

  afterEach(async () => {
    await flushScheduledTelemetryTasksForTests();
    if (originalApiSecretToken === undefined) {
      delete process.env.API_SECRET_TOKEN;
    } else {
      process.env.API_SECRET_TOKEN = originalApiSecretToken;
    }
    mock.clearAllMocks();
    sharedRedisMockGet.mockReset();
    sharedRedisMockSet.mockReset();
    sharedRedisMockDel.mockReset();
    sharedRedisMockIncr.mockReset();
    sharedRatelimitMockLimit.mockReset();
    sharedRedisMockMget.mockReset();
    sharedRedisMockPipelineExec.mockReset();
    sharedRedisMockSadd.mockReset();
    sharedRedisMockSmembers.mockReset();
    sharedRedisMockZadd.mockReset();

    sharedRedisMockIncr.mockResolvedValue(1);
    sharedRatelimitMockLimit.mockResolvedValue({ success: true });
    sharedRedisMockGet.mockResolvedValue(null);
    sharedRedisMockMget.mockImplementation(mgetReturnNulls);
    sharedRedisMockPipelineExec.mockResolvedValue([]);
    sharedRedisMockSmembers.mockResolvedValue([]);
    sharedRedisMockZadd.mockResolvedValue(1);
  });

  describe("POST - Request Validation & Security", () => {
    it("should return 429 error if rate limit is exceeded", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: false });

      const reqBody = { userId: 1, username: "user1", stats: { score: 10 } };
      const req = createTestRequest(reqBody, "http://localhost");

      const res = await POST(req);
      expect(res.status).toBe(429);
      const data = await getJsonResponse(res);
      expect(data.error).toBe("Too many requests");
      expect(sharedRedisMockIncr).toHaveBeenCalledWith(
        "analytics:store_users:failed_requests",
      );
    });

    it("should reject cross-origin requests in production when origin differs", async () => {
      const originalEnv = { ...process.env };
      const capturedIncr = captureSharedRedisIncrCalls();
      process.env = {
        ...process.env,
        NODE_ENV: "production",
        API_SECRET_TOKEN: "test-request-proof-secret",
      };

      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });

      const requestProofToken = await createRequestProofToken({
        ip: "127.0.0.1",
      });
      if (!requestProofToken) {
        throw new Error("Expected request proof token to be generated");
      }

      const reqBody = { userId: 1, username: "user1", stats: { score: 10 } };
      const req = createTestRequestWithHeaders(
        reqBody,
        "http://different-origin.com",
        {
          cookie: `${REQUEST_PROOF_COOKIE_NAME}=${requestProofToken}`,
        },
      );

      try {
        const res = await POST(req);
        expect(res.status).toBe(401);
        const data = await getJsonResponse(res);
        expect(data.error).toBe("Unauthorized");
        await flushScheduledTelemetryTasksForTests();
        expect(capturedIncr.calls).toContainEqual([
          "analytics:store_users:failed_requests",
        ]);
      } finally {
        capturedIncr.release();
        process.env = originalEnv;
      }
    });

    it("should reject request with missing userId", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });

      const reqBody = { username: "user1", stats: { score: 10 } };
      const req = createTestRequest(reqBody, "http://localhost");

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await getJsonResponse(res);
      expect(data.error).toBe("Invalid data");
      expect(sharedRedisMockIncr).toHaveBeenCalledWith(
        "analytics:store_users:failed_requests",
      );
    });

    it("should reject request with null userId", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });

      const reqBody = { userId: null, username: "user1", stats: { score: 10 } };
      const req = createTestRequest(reqBody, "http://localhost");

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await getJsonResponse(res);
      expect(data.error).toBe("Invalid data");
    });

    it("should reject request with non-integer userId", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });

      const reqBody = {
        userId: "abc",
        username: "user1",
        stats: { score: 10 },
      };
      const req = createTestRequest(reqBody, "http://localhost");

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await getJsonResponse(res);
      expect(data.error).toBe("Invalid data");
    });

    it("should reject request with zero or negative userId", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });

      const reqBody = { userId: 0, username: "user1", stats: { score: 10 } };
      const req = createTestRequest(reqBody, "http://localhost");

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await getJsonResponse(res);
      expect(data.error).toBe("Invalid data");
    });

    it("should reject request with missing stats object", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });

      const reqBody = { userId: 1, username: "user1" };
      const req = createTestRequest(reqBody, "http://localhost");

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await getJsonResponse(res);
      expect(data.error).toBe("Invalid data");
    });

    it("should reject request with null stats", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });

      const reqBody = { userId: 1, username: "user1", stats: null };
      const req = createTestRequest(reqBody, "http://localhost");

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await getJsonResponse(res);
      expect(data.error).toBe("Invalid data");
    });

    it("should reject request with non-object stats", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });

      const reqBody = { userId: 1, username: "user1", stats: "invalid" };
      const req = createTestRequest(reqBody, "http://localhost");

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await getJsonResponse(res);
      expect(data.error).toBe("Invalid data");
    });

    it("should reject request with invalid username format (empty after trim)", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });

      const reqBody = { userId: 1, username: "   ", stats: { score: 10 } };
      const req = createTestRequest(reqBody, "http://localhost");

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await getJsonResponse(res);
      expect(data.error).toBe("Invalid data");
    });

    it("should reject request with username exceeding max length (100 chars)", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });

      const longUsername = "a".repeat(101);
      const reqBody = {
        userId: 1,
        username: longUsername,
        stats: { score: 10 },
      };
      const req = createTestRequest(reqBody, "http://localhost");

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await getJsonResponse(res);
      expect(data.error).toBe("Invalid data");
    });

    it("should reject request with invalid username characters", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });

      const reqBody = {
        userId: 1,
        username: "user@invalid#name",
        stats: { score: 10 },
      };
      const req = createTestRequest(reqBody, "http://localhost");

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await getJsonResponse(res);
      expect(data.error).toBe("Invalid data");
    });

    it("should reject malformed JSON body", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });

      const req = new Request("http://localhost/api/store-users", {
        method: "POST",
        headers: {
          "x-forwarded-for": "127.0.0.1",
          origin: "http://localhost",
          "Content-Type": "application/json",
        },
        body: "{ invalid json }",
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await getJsonResponse(res);
      expect(data.error).toBe("Invalid JSON body");
      expect(data.category).toBe("invalid_data");
      expect(data.retryable).toBe(false);
      expect(data.status).toBe(400);
    });

    it("should reject request bodies larger than the route limit", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });

      const oversizedPayloadBytes = 2 * 1024 * 1024 + 1;

      const req = createTestRequest(
        {
          userId: 1,
          username: "user1",
          stats: { blob: "x".repeat(oversizedPayloadBytes) },
        },
        "http://localhost",
      );

      const res = await POST(req);
      expect(res.status).toBe(413);
      const data = await getJsonResponse(res);
      expect(data.error).toBe("Request body too large");
      expect(sharedRedisMockIncr).toHaveBeenCalledWith(
        "analytics:store_users:failed_requests",
      );
    });

    it("should reject protected writes without a request proof when API_SECRET_TOKEN is configured", async () => {
      process.env.API_SECRET_TOKEN = "test-request-proof-secret";
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });

      const req = createTestRequest(
        { userId: 1, username: "user1", stats: { score: 10 } },
        "http://localhost",
      );

      const res = await POST(req);
      expect(res.status).toBe(401);
      const data = await getJsonResponse(res);
      expect(data.error).toBe("Unauthorized");
    });
  });

  describe("POST - Successful User Creation & Updates", () => {
    it("should successfully store new user with username", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      sharedRedisMockSet.mockResolvedValue(true);

      const reqBody = {
        userId: 1,
        username: "UserOne",
        stats: cloneMockUserStatsData(),
      };
      const req = createTestRequest(reqBody, "http://localhost");

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await getJsonResponse(res);
      expect(data.success).toBe(true);
      expect(data.userId).toBe(1);
      expect(data.updatedAt).toBeTruthy();

      expect(sharedRedisMockGet).toHaveBeenCalledWith("user:1:commit");
      expect(sharedRedisMockGet).toHaveBeenCalledWith("user:1:meta");
      expect(sharedRedisMockGet).toHaveBeenCalledWith("user:1");
      expect(sharedRedisMockSet).toHaveBeenCalledTimes(11);

      const metaValue = parseJsonSetCall("user:1:meta");
      expect(String(metaValue.userId)).toBe(String(1));
      expect(metaValue.username).toBe("UserOne");
      expect(metaValue.usernameNormalized).toBe("userone");
      expect(metaValue.schemaVersion).toBe(2);
      expect(metaValue.revision).toBe(1);
      expect(metaValue.requestMetadata).toEqual({
        lastSeenIpBucket: "loopback",
      });
      expect(metaValue).toHaveProperty("createdAt");
      expect(metaValue).toHaveProperty("updatedAt");

      const statsValue = parseJsonSetCall("user:1:activity");
      expect(statsValue).toEqual(mockUserStatsData.User.stats);

      expect(findSetCall("username:userone")[1]).toBe("1");
      expect(sharedRedisMockSadd).toHaveBeenCalledWith("users:known-ids", "1");
      expect(sharedRedisMockSadd).toHaveBeenCalledWith(
        "user:1:username-aliases",
        "userone",
      );
      expect(parseJsonSetCall("user:1:commit")).toMatchObject({
        revision: 1,
        storageFormat: "split-user-v2",
        usernameNormalized: "userone",
      });
      expect(sharedRedisMockZadd).toHaveBeenCalledWith(
        "users:stale-by-updated-at",
        expect.objectContaining({ member: "1", score: expect.any(Number) }),
      );

      expect(sharedRedisMockIncr).toHaveBeenCalledWith(
        "analytics:store_users:successful_requests",
      );
    });

    it("should successfully store new user without username", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      sharedRedisMockSet.mockResolvedValue(true);

      const reqBody = { userId: 2, stats: cloneMockUserStatsData() };
      const req = createTestRequest(reqBody, "http://localhost");

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await getJsonResponse(res);
      expect(data.success).toBe(true);
      expect(data.userId).toBe(2);

      expect(sharedRedisMockSet).toHaveBeenCalledTimes(10);

      const metaValue = parseJsonSetCall("user:2:meta");
      expect(metaValue.username).toBeUndefined();
      expect(
        sharedRedisMockSet.mock.calls.some(
          (call) => call[0] === "username:userone",
        ),
      ).toBe(false);
    });

    it("should accept null username explicitly", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      sharedRedisMockSet.mockResolvedValue(true);

      const reqBody = {
        userId: 3,
        username: null,
        stats: cloneMockUserStatsData(),
      };
      const req = createTestRequest(reqBody, "http://localhost");

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await getJsonResponse(res);
      expect(data.success).toBe(true);
      expect(sharedRedisMockSet).toHaveBeenCalledTimes(10);
    });

    it("should normalize username (trim and lowercase)", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      sharedRedisMockSet.mockResolvedValue(true);

      const reqBody = {
        userId: 4,
        username: "  UserName  ",
        stats: cloneMockUserStatsData(),
      };
      const req = createTestRequest(reqBody, "http://localhost");

      const res = await POST(req);
      expect(res.status).toBe(200);

      expect(sharedRedisMockSet).toHaveBeenCalledTimes(11);
      expect(findSetCall("username:username")[1]).toBe("4");
    });

    it("should compute and store animeSourceMaterialDistributionTotals before pruning", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      sharedRedisMockGet.mockResolvedValueOnce(null);
      sharedRedisMockSet.mockResolvedValue(true);

      const statsPayload = cloneMockUserStatsData();
      statsPayload.animeCurrent = {
        lists: [
          {
            name: "Watching",
            entries: [
              {
                id: 1,
                progress: 1,
                media: { id: 10, source: "MANGA", title: { romaji: "A" } },
              },
              {
                id: 2,
                progress: 1,
                media: { id: 12, title: { romaji: "B" } },
              },
            ],
          },
        ],
      };
      statsPayload.animeCompleted = {
        lists: [
          {
            name: "Completed",
            entries: [
              {
                id: 3,
                score: 10,
                media: {
                  id: 10,
                  source: "MANGA",
                  title: { romaji: "A" },
                },
              },
              {
                id: 4,
                score: 10,
                media: {
                  id: 11,
                  source: "ORIGINAL",
                  title: { romaji: "C" },
                },
              },
            ],
          },
        ],
      };

      const reqBody = {
        userId: 42,
        username: "FullListUser",
        stats: statsPayload,
      };
      const req = createTestRequest(reqBody, "http://localhost");
      const res = await POST(req);
      expect(res.status).toBe(200);

      const aggregatesValue = parseJsonSetCall("user:42:aggregates");

      expect(aggregatesValue).toHaveProperty(
        "animeSourceMaterialDistributionTotals",
      );
      const totals =
        aggregatesValue.animeSourceMaterialDistributionTotals as Array<{
          source: string;
          count: number;
        }>;

      expect(totals).toContainEqual({ source: "MANGA", count: 1 });
      expect(totals).toContainEqual({ source: "ORIGINAL", count: 1 });
      expect(totals).toContainEqual({ source: "UNKNOWN", count: 1 });
    });

    it("should compute and store animeSeasonalPreferenceTotals before pruning", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      sharedRedisMockGet.mockResolvedValueOnce(null);
      sharedRedisMockSet.mockResolvedValue(true);

      const statsPayload = cloneMockUserStatsData();
      statsPayload.animeCurrent = {
        lists: [
          {
            name: "Watching",
            entries: [
              {
                id: 1,
                progress: 1,
                media: {
                  id: 10,
                  season: "WINTER",
                  seasonYear: 2024,
                  title: { romaji: "A" },
                },
              },
              {
                id: 2,
                progress: 1,
                media: { id: 12, title: { romaji: "B" } },
              },
            ],
          },
        ],
      };
      statsPayload.animeCompleted = {
        lists: [
          {
            name: "Completed",
            entries: [
              {
                id: 3,
                score: 10,
                media: {
                  id: 10,
                  season: "WINTER",
                  seasonYear: 2024,
                  title: { romaji: "A" },
                },
              },
              {
                id: 4,
                score: 10,
                media: {
                  id: 11,
                  season: "SPRING",
                  seasonYear: 2024,
                  title: { romaji: "C" },
                },
              },
            ],
          },
        ],
      };

      const reqBody = {
        userId: 43,
        username: "SeasonUser",
        stats: statsPayload,
      };
      const req = createTestRequest(reqBody, "http://localhost");
      const res = await POST(req);
      expect(res.status).toBe(200);

      const aggregatesValue = parseJsonSetCall("user:43:aggregates");

      expect(aggregatesValue).toHaveProperty("animeSeasonalPreferenceTotals");
      const totals = aggregatesValue.animeSeasonalPreferenceTotals as Array<{
        season: string;
        count: number;
      }>;

      expect(totals).toContainEqual({ season: "WINTER", count: 1 });
      expect(totals).toContainEqual({ season: "SPRING", count: 1 });
      expect(totals).toContainEqual({ season: "UNKNOWN", count: 1 });
    });

    it("should compute and store animeGenreSynergyTotals before pruning", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      sharedRedisMockGet.mockResolvedValueOnce(null);
      sharedRedisMockSet.mockResolvedValue(true);

      const statsPayload = cloneMockUserStatsData();
      statsPayload.animeCompleted = {
        lists: [
          {
            name: "Completed",
            entries: [
              {
                id: 1,
                score: 10,
                media: {
                  id: 101,
                  title: { romaji: "A" },
                  genres: ["Action", "Drama", "Comedy"],
                },
              },
              {
                id: 2,
                score: 10,
                media: {
                  id: 102,
                  title: { romaji: "B" },
                  genres: ["Action", "Drama"],
                },
              },
              {
                id: 3,
                score: 10,
                media: {
                  id: 103,
                  title: { romaji: "C" },
                  genres: ["Drama", "Fantasy"],
                },
              },
            ],
          },
        ],
      };

      const reqBody = {
        userId: 44,
        username: "GenreSynergyUser",
        stats: statsPayload,
      };
      const req = createTestRequest(reqBody, "http://localhost");
      const res = await POST(req);
      expect(res.status).toBe(200);

      const aggregatesValue = parseJsonSetCall("user:44:aggregates");

      expect(aggregatesValue).toHaveProperty("animeGenreSynergyTotals");
      const totals = aggregatesValue.animeGenreSynergyTotals as Array<{
        a: string;
        b: string;
        count: number;
      }>;

      expect(totals).toContainEqual({ a: "Action", b: "Drama", count: 2 });
      expect(totals).toContainEqual({ a: "Action", b: "Comedy", count: 1 });
      expect(totals).toContainEqual({ a: "Comedy", b: "Drama", count: 1 });
      expect(totals).toContainEqual({ a: "Drama", b: "Fantasy", count: 1 });
    });

    it("should persist userReviews/userRecommendations and dropped lists", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      sharedRedisMockGet.mockResolvedValueOnce(null);
      sharedRedisMockSet.mockResolvedValue(true);

      const statsPayload = cloneMockUserStatsData();
      statsPayload.userReviews = {
        reviews: [
          {
            id: 100,
            score: 70,
            rating: 10,
            ratingAmount: 42,
            summary: "A review summary",
            createdAt: 1700000000,
            media: {
              id: 200,
              title: { romaji: "Example Anime" },
              type: "ANIME",
              genres: ["Action"],
            },
          },
        ],
      };
      statsPayload.userRecommendations = {
        recommendations: [
          {
            id: 300,
            rating: 5,
            media: { id: 1, title: { romaji: "A" } },
            mediaRecommendation: { id: 2, title: { romaji: "B" } },
          },
        ],
      };
      statsPayload.animeCompleted = {
        lists: [
          {
            name: "Completed",
            entries: [
              {
                id: 1,
                score: 9,
                media: {
                  id: 10,
                  title: { romaji: "Completed With Dates" },
                  episodes: 12,
                  averageScore: 82,
                  genres: ["Drama"],
                },
              },
            ],
          },
        ],
      };
      statsPayload.animeDropped = {
        lists: [
          {
            name: "Dropped",
            entries: [
              {
                id: 2,
                progress: 3,
                media: {
                  id: 11,
                  title: { romaji: "Dropped Anime" },
                  episodes: 12,
                  genres: ["Comedy"],
                },
              },
            ],
          },
        ],
      };
      statsPayload.mangaDropped = {
        lists: [
          {
            name: "Dropped",
            entries: [
              {
                id: 3,
                progress: 5,
                media: {
                  id: 21,
                  title: { romaji: "Dropped Manga" },
                  chapters: 100,
                  genres: ["Adventure"],
                },
              },
            ],
          },
        ],
      };

      const reqBody = {
        userId: 99,
        username: "NewFieldsUser",
        stats: statsPayload,
      };
      const req = createTestRequest(reqBody, "http://localhost");

      const res = await POST(req);
      expect(res.status).toBe(200);

      const pagesValue = parseJsonSetCall("user:99:pages");
      expect(pagesValue.userReviews?.reviews).toHaveLength(1);
      expect(pagesValue.userRecommendations?.recommendations).toHaveLength(1);

      const completedValue = parseJsonSetCall("user:99:completed");

      expect(completedValue.animeDropped?.lists?.[0]?.entries).toHaveLength(1);
      expect(completedValue.mangaDropped?.lists?.[0]?.entries).toHaveLength(1);

      const storedEntry =
        completedValue.animeCompleted?.lists?.[0]?.entries?.[0];
      expect(storedEntry).toBeTruthy();
    });

    it("should update existing user and preserve createdAt", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      const existingRecord = {
        userId: 5,
        username: "OldName",
        stats: { score: 5 },
        ip: "127.0.0.1",
        createdAt: "2022-01-01T00:00:00.000Z",
        updatedAt: "2022-01-01T00:00:00.000Z",
      };
      sharedRedisMockGet.mockImplementation((key: string) => {
        if (key === "user:5") {
          return Promise.resolve(JSON.stringify(existingRecord));
        }

        return Promise.resolve(null);
      });
      sharedRedisMockSet.mockResolvedValue(true);

      const reqBody = {
        userId: 5,
        username: "NewName",
        stats: cloneMockUserStatsData(),
      };
      const req = createTestRequest(reqBody, "http://localhost");

      const res = await POST(req);
      expect(res.status).toBe(200);

      expect(sharedRedisMockSet).toHaveBeenCalledTimes(11);

      const metaValue = parseJsonSetCall("user:5:meta");
      expect(metaValue.createdAt).toBe("2022-01-01T00:00:00.000Z");
      expect(metaValue.updatedAt).not.toBe("2022-01-01T00:00:00.000Z");
      expect(metaValue.username).toBe("NewName");

      const statsValue = parseJsonSetCall("user:5:activity");
      expect(statsValue).toEqual(mockUserStatsData.User.stats);
      expect(sharedRedisMockDel).toHaveBeenCalledWith("username:oldname");
    });

    it("should reject stats payloads that fail persisted schema validation", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      sharedRedisMockSet.mockResolvedValue(true);

      const complexStats = {
        animeCount: 150,
        mangaCount: 75,
        totalGenres: 20,
        topGenres: ["Action", "Drama", "Sci-Fi"],
        stats: { avg_score: 7.5 },
      };
      const reqBody = { userId: 6, username: "user6", stats: complexStats };
      const req = createTestRequest(reqBody, "http://localhost");

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await getJsonResponse(res);
      expect(data.error).toBe("Invalid data");
      expect(sharedRedisMockSet).not.toHaveBeenCalled();
    });

    it("should update existing user without username when not provided", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      const existingRecord = {
        userId: 7,
        username: "ExistingName",
        stats: { score: 10 },
        ip: "127.0.0.1",
        createdAt: "2022-01-01T00:00:00.000Z",
        updatedAt: "2022-01-01T00:00:00.000Z",
      };
      sharedRedisMockGet.mockImplementation((key: string) => {
        if (key === "user:7") {
          return Promise.resolve(JSON.stringify(existingRecord));
        }

        return Promise.resolve(null);
      });
      sharedRedisMockSet.mockResolvedValue(true);

      const reqBody = { userId: 7, stats: cloneMockUserStatsData() };
      const req = createTestRequest(reqBody, "http://localhost");

      const res = await POST(req);
      expect(res.status).toBe(200);

      expect(sharedRedisMockSet).toHaveBeenCalledTimes(10);
      const metaValue = parseJsonSetCall("user:7:meta");
      expect(metaValue.username).toBeUndefined();
      expect(sharedRedisMockDel).toHaveBeenCalledWith("username:existingname");
    });

    it("should replace username when changing from existing name to new name", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      const existingRecord = {
        userId: 8,
        username: "OldName",
        stats: { score: 10 },
        ip: "127.0.0.1",
        createdAt: "2022-01-01T00:00:00.000Z",
        updatedAt: "2022-01-01T00:00:00.000Z",
      };
      sharedRedisMockGet.mockImplementation((key: string) => {
        if (key === "user:8") {
          return Promise.resolve(JSON.stringify(existingRecord));
        }

        return Promise.resolve(null);
      });
      sharedRedisMockSet.mockResolvedValue(true);

      const reqBody = {
        userId: 8,
        username: "NewName",
        stats: cloneMockUserStatsData(),
      };
      const req = createTestRequest(reqBody, "http://localhost");

      const res = await POST(req);
      expect(res.status).toBe(200);

      expect(sharedRedisMockSet).toHaveBeenCalledTimes(11);
      expect(findSetCall("username:newname")[1]).toBe("8");
      expect(sharedRedisMockDel).toHaveBeenCalledWith("username:oldname");
    });

    it("should reject stale writes when ifMatchUpdatedAt does not match", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      const existingRecord = {
        userId: 19,
        username: "ConflictUser",
        stats: { score: 10 },
        createdAt: "2022-01-01T00:00:00.000Z",
        updatedAt: "2022-01-02T00:00:00.000Z",
      };
      sharedRedisMockGet.mockImplementation((key: string) => {
        if (key === "user:19") {
          return Promise.resolve(JSON.stringify(existingRecord));
        }

        return Promise.resolve(null);
      });

      const req = createTestRequest(
        {
          userId: 19,
          username: "ConflictUser",
          stats: { score: 20 },
          ifMatchUpdatedAt: "2022-01-01T00:00:00.000Z",
        },
        "http://localhost",
      );

      const res = await POST(req);
      expect(res.status).toBe(409);
      const data = await getJsonResponse(res);
      expect(data).toMatchObject({
        error:
          "Conflict: data was updated elsewhere. Please reload and try again.",
        currentUpdatedAt: "2022-01-02T00:00:00.000Z",
      });
      expect(sharedRedisMockSet).not.toHaveBeenCalled();
    });
  });

  describe("POST - Timestamp Handling", () => {
    it("should include updatedAt timestamp in stored record", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      sharedRedisMockSet.mockResolvedValue(true);

      const beforeTime = new Date();
      const reqBody = {
        userId: 9,
        username: "user9",
        stats: cloneMockUserStatsData(),
      };
      const req = createTestRequest(reqBody, "http://localhost");

      const res = await POST(req);
      const afterTime = new Date();

      expect(res.status).toBe(200);
      const metaValue = parseJsonSetCall("user:9:meta");
      const timestamp = new Date(metaValue.updatedAt);

      expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it("should generate new createdAt for new user records", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      sharedRedisMockSet.mockResolvedValue(true);

      const beforeTime = new Date();
      const reqBody = {
        userId: 10,
        username: "user10",
        stats: cloneMockUserStatsData(),
      };
      const req = createTestRequest(reqBody, "http://localhost");

      const res = await POST(req);
      const afterTime = new Date();

      expect(res.status).toBe(200);
      const metaValue = parseJsonSetCall("user:10:meta");
      const createdAt = new Date(metaValue.createdAt);

      expect(createdAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(createdAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });

  describe("POST - Error Handling", () => {
    it("should return 500 error if redis storage fails", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      sharedRedisMockGet.mockResolvedValueOnce(null);
      sharedRedisMockEval.mockRejectedValueOnce(new Error("Redis failure"));

      const reqBody = {
        userId: 11,
        username: "user11",
        stats: cloneMockUserStatsData(),
      };
      const req = createTestRequest(reqBody, "http://localhost");

      const res = await POST(req);
      expect(res.status).toBe(503);
      const data = await getJsonResponse(res);
      expect(data.error).toBe("User storage is temporarily unavailable");
      expect(data.retryable).toBe(true);
      expect(sharedRedisMockIncr).toHaveBeenCalledWith(
        "analytics:store_users:failed_requests",
      );
    });

    it("should return 500 error if redis get fails", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      sharedRedisMockGet.mockRejectedValueOnce(new Error("Redis get failure"));

      const reqBody = { userId: 12, username: "user12", stats: { score: 30 } };
      const req = createTestRequest(reqBody, "http://localhost");

      const res = await POST(req);
      expect(res.status).toBe(503);
      const data = await getJsonResponse(res);
      expect(data.error).toBe("User storage is temporarily unavailable");
    });

    it("should recover gracefully from corrupted Redis record (invalid JSON)", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      sharedRedisMockGet.mockImplementation((key: string) => {
        if (key === "user:13:meta") {
          return Promise.resolve("[object Object]");
        }

        return Promise.resolve(null);
      });
      sharedRedisMockSet.mockResolvedValue(true);

      const reqBody = {
        userId: 13,
        username: "user13",
        stats: cloneMockUserStatsData(),
      };
      const req = createTestRequest(reqBody, "http://localhost");

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await getJsonResponse(res);
      expect(data.success).toBe(true);

      const storedValue = parseJsonSetCall("user:13:meta");
      expect(storedValue.createdAt).toBeDefined();
    });

    it("should generate new createdAt when recovering from corrupted record", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      sharedRedisMockGet.mockImplementation((key: string) => {
        if (key === "user:14:meta") {
          return Promise.resolve("corrupted data");
        }

        return Promise.resolve(null);
      });
      sharedRedisMockSet.mockResolvedValue(true);

      const beforeTime = new Date();
      const reqBody = {
        userId: 14,
        username: "user14",
        stats: cloneMockUserStatsData(),
      };
      const req = createTestRequest(reqBody, "http://localhost");

      const res = await POST(req);
      const afterTime = new Date();

      expect(res.status).toBe(200);
      const metaValue = parseJsonSetCall("user:14:meta");
      const createdAt = new Date(metaValue.createdAt);

      expect(createdAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(createdAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });

  describe("POST - CORS & Response Headers", () => {
    it("should include CORS headers in success response", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      sharedRedisMockGet.mockResolvedValueOnce(null);
      sharedRedisMockSet.mockResolvedValueOnce(true);

      const reqBody = {
        userId: 15,
        username: "user15",
        stats: cloneMockUserStatsData(),
      };
      const req = createTestRequest(reqBody, "http://localhost");

      const res = await POST(req);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "http://localhost",
      );
      expect(res.headers.get("Content-Type")).toBe("application/json");
    });

    it("should echo X-Request-Id in success responses", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      sharedRedisMockGet.mockResolvedValueOnce(null);
      sharedRedisMockSet.mockResolvedValueOnce(true);

      const requestId = "req-store-12345";
      const res = await POST(
        new Request("http://localhost/api/store-users", {
          method: "POST",
          headers: {
            "x-forwarded-for": "127.0.0.1",
            origin: "http://localhost",
            "Content-Type": "application/json",
            "x-request-id": requestId,
          },
          body: JSON.stringify({
            userId: 101,
            username: "user101",
            stats: cloneMockUserStatsData(),
          }),
        }),
      );

      expect(res.status).toBe(200);
      expect(res.headers.get("X-Request-Id")).toBe(requestId);
      expect(res.headers.get("Access-Control-Expose-Headers")).toContain(
        "X-Request-Id",
      );
    });

    it("should include CORS headers in error response", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });

      const reqBody = { userId: null, stats: { score: 10 } };
      const req = createTestRequest(reqBody, "http://localhost");

      const res = await POST(req);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "http://localhost",
      );
      expect(res.status).toBe(400);
    });
  });

  describe("POST - Analytics Tracking", () => {
    it("should increment successful_requests metric on success", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      sharedRedisMockGet.mockResolvedValueOnce(null);
      sharedRedisMockSet.mockResolvedValueOnce(true);

      const reqBody = {
        userId: 16,
        username: "user16",
        stats: cloneMockUserStatsData(),
      };
      const req = createTestRequest(reqBody, "http://localhost");

      await POST(req);
      expect(sharedRedisMockIncr).toHaveBeenCalledWith(
        "analytics:store_users:successful_requests",
      );
    });

    it("should increment failed_requests metric on validation error", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });

      const reqBody = { userId: null, stats: { score: 10 } };
      const req = createTestRequest(reqBody, "http://localhost");

      await POST(req);
      expect(sharedRedisMockIncr).toHaveBeenCalledWith(
        "analytics:store_users:failed_requests",
      );
    });

    it("should increment failed_requests metric on rate limit", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: false });

      const reqBody = { userId: 17, stats: { score: 10 } };
      const req = createTestRequest(reqBody, "http://localhost");

      await POST(req);
      expect(sharedRedisMockIncr).toHaveBeenCalledWith(
        "analytics:store_users:failed_requests",
      );
    });

    it("should increment failed_requests metric on Redis error", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      sharedRedisMockGet.mockResolvedValueOnce(null);
      sharedRedisMockPipelineExec.mockRejectedValueOnce(
        new Error("Redis failure"),
      );

      const reqBody = { userId: 18, username: "user18", stats: { score: 10 } };
      const req = createTestRequest(reqBody, "http://localhost");

      await POST(req);
      expect(sharedRedisMockIncr).toHaveBeenCalledWith(
        "analytics:store_users:failed_requests",
      );
    });
  });

  describe("OPTIONS - Preflight Handling", () => {
    it("should respond to OPTIONS with correct CORS headers", async () => {
      const req = new Request("http://localhost/api/store-users", {
        method: "OPTIONS",
        headers: {
          "x-forwarded-for": "127.0.0.1",
          origin: "http://localhost",
          "Content-Type": "application/json",
        },
      });
      const res = OPTIONS(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "http://localhost",
      );
      expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
      expect(res.headers.get("Access-Control-Allow-Headers")).toContain(
        "Content-Type",
      );
    });

    it("should allow cross-origin preflight requests", async () => {
      const req = new Request("http://localhost/api/store-users", {
        method: "OPTIONS",
        headers: {
          origin: "http://different-origin.com",
          "Access-Control-Request-Method": "POST",
        },
      });
      const res = OPTIONS(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    });
  });
});
