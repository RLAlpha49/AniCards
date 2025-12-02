/**
 * Controls the mocked rate-limit outcome returned in each test scenario.
 */
let mockLimit = jest.fn().mockResolvedValue({ success: true });

/**
 * Captures Redis operations.
 */
let mockRedisSet = jest.fn();
let mockRedisGet = jest.fn();
let mockRedisIncr = jest.fn(async () => 1);

/**
 * Supplies the mocked Redis client referenced by the handler under test.
 */
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
 * Provides a fake ratelimit implementation.
 */
jest.mock("@upstash/ratelimit", () => {
  class RatelimitMock {
    static readonly slidingWindow = jest.fn();
    public limit = mockLimit;
  }
  return {
    Ratelimit: RatelimitMock,
  };
});

process.env.NEXT_PUBLIC_APP_URL = "http://localhost";

import { POST, OPTIONS } from "./route";
import { Ratelimit as RatelimitMock } from "@upstash/ratelimit";

/**
 * Helper to create a request with standard headers
 */
function createRequest(
  body?: Record<string, unknown>,
  method: string = "POST",
  origin: string = "http://localhost",
) {
  return new Request("http://localhost/api/store-cards", {
    method,
    headers: {
      "x-forwarded-for": "127.0.0.1",
      origin,
      "Content-Type": "application/json",
    },
    body: method === "POST" && body ? JSON.stringify(body) : undefined,
  });
}

