// Mocks for external dependencies.
var mockLimit = jest.fn().mockResolvedValue({ success: true });
var mockRedisSet = jest.fn();
var mockRedisGet = jest.fn();

jest.mock("@upstash/redis", () => {
  return {
    Redis: {
      fromEnv: jest.fn(() => ({
        set: mockRedisSet,
        get: mockRedisGet,
        incr: jest.fn(() => Promise.resolve(1)),
      })),
    },
  };
});

jest.mock("@upstash/ratelimit", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const RatelimitMock: any = jest.fn().mockImplementation(() => ({
    limit: mockLimit,
  }));
  RatelimitMock.slidingWindow = jest.fn().mockReturnValue("fake-limiter");
  return {
    Ratelimit: RatelimitMock,
  };
});

// Set the app URL for same-origin validation testing
process.env.NEXT_PUBLIC_APP_URL = "http://localhost";

// Import the module under test after the mocks above are defined.
import { POST } from "./route";

// Helper function to create test requests
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

describe("Store Users API POST Endpoint", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return 429 error if rate limit is exceeded", async () => {
    // Simulate a rate limit failure.
    mockLimit.mockResolvedValueOnce({ success: false });

    const reqBody = { userId: 1, username: "user1", stats: { score: 10 } };
    const req = createTestRequest(reqBody, "http://localhost");

    const res = await POST(req);
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toBe("Too many requests");
  });

  it("should reject cross-origin requests in production when origin differs", async () => {
    // Set NODE_ENV to production for this test
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    mockLimit.mockResolvedValueOnce({ success: true });

    const reqBody = { userId: 1, username: "user1", stats: { score: 10 } };
    const req = createTestRequest(reqBody, "http://different-origin.com");

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");

    process.env.NODE_ENV = originalEnv;
  });

  it("should successfully store new user data and update username index", async () => {
    mockLimit.mockResolvedValueOnce({ success: true });
    // Simulate new user record: no record found in Redis.
    mockRedisGet.mockResolvedValueOnce(null);
    // Simulate successful saving for user data and username index.
    mockRedisSet.mockResolvedValueOnce(true); // For user record.
    mockRedisSet.mockResolvedValueOnce(true); // For username index.

    const reqBody = { userId: 1, username: "UserOne", stats: { score: 10 } };
    const req = createTestRequest(reqBody, "http://localhost");

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.userId).toBe(1);

    // Verify the user record is fetched using the correct key.
    expect(mockRedisGet).toHaveBeenCalledWith("user:1");

    // Expect two calls to redisClient.set: one for the user record, one for updating the username index.
    expect(mockRedisSet).toHaveBeenCalledTimes(2);

    // Validate the first set call (user data).
    const storedValue = JSON.parse(mockRedisSet.mock.calls[0][1]);
    expect(storedValue.userId).toBe(1);
    expect(storedValue.username).toBe("UserOne");
    expect(storedValue.stats).toEqual({ score: 10 });
    expect(storedValue.ip).toBe("127.0.0.1");
    expect(storedValue).toHaveProperty("createdAt");
    expect(storedValue).toHaveProperty("updatedAt");

    // Validate the username index update.
    // The username should be normalized (trimmed and lowercased).
    expect(mockRedisSet.mock.calls[1][0]).toBe("username:userone");
    expect(mockRedisSet.mock.calls[1][1]).toBe("1");
  });

  it("should successfully store user data without username (skipping username index update)", async () => {
    mockLimit.mockResolvedValueOnce({ success: true });
    mockRedisGet.mockResolvedValueOnce(null);
    // Only one call is expected when no username is provided.
    mockRedisSet.mockResolvedValueOnce(true);

    const reqBody = { userId: 2, stats: { score: 20 } };
    const req = createTestRequest(reqBody, "http://localhost");

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.userId).toBe(2);

    // Expect only one call to save the user record (no username index update).
    expect(mockRedisSet).toHaveBeenCalledTimes(1);
    expect(mockRedisSet.mock.calls[0][0]).toBe("user:2");
  });

  it("should update an existing user record while preserving createdAt", async () => {
    mockLimit.mockResolvedValueOnce({ success: true });
    // Simulate an existing user record with a defined createdAt value.
    const existingRecord = {
      userId: 1,
      username: "ExistingUser",
      stats: { score: 5 },
      ip: "127.0.0.1",
      createdAt: "2022-01-01T00:00:00.000Z",
      updatedAt: "2022-01-01T00:00:00.000Z",
    };
    mockRedisGet.mockResolvedValueOnce(JSON.stringify(existingRecord));
    mockRedisSet.mockResolvedValueOnce(true); // For updating the user record.
    mockRedisSet.mockResolvedValueOnce(true); // For updating username index.

    const reqBody = { userId: 1, username: "NewName", stats: { score: 100 } };
    const req = createTestRequest(reqBody, "http://localhost");

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.userId).toBe(1);

    // Check that the existing createdAt value is preserved.
    const parsedStoredData = JSON.parse(mockRedisSet.mock.calls[0][1]);
    expect(parsedStoredData.createdAt).toBe("2022-01-01T00:00:00.000Z");
  });

  it("should return 500 error if redis storage fails", async () => {
    mockLimit.mockResolvedValueOnce({ success: true });
    mockRedisGet.mockResolvedValueOnce(null);
    // Simulate a failure when saving the user record.
    mockRedisSet.mockRejectedValueOnce(new Error("Redis failure"));

    const reqBody = { userId: 3, username: "user3", stats: { score: 30 } };
    const req = createTestRequest(reqBody, "http://localhost");

    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("User storage failed");
  });
});
