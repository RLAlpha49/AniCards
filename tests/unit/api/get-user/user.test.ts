import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import {
  sharedRedisMockGet,
  sharedRedisMockIncr,
} from "@/tests/unit/__setup__.test";

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

  // Check statistics if present in expected (allow explicit null)
  if (
    Object.prototype.hasOwnProperty.call(expected, "statistics") ||
    Object.prototype.hasOwnProperty.call(expected, "stats")
  ) {
    const expStats = expected.statistics ?? expected.stats;
    if (expStats === null || expStats === undefined) {
      expect(json.statistics).toEqual(expStats);
    } else if (typeof expStats === "object") {
      expect(json.statistics).toMatchObject(expStats);
    } else {
      expect(json.statistics).toEqual(expStats);
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
    // If we are looking for a part key and we only have one value (legacy mock), return null
    if (
      values.length === 1 &&
      (key.endsWith(":meta") ||
        key.endsWith(":activity") ||
        key.endsWith(":favourites") ||
        key.endsWith(":pages"))
    ) {
      return null;
    }

    if (callIndex < values.length) {
      const v = values[callIndex++];
      if (v instanceof Error) throw v;
      return v;
    }
    return null;
  });
}

describe("User API GET Endpoint", () => {
  beforeEach(() => {
    mock.clearAllMocks();
    sharedRedisMockIncr.mockResolvedValue(1);
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
      const userData = { userId: 123, username: "testUser" };
      mockRedisSequence(JSON.stringify(userData));
      await expectOkJson("userId=123", userData);
    });

    it("should accept valid username with letters, numbers, hyphens, underscores", async () => {
      const userData = { userId: 123, username: "test_user-123" };
      mockRedisSequence("123", JSON.stringify(userData));
      await expectOkJson("username=test_user-123", userData);
    });

    it("should normalize username by trimming whitespace", async () => {
      const userData = { userId: 123, username: "testUser" };
      mockRedisSequence("123", JSON.stringify(userData));
      await expectOkJson("username= testUser ", userData);
    });

    it("should accept exactly 100 character username", async () => {
      const username = "a".repeat(100);
      const userData = { userId: 123, username };
      mockRedisSequence("123", JSON.stringify(userData));
      await expectOkJson(`username=${username}`, userData);
    });
  });

  describe("UserId Query Path", () => {
    it("should fetch user data by userId when parameter is provided", async () => {
      const userData = {
        userId: 123,
        username: "testUser",
        stats: { score: 10 },
      };
      mockRedisSequence(JSON.stringify(userData));
      await expectOkJson("userId=123", userData);
      expect(sharedRedisMockGet).toHaveBeenCalledWith("user:123");
    });

    it("should return 404 when user data is not found in Redis", async () => {
      mockRedisSequence(null);
      await expectError("userId=123", 404, "User not found");
    });

    it("should handle large userId values", async () => {
      const userData = { userId: 2147483647, username: "largeId" };
      mockRedisSequence(JSON.stringify(userData));
      await expectOkJson("userId=2147483647", userData);
    });

    it("should return 500 when Redis throws an error during fetch", async () => {
      mockRedisSequence(new Error("Redis connection failed"));
      await expectError("userId=123", 500, "Failed to fetch user data");
    });
  });

  describe("Username Query Path", () => {
    it("should resolve username to userId via index and fetch user data", async () => {
      const userData = { userId: 456, username: "alice" };
      mockRedisSequence("456", JSON.stringify(userData));
      await expectOkJson("username=alice", userData);
      expect(sharedRedisMockGet).toHaveBeenCalledWith("username:alice");
      expect(sharedRedisMockGet).toHaveBeenCalledWith("user:456");
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
      const userData = { userId: 111, username: "TestUser" };
      mockRedisSequence("111", JSON.stringify(userData));
      await expectOkJson("username=TESTUSER", userData);
      expect(sharedRedisMockGet).toHaveBeenCalledWith("username:testuser");
    });

    it("should handle username with spaces (normalized)", async () => {
      const userData = { userId: 222, username: "test user" };
      mockRedisSequence("222", JSON.stringify(userData));
      await expectOkJson("username=test user", userData);
    });

    it("should return 500 when Redis throws error during user data fetch", async () => {
      mockRedisSequence("333", new Error("Redis disconnected"));
      await expectError("username=someuser", 500, "Failed to fetch user data");
    });
  });

  describe("Response Headers and CORS", () => {
    it("should include Content-Type application/json header", async () => {
      const userData = { userId: 123, username: "test" };
      mockRedisSequence(JSON.stringify(userData));
      const res = await callGet("userId=123");
      expect(res.headers.get("Content-Type")).toBe("application/json");
    });

    it("should include Vary: Origin header for CORS cache control", async () => {
      const userData = { userId: 123, username: "test" };
      mockRedisSequence(JSON.stringify(userData));
      const res = await callGet("userId=123");
      expect(res.headers.get("Vary")).toBe("Origin");
    });

    it("should set CORS Access-Control-Allow-Origin from request origin when no config", async () => {
      const userData = { userId: 123, username: "test" };
      mockRedisSequence(JSON.stringify(userData));
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
      const userData = { userId: 123, username: "test" };
      mockRedisSequence(JSON.stringify(userData));
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
      const userData = { userId: 123, username: "test" };
      mockRedisSequence(JSON.stringify(userData));
      const res = await callGet("userId=123", {
        "x-forwarded-for": "127.0.0.1",
      });
      expect(res.headers.get("Access-Control-Allow-Origin")).toBeTruthy();
    });

    it("should include CORS Access-Control-Allow-Methods header on success", async () => {
      const userData = { userId: 123, username: "test" };
      mockRedisSequence(JSON.stringify(userData));
      const res = await callGet("userId=123");
      const methods = res.headers.get("Access-Control-Allow-Methods");
      expect(methods).toContain("GET");
    });
  });

  describe("Data Serialization", () => {
    it("should parse and return valid user data from Redis JSON string", async () => {
      const userData = {
        userId: 123,
        username: "testUser",
        stats: { score: 100, level: 5 },
      };
      mockRedisSequence(JSON.stringify(userData));
      await expectOkJson("userId=123", userData);
    });

    it("should handle user data with nested objects", async () => {
      const userData = {
        userId: 123,
        username: "testUser",
        stats: {
          anime: { watched: 50, completed: 30 },
          manga: { read: 100, completed: 50 },
        },
      };
      mockRedisSequence(JSON.stringify(userData));
      await expectOkJson("userId=123", userData);
    });

    it("should handle user data with arrays", async () => {
      const userData = {
        userId: 123,
        username: "testUser",
        favorites: [
          { id: 1, title: "Attack on Titan" },
          { id: 2, title: "Death Note" },
        ],
      };
      mockRedisSequence(JSON.stringify(userData));
      await expectOkJson("userId=123", userData);
    });

    it("should handle user data with null values", async () => {
      const userData = {
        userId: 123,
        username: "testUser",
        bio: null,
        stats: null,
      };
      mockRedisSequence(JSON.stringify(userData));
      await expectOkJson("userId=123", userData);
    });
  });

  describe("Analytics Tracking", () => {
    it("should increment successful_requests analytics on successful fetch", async () => {
      const userData = { userId: 123, username: "test" };
      mockRedisSequence(JSON.stringify(userData));
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
      mockRedisSequence(new Error("Redis error"));
      await callGet("userId=123");
      expect(sharedRedisMockIncr).toHaveBeenCalledWith(
        "analytics:user_api:failed_requests",
      );
    });

    it("should handle analytics increment failure gracefully", async () => {
      sharedRedisMockIncr.mockRejectedValue(new Error("Analytics failed"));
      const userData = { userId: 123, username: "test" };
      mockRedisSequence(JSON.stringify(userData));
      const res = await callGet("userId=123");
      expect(res.status).toBe(200);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle malformed JSON from Redis", async () => {
      mockRedisSequence("{ invalid json");
      await expectError("userId=123", 500, "Failed to fetch user data");
    });

    it("should handle undefined Redis response", async () => {
      mockRedisSequence(undefined);
      await expectError("userId=123", 404, "User not found");
    });

    it("should prioritize userId over username when both provided", async () => {
      const userData = { userId: 123, username: "testUser" };
      mockRedisSequence(JSON.stringify(userData));
      await expectOkJson("userId=123&username=ignored", userData);
      expect(sharedRedisMockGet).toHaveBeenCalledWith("user:123");
      expect(sharedRedisMockGet).not.toHaveBeenCalledWith("username:ignored");
    });

    it("should handle IP header extraction for logging", async () => {
      const userData = { userId: 123, username: "test" };
      mockRedisSequence(JSON.stringify(userData));
      const req = new Request(`${API_BASE}?userId=123`, {
        headers: { "x-forwarded-for": "192.168.1.1" },
      });
      const res = await GET(req);
      expect(res.status).toBe(200);
    });

    it("should default to 127.0.0.1 when no IP header provided", async () => {
      const userData = { userId: 123, username: "test" };
      mockRedisSequence(JSON.stringify(userData));
      const req = new Request(`${API_BASE}?userId=123`, {
        headers: {},
      });
      const res = await GET(req);
      expect(res.status).toBe(200);
    });
  });

  describe("HTTP Status Codes", () => {
    it("should return 200 for successful user fetch by userId", async () => {
      mockRedisSequence(JSON.stringify({ userId: 123, username: "test" }));
      const res = await callGet("userId=123");
      expect(res.status).toBe(200);
    });

    it("should return 200 for successful user fetch by username", async () => {
      mockRedisSequence(
        "123",
        JSON.stringify({ userId: 123, username: "test" }),
      );
      const res = await callGet("username=test");
      expect(res.status).toBe(200);
    });

    it("should return 400 for invalid parameter format", async () => {
      const res = await callGet("userId=abc");
      expect(res.status).toBe(400);
    });

    it("should return 404 when user not found", async () => {
      mockRedisSequence(null);
      const res = await callGet("userId=999");
      expect(res.status).toBe(404);
    });

    it("should return 500 for Redis errors", async () => {
      mockRedisSequence(new Error("Connection timeout"));
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
      expect(res.body).toBe(null);
    });
  });
});
