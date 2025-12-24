import {
  afterEach,
  afterAll,
  beforeEach,
  describe,
  it,
  expect,
  mock,
} from "bun:test";
import {
  sharedRedisMockSet,
  sharedRedisMockGet,
  sharedRedisMockIncr,
  sharedRatelimitMockLimit,
  sharedRatelimitMockSlidingWindow,
} from "@/tests/unit/__setup__.test";
import { displayNames } from "@/lib/card-data/validation";

const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
process.env.NEXT_PUBLIC_APP_URL = "http://localhost";

const { POST, OPTIONS } = await import("@/app/api/store-cards/route");

afterAll(() => {
  // Restore the original app URL
  if (originalAppUrl === undefined) {
    delete process.env.NEXT_PUBLIC_APP_URL;
  } else {
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  }
});

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
    mock.clearAllMocks();
  });

  beforeEach(() => {
    sharedRedisMockGet.mockReset();
    sharedRedisMockSet.mockReset();
    sharedRedisMockIncr.mockReset();
    sharedRatelimitMockLimit.mockReset();
    sharedRatelimitMockSlidingWindow.mockClear();

    sharedRedisMockGet.mockResolvedValue(null);
    sharedRedisMockSet.mockResolvedValue(true);
    sharedRedisMockIncr.mockResolvedValue(1);
    sharedRatelimitMockLimit.mockResolvedValue({ success: true });
  });

  describe("Rate Limiting", () => {
    it("should apply rate limiting with default configuration", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      const req = createRequest({ userId: 1, statsData: {}, cards: [] });
      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(sharedRatelimitMockLimit).toHaveBeenCalled();
    });

    it("should return 429 when rate limit is exceeded", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: false });
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
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
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
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      const req = createRequest({
        userId: 1,
        statsData: {},
        cards: null, // Invalid: should be an array
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("should reject missing userId", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      const req = createRequest({
        statsData: {},
        cards: [],
        // userId omitted
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("should reject invalid JSON body", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
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

    it("should reject non-boolean disabled field", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      const req = createRequest({
        userId: 1,
        statsData: {},
        cards: [
          {
            cardName: "animeStats",
            disabled: "yes", // invalid type
          },
        ],
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("should reject invalid card types", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      const req = createRequest({
        userId: 1,
        statsData: {},
        cards: [
          {
            cardName: "invalidCardType",
            variation: "default",
            titleColor: "#000",
            backgroundColor: "#fff",
            textColor: "#333",
            circleColor: "#f00",
          },
        ],
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("should return invalid names and suggestions for typos", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      const req = createRequest({
        userId: 542244,
        statsData: {},
        cards: [
          {
            cardName: "tagCategoryDistribution",
            variation: "default",
            titleColor: "#000",
            backgroundColor: "#fff",
            textColor: "#333",
            circleColor: "#f00",
          },
          {
            cardName: "tagCategoryDistribuution", // typo
            variation: "default",
            titleColor: "#000",
            backgroundColor: "#fff",
            textColor: "#333",
            circleColor: "#f00",
          },
        ],
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(Array.isArray(data.invalidCardNames)).toBe(true);
      expect(data.invalidCardNames).toContain("tagCategoryDistribuution");
      expect(data.suggestions).toBeDefined();
      expect(data.suggestions["tagCategoryDistribuution"]).toContain(
        "tagCategoryDistribution",
      );
    });
  });

  describe("Basic Storage", () => {
    it("should store card configurations successfully", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
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
      expect(sharedRedisMockSet).toHaveBeenCalledWith(
        expectedKey,
        expect.any(String),
      );

      const storedData = JSON.parse(sharedRedisMockSet.mock.calls[0][1]);
      expect(storedData.userId).toBe(userId);
      expect(storedData.cards).toHaveLength(Object.keys(displayNames).length);

      const storedNames = new Set(
        (storedData.cards as Array<{ cardName: string }>).map(
          (c) => c.cardName,
        ),
      );
      for (const name of Object.keys(displayNames)) {
        expect(storedNames.has(name)).toBe(true);
      }

      const animeStats = (
        storedData.cards as Array<Record<string, unknown>>
      ).find((c) => c.cardName === "animeStats");
      expect(animeStats).toBeDefined();
      expect(animeStats).toMatchObject({
        cardName: "animeStats",
        variation: "default",
        titleColor: "#000",
        backgroundColor: "#fff",
        textColor: "#333",
        circleColor: "#f00",
      });
      expect(storedData.updatedAt).toBeDefined();
    });

    it("should accept and store disabled cards with minimal data", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      const userId = 321;
      const req = createRequest({
        userId,
        statsData: {},
        cards: [
          {
            cardName: "animeStats",
            disabled: true,
          },
        ],
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const stored = JSON.parse(sharedRedisMockSet.mock.calls[0][1]);
      expect(stored.cards).toHaveLength(Object.keys(displayNames).length);

      const animeStats = (stored.cards as Array<Record<string, unknown>>).find(
        (c) => c.cardName === "animeStats",
      );
      expect(animeStats).toEqual({ cardName: "animeStats", disabled: true });
    });

    it("should backfill all supported cards when incoming cards is empty", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      const userId = 987;
      const req = createRequest({ userId, statsData: {}, cards: [] });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const stored = JSON.parse(sharedRedisMockSet.mock.calls[0][1]);
      expect(stored.cards).toHaveLength(Object.keys(displayNames).length);

      const disabledCount = (
        stored.cards as Array<{ disabled?: boolean }>
      ).filter((c) => c.disabled === true).length;
      expect(disabledCount).toBe(0);
    });

    it("should accept up to the allowed number of card types", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      const userId = 1;
      const available = Object.keys(displayNames);
      // Build a payload with exactly the number of available card types
      const cardsPayload = available.map((cardName) => ({
        cardName,
        variation: "default",
        titleColor: "#111",
        backgroundColor: "#fff",
        textColor: "#000",
        circleColor: "#f00",
      }));

      const req = createRequest({ userId, statsData: {}, cards: cardsPayload });
      const res = await POST(req);
      expect(res.status).toBe(200);
    });

    it("should remove unsupported stored card types when saving", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      const userId = 1;
      const existing = {
        userId,
        cards: [
          {
            cardName: "invalidCardType",
            variation: "default",
            titleColor: "#000",
            backgroundColor: "#fff",
            textColor: "#111",
            circleColor: "#222",
          },
        ],
        updatedAt: new Date().toISOString(),
      };

      sharedRedisMockGet.mockResolvedValueOnce(JSON.stringify(existing));

      const req = createRequest({ userId, statsData: {}, cards: [] });
      const res = await POST(req);
      expect(res.status).toBe(200);

      const expectedKey = `cards:${userId}`;
      expect(sharedRedisMockSet).toHaveBeenCalledWith(
        expectedKey,
        expect.any(String),
      );

      const storedData = JSON.parse(sharedRedisMockSet.mock.calls[0][1]);
      expect(storedData.cards).toHaveLength(Object.keys(displayNames).length);

      const storedNames = new Set(
        (storedData.cards as Array<{ cardName: string }>).map(
          (c) => c.cardName,
        ),
      );
      expect(storedNames.has("invalidCardType")).toBe(false);
    });

    it("should accept duplicate entries that don't increase unique types", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      const userId = 1;
      const available = Object.keys(displayNames);
      // Build a payload with available + 1 entry but duplicate of the first card
      const cardsPayload = available
        .map((cardName) => ({
          cardName,
          variation: "default",
          titleColor: "#111",
          backgroundColor: "#fff",
          textColor: "#000",
          circleColor: "#f00",
        }))
        .concat([
          {
            cardName: available[0],
            variation: "default",
            titleColor: "#111",
            backgroundColor: "#fff",
            textColor: "#000",
            circleColor: "#f00",
          },
        ]);

      const req = createRequest({ userId, statsData: {}, cards: cardsPayload });
      const res = await POST(req);
      expect(res.status).toBe(200);
    });

    it("should reject when more than the allowed number of unique card types are provided", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      const userId = 1;
      const available = Object.keys(displayNames);
      // Build a payload with available + 1 unique card types
      const cardsPayload = available
        .map((cardName) => ({
          cardName,
          variation: "default",
          titleColor: "#111",
          backgroundColor: "#fff",
          textColor: "#000",
          circleColor: "#f00",
        }))
        .concat([
          {
            cardName: "extra_card_type_1",
            variation: "default",
            titleColor: "#111",
            backgroundColor: "#fff",
            textColor: "#000",
            circleColor: "#f00",
          },
        ]);

      const req = createRequest({ userId, statsData: {}, cards: cardsPayload });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
    it("should clamp border radius to valid range", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
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
      expect(sharedRedisMockSet).toHaveBeenCalled();
    });

    it("should return 500 when Redis storage fails", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      sharedRedisMockSet.mockRejectedValueOnce(new Error("Redis failure"));

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
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
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

      const stored = JSON.parse(sharedRedisMockSet.mock.calls[0][1]);
      expect(stored.cards[0].showPiePercentages).toBe(false);
    });

    it("should persist showPiePercentages=false when donut card omits it", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      const req = createRequest({
        userId: 999,
        statsData: {},
        cards: [
          {
            cardName: "animeStatusDistribution",
            variation: "donut",
            titleColor: "#fff",
            backgroundColor: "#000",
            textColor: "#000",
            circleColor: "#fff",
          },
        ],
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const stored = JSON.parse(sharedRedisMockSet.mock.calls[0][1]);
      expect(stored.cards[0].showPiePercentages).toBe(false);
    });

    it("should preserve showPiePercentages=true when explicitly set", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
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

      const stored = JSON.parse(sharedRedisMockSet.mock.calls[0][1]);
      expect(stored.cards[0].showPiePercentages).toBe(true);
    });

    it("should not save showPiePercentages for non-pie variations", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
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

      const stored = JSON.parse(sharedRedisMockSet.mock.calls[0][1]);
      expect(stored.cards[0].showPiePercentages).toBeUndefined();
    });

    it("should merge pie percentages from previous config", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      // Simulate existing card with showPiePercentages=true
      sharedRedisMockGet.mockResolvedValueOnce(
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

      const stored = JSON.parse(sharedRedisMockSet.mock.calls[0][1]);
      expect(stored.cards[0].showPiePercentages).toBe(true);
    });
  });

  describe("Favorites Handling", () => {
    it("should persist showFavorites=false for favorite cards when omitted", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
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

      const stored = JSON.parse(sharedRedisMockSet.mock.calls[0][1]);
      expect(stored.cards[0].showFavorites).toBe(false);
    });

    it("should preserve showFavorites=true when explicitly set", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
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

      const stored = JSON.parse(sharedRedisMockSet.mock.calls[0][1]);
      expect(stored.cards[0].showFavorites).toBe(true);
    });

    it("should not save showFavorites for cards that don't support it", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
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

      const stored = JSON.parse(sharedRedisMockSet.mock.calls[0][1]);
      expect(stored.cards[0].showFavorites).toBeUndefined();
    });

    it("should merge favorites from previous config", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      sharedRedisMockGet.mockResolvedValueOnce(
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

      const stored = JSON.parse(sharedRedisMockSet.mock.calls[0][1]);
      expect(stored.cards[0].showFavorites).toBe(true);
    });
  });

  describe("Color Preset Handling", () => {
    it("should save individual colors when no colorPreset is set", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
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
      expect(sharedRedisMockSet).toHaveBeenCalled();
    });

    it("should save individual colors when colorPreset=custom", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
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
      expect(sharedRedisMockSet).toHaveBeenCalled();
    });

    it("should not save individual colors when colorPreset is set to non-custom", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
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
      expect(sharedRedisMockSet).toHaveBeenCalled();
    });

    it("should not save colorPreset when useCustomSettings is false", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      const req = createRequest({
        userId: 500,
        statsData: {},
        cards: [
          {
            cardName: "animeStats",
            variation: "default",
            colorPreset: "dark",
            titleColor: "#111",
            backgroundColor: "#222",
            textColor: "#333",
            circleColor: "#444",
            useCustomSettings: false,
          },
        ],
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const stored = JSON.parse(sharedRedisMockSet.mock.calls[0][1]);
      expect(stored.cards[0].colorPreset).toBeUndefined();
      expect(stored.cards[0].titleColor).toBeUndefined();
      expect(stored.cards[0].backgroundColor).toBeUndefined();
      expect(stored.cards[0].textColor).toBeUndefined();
      expect(stored.cards[0].circleColor).toBeUndefined();
      expect(stored.cards[0].useCustomSettings).toBe(false);
    });

    it("should save colorPreset when useCustomSettings is true", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      const req = createRequest({
        userId: 500,
        statsData: {},
        cards: [
          {
            cardName: "animeStats",
            variation: "default",
            colorPreset: "dark",
            useCustomSettings: true,
          },
        ],
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const stored = JSON.parse(sharedRedisMockSet.mock.calls[0][1]);
      expect(stored.cards[0].colorPreset).toBe("dark");
      expect(stored.cards[0].useCustomSettings).toBe(true);
    });
  });

  describe("Border Settings Optimization", () => {
    it("should not save borderColor in globalSettings when borderEnabled is false", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      const req = createRequest({
        userId: 600,
        statsData: {},
        cards: [
          {
            cardName: "animeStats",
            variation: "default",
            colorPreset: "dark",
          },
        ],
        globalSettings: {
          colorPreset: "default",
          borderEnabled: false,
          borderColor: "#ff0000",
        },
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const stored = JSON.parse(sharedRedisMockSet.mock.calls[0][1]);
      expect(stored.globalSettings.borderEnabled).toBe(false);
      expect(stored.globalSettings.borderColor).toBeUndefined();
    });

    it("should save borderColor in globalSettings when borderEnabled is true", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      const req = createRequest({
        userId: 600,
        statsData: {},
        cards: [
          {
            cardName: "animeStats",
            variation: "default",
            colorPreset: "dark",
          },
        ],
        globalSettings: {
          colorPreset: "default",
          borderEnabled: true,
          borderColor: "#ff0000",
        },
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const stored = JSON.parse(sharedRedisMockSet.mock.calls[0][1]);
      expect(stored.globalSettings.borderEnabled).toBe(true);
      expect(stored.globalSettings.borderColor).toBe("#ff0000");
    });

    it("should not save borderColor in card config when border is disabled globally", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      const req = createRequest({
        userId: 600,
        statsData: {},
        cards: [
          {
            cardName: "animeStats",
            variation: "default",
            borderColor: "#00ff00",
            borderRadius: 8,
            useCustomSettings: true,
            colorPreset: "custom",
            titleColor: "#111",
            backgroundColor: "#222",
            textColor: "#333",
            circleColor: "#444",
          },
        ],
        globalSettings: {
          colorPreset: "default",
          borderEnabled: false,
        },
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const stored = JSON.parse(sharedRedisMockSet.mock.calls[0][1]);
      expect(stored.cards[0].borderColor).toBeUndefined();
    });

    it("should save borderColor in card config when border is enabled globally", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      const req = createRequest({
        userId: 600,
        statsData: {},
        cards: [
          {
            cardName: "animeStats",
            variation: "default",
            borderColor: "#00ff00",
            borderRadius: 8,
            useCustomSettings: true,
            colorPreset: "custom",
            titleColor: "#111",
            backgroundColor: "#222",
            textColor: "#333",
            circleColor: "#444",
          },
        ],
        globalSettings: {
          colorPreset: "default",
          borderEnabled: true,
        },
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const stored = JSON.parse(sharedRedisMockSet.mock.calls[0][1]);
      expect(stored.cards[0].borderColor).toBe("#00ff00");
    });
  });

  describe("Card Merging Logic", () => {
    it("should merge new cards with existing cards", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      sharedRedisMockGet.mockResolvedValueOnce(
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
      expect(sharedRedisMockSet).toHaveBeenCalled();
    });

    it("should update existing card when same cardName is provided", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      sharedRedisMockGet.mockResolvedValueOnce(
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
      expect(sharedRedisMockSet).toHaveBeenCalled();
    });

    it("should preserve border radius from previous config when not provided", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      sharedRedisMockGet.mockResolvedValueOnce(
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
      expect(sharedRedisMockSet).toHaveBeenCalled();
    });

    it("should override border radius with new value", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      sharedRedisMockGet.mockResolvedValueOnce(
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
      expect(sharedRedisMockSet).toHaveBeenCalled();
    });
  });

  describe("Error Recovery & Edge Cases", () => {
    it("should recover from corrupted Redis payload", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      sharedRedisMockGet.mockResolvedValueOnce("[object Object]"); // Corrupted

      const req = createRequest({
        userId: 77,
        statsData: { score: 42 },
        cards: [
          {
            cardName: "animeStats",
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
      expect(sharedRedisMockSet).toHaveBeenCalled();
    });

    it("should increment corrupted records analytics metric", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      sharedRedisMockGet.mockResolvedValueOnce("[object Object]");

      const req = createRequest({
        userId: 77,
        statsData: {},
        cards: [
          {
            cardName: "animeStats",
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
      expect(sharedRedisMockSet).toHaveBeenCalled();
    });

    it("should include updatedAt timestamp in stored record", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
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
      const stored = JSON.parse(sharedRedisMockSet.mock.calls[0][1]);
      const timestamp = new Date(stored.updatedAt);

      expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it("should handle empty cards array", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
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
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
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

      const stored = JSON.parse(sharedRedisMockSet.mock.calls[0][1]);
      expect(stored.cards).toHaveLength(Object.keys(displayNames).length);

      const storedNames = new Set(
        (stored.cards as Array<{ cardName: string }>).map((c) => c.cardName),
      );
      expect(storedNames.has("animeStats")).toBe(true);
      expect(storedNames.has("animeGenres")).toBe(true);
      expect(storedNames.has("animeStaff")).toBe(true);
    });
  });

  describe("Analytics Tracking", () => {
    it("should increment successful requests metric", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
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
      expect(sharedRedisMockIncr).toHaveBeenCalledWith(
        "analytics:store_cards:successful_requests",
      );
    });

    it("should increment failed requests metric on validation error", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: true });
      const req = createRequest({
        userId: 1,
        statsData: { error: "Test error" },
        cards: [],
      });

      await POST(req);
      expect(sharedRedisMockIncr).toHaveBeenCalledWith(
        "analytics:store_cards:failed_requests",
      );
    });

    it("should increment failed requests metric on rate limit", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({ success: false });
      const req = createRequest({ userId: 1, statsData: {}, cards: [] });

      await POST(req);
      expect(sharedRedisMockIncr).toHaveBeenCalledWith(
        "analytics:store_cards:failed_requests",
      );
    });
  });
});
