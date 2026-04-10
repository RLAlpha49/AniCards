import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import { GET, OPTIONS } from "@/app/api/get-user/route";
import {
  allowConsoleWarningsAndErrors,
  sharedRatelimitMockLimit,
  sharedRedisMockDel,
  sharedRedisMockGet,
  sharedRedisMockIncr,
  sharedRedisMockMget,
} from "@/tests/unit/__setup__";

async function getResponseJson<T = unknown>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

const API_BASE = "http://localhost/api/get-user";
const DEFAULT_HEADERS = { "x-forwarded-for": "127.0.0.1" };
const USER_PART_KEYS = [
  "meta",
  "activity",
  "favourites",
  "statistics",
  "pages",
  "planning",
  "current",
  "rewatched",
  "completed",
  "aggregates",
] as const;
const EXPECTED_BOUNDED_SECTIONS = [
  "activity",
  "favourites",
  "pages",
  "planning",
  "current",
  "rewatched",
  "completed",
] as const;
const EXPECTED_MISSING_AGGREGATES = [
  "animeSourceMaterialDistributionTotals",
  "animeSeasonalPreferenceTotals",
  "animeGenreSynergyTotals",
  "studioCollaborationTotals",
] as const;

function createReq(query?: string, headers?: Record<string, string>): Request {
  const url = query?.length ? `${API_BASE}?${query}` : API_BASE;
  return new Request(url, {
    headers: { ...DEFAULT_HEADERS, ...headers } as Record<string, string>,
  });
}

async function callGet(
  query?: string,
  headers?: Record<string, string>,
): Promise<Response> {
  return GET(createReq(query, headers));
}

function createStoredUserParts(overrides?: {
  meta?: Record<string, unknown>;
  activity?: Record<string, unknown>;
  favourites?: Record<string, unknown>;
  statistics?: Record<string, unknown> | null;
  pages?: Record<string, unknown>;
  planning?: Record<string, unknown>;
  current?: Record<string, unknown>;
  rewatched?: Record<string, unknown>;
  completed?: Record<string, unknown>;
  aggregates?: Record<string, unknown> | null;
}) {
  return {
    meta: {
      userId: "123",
      username: "testUser",
      createdAt: "2026-03-20T08:00:00.000Z",
      updatedAt: "2026-03-21T10:00:00.000Z",
      requestMetadata: { lastSeenIpBucket: "loopback" },
      name: "Test User",
      avatar: {
        medium: "https://example.com/avatar-medium.webp",
        large: "https://example.com/avatar-large.webp",
      },
      userCreatedAt: 1_700_000_000,
      ...overrides?.meta,
    },
    activity: {
      activityHistory: [{ date: 1_700_000_000, amount: 3 }],
      ...overrides?.activity,
    },
    favourites: {
      anime: { nodes: [{ id: 1, title: { romaji: "A" } }] },
      manga: { nodes: [] },
      characters: { nodes: [] },
      staff: { nodes: [] },
      studios: { nodes: [] },
      ...overrides?.favourites,
    },
    statistics: overrides?.statistics ?? {
      anime: {
        count: 42,
        episodesWatched: 900,
        minutesWatched: 27_000,
        meanScore: 81,
        standardDeviation: 10,
        genres: [],
        tags: [],
        voiceActors: [],
        studios: [],
        staff: [],
      },
      manga: {
        count: 12,
        chaptersRead: 240,
        volumesRead: 40,
        meanScore: 79,
        standardDeviation: 8,
        genres: [],
        tags: [],
        staff: [],
      },
    },
    pages: {
      followersPage: { pageInfo: { total: 12 }, followers: [{ id: 999 }] },
      followingPage: { pageInfo: { total: 5 }, following: [] },
      threadsPage: { pageInfo: { total: 2 }, threads: [] },
      threadCommentsPage: { pageInfo: { total: 7 }, threadComments: [] },
      reviewsPage: { pageInfo: { total: 1 }, reviews: [] },
      ...overrides?.pages,
    },
    planning: overrides?.planning ?? {},
    current: overrides?.current ?? {},
    rewatched: overrides?.rewatched ?? {},
    completed: overrides?.completed ?? {},
    aggregates: overrides?.aggregates ?? null,
  };
}

