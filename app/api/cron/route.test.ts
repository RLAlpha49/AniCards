import { POST } from "./route";

// Set up mocks for @upstash/redis.
const mockKeys = jest.fn();
const mockGet = jest.fn();
const mockSet = jest.fn();
const fakeRedisClient = {
  keys: mockKeys,
  get: mockGet,
  set: mockSet,
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
    expect(text).toBe("Updated 0/0 users successfully");
    expect(mockKeys).toHaveBeenCalledWith("user:*");
  });

  it("should process and update users successfully in one batch", async () => {
    // Simulate 5 user keys
    const userKeys = ["user:1", "user:2", "user:3", "user:4", "user:5"];
    mockKeys.mockResolvedValueOnce(userKeys);
    // For each key, simulate valid and distinct user data and a successful update.
    mockGet.mockImplementation((key: string) => {
      const id = key.split(":")[1];
      return Promise.resolve(
        JSON.stringify({
          userId: Number(id),
          username: `user${id}`,
          stats: { dummy: Number(id) },
        }),
      );
    });
    mockSet.mockResolvedValue(true);

    const req = new Request("http://localhost/api/cron", {
      headers: { "x-cron-secret": CRON_SECRET },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe(
      `Updated ${userKeys.length}/${userKeys.length} users successfully`,
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
});
