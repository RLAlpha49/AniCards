import {
  afterEach,
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  mock,
} from "bun:test";
import {
  sharedRedisMockSet,
  sharedRedisMockGet,
  sharedRedisMockIncr,
  sharedRatelimitMockLimit,
} from "../__setup__.test";

// Set the app URL for same-origin validation testing
const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
process.env.NEXT_PUBLIC_APP_URL = "http://localhost";

let POST: typeof import("./route").POST;
let OPTIONS: typeof import("./route").OPTIONS;

beforeAll(async () => {
  const module = await import("./route");
  POST = module.POST;
  OPTIONS = module.OPTIONS;
});

afterAll(() => {
  // Restore the original app URL
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
      ...(origin && { origin }),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(reqBody),
  });
}

/**
 * Helper to extract JSON response safely
 */
async function getJsonResponse(res: Response) {
  return res.clone().json();
}

describe("Store Users API", () => {
  afterEach(() => {
    mock.clearAllMocks();
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
      const originalEnv = process.env.NODE_ENV;
      (process.env as unknown as { NODE_ENV?: string }).NODE_ENV = "production";

      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });

      const reqBody = { userId: 1, username: "user1", stats: { score: 10 } };
      const req = createTestRequest(reqBody, "http://different-origin.com");

      const res = await POST(req);
      expect(res.status).toBe(401);
      const data = await getJsonResponse(res);
      expect(data.error).toBe("Unauthorized");
      expect(sharedRedisMockIncr).toHaveBeenCalledWith(
        "analytics:store_users:failed_requests",
      );

      (process.env as unknown as { NODE_ENV?: string }).NODE_ENV = originalEnv;
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
      expect(res.status).toBe(500);
      const data = await getJsonResponse(res);
      expect(data.error).toBe("User storage failed");
    });
  });

  describe("POST - Successful User Creation & Updates", () => {
    it("should successfully store new user with username", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      sharedRedisMockGet.mockResolvedValueOnce(null);
      sharedRedisMockSet.mockResolvedValueOnce(true);
      sharedRedisMockSet.mockResolvedValueOnce(true);

      const reqBody = { userId: 1, username: "UserOne", stats: { score: 10 } };
      const req = createTestRequest(reqBody, "http://localhost");

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await getJsonResponse(res);
      expect(data.success).toBe(true);
      expect(data.userId).toBe(1);

      expect(sharedRedisMockGet).toHaveBeenCalledWith("user:1");
      expect(sharedRedisMockSet).toHaveBeenCalledTimes(2);

      const storedValue = JSON.parse(sharedRedisMockSet.mock.calls[0][1]);
      expect(storedValue.userId).toBe(1);
      expect(storedValue.username).toBe("UserOne");
      expect(storedValue.stats).toEqual({ score: 10 });
      expect(storedValue.ip).toBe("127.0.0.1");
      expect(storedValue).toHaveProperty("createdAt");
      expect(storedValue).toHaveProperty("updatedAt");

      expect(sharedRedisMockSet.mock.calls[1][0]).toBe("username:userone");
      expect(sharedRedisMockSet.mock.calls[1][1]).toBe("1");

      expect(sharedRedisMockIncr).toHaveBeenCalledWith(
        "analytics:store_users:successful_requests",
      );
    });

    it("should successfully store new user without username", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      sharedRedisMockGet.mockResolvedValueOnce(null);
      sharedRedisMockSet.mockResolvedValueOnce(true);

      const reqBody = { userId: 2, stats: { score: 20 } };
      const req = createTestRequest(reqBody, "http://localhost");

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await getJsonResponse(res);
      expect(data.success).toBe(true);
      expect(data.userId).toBe(2);

      expect(sharedRedisMockSet).toHaveBeenCalledTimes(1);
      expect(sharedRedisMockSet.mock.calls[0][0]).toBe("user:2");

      const storedValue = JSON.parse(sharedRedisMockSet.mock.calls[0][1]);
      expect(storedValue.username).toBeUndefined();
    });

    it("should accept null username explicitly", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      sharedRedisMockGet.mockResolvedValueOnce(null);
      sharedRedisMockSet.mockResolvedValueOnce(true);

      const reqBody = { userId: 3, username: null, stats: { score: 30 } };
      const req = createTestRequest(reqBody, "http://localhost");

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await getJsonResponse(res);
      expect(data.success).toBe(true);
      expect(sharedRedisMockSet).toHaveBeenCalledTimes(1);
    });

    it("should normalize username (trim and lowercase)", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      sharedRedisMockGet.mockResolvedValueOnce(null);
      sharedRedisMockSet.mockResolvedValueOnce(true);
      sharedRedisMockSet.mockResolvedValueOnce(true);

      const reqBody = {
        userId: 4,
        username: "  UserName  ",
        stats: { score: 40 },
      };
      const req = createTestRequest(reqBody, "http://localhost");

      const res = await POST(req);
      expect(res.status).toBe(200);

      expect(sharedRedisMockSet.mock.calls[1][0]).toBe("username:username");
      expect(sharedRedisMockSet.mock.calls[1][1]).toBe("4");
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
      sharedRedisMockGet.mockResolvedValueOnce(JSON.stringify(existingRecord));
      sharedRedisMockSet.mockResolvedValueOnce(true);
      sharedRedisMockSet.mockResolvedValueOnce(true);

      const reqBody = { userId: 5, username: "NewName", stats: { score: 100 } };
      const req = createTestRequest(reqBody, "http://localhost");

      const res = await POST(req);
      expect(res.status).toBe(200);

      const storedValue = JSON.parse(sharedRedisMockSet.mock.calls[0][1]);
      expect(storedValue.createdAt).toBe("2022-01-01T00:00:00.000Z");
      expect(storedValue.updatedAt).not.toBe("2022-01-01T00:00:00.000Z");
      expect(storedValue.username).toBe("NewName");
      expect(storedValue.stats).toEqual({ score: 100 });
    });

    it("should handle complex stats objects", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      sharedRedisMockGet.mockResolvedValueOnce(null);
      sharedRedisMockSet.mockResolvedValueOnce(true);

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
      expect(res.status).toBe(200);

      const storedValue = JSON.parse(sharedRedisMockSet.mock.calls[0][1]);
      expect(storedValue.stats).toEqual(complexStats);
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
      sharedRedisMockGet.mockResolvedValueOnce(JSON.stringify(existingRecord));
      sharedRedisMockSet.mockResolvedValueOnce(true);

      const reqBody = { userId: 7, stats: { score: 50 } };
      const req = createTestRequest(reqBody, "http://localhost");

      const res = await POST(req);
      expect(res.status).toBe(200);

      expect(sharedRedisMockSet).toHaveBeenCalledTimes(1);
      const storedValue = JSON.parse(sharedRedisMockSet.mock.calls[0][1]);
      expect(storedValue.username).toBeUndefined();
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
      sharedRedisMockGet.mockResolvedValueOnce(JSON.stringify(existingRecord));
      sharedRedisMockSet.mockResolvedValueOnce(true);
      sharedRedisMockSet.mockResolvedValueOnce(true);

      const reqBody = { userId: 8, username: "NewName", stats: { score: 50 } };
      const req = createTestRequest(reqBody, "http://localhost");

      const res = await POST(req);
      expect(res.status).toBe(200);

      expect(sharedRedisMockSet).toHaveBeenCalledTimes(2);
      expect(sharedRedisMockSet.mock.calls[1][0]).toBe("username:newname");
      expect(sharedRedisMockSet.mock.calls[1][1]).toBe("8");
    });
  });

  describe("POST - Timestamp Handling", () => {
    it("should include updatedAt timestamp in stored record", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      sharedRedisMockGet.mockResolvedValueOnce(null);
      sharedRedisMockSet.mockResolvedValueOnce(true);

      const beforeTime = new Date();
      const reqBody = { userId: 9, username: "user9", stats: { score: 10 } };
      const req = createTestRequest(reqBody, "http://localhost");

      const res = await POST(req);
      const afterTime = new Date();

      expect(res.status).toBe(200);
      const stored = JSON.parse(sharedRedisMockSet.mock.calls[0][1]);
      const timestamp = new Date(stored.updatedAt);

      expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it("should generate new createdAt for new user records", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      sharedRedisMockGet.mockResolvedValueOnce(null);
      sharedRedisMockSet.mockResolvedValueOnce(true);

      const beforeTime = new Date();
      const reqBody = { userId: 10, username: "user10", stats: { score: 10 } };
      const req = createTestRequest(reqBody, "http://localhost");

      const res = await POST(req);
      const afterTime = new Date();

      expect(res.status).toBe(200);
      const stored = JSON.parse(sharedRedisMockSet.mock.calls[0][1]);
      const createdAt = new Date(stored.createdAt);

      expect(createdAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(createdAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });

  describe("POST - Error Handling", () => {
    it("should return 500 error if redis storage fails", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      sharedRedisMockGet.mockResolvedValueOnce(null);
      sharedRedisMockSet.mockRejectedValueOnce(new Error("Redis failure"));

      const reqBody = { userId: 11, username: "user11", stats: { score: 30 } };
      const req = createTestRequest(reqBody, "http://localhost");

      const res = await POST(req);
      expect(res.status).toBe(500);
      const data = await getJsonResponse(res);
      expect(data.error).toBe("User storage failed");
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
      expect(res.status).toBe(500);
      const data = await getJsonResponse(res);
      expect(data.error).toBe("User storage failed");
    });

    it("should recover gracefully from corrupted Redis record (invalid JSON)", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      sharedRedisMockGet.mockResolvedValueOnce("[object Object]");
      sharedRedisMockSet.mockResolvedValueOnce(true);

      const reqBody = { userId: 13, username: "user13", stats: { score: 30 } };
      const req = createTestRequest(reqBody, "http://localhost");

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await getJsonResponse(res);
      expect(data.success).toBe(true);

      const storedValue = JSON.parse(sharedRedisMockSet.mock.calls[0][1]);
      expect(storedValue.createdAt).toBeDefined();
    });

    it("should generate new createdAt when recovering from corrupted record", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      sharedRedisMockGet.mockResolvedValueOnce("corrupted data");
      sharedRedisMockSet.mockResolvedValueOnce(true);

      const beforeTime = new Date();
      const reqBody = { userId: 14, username: "user14", stats: { score: 30 } };
      const req = createTestRequest(reqBody, "http://localhost");

      const res = await POST(req);
      const afterTime = new Date();

      expect(res.status).toBe(200);
      const stored = JSON.parse(sharedRedisMockSet.mock.calls[0][1]);
      const createdAt = new Date(stored.createdAt);

      expect(createdAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(createdAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });

  describe("POST - CORS & Response Headers", () => {
    it("should include CORS headers in success response", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      sharedRedisMockGet.mockResolvedValueOnce(null);
      sharedRedisMockSet.mockResolvedValueOnce(true);

      const reqBody = { userId: 15, username: "user15", stats: { score: 10 } };
      const req = createTestRequest(reqBody, "http://localhost");

      const res = await POST(req);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "http://localhost",
      );
      expect(res.headers.get("Content-Type")).toBe("application/json");
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

      const reqBody = { userId: 16, username: "user16", stats: { score: 10 } };
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
      sharedRedisMockSet.mockRejectedValueOnce(new Error("Redis failure"));

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