function mockStoredParts(
  parts = createStoredUserParts(),
  options?: { usernameIndex?: string | null },
) {
  if (options && Object.hasOwn(options, "usernameIndex")) {
    sharedRedisMockGet.mockResolvedValueOnce(options.usernameIndex ?? null);
  }

  sharedRedisMockMget.mockImplementationOnce((...keys: string[]) => {
    return Promise.resolve(
      keys.map((key) => {
        const part = key.split(":").at(-1) as (typeof USER_PART_KEYS)[number];
        const value = parts[part];
        return value === null || value === undefined
          ? null
          : JSON.stringify(value);
      }),
    );
  });
}

async function expectError(
  query: string | undefined,
  status: number,
  errorMsg: string,
) {
  const res = await callGet(query);
  expect(res.status).toBe(status);
  const json = await getResponseJson<{ error?: string }>(res);
  expect(json?.error).toBe(errorMsg);
}

async function expectOkJson(query: string | undefined) {
  const res = await callGet(query);
  expect(res.status).toBe(200);
  const json = await getResponseJson<Record<string, unknown>>(res);

  expect(json).toMatchObject({
    userId: 123,
    username: "testUser",
    stats: {
      User: {
        avatar: {
          medium: "https://example.com/avatar-medium.webp",
          large: "https://example.com/avatar-large.webp",
        },
      },
    },
    statistics: {
      anime: { count: 42 },
      manga: { count: 12 },
    },
    favourites: {
      anime: {
        nodes: [{ id: 1, title: { romaji: "A" } }],
      },
    },
    pages: {
      followersPage: {
        pageInfo: { total: 12 },
      },
    },
    recordMeta: {
      storageFormat: "legacy-split",
      schemaVersion: 1,
      completeness: {
        sampled: true,
        fullHistory: false,
        boundedSections: EXPECTED_BOUNDED_SECTIONS,
        availableAggregates: [],
        missingAggregates: EXPECTED_MISSING_AGGREGATES,
      },
    },
  });

  expect(json).not.toHaveProperty("ip");
  expect(json).not.toHaveProperty("createdAt");
  expect(json).not.toHaveProperty("updatedAt");
  expect(json).not.toHaveProperty("requestMetadata");

  return json;
}

async function expectBootstrapJson(query: string | undefined) {
  const res = await callGet(query);
  expect(res.status).toBe(200);

  const json = await getResponseJson<Record<string, unknown>>(res);

  expect(json).toMatchObject({
    userId: 123,
    username: "testUser",
    avatarUrl: "https://example.com/avatar-medium.webp",
    recordMeta: {
      storageFormat: "legacy-split",
      schemaVersion: 1,
      completeness: {
        sampled: true,
        fullHistory: false,
        boundedSections: EXPECTED_BOUNDED_SECTIONS,
        availableAggregates: [],
        missingAggregates: EXPECTED_MISSING_AGGREGATES,
      },
    },
  });

  return json;
}

