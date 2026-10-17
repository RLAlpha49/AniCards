import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import {
  sharedRedisMockGet,
  sharedRedisMockIncr,
  sharedRedisMockMget,
} from "@/tests/unit/__setup__";
import { splitUserRecord, UserDataPart } from "@/lib/server/user-data";
import type { UserRecord } from "@/lib/types/records";

import { GET, OPTIONS } from "@/app/api/get-user/route";

/**
 * Extracts the response JSON payload for assertions.
 * @param response - Response to parse.
 * @returns Parsed JSON from the response body.
 * @source
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getResponseJson(response: Response): Promise<any> {
  return response.json();
}

const API_BASE = "http://localhost/api/get-user";
const DEFAULT_HEADERS = { "x-forwarded-for": "127.0.0.1" };

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

async function expectError(
  query: string | undefined,
  status: number,
  errorMsg: string,
) {
  const res = await callGet(query);
  expect(res.status).toBe(status);
  const json = await getResponseJson(res);
  expect(json?.error).toBe(errorMsg);
}

async function expectOkJson(
  query: string | undefined,
  expected: Record<string, unknown>,
) {
  const res = await callGet(query);
  expect(res.status).toBe(200);
  const json = await getResponseJson(res);

  // Check core fields
  expect(String(json.userId)).toBe(String(expected.userId));
  if (expected.username) expect(json.username).toBe(expected.username);

  // `stats` is the full AniList response; `statistics` is only its statistics block.
  if (
    Object.hasOwn(expected, "statistics") ||
    Object.hasOwn(expected, "stats")
  ) {
    const usesFullStats = Object.hasOwn(expected, "stats");
    const expStats = usesFullStats ? expected.stats : expected.statistics;
    const actualStats = usesFullStats ? json.stats : json.statistics;
    if (expStats === null || expStats === undefined) {
      expect(actualStats).toEqual(expStats);
    } else if (typeof expStats === "object") {
      expect(actualStats).toMatchObject(expStats);
    } else {
      expect(actualStats).toEqual(expStats);
    }
  }

  // Check favourites if provided in expected
  if (expected.favourites || expected.favorites) {
    const expFavs = expected.favourites || expected.favorites;
    if (typeof expFavs === "object" && expFavs !== null) {
      expect(json.favourites).toMatchObject(expFavs);
    } else {
      expect(json.favourites).toEqual(expFavs);
    }
  }

  // Check other fields if they were in expected
  Object.keys(expected).forEach((key) => {
    if (
      ![
        "userId",
        "username",
        "updatedAt",
        "ip",
        "statistics",
        "stats",
        "User",
        "favourites",
        "favorites",
        "pages",
      ].includes(key)
    ) {
      expect(json[key]).toEqual(expected[key]);
    }
  });
}

function mockRedisSequence(...values: Array<unknown>) {
  sharedRedisMockGet.mockReset();

  let callIndex = 0;
  sharedRedisMockGet.mockImplementation(async (key: string) => {
    if (callIndex < values.length) {
      const v = values[callIndex++];
      if (v instanceof Error) throw v;
      return v;
    }
    return null;
  });
}

function mockUserRecord(userId: number, username: string) {
  return {
    userId: String(userId),
    username,
    stats: {
      User: {
        statistics: { anime: { count: 1 }, manga: { count: 0 } },
        stats: { activityHistory: [] },
      },
    },
    ip: "127.0.0.1",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-02T00:00:00.000Z",
  };
}

function mockSplitUserData(userData: Record<string, unknown>) {
  const parts = splitUserRecord(userData as unknown as UserRecord);
  sharedRedisMockMget.mockImplementation(async (...keys: string[]) =>
    keys.map((key) => {
      const part = key.split(":").at(-1) as UserDataPart;
      const value = parts[part];
      return value === undefined ? null : JSON.stringify(value);
    }),
  );
}

describe("User API GET Endpoint", () => {
  beforeEach(() => {
    mock.clearAllMocks();
    sharedRedisMockIncr.mockResolvedValue(1);
  });

  afterEach(() => {
    mock.clearAllMocks();
    sharedRedisMockMget.mockReset();
    sharedRedisMockMget.mockImplementation(async (...keys: string[]) =>
      keys.map(() => null),
    );
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

    it("should accept userId as a valid positive integer", async () => {
      const userData = mockUserRecord(123, "testUser");
      mockSplitUserData(userData);
      await expectOkJson("userId=123", userData);
      expect(sharedRedisMockMget).toHaveBeenCalledWith(
        "user:123:meta",
        "user:123:activity",
        "user:123:favourites",
        "user:123:statistics",
        "user:123:pages",
        "user:123:planning",
        "user:123:current",
        "user:123:rewatched",
        "user:123:completed",
        "user:123:aggregates",
      );
    });

    it("should accept valid username with letters, numbers, hyphens, underscores", async () => {
      const userData = mockUserRecord(123, "test_user-123");
      mockRedisSequence("123");
      mockSplitUserData(userData);
      await expectOkJson("username=test_user-123", userData);
    });

    it("should normalize username by trimming whitespace", async () => {
      const userData = mockUserRecord(123, "testUser");
      mockRedisSequence("123");
      mockSplitUserData(userData);
      await expectOkJson("username= testUser ", userData);
    });

    it("should accept exactly 100 character username", async () => {
      const username = "a".repeat(100);
      const userData = mockUserRecord(123, username);
      mockRedisSequence("123");
      mockSplitUserData(userData);
      await expectOkJson(`username=${username}`, userData);
    });
  });

  describe("UserId Query Path", () => {
    it("should fetch user data by userId when parameter is provided", async () => {
      const userData = mockUserRecord(123, "testUser");
      mockSplitUserData(userData);
      await expectOkJson("userId=123", userData);
      expect(sharedRedisMockMget).toHaveBeenCalled();
    });

    it("should return 404 when user data is not found in Redis", async () => {
      await expectError("userId=123", 404, "User not found");
    });

    it("should handle large userId values", async () => {
      const userData = mockUserRecord(2147483647, "largeId");
      mockSplitUserData(userData);
      await expectOkJson("userId=2147483647", userData);
    });

    it("should return 500 when Redis throws an error during fetch", async () => {
      sharedRedisMockMget.mockRejectedValueOnce(
        new Error("Redis connection failed"),
      );
      await expectError("userId=123", 500, "Failed to fetch user data");
    });
  });

  describe("Username Query Path", () => {
    it("should resolve username to userId via index and fetch user data", async () => {
      mockRedisSequence("456");
      mockSplitUserData(mockUserRecord(456, "alice"));
      await expectOkJson("username=alice", {
        userId: "456",
        username: "alice",
      });
      expect(sharedRedisMockGet).toHaveBeenCalledWith("username:alice");
      expect(sharedRedisMockMget).toHaveBeenCalled();
    });

    it("should return 404 when username index does not exist", async () => {
      mockRedisSequence(null);
      await expectError("username=unknownuser", 404, "User not found");
    });

    it("should return 404 when username resolves to userId but user record is missing", async () => {
      mockRedisSequence("789", null);
      await expectError("username=orphaned", 404, "User not found");
    });

    it("should handle case-insensitive username lookup (normalized)", async () => {
      const userData = mockUserRecord(111, "TestUser");
      mockRedisSequence("111");
      mockSplitUserData(userData);
      await expectOkJson("username=TESTUSER", userData);
      expect(sharedRedisMockGet).toHaveBeenCalledWith("username:testuser");
    });

    it("should handle username with spaces (normalized)", async () => {
      const userData = mockUserRecord(222, "test user");
      mockRedisSequence("222");
      mockSplitUserData(userData);
      await expectOkJson("username=test user", userData);
    });

    it("should return 500 when Redis throws error during user data fetch", async () => {
      mockRedisSequence("333");
      sharedRedisMockMget.mockRejectedValueOnce(
        new Error("Redis disconnected"),
      );
      await expectError("username=someuser", 500, "Failed to fetch user data");
    });
  });

  describe("Response Headers and CORS", () => {
    it("should include Content-Type application/json header", async () => {
      mockSplitUserData(mockUserRecord(123, "test"));
      const res = await callGet("userId=123");
      expect(res.headers.get("Content-Type")).toBe("application/json");
    });

    it("should include Vary: Origin header for CORS cache control", async () => {
      mockSplitUserData(mockUserRecord(123, "test"));
      const res = await callGet("userId=123");
      expect(res.headers.get("Vary")).toBe("Origin");
    });

    it("should set CORS Access-Control-Allow-Origin from request origin when no config", async () => {
      mockSplitUserData(mockUserRecord(123, "test"));
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
      mockSplitUserData(mockUserRecord(123, "test"));
      const res = await callGet("userId=123", {
        origin: "http://different-origin.dev",
      });
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://configured.example",
      );
    });

    it("should default to * when no origin header and no config in dev", async () => {
      delete (process.env as Record<string, string | undefined>)[
        "NEXT_PUBLIC_APP_URL"
      ];
      mockSplitUserData(mockUserRecord(123, "test"));
      const res = await callGet("userId=123", {
        "x-forwarded-for": "127.0.0.1",
      });
      expect(res.headers.get("Access-Control-Allow-Origin")).toBeTruthy();
    });

    it("should include CORS Access-Control-Allow-Methods header on success", async () => {
      mockSplitUserData(mockUserRecord(123, "test"));
      const res = await callGet("userId=123");
      const methods = res.headers.get("Access-Control-Allow-Methods");
      expect(methods).toContain("GET");
    });
  });

  describe("Data Serialization", () => {
    it("should reconstruct user data from split Redis JSON parts", async () => {
      const userData = mockUserRecord(123, "testUser");
      mockSplitUserData(userData);
      await expectOkJson("userId=123", userData);
    });

    it("should handle user data with nested objects", async () => {
      const userData = mockUserRecord(123, "testUser");
      mockSplitUserData(userData);
      await expectOkJson("userId=123", userData);
    });

    it("should handle user data with arrays", async () => {
      const userData = mockUserRecord(123, "testUser");
      mockSplitUserData(userData);
      await expectOkJson("userId=123", userData);
    });

    it("should handle user data with null values", async () => {
      const userData = mockUserRecord(123, "testUser");
      mockSplitUserData({ ...userData, stats: null });
      await expectOkJson("userId=123", {
        userId: 123,
        username: "testUser",
        statistics: null,
      });
    });
  });

  describe("Analytics Tracking", () => {
    it("should increment successful_requests analytics on successful fetch", async () => {
      mockSplitUserData(mockUserRecord(123, "test"));
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

    it("should handle analytics increment failure gracefully", async () => {
      sharedRedisMockIncr.mockRejectedValue(new Error("Analytics failed"));
      mockSplitUserData(mockUserRecord(123, "test"));
      const res = await callGet("userId=123");
      expect(res.status).toBe(200);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle malformed JSON from Redis", async () => {
      sharedRedisMockMget.mockResolvedValueOnce([
        "{ invalid json",
        ...Array.from({ length: 9 }, () => null),
      ]);
      await expectError("userId=123", 404, "User not found");
    });

    it("should handle undefined Redis response", async () => {
      await expectError("userId=123", 404, "User not found");
    });

    it("should prioritize userId over username when both provided", async () => {
      const userData = mockUserRecord(123, "testUser");
      mockSplitUserData(userData);
      await expectOkJson("userId=123&username=ignored", userData);
      expect(sharedRedisMockMget).toHaveBeenCalled();
      expect(sharedRedisMockGet).not.toHaveBeenCalledWith("username:ignored");
    });

    it("should handle IP header extraction for logging", async () => {
      mockSplitUserData(mockUserRecord(123, "test"));
      const req = new Request(`${API_BASE}?userId=123`, {
        headers: { "x-forwarded-for": "192.168.1.1" },
      });
      const res = await GET(req);
      expect(res.status).toBe(200);
    });

    it("should default to 127.0.0.1 when no IP header provided", async () => {
      mockSplitUserData(mockUserRecord(123, "test"));
      const req = new Request(`${API_BASE}?userId=123`, {
        headers: {},
      });
      const res = await GET(req);
      expect(res.status).toBe(200);
    });
  });

  describe("HTTP Status Codes", () => {
    it("should return 200 for successful user fetch by userId", async () => {
      mockSplitUserData(mockUserRecord(123, "test"));
      const res = await callGet("userId=123");
      expect(res.status).toBe(200);
    });

    it("should return 200 for successful user fetch by username", async () => {
      mockRedisSequence("123");
      mockSplitUserData(mockUserRecord(123, "test"));
      const res = await callGet("username=test");
      expect(res.status).toBe(200);
    });

    it("should return 400 for invalid parameter format", async () => {
      const res = await callGet("userId=abc");
      expect(res.status).toBe(400);
    });

    it("should return 404 when user not found", async () => {
      const res = await callGet("userId=999");
      expect(res.status).toBe(404);
    });

    it("should return 500 for Redis errors", async () => {
      sharedRedisMockMget.mockRejectedValueOnce(
        new Error("Connection timeout"),
      );
      const res = await callGet("userId=123");
      expect(res.status).toBe(500);
    });
  });
});

describe("User API OPTIONS Endpoint", () => {
  beforeEach(() => {
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

    it("should return empty response body for OPTIONS", () => {
      const req = createReq();
      const res = OPTIONS(req);
      expect(res.body).toBeNull();
    });
  });
});
