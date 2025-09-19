import { POST } from "./route";

// Set up mocks for @upstash/redis.
const mockKeys = jest.fn();
const mockGet = jest.fn();
const mockSet = jest.fn();
const mockDel = jest.fn();
const fakeRedisClient = {
  keys: mockKeys,
  get: mockGet,
  set: mockSet,
  del: mockDel,
  incr: jest.fn(() => Promise.resolve(1)),
};

jest.mock("@upstash/redis", () => ({
  Redis: {
    fromEnv: jest.fn(() => fakeRedisClient),
  },
}));

// Set a dummy CRON_SECRET for testing.
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

    // Mock global.fetch to always return a successful AniList response
    global.fetch = jest.fn().mockResolvedValue({
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

    // Mock global.fetch to return 404 errors (user not found on AniList)
    global.fetch = jest.fn().mockResolvedValue({
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