describe("User API GET Endpoint", () => {
  beforeEach(() => {
    allowConsoleWarningsAndErrors();
    mock.clearAllMocks();
    sharedRedisMockGet.mockReset();
    sharedRedisMockMget.mockReset();
    sharedRedisMockIncr.mockResolvedValue(1);
    sharedRedisMockGet.mockResolvedValue(null);
    sharedRedisMockMget.mockResolvedValue(USER_PART_KEYS.map(() => null));
    sharedRatelimitMockLimit.mockResolvedValue({
      success: true,
      limit: 60,
      remaining: 59,
      reset: Date.now() + 10_000,
      pending: Promise.resolve(),
    });
  });

  afterEach(() => {
    mock.clearAllMocks();
    delete (process.env as Record<string, string | undefined>)[
      "NEXT_PUBLIC_APP_URL"
    ];
  });

  describe("Parameter Validation", () => {
    it("should return 400 when both userId and username are missing", async () => {
      await expectError(undefined, 400, "Missing userId or username parameter");
    });

    it("should return 400 when userId is not a valid number", async () => {
      await expectError("userId=abc", 400, "Invalid userId parameter");
    });

    it("should return 400 when userId is only partially numeric", async () => {
      await expectError("userId=123abc", 400, "Invalid userId parameter");
    });

    it("should return 400 when userId is zero", async () => {
      await expectError("userId=0", 400, "Invalid userId parameter");
    });

    it("should return 400 when username contains invalid characters", async () => {
      await expectError(
        "username=***invalid***",
        400,
        "Invalid username parameter",
      );
    });

    it("should return 400 when username exceeds 100 characters", async () => {
      const longUsername = "a".repeat(101);
      await expectError(
        `username=${longUsername}`,
        400,
        "Invalid username parameter",
      );
    });
  });

  describe("Lookup Paths", () => {
    it("should fetch public user data by userId when parameter is provided", async () => {
      mockStoredParts();

      await expectOkJson("userId=123");

      expect(sharedRedisMockMget).toHaveBeenCalledWith(
        ...USER_PART_KEYS.map((part) => `user:123:${part}`),
      );
      expect(sharedRedisMockGet).not.toHaveBeenCalledWith("user:123");
    });

    it("should return the lightweight bootstrap DTO when view=bootstrap is requested", async () => {
      mockStoredParts();

      await expectBootstrapJson("userId=123&view=bootstrap");

      expect(sharedRedisMockMget).toHaveBeenCalledWith("user:123:meta");
    });

    it("should resolve username to userId via index and fetch split user data", async () => {
      mockStoredParts(undefined, { usernameIndex: "123" });

      await expectOkJson("username=testuser");

      expect(sharedRedisMockGet).toHaveBeenCalledWith("username:testuser");
      expect(sharedRedisMockMget).toHaveBeenCalledWith(
        ...USER_PART_KEYS.map((part) => `user:123:${part}`),
      );
    });

    it("should normalize username by trimming and lowercasing for index lookup", async () => {
      mockStoredParts(undefined, { usernameIndex: "123" });

      await expectOkJson("username= TestUser ");

      expect(sharedRedisMockGet).toHaveBeenCalledWith("username:testuser");
    });

    it("should prioritize userId over username when both are provided", async () => {
      mockStoredParts();

      await expectOkJson("userId=123&username=ignored");

      expect(sharedRedisMockGet).not.toHaveBeenCalledWith("username:ignored");
    });

    it("should return 404 when username index does not exist", async () => {
      sharedRedisMockGet.mockResolvedValueOnce(null);

      await expectError("username=unknownuser", 404, "User not found");
    });

    it("should return 404 when username index returns a non-numeric value", async () => {
      sharedRedisMockGet.mockResolvedValueOnce("abc");

      await expectError("username=badindex", 404, "User not found");
      expect(sharedRedisMockIncr).toHaveBeenCalledWith(
        "analytics:user_api:failed_requests",
      );
    });

    it("should return 404 when split user record is not found", async () => {
      await expectError("userId=123", 404, "User not found");
    });

    it("should return 500 when Redis throws during split fetch", async () => {
      sharedRedisMockMget.mockRejectedValueOnce(
        new Error("Redis connection failed"),
      );

      const res = await callGet("userId=123");
      expect(res.status).toBe(503);
      const json = await getResponseJson<{
        error?: string;
        retryable?: boolean;
        status?: number;
      }>(res);
      expect(json.error).toBe("User data is temporarily unavailable");
      expect(json.retryable).toBe(true);
      expect(json.status).toBe(503);
    });

    it("should return 503 when Redis throws during username index lookup", async () => {
      sharedRedisMockGet.mockRejectedValueOnce(
        new Error("Redis connection failed"),
      );

      await expectError(
        "username=testuser",
        503,
        "User data is temporarily unavailable",
      );
    });

    it("should return 500 when a stored split user record is incomplete", async () => {
      const incomplete = createStoredUserParts();
      sharedRedisMockMget.mockResolvedValueOnce([
        JSON.stringify(incomplete.meta),
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
      ]);

      await expectError(
        "userId=123",
        500,
        "Stored user record is incomplete or corrupted",
      );
    });

    it("should return 500 when the stored userId cannot satisfy the public numeric contract", async () => {
      mockStoredParts(
        createStoredUserParts({
          meta: {
            userId: "not-a-number",
          },
        }),
      );

      await expectError(
        "userId=123",
        500,
        "Stored user record is incomplete or corrupted",
      );
    });

    it("should return 404 for a stale username alias without deleting the alias", async () => {
      mockStoredParts(
        createStoredUserParts({
          meta: {
            username: "different-user",
          },
        }),
        { usernameIndex: "123" },
      );

      await expectError("username=alice", 404, "User not found");
      expect(sharedRedisMockDel).not.toHaveBeenCalledWith("username:alice");
    });
  });

  describe("Public DTO Minimization", () => {
    it("should return a bounded public DTO and strip internal metadata", async () => {
      mockStoredParts(
        createStoredUserParts({
          meta: {
            userId: "123",
            username: "testUser",
            createdAt: "2026-03-20T08:00:00.000Z",
            updatedAt: "2026-03-21T10:00:00.000Z",
            requestMetadata: { lastSeenIpBucket: "10.20.x.x" },
            name: "Test User",
            avatar: {
              medium: "https://example.com/avatar-medium.webp",
              large: "https://example.com/avatar-large.webp",
            },
            userCreatedAt: 1_700_000_000,
            internalOnly: "should-not-leak",
          },
        }),
      );

      const json = await expectOkJson("userId=123");

      expect(json).not.toHaveProperty("internalOnly");
      expect(json).not.toHaveProperty("requestMetadata");
      expect(json).not.toHaveProperty("createdAt");
      expect(json).not.toHaveProperty("updatedAt");
      expect(json).not.toHaveProperty("ip");
    });

    it("should include public profile fields inside stats.User for the client", async () => {
      mockStoredParts();

      const json = await expectOkJson("userId=123");

      expect(json.stats).toMatchObject({
        User: {
          name: "Test User",
          avatar: {
            medium: "https://example.com/avatar-medium.webp",
          },
          createdAt: 1_700_000_000,
        },
      });
    });

    it("should keep bootstrap responses limited to identity fields", async () => {
      mockStoredParts();

      const json = await expectBootstrapJson("userId=123&view=bootstrap");

      expect(json).not.toHaveProperty("stats");
      expect(json).not.toHaveProperty("statistics");
      expect(json).not.toHaveProperty("favourites");
      expect(json).not.toHaveProperty("pages");
      expect(json).not.toHaveProperty("aggregates");
    });
  });

  describe("Response Headers and CORS", () => {
    it("should include Content-Type application/json header", async () => {
      mockStoredParts();
      const res = await callGet("userId=123");
      expect(res.headers.get("Content-Type")).toBe("application/json");
    });

    it("should include Vary: Origin header for CORS cache control", async () => {
      mockStoredParts();
      const res = await callGet("userId=123");
      expect(res.headers.get("Vary")).toBe("Origin");
    });

    it("should set CORS Access-Control-Allow-Origin from request origin when no config", async () => {
      mockStoredParts();
      const res = await callGet("userId=123", {
        origin: "http://example.dev",
      });
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "http://example.dev",
      );
    });

    it("should use NEXT_PUBLIC_APP_URL over request origin when configured", async () => {
      (process.env as Record<string, string | undefined>)[
        "NEXT_PUBLIC_APP_URL"
      ] = "https://configured.example";
      mockStoredParts();

      const res = await callGet("userId=123", {
        origin: "http://different-origin.dev",
      });
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://configured.example",
      );
    });

    it("should echo X-Request-Id when the caller provides one", async () => {
      mockStoredParts();

      const res = await callGet("userId=123", {
        origin: "http://example.dev",
        "x-request-id": "req-user-12345",
      });

      expect(res.headers.get("X-Request-Id")).toBe("req-user-12345");
      expect(res.headers.get("Access-Control-Expose-Headers")).toContain(
        "X-Request-Id",
      );
    });
  });

  describe("Analytics Tracking", () => {
    it("should increment successful_requests analytics on successful fetch", async () => {
      mockStoredParts();
      await callGet("userId=123");
      expect(sharedRedisMockIncr).toHaveBeenCalledWith(
        "analytics:user_api:successful_requests",
      );
    });

    it("should increment failed_requests analytics when missing parameters", async () => {
      await callGet();
      expect(sharedRedisMockIncr).toHaveBeenCalledWith(
        "analytics:user_api:failed_requests",
      );
    });

    it("should increment failed_requests analytics when Redis error occurs", async () => {
      sharedRedisMockMget.mockRejectedValueOnce(new Error("Redis error"));
      await callGet("userId=123");
      expect(sharedRedisMockIncr).toHaveBeenCalledWith(
        "analytics:user_api:failed_requests",
      );
    });
  });

  describe("Rate Limiting", () => {
    it("should return 429 before touching Redis when the Upstash limiter blocks the request", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({
        success: false,
        limit: 60,
        remaining: 0,
        reset: Date.now() + 5_000,
        pending: Promise.resolve(),
      });

      const res = await callGet("userId=123");

      expect(res.status).toBe(429);
      const json = await getResponseJson<{ error?: string }>(res);
      expect(json.error).toBe("Too many requests");
      expect(sharedRedisMockMget).not.toHaveBeenCalled();
      expect(sharedRedisMockIncr).toHaveBeenCalledWith(
        "analytics:user_api:failed_requests",
      );
      expect(res.headers.get("Retry-After")).toBeTruthy();
    });
  });
});

