import { POST } from "./route";

/**
 * Mocks the Redis keys command used by the cron job.
 * @source
 */
const mockKeys = jest.fn();
/**
 * Mocks the Redis get command used to fetch user payloads.
 * @source
 */
const mockGet = jest.fn();
/**
 * Mocks the Redis set command for writing updated user data.
 * @source
 */
const mockSet = jest.fn();
/**
 * Mocks the Redis del command for cleanup and removal operations.
 * @source
 */
const mockDel = jest.fn();
/**
 * Aggregated fake Redis client that exposes stubbed methods for the cron tests.
 * @source
 */
const fakeRedisClient = {
  keys: mockKeys,
  get: mockGet,
  set: mockSet,
  del: mockDel,
  incr: jest.fn(async () => 1),
};

jest.mock("@upstash/redis", () => ({
  Redis: {
    fromEnv: jest.fn(() => fakeRedisClient),
  },
}));

/**
 * Dummy cron secret used to satisfy authorization checks in tests.
 * @source
 */
const CRON_SECRET = "testsecret";
process.env.CRON_SECRET = CRON_SECRET;

describe("Cron API POST Endpoint", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it("should return 401 Unauthorized when the secret is missing or invalid", async () => {
    const req = new Request("http://localhost/api/cron", {
      headers: { "x-cron-secret": "wrongsecret" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const text = await res.text();
    expect(text).toBe("Unauthorized");
  });

  it("should process with zero users if no keys are found", async () => {
    // Simulate no user keys found.
    mockKeys.mockResolvedValueOnce([]);
    const req = new Request("http://localhost/api/cron", {
      headers: { "x-cron-secret": CRON_SECRET },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe("Updated 0/0 users successfully. Failed: 0, Removed: 0");
    expect(mockKeys).toHaveBeenCalledWith("user:*");
  });

  it("should process and update users successfully in one batch", async () => {
    // Simulate 5 user keys
    const userKeys = ["user:1", "user:2", "user:3", "user:4", "user:5"];
    mockKeys.mockResolvedValueOnce(userKeys);
    // For each key, simulate valid and distinct user data and a successful update.
    mockGet.mockImplementation((key: string) => {
      // Check if this is a failure tracking key
      if (key.startsWith("failed_updates:")) {
        return Promise.resolve(null); // No previous failures
      }
      // User data key
      const id = key.split(":")[1];
      return Promise.resolve(
        JSON.stringify({
          userId: id,
          username: `user${id}`,
          stats: { dummy: Number(id) },
          updatedAt: new Date(2024, 0, 1).toISOString(), // Old date to ensure selection
        }),
      );
    });
    mockSet.mockResolvedValue(true);
    mockDel.mockResolvedValue(1); // Mock successful deletion for clearing failure tracking

    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { stats: "mocked" } }),
    });

    const req = new Request("http://localhost/api/cron", {
      headers: { "x-cron-secret": CRON_SECRET },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe(
      `Updated ${userKeys.length}/${userKeys.length} users successfully. Failed: 0, Removed: 0`,
    );
  });

  it("should return 500 and an error message if redis keys retrieval fails", async () => {
    // Simulate an error when fetching keys.
    mockKeys.mockRejectedValueOnce(new Error("Redis error"));
    const req = new Request("http://localhost/api/cron", {
      headers: { "x-cron-secret": CRON_SECRET },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).toBe("Cron job failed");
  });

  it("should track 404 failures and remove users after 3 failures", async () => {
    // Simulate 1 user that will get 404 errors
    const userKeys = ["user:123"];
    mockKeys.mockResolvedValueOnce(userKeys);

    mockGet.mockImplementation((key: string) => {
      if (key.startsWith("failed_updates:")) {
        return Promise.resolve("2"); // User already has 2 failures
      }
      // User data key
      return Promise.resolve(
        JSON.stringify({
          userId: "123",
          username: "failing_user",
          stats: { dummy: 1 },
          updatedAt: new Date(2024, 0, 1).toISOString(),
        }),
      );
    });

    mockSet.mockResolvedValue(true);
    mockDel.mockResolvedValue(1);

    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: "User not found" }),
    });

    const req = new Request("http://localhost/api/cron", {
      headers: { "x-cron-secret": CRON_SECRET },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe("Updated 0/1 users successfully. Failed: 1, Removed: 1");

    // Verify that user data, failure tracking, and card configs were deleted (user removed)
    expect(mockDel).toHaveBeenCalledWith("user:123");
    expect(mockDel).toHaveBeenCalledWith("failed_updates:123");
    expect(mockDel).toHaveBeenCalledWith("cards:123");
  });
});
