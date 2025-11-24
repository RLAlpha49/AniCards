// Declare mockLimit in the outer scope so tests can access it.
var mockLimit = jest.fn().mockResolvedValue({ success: true });
var mockRedisSet = jest.fn();

jest.mock("@upstash/redis", () => {
  return {
    Redis: {
      fromEnv: jest.fn(() => ({
        set: mockRedisSet,
        incr: jest.fn(() => Promise.resolve(1)),
      })),
    },
  };
});

jest.mock("@upstash/ratelimit", () => {
  const RatelimitMock = jest.fn().mockImplementation(() => ({
    limit: mockLimit,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  })) as any;
  RatelimitMock.slidingWindow = jest.fn();
  return {
    Ratelimit: RatelimitMock,
  };
});

// Set the app URL for same-origin validation testing
process.env.NEXT_PUBLIC_APP_URL = "http://localhost";

import { POST } from "./route";

describe("Store Cards API POST Endpoint", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return rate limit error when limit is exceeded", async () => {
    // Simulate rate limit failure.
    mockLimit.mockResolvedValueOnce({ success: false });

    const req = new Request("http://localhost/api/store-cards", {
      method: "POST",
      headers: {
        "x-forwarded-for": "127.0.0.1",
        origin: "http://localhost",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: 1, statsData: {}, cards: [] }),
    });

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

    const req = new Request("http://localhost/api/store-cards", {
      method: "POST",
      headers: {
        "x-forwarded-for": "127.0.0.1",
        origin: "http://different-origin.com",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: 1, statsData: {}, cards: [] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");

    process.env.NODE_ENV = originalEnv;
  });

  it("should return 400 error when statsData contains an error", async () => {
    mockLimit.mockResolvedValueOnce({ success: true });

    const req = new Request("http://localhost/api/store-cards", {
      method: "POST",
      headers: {
        "x-forwarded-for": "127.0.0.1",
        origin: "http://localhost",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: 1,
        statsData: { error: "Invalid stats" },
        cards: [],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid data: Invalid stats");
  });

  it("should store card configurations successfully and return success", async () => {
    mockLimit.mockResolvedValueOnce({ success: true });
    mockRedisSet.mockResolvedValueOnce(true); // Simulate successful Redis storage

    const reqBody = {
      userId: 123,
      statsData: { score: 95 },
      cards: [
        {
          cardName: "animeStats",
          variation: "default",
          titleColor: "#000",
          backgroundColor: "#fff",
          textColor: "#333",
          circleColor: "#f00",
          borderColor: "#e4e2e2",
        },
      ],
    };

    const req = new Request("http://localhost/api/store-cards", {
      method: "POST",
      headers: {
        "x-forwarded-for": "127.0.0.1",
        origin: "http://localhost",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(reqBody),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.userId).toBe(123);

    // Verify that redisClient.set was called with the correct key and payload.
    const expectedKey = `cards:123`;
    expect(mockRedisSet).toHaveBeenCalledWith(expectedKey, expect.any(String));

    // Optionally, validate the stored payload.
    const storedData = JSON.parse(mockRedisSet.mock.calls[0][1]);
    expect(storedData).toHaveProperty("userId", 123);
    expect(storedData).toHaveProperty("cards");
    expect(storedData).toHaveProperty("updatedAt");
  });

  it("should return 500 if redis storage fails", async () => {
    mockLimit.mockResolvedValueOnce({ success: true });
    // Simulate a failure in redisClient.set.
    mockRedisSet.mockRejectedValueOnce(new Error("Redis failure"));

    const reqBody = {
      userId: 1,
      statsData: { score: 50 },
      cards: [
        {
          cardName: "animeStats",
          variation: "default",
          titleColor: "#000",
          backgroundColor: "#fff",
          textColor: "#333",
          circleColor: "#f00",
          borderColor: "#e4e2e2",
        },
      ],
    };

    const req = new Request("http://localhost/api/store-cards", {
      method: "POST",
      headers: {
        "x-forwarded-for": "127.0.0.1",
        origin: "http://localhost",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(reqBody),
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Card storage failed");
  });
});