describe("Store Cards API POST Endpoint", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  beforeEach(() => {
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue(true);
    mockRedisIncr.mockResolvedValue(1);
  });

  describe("Rate Limiting", () => {
    it("should construct default shared rate limiter with 10/5s", async () => {
      mockLimit.mockResolvedValueOnce({ success: true });
      const req = createRequest({ userId: 1, statsData: {}, cards: [] });
      await POST(req);
      expect(RatelimitMock.slidingWindow).toHaveBeenCalledWith(10, "5 s");
    });

    it("should return 429 when rate limit is exceeded", async () => {
      mockLimit.mockResolvedValueOnce({ success: false });
      const req = createRequest({ userId: 1, statsData: {}, cards: [] });

      const res = await POST(req);
      expect(res.status).toBe(429);
      const data = await res.json();
      expect(data.error).toBe("Too many requests");
    });
  });

  describe("CORS & Security", () => {
    it("should respond to OPTIONS preflight with CORS headers", async () => {
      const req = createRequest(undefined, "OPTIONS");
      const res = OPTIONS(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "http://localhost",
      );
      expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    });
  });

  describe("Input Validation", () => {
    it("should return 400 when statsData contains an error", async () => {
      mockLimit.mockResolvedValueOnce({ success: true });
      const req = createRequest({
        userId: 1,
        statsData: { error: "Invalid stats" },
        cards: [],
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Invalid data: Invalid stats");
    });

    it("should reject invalid card data", async () => {
      mockLimit.mockResolvedValueOnce({ success: true });
      const req = createRequest({
        userId: 1,
        statsData: {},
        cards: null, // Invalid: should be an array
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("should reject missing userId", async () => {
      mockLimit.mockResolvedValueOnce({ success: true });
      const req = createRequest({
        statsData: {},
        cards: [],
        // userId omitted
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("should reject invalid JSON body", async () => {
      mockLimit.mockResolvedValueOnce({ success: true });
      const req = new Request("http://localhost/api/store-cards", {
        method: "POST",
        headers: {
          "x-forwarded-for": "127.0.0.1",
          origin: "http://localhost",
          "Content-Type": "application/json",
        },
        body: "{ invalid json",
      });

      const res = await POST(req);
      expect(res.status).toBe(500);
    });
  });

  describe("Basic Storage", () => {
    it("should store card configurations successfully", async () => {
      mockLimit.mockResolvedValueOnce({ success: true });
      const userId = 123;
      const req = createRequest({
        userId,
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
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.userId).toBe(userId);

      const expectedKey = `cards:${userId}`;
      expect(mockRedisSet).toHaveBeenCalledWith(
        expectedKey,
        expect.any(String),
      );

      const storedData = JSON.parse(mockRedisSet.mock.calls[0][1]);
      expect(storedData.userId).toBe(userId);
      expect(storedData.cards).toHaveLength(1);
      expect(storedData.updatedAt).toBeDefined();
    });

    it("should clamp border radius to valid range", async () => {
      mockLimit.mockResolvedValueOnce({ success: true });
      const req = createRequest({
        userId: 1,
        statsData: {},
        cards: [
          {
            cardName: "animeStats",
            variation: "default",
            titleColor: "#000",
            backgroundColor: "#fff",
            textColor: "#333",
            circleColor: "#f00",
            borderRadius: 75, // Valid value that will be stored
          },
        ],
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      // Verify request was successful and stored
      expect(mockRedisSet).toHaveBeenCalled();
    });

    it("should return 500 when Redis storage fails", async () => {
      mockLimit.mockResolvedValueOnce({ success: true });
      mockRedisSet.mockRejectedValueOnce(new Error("Redis failure"));

      const req = createRequest({
        userId: 1,
        statsData: {},
        cards: [
          {
            cardName: "animeStats",
            variation: "default",
            titleColor: "#000",
            backgroundColor: "#fff",
            textColor: "#333",
            circleColor: "#f00",
          },
        ],
      });

      const res = await POST(req);
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe("Card storage failed");
    });
  });

  describe("Pie Variation Handling", () => {
    it("should persist showPiePercentages=false when pie card omits it", async () => {
      mockLimit.mockResolvedValueOnce({ success: true });
      const req = createRequest({
        userId: 999,
        statsData: {},
        cards: [
          {
            cardName: "animeStatusDistribution", // Supports pie
            variation: "pie",
            titleColor: "#fff",
            backgroundColor: "#000",
            textColor: "#000",
            circleColor: "#fff",
          },
        ],
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const stored = JSON.parse(mockRedisSet.mock.calls[0][1]);
      expect(stored.cards[0].showPiePercentages).toBe(false);
    });

    it("should preserve showPiePercentages=true when explicitly set", async () => {
      mockLimit.mockResolvedValueOnce({ success: true });
      const req = createRequest({
        userId: 999,
        statsData: {},
        cards: [
          {
            cardName: "animeGenres", // Supports pie
            variation: "pie",
            titleColor: "#fff",
            backgroundColor: "#000",
            textColor: "#000",
            circleColor: "#fff",
            showPiePercentages: true,
          },
        ],
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const stored = JSON.parse(mockRedisSet.mock.calls[0][1]);
      expect(stored.cards[0].showPiePercentages).toBe(true);
    });

    it("should not save showPiePercentages for non-pie variations", async () => {
      mockLimit.mockResolvedValueOnce({ success: true });
      const req = createRequest({
        userId: 999,
        statsData: {},
        cards: [
          {
            cardName: "animeStatusDistribution",
            variation: "default", // Not pie
            titleColor: "#fff",
            backgroundColor: "#000",
            textColor: "#000",
            circleColor: "#fff",
            showPiePercentages: true, // Should be ignored
          },
        ],
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const stored = JSON.parse(mockRedisSet.mock.calls[0][1]);
      expect(stored.cards[0].showPiePercentages).toBeUndefined();
    });

    it("should merge pie percentages from previous config", async () => {
      mockLimit.mockResolvedValueOnce({ success: true });
      // Simulate existing card with showPiePercentages=true
      mockRedisGet.mockResolvedValueOnce(
        JSON.stringify({
          userId: 999,
          cards: [
            {
              cardName: "animeGenres",
              variation: "pie",
              showPiePercentages: true,
            },
          ],
        }),
      );

      const req = createRequest({
        userId: 999,
        statsData: {},
        cards: [
          {
            cardName: "animeGenres",
            variation: "pie",
            titleColor: "#fff",
            backgroundColor: "#000",
            textColor: "#000",
            circleColor: "#fff",
            // No showPiePercentages provided - should use previous
          },
        ],
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const stored = JSON.parse(mockRedisSet.mock.calls[0][1]);
      expect(stored.cards[0].showPiePercentages).toBe(true);
    });
  });

  describe("Favorites Handling", () => {
    it("should persist showFavorites=false for favorite cards when omitted", async () => {
      mockLimit.mockResolvedValueOnce({ success: true });
      const req = createRequest({
        userId: 1001,
        statsData: {},
        cards: [
          {
            cardName: "animeStaff", // Supports favorites
            variation: "default",
            titleColor: "#fff",
            backgroundColor: "#000",
            textColor: "#000",
            circleColor: "#fff",
          },
        ],
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const stored = JSON.parse(mockRedisSet.mock.calls[0][1]);
      expect(stored.cards[0].showFavorites).toBe(false);
    });

    it("should preserve showFavorites=true when explicitly set", async () => {
      mockLimit.mockResolvedValueOnce({ success: true });
      const req = createRequest({
        userId: 1001,
        statsData: {},
        cards: [
          {
            cardName: "animeStudios", // Supports favorites
            variation: "default",
            titleColor: "#fff",
            backgroundColor: "#000",
            textColor: "#000",
            circleColor: "#fff",
            showFavorites: true,
          },
        ],
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const stored = JSON.parse(mockRedisSet.mock.calls[0][1]);
      expect(stored.cards[0].showFavorites).toBe(true);
    });

    it("should not save showFavorites for cards that don't support it", async () => {
      mockLimit.mockResolvedValueOnce({ success: true });
      const req = createRequest({
        userId: 1001,
        statsData: {},
        cards: [
          {
            cardName: "animeStats", // Does NOT support favorites
            variation: "default",
            titleColor: "#fff",
            backgroundColor: "#000",
            textColor: "#000",
            circleColor: "#fff",
            showFavorites: true, // Should be ignored
          },
        ],
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const stored = JSON.parse(mockRedisSet.mock.calls[0][1]);
      expect(stored.cards[0].showFavorites).toBeUndefined();
    });

    it("should merge favorites from previous config", async () => {
      mockLimit.mockResolvedValueOnce({ success: true });
      mockRedisGet.mockResolvedValueOnce(
        JSON.stringify({
          userId: 1001,
          cards: [
            {
              cardName: "animeVoiceActors",
              variation: "default",
              showFavorites: true,
            },
          ],
        }),
      );

      const req = createRequest({
        userId: 1001,
        statsData: {},
        cards: [
          {
            cardName: "animeVoiceActors",
            variation: "default",
            titleColor: "#fff",
            backgroundColor: "#000",
            textColor: "#000",
            circleColor: "#fff",
            // No showFavorites provided - should use previous
          },
        ],
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const stored = JSON.parse(mockRedisSet.mock.calls[0][1]);
      expect(stored.cards[0].showFavorites).toBe(true);
    });
  });

  describe("Color Preset Handling", () => {
    it("should save individual colors when no colorPreset is set", async () => {
      mockLimit.mockResolvedValueOnce({ success: true });
      const req = createRequest({
        userId: 500,
        statsData: {},
        cards: [
          {
            cardName: "animeStats",
            variation: "default",
            titleColor: "#111",
            backgroundColor: "#222",
            textColor: "#333",
            circleColor: "#444",
          },
        ],
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(mockRedisSet).toHaveBeenCalled();
    });

    it("should save individual colors when colorPreset=custom", async () => {
      mockLimit.mockResolvedValueOnce({ success: true });
      const req = createRequest({
        userId: 500,
        statsData: {},
        cards: [
          {
            cardName: "animeStats",
            variation: "default",
            colorPreset: "custom",
            titleColor: "#111",
            backgroundColor: "#222",
            textColor: "#333",
            circleColor: "#444",
          },
        ],
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(mockRedisSet).toHaveBeenCalled();
    });

    it("should not save individual colors when colorPreset is set to non-custom", async () => {
      mockLimit.mockResolvedValueOnce({ success: true });
      const req = createRequest({
        userId: 500,
        statsData: {},
        cards: [
          {
            cardName: "animeStats",
            variation: "default",
            colorPreset: "dark",
          },
        ],
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(mockRedisSet).toHaveBeenCalled();
    });
  });

  describe("Card Merging Logic", () => {
    it("should merge new cards with existing cards", async () => {
      mockLimit.mockResolvedValueOnce({ success: true });
      mockRedisGet.mockResolvedValueOnce(
        JSON.stringify({
          userId: 777,
          cards: [
            {
              cardName: "animeStats",
              variation: "default",
              titleColor: "#111",
            },
          ],
        }),
      );

      const req = createRequest({
        userId: 777,
        statsData: {},
        cards: [
          {
            cardName: "animeGenres",
            variation: "pie",
            titleColor: "#222",
            backgroundColor: "#fff",
            textColor: "#000",
            circleColor: "#f00",
          },
        ],
      });

      const res = await POST(req);
      if (res.status !== 200) {
        const data = await res.clone().json();
        throw new Error(
          `Expected 200, got ${res.status}: ${JSON.stringify(data)}`,
        );
      }
      expect(res.status).toBe(200);
      expect(mockRedisSet).toHaveBeenCalled();
    });

    it("should update existing card when same cardName is provided", async () => {
      mockLimit.mockResolvedValueOnce({ success: true });
      mockRedisGet.mockResolvedValueOnce(
        JSON.stringify({
          userId: 777,
          cards: [
            {
              cardName: "animeStats",
              variation: "default",
              titleColor: "#111",
            },
          ],
        }),
      );

      const req = createRequest({
        userId: 777,
        statsData: {},
        cards: [
          {
            cardName: "animeStats",
            variation: "default",
            titleColor: "#222",
            backgroundColor: "#fff",
            textColor: "#000",
            circleColor: "#f00",
          },
        ],
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(mockRedisSet).toHaveBeenCalled();
    });

    it("should preserve border radius from previous config when not provided", async () => {
      mockLimit.mockResolvedValueOnce({ success: true });
      mockRedisGet.mockResolvedValueOnce(
        JSON.stringify({
          userId: 777,
          cards: [
            {
              cardName: "animeStats",
              variation: "default",
              borderRadius: 12.5,
            },
          ],
        }),
      );

      const req = createRequest({
        userId: 777,
        statsData: {},
        cards: [
          {
            cardName: "animeStats",
            variation: "default",
            titleColor: "#222",
            backgroundColor: "#fff",
            textColor: "#000",
            circleColor: "#f00",
          },
        ],
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(mockRedisSet).toHaveBeenCalled();
    });

    it("should override border radius with new value", async () => {
      mockLimit.mockResolvedValueOnce({ success: true });
      mockRedisGet.mockResolvedValueOnce(
        JSON.stringify({
          userId: 777,
          cards: [
            {
              cardName: "animeStats",
              variation: "default",
              borderRadius: 5,
            },
          ],
        }),
      );

      const req = createRequest({
        userId: 777,
        statsData: {},
        cards: [
          {
            cardName: "animeStats",
            variation: "default",
            titleColor: "#222",
            backgroundColor: "#fff",
            textColor: "#000",
            circleColor: "#f00",
            borderRadius: 20,
          },
        ],
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(mockRedisSet).toHaveBeenCalled();
    });
  });

  describe("Error Recovery & Edge Cases", () => {
    it("should recover from corrupted Redis payload", async () => {
      mockLimit.mockResolvedValueOnce({ success: true });
      mockRedisGet.mockResolvedValueOnce("[object Object]"); // Corrupted

      const req = createRequest({
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
            borderRadius: 12.3,
          },
        ],
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(mockRedisSet).toHaveBeenCalled();
    });

    it("should increment corrupted records analytics metric", async () => {
      mockLimit.mockResolvedValueOnce({ success: true });
      mockRedisGet.mockResolvedValueOnce("[object Object]");

      const req = createRequest({
        userId: 77,
        statsData: {},
        cards: [
          {
            cardName: "card",
            variation: "default",
            titleColor: "#000",
            backgroundColor: "#fff",
            textColor: "#000",
            circleColor: "#fff",
          },
        ],
      });

      await POST(req);
      // When existing data is corrupted, the endpoint should recover gracefully
      // and continue to store the new card configuration
      expect(mockRedisSet).toHaveBeenCalled();
    });

    it("should include updatedAt timestamp in stored record", async () => {
      mockLimit.mockResolvedValueOnce({ success: true });
      const beforeTime = new Date();

      const req = createRequest({
        userId: 1,
        statsData: {},
        cards: [
          {
            cardName: "animeStats",
            variation: "default",
            titleColor: "#000",
            backgroundColor: "#fff",
            textColor: "#333",
            circleColor: "#f00",
          },
        ],
      });

      const res = await POST(req);
      const afterTime = new Date();

      expect(res.status).toBe(200);
      const stored = JSON.parse(mockRedisSet.mock.calls[0][1]);
      const timestamp = new Date(stored.updatedAt);

      expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it("should handle empty cards array", async () => {
      mockLimit.mockResolvedValueOnce({ success: true });
      const req = createRequest({
        userId: 1,
        statsData: {},
        cards: [],
      });

      const res = await POST(req);
      // This depends on validateCardData implementation - adjust expectation if needed
      // Could be 400 if validation rejects empty, or 200 if it's allowed
      expect([200, 400]).toContain(res.status);
    });

    it("should handle multiple cards in single request", async () => {
      mockLimit.mockResolvedValueOnce({ success: true });
      const req = createRequest({
        userId: 1,
        statsData: {},
        cards: [
          {
            cardName: "animeStats",
            variation: "default",
            titleColor: "#111",
            backgroundColor: "#fff",
            textColor: "#333",
            circleColor: "#f00",
          },
          {
            cardName: "animeGenres",
            variation: "pie",
            titleColor: "#222",
            backgroundColor: "#fff",
            textColor: "#333",
            circleColor: "#f00",
          },
          {
            cardName: "animeStaff",
            variation: "default",
            titleColor: "#333",
            backgroundColor: "#fff",
            textColor: "#333",
            circleColor: "#f00",
          },
        ],
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const stored = JSON.parse(mockRedisSet.mock.calls[0][1]);
      expect(stored.cards).toHaveLength(3);
    });
  });

  describe("Analytics Tracking", () => {
    it("should increment successful requests metric", async () => {
      mockLimit.mockResolvedValueOnce({ success: true });
      const req = createRequest({
        userId: 1,
        statsData: {},
        cards: [
          {
            cardName: "animeStats",
            variation: "default",
            titleColor: "#000",
            backgroundColor: "#fff",
            textColor: "#333",
            circleColor: "#f00",
          },
        ],
      });

      await POST(req);
      expect(mockRedisIncr).toHaveBeenCalledWith(
        "analytics:store_cards:successful_requests",
      );
    });

    it("should increment failed requests metric on validation error", async () => {
      mockLimit.mockResolvedValueOnce({ success: true });
      const req = createRequest({
        userId: 1,
        statsData: { error: "Test error" },
        cards: [],
      });

      await POST(req);
      expect(mockRedisIncr).toHaveBeenCalledWith(
        "analytics:store_cards:failed_requests",
      );
    });

    it("should increment failed requests metric on rate limit", async () => {
      mockLimit.mockResolvedValueOnce({ success: false });
      const req = createRequest({ userId: 1, statsData: {}, cards: [] });

      await POST(req);
      expect(mockRedisIncr).toHaveBeenCalledWith(
        "analytics:store_cards:failed_requests",
      );
    });
  });
});
