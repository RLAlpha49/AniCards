/**
 * Controls the mocked rate-limit outcome returned in each test scenario.
 * @source
 */
let mockLimit = jest.fn().mockResolvedValue({ success: true });
/**
 * Captures Redis `set` invocations to assert payloads without contacting Upstash.
 * @source
 */
let mockRedisSet = jest.fn();
let mockRedisGet = jest.fn();
let mockRedisIncr = jest.fn(async () => 1);

/**
 * Supplies the mocked Redis client referenced by the handler under test.
 * @source
 */
/** Create a named redis mock for store-cards tests */
function createRedisFromEnvMock() {
  return {
    set: mockRedisSet,
    get: mockRedisGet,
    incr: mockRedisIncr,
  };
}

jest.mock("@upstash/redis", () => ({
  Redis: {
    fromEnv: jest.fn(createRedisFromEnvMock),
  },
}));

/**
 * Provides a fake ratelimit implementation that exposes the mock limit handler.
 * @source
 */
jest.mock("@upstash/ratelimit", () => {
  /**
   * Mimics the public ratelimit interface used by the POST handler.
   * @source
   */
  class RatelimitMock {
    static readonly slidingWindow = jest.fn();
    public limit = mockLimit;
  }
  return {
    Ratelimit: RatelimitMock,
  };
});

// Set the app URL for same-origin validation testing
process.env.NEXT_PUBLIC_APP_URL = "http://localhost";

import { POST } from "./route";
import { Ratelimit as RatelimitMock } from "@upstash/ratelimit";

/**
 * Verifies the store-cards POST endpoint across rate limit, validation, and persistence scenarios.
 * @source
 */
describe("Store Cards API POST Endpoint", () => {
  /**
   * Resets mocks after each test so state does not leak between cases.
   * @source
   */
  afterEach(() => {
    jest.clearAllMocks();
  });

  beforeEach(() => {
    mockRedisGet.mockResolvedValue(null);
  });

  it("should construct default shared rate limiter with 10/5s", async () => {
    // Trigger the POST handler to ensure initializeApiRequest invokes the shared rate limiter
    mockLimit.mockResolvedValueOnce({ success: true });
    mockRedisGet.mockResolvedValueOnce(null);
    const req = new Request("http://localhost/api/store-cards", {
      method: "POST",
      headers: {
        "x-forwarded-for": "127.0.0.1",
        origin: "http://localhost",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: 1, statsData: {}, cards: [] }),
    });
    await POST(req);
    expect(RatelimitMock.slidingWindow).toHaveBeenCalledWith(10, "5 s");
  });

  /**
   * Expects a 429 response when the rate limiter rejects the request.
   * @source
   */
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

  /**
   * Ensures production-only cross-origin requests return 401.
   * @source
   */
  it("should reject cross-origin requests in production when origin differs", async () => {
    // Set NODE_ENV to production for this test
    const originalEnv = process.env.NODE_ENV;
    (process.env as unknown as { NODE_ENV?: string }).NODE_ENV = "production";

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

    (process.env as unknown as { NODE_ENV?: string }).NODE_ENV = originalEnv;
  });

  /**
   * Validates that statsData errors translate to 400 responses.
   * @source
   */
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

  /**
   * Confirms valid configs are persisted and respond with success.
   * @source
   */
  it("should store card configurations successfully and return success", async () => {
    mockLimit.mockResolvedValueOnce({ success: true });
    mockRedisSet.mockResolvedValueOnce(true); // Simulate successful Redis storage
    mockRedisGet.mockResolvedValueOnce(null);

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
          borderRadius: 8.27,
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
    expect(storedData.cards[0]).toHaveProperty("borderRadius", 8.3);
  });

  it("should recover from corrupted Redis payload and continue", async () => {
    mockLimit.mockResolvedValueOnce({ success: true });
    mockRedisGet.mockResolvedValueOnce("[object Object]");
    mockRedisSet.mockResolvedValueOnce(true);

    const reqBody = {
      userId: 77,
      statsData: { score: 42 },
      cards: [
        {
          cardName: "badData",
          variation: "default",
          titleColor: "#000",
          backgroundColor: "#fff",
          textColor: "#333",
          circleColor: "#f00",
          borderColor: "#e4e2e2",
          borderRadius: 12.3,
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

    expect(mockRedisSet).toHaveBeenCalledWith(
      `cards:${reqBody.userId}`,
      expect.any(String),
    );
  });

  it("should increment analytics when stored cards payload is corrupted", async () => {
    mockLimit.mockResolvedValueOnce({ success: true });
    // Simulate corrupted existing payload in Redis
    mockRedisGet.mockResolvedValueOnce("[object Object]");
    mockRedisSet.mockResolvedValueOnce(true);

    const reqBody = {
      userId: 77,
      statsData: { score: 42 },
      cards: [
        {
          cardName: "badData",
          variation: "default",
          titleColor: "#000",
          backgroundColor: "#fff",
          textColor: "#333",
          circleColor: "#f00",
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
    expect(mockRedisIncr).toHaveBeenCalledWith(
      "analytics:store_cards:corrupted_records",
    );
  });

  /**
   * Checks that Redis failures surface as 500 server errors.
   * @source
   */
  it("should return 500 if redis storage fails", async () => {
    mockLimit.mockResolvedValueOnce({ success: true });
    // Simulate a failure in redisClient.set.
    mockRedisSet.mockRejectedValueOnce(new Error("Redis failure"));
    mockRedisGet.mockResolvedValueOnce(null);

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
          borderRadius: 0,
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