describe("User API OPTIONS Endpoint", () => {
  beforeEach(() => {
    allowConsoleWarningsAndErrors();
    mock.clearAllMocks();
  });

  afterEach(() => {
    mock.clearAllMocks();
    delete (process.env as Record<string, string | undefined>)[
      "NEXT_PUBLIC_APP_URL"
    ];
  });

  describe("CORS Preflight Handling", () => {
    it("should return 200 status for OPTIONS request", () => {
      const req = createReq();
      const res = OPTIONS(req);
      expect(res.status).toBe(200);
    });

    it("should include Content-Type header in OPTIONS response", () => {
      const req = createReq();
      const res = OPTIONS(req);
      expect(res.headers.get("Content-Type")).toBe("application/json");
    });

    it("should include Vary: Origin header", () => {
      const req = createReq();
      const res = OPTIONS(req);
      expect(res.headers.get("Vary")).toBe("Origin");
    });

    it("should include Access-Control-Allow-Methods header", () => {
      const req = createReq();
      const res = OPTIONS(req);
      const methods = res.headers.get("Access-Control-Allow-Methods");
      expect(methods).toContain("GET");
      expect(methods).toContain("HEAD");
      expect(methods).toContain("OPTIONS");
    });

    it("should include Access-Control-Allow-Headers header", () => {
      const req = createReq();
      const res = OPTIONS(req);
      expect(res.headers.get("Access-Control-Allow-Headers")).toBe(
        "Content-Type",
      );
    });

    it("should set CORS origin from request origin header", () => {
      const req = createReq(undefined, { origin: "http://example.dev" });
      const res = OPTIONS(req);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "http://example.dev",
      );
    });

    it("should use NEXT_PUBLIC_APP_URL when configured", () => {
      (process.env as Record<string, string | undefined>)[
        "NEXT_PUBLIC_APP_URL"
      ] = "https://configured.example";
      const req = createReq(undefined, {
        origin: "http://different-origin.dev",
      });
      const res = OPTIONS(req);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://configured.example",
      );
    });
  });
});
