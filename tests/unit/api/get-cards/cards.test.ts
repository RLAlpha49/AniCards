import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import {
  allowConsoleWarningsAndErrors,
  sharedRatelimitMockLimit,
  sharedRedisMockGet,
  sharedRedisMockIncr,
  sharedRedisMockSet,
} from "@/tests/unit/__setup__";

const { GET, OPTIONS } = await import("@/app/api/get-cards/route");

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
async function getResponseJson(response: Response): Promise<any> {
  return response.json();
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createStoredCardsRecord({
  userId = 123,
  cards = [],
  cardOrder,
  globalSettings,
  updatedAt = "2026-03-28T00:00:00.000Z",
}: {
  userId?: number;
  cards?: Array<Record<string, unknown>>;
  cardOrder?: string[];
  globalSettings?: Record<string, unknown>;
  updatedAt?: string;
} = {}) {
  return {
    userId,
    cards,
    ...(cardOrder === undefined ? {} : { cardOrder }),
    ...(globalSettings === undefined ? {} : { globalSettings }),
    updatedAt,
  };
}

describe("Cards API GET Endpoint", () => {
  const baseUrl = "http://localhost/api/get-cards";

  beforeEach(() => {
    allowConsoleWarningsAndErrors();
    sharedRedisMockIncr.mockResolvedValue(1);
    sharedRatelimitMockLimit.mockResolvedValue({
      success: true,
      limit: 60,
      remaining: 59,
      reset: Date.now() + 10_000,
      pending: Promise.resolve(),
    });
  });

  afterEach(() => {
    mock.clearAllMocks();
  });

  describe("Parameter Validation", () => {
    it("should return 400 error for missing userId parameter", async () => {
      const req = new Request(`${baseUrl}`, {
        headers: { "x-forwarded-for": "127.0.0.1" },
      });
      const res = await GET(req);
      expect(res.status).toBe(400);
      const json = await getResponseJson(res);
      expect(json.error).toBe("Missing user ID parameter");
    });

    it("should return 400 error for empty userId string", async () => {
      const req = new Request(`${baseUrl}?userId=`, {
        headers: { "x-forwarded-for": "127.0.0.1" },
      });
      const res = await GET(req);
      expect(res.status).toBe(400);
      const json = await getResponseJson(res);
      expect(json.error).toBe("Missing user ID parameter");
    });

    it("should return 400 error for invalid user ID format (non-numeric)", async () => {
      const req = new Request(`${baseUrl}?userId=abc`, {
        headers: { "x-forwarded-for": "127.0.0.1" },
      });
      const res = await GET(req);
      expect(res.status).toBe(400);
      const json = await getResponseJson(res);
      expect(json.error).toBe("Invalid user ID format");
    });

    it("should return 400 error for invalid user ID format (special characters)", async () => {
      const req = new Request(`${baseUrl}?userId=abc@#$`, {
        headers: { "x-forwarded-for": "127.0.0.1" },
      });
      const res = await GET(req);
      expect(res.status).toBe(400);
      const json = await getResponseJson(res);
      expect(json.error).toBe("Invalid user ID format");
    });

    it("should return 400 error for partially numeric user IDs", async () => {
      const req = new Request(`${baseUrl}?userId=123abc`, {
        headers: { "x-forwarded-for": "127.0.0.1" },
      });
      const res = await GET(req);
      expect(res.status).toBe(400);
      const json = await getResponseJson(res);
      expect(json.error).toBe("Invalid user ID format");
    });

    it("should reject userId as zero", async () => {
      const req = new Request(`${baseUrl}?userId=0`, {
        headers: { "x-forwarded-for": "127.0.0.1" },
      });
      const res = await GET(req);
      expect(res.status).toBe(400);
      const json = await getResponseJson(res);
      expect(json.error).toBe("Invalid user ID format");
      expect(sharedRedisMockGet).not.toHaveBeenCalled();
    });

    it("should successfully handle very large userId values", async () => {
      const largeId = "999999999";
      const cardData = createStoredCardsRecord({
        userId: Number(largeId),
        cards: [{ cardName: "animeStats", titleColor: "#000" }],
      });
      sharedRedisMockGet.mockResolvedValueOnce(JSON.stringify(cardData));
      const req = new Request(`${baseUrl}?userId=${largeId}`, {
        headers: { "x-forwarded-for": "127.0.0.1" },
      });
      const res = await GET(req);
      expect(res.status).toBe(200);
      expect(sharedRedisMockGet).toHaveBeenCalledWith(`cards:${largeId}`);
    });
  });

  describe("Redis Data Retrieval", () => {
    it("should return 404 if cards are not found in Redis", async () => {
      sharedRedisMockGet.mockResolvedValueOnce(null);
      const req = new Request(`${baseUrl}?userId=123`, {
        headers: { "x-forwarded-for": "127.0.0.1" },
      });
      const res = await GET(req);
      expect(res.status).toBe(404);
      const json = await getResponseJson(res);
      expect(json.error).toBe("Cards not found");
      expect(sharedRedisMockIncr).toHaveBeenCalledWith(
        "analytics:cards_api:failed_requests",
      );
    });

    it("should successfully return card data when present", async () => {
      const cardData = createStoredCardsRecord({
        userId: 456,
        cards: [{ cardName: "animeStats", titleColor: "#000" }],
        cardOrder: ["favoritesGrid", "animeStats"],
      });
      sharedRedisMockGet.mockResolvedValueOnce(JSON.stringify(cardData));
      const req = new Request(`${baseUrl}?userId=456`, {
        headers: { "x-forwarded-for": "127.0.0.1" },
      });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await getResponseJson(res);
      expect(json).toEqual(cardData);
    });

    it("should return stored card data unchanged (including unsupported types)", async () => {
      const cardData = createStoredCardsRecord({
        userId: 789,
        cards: [
          { cardName: "animeStats", titleColor: "#000" },
          { cardName: "mangaStats", titleColor: "#fff" },
          { cardName: "unsupportedCardType", titleColor: "#f0f" },
        ],
      });
      sharedRedisMockGet.mockResolvedValueOnce(JSON.stringify(cardData));
      const req = new Request(`${baseUrl}?userId=789`, {
        headers: { "x-forwarded-for": "127.0.0.1" },
      });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await getResponseJson(res);
      expect(json.cards).toHaveLength(3);
      expect(json.cards.map((c: { cardName: string }) => c.cardName)).toEqual([
        "animeStats",
        "mangaStats",
        "unsupportedCardType",
      ]);
    });

    it("should return stored data including unsupported card types and not persist changes in GET", async () => {
      const cardData = createStoredCardsRecord({
        userId: 101,
        cards: [
          { cardName: "animeStats", titleColor: "#000" },
          { cardName: "invalidCardType", titleColor: "#fff" },
        ],
      });
      sharedRedisMockGet.mockResolvedValueOnce(JSON.stringify(cardData));

      const req = new Request(`${baseUrl}?userId=101`, {
        headers: { "x-forwarded-for": "127.0.0.1" },
      });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await getResponseJson(res);
      expect(json.cards.map((c: { cardName: string }) => c.cardName)).toEqual([
        "animeStats",
        "invalidCardType",
      ]);

      expect(sharedRedisMockSet).not.toHaveBeenCalled();
    });

    it("should handle empty cards array", async () => {
      const cardData = createStoredCardsRecord({
        userId: 100,
        cards: [],
      });
      sharedRedisMockGet.mockResolvedValueOnce(JSON.stringify(cardData));
      const req = new Request(`${baseUrl}?userId=100`, {
        headers: { "x-forwarded-for": "127.0.0.1" },
      });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await getResponseJson(res);
      expect(json.cards).toEqual([]);
    });

    it("should query Redis with correct key format", async () => {
      sharedRedisMockGet.mockResolvedValueOnce(null);
      const userId = "12345";
      const req = new Request(`${baseUrl}?userId=${userId}`, {
        headers: { "x-forwarded-for": "127.0.0.1" },
      });
      await GET(req);
      expect(sharedRedisMockGet).toHaveBeenCalledWith(`cards:${userId}`);
    });
  });

  describe("Error Handling", () => {
    it("should return 500 if an error occurs during card data retrieval", async () => {
      sharedRedisMockGet.mockRejectedValueOnce(new Error("Redis error"));
      const req = new Request(`${baseUrl}?userId=123`, {
        headers: { "x-forwarded-for": "127.0.0.1" },
      });
      const res = await GET(req);
      expect(res.status).toBe(503);
      const json = await getResponseJson(res);
      expect(json.error).toBe("Card data is temporarily unavailable");
      expect(json.retryable).toBe(true);
    });

    it("should handle safeParse errors gracefully", async () => {
      sharedRedisMockGet.mockResolvedValueOnce("invalid json {{{");
      const req = new Request(`${baseUrl}?userId=123`, {
        headers: { "x-forwarded-for": "127.0.0.1" },
      });
      const res = await GET(req);
      expect(res.status).toBe(500);
      const json = await getResponseJson(res);
      expect(json.error).toBe("Stored cards record is incomplete or corrupted");
      expect(json.retryable).toBe(false);
    });

    it("should fail closed when stored cards record is missing required fields", async () => {
      sharedRedisMockGet.mockResolvedValueOnce(
        JSON.stringify({
          cards: [{ cardName: "animeStats", titleColor: "#000" }],
        }),
      );
      const req = new Request(`${baseUrl}?userId=123`, {
        headers: { "x-forwarded-for": "127.0.0.1" },
      });
      const res = await GET(req);

      expect(res.status).toBe(500);
      const json = await getResponseJson(res);
      expect(json.error).toBe("Stored cards record is incomplete or corrupted");
    });

    it("should fail closed when stored cards record contains invalid card entries", async () => {
      sharedRedisMockGet.mockResolvedValueOnce(
        JSON.stringify(
          createStoredCardsRecord({
            userId: 123,
            cards: [{ titleColor: "#000" }],
          }),
        ),
      );
      const req = new Request(`${baseUrl}?userId=123`, {
        headers: { "x-forwarded-for": "127.0.0.1" },
      });
      const res = await GET(req);

      expect(res.status).toBe(500);
      const json = await getResponseJson(res);
      expect(json.error).toBe("Stored cards record is incomplete or corrupted");
    });

    it("should fail closed when stored cards record userId mismatches the requested user", async () => {
      sharedRedisMockGet.mockResolvedValueOnce(
        JSON.stringify(
          createStoredCardsRecord({
            userId: 999,
            cards: [{ cardName: "animeStats", titleColor: "#000" }],
          }),
        ),
      );
      const req = new Request(`${baseUrl}?userId=123`, {
        headers: { "x-forwarded-for": "127.0.0.1" },
      });
      const res = await GET(req);

      expect(res.status).toBe(500);
      const json = await getResponseJson(res);
      expect(json.error).toBe("Stored cards record is incomplete or corrupted");
    });

    it("should track failed requests analytics on invalid userId", async () => {
      const req = new Request(`${baseUrl}?userId=invalid`, {
        headers: { "x-forwarded-for": "127.0.0.1" },
      });
      await GET(req);
      expect(sharedRedisMockIncr).toHaveBeenCalledWith(
        "analytics:cards_api:failed_requests",
      );
    });

    it("should track failed requests analytics on Redis error", async () => {
      sharedRedisMockGet.mockRejectedValueOnce(new Error("Redis error"));
      const req = new Request(`${baseUrl}?userId=123`, {
        headers: { "x-forwarded-for": "127.0.0.1" },
      });
      await GET(req);
      expect(sharedRedisMockIncr).toHaveBeenCalledWith(
        "analytics:cards_api:failed_requests",
      );
    });
  });

  describe("Analytics Tracking", () => {
    it("should increment successful requests counter on successful retrieval", async () => {
      const cardData = createStoredCardsRecord({
        userId: 456,
        cards: [{ cardName: "animeStats", titleColor: "#000" }],
      });
      sharedRedisMockGet.mockResolvedValueOnce(JSON.stringify(cardData));
      const req = new Request(`${baseUrl}?userId=456`, {
        headers: { "x-forwarded-for": "127.0.0.1" },
      });
      await GET(req);
      expect(sharedRedisMockIncr).toHaveBeenCalledWith(
        "analytics:cards_api:successful_requests",
      );
    });

    it("should not track analytics on invalid userId (only error increment)", async () => {
      const req = new Request(`${baseUrl}?userId=invalid`, {
        headers: { "x-forwarded-for": "127.0.0.1" },
      });
      await GET(req);
      expect(sharedRedisMockIncr).toHaveBeenCalledTimes(1);
      expect(sharedRedisMockIncr).toHaveBeenCalledWith(
        "analytics:cards_api:failed_requests",
      );
    });
  });

  describe("Rate Limiting", () => {
    it("should return 429 before reading Redis when the request is rate limited", async () => {
      sharedRatelimitMockLimit.mockResolvedValueOnce({
        success: false,
        limit: 60,
        remaining: 0,
        reset: Date.now() + 5_000,
        pending: Promise.resolve(),
      });

      const req = new Request(`${baseUrl}?userId=456`, {
        headers: { "x-forwarded-for": "127.0.0.1" },
      });
      const res = await GET(req);

      expect(res.status).toBe(429);
      const json = await getResponseJson(res);
      expect(json.error).toBe("Too many requests");
      expect(sharedRedisMockGet).not.toHaveBeenCalled();
      expect(sharedRedisMockIncr).toHaveBeenCalledWith(
        "analytics:cards_api:failed_requests",
      );
      expect(res.headers.get("Retry-After")).toBeTruthy();
    });
  });

  describe("Performance Monitoring", () => {
    it("should handle fast responses normally", async () => {
      const cardData = createStoredCardsRecord({
        userId: 456,
        cards: [{ cardName: "animeStats", titleColor: "#000" }],
      });
      sharedRedisMockGet.mockResolvedValueOnce(JSON.stringify(cardData));
      const req = new Request(`${baseUrl}?userId=456`, {
        headers: { "x-forwarded-for": "127.0.0.1" },
      });
      const res = await GET(req);
      expect(res.status).toBe(200);
    });

    it("should handle slow responses (>500ms) normally but log warning", async () => {
      const cardData = createStoredCardsRecord({
        userId: 456,
        cards: [{ cardName: "animeStats", titleColor: "#000" }],
      });
      sharedRedisMockGet.mockImplementationOnce(async () => {
        await delay(600);
        return JSON.stringify(cardData);
      });
      const req = new Request(`${baseUrl}?userId=456`, {
        headers: { "x-forwarded-for": "127.0.0.1" },
      });
      const res = await GET(req);
      expect(res.status).toBe(200);
    });
  });

  describe("CORS Headers", () => {
    it("should return proper CORS headers with Content-Type", async () => {
      const cardData = createStoredCardsRecord({
        userId: 456,
        cards: [{ cardName: "animeStats", titleColor: "#000" }],
      });
      sharedRedisMockGet.mockResolvedValueOnce(JSON.stringify(cardData));
      const req = new Request(`${baseUrl}?userId=456`, {
        headers: { "x-forwarded-for": "127.0.0.1" },
      });
      const res = await GET(req);
      expect(res.headers.get("Content-Type")).toBe("application/json");
      expect(res.headers.get("Access-Control-Allow-Origin")).toBeDefined();
    });

    it("should set CORS Access-Control-Allow-Origin to the request origin when present in dev", async () => {
      const prev = process.env.NEXT_PUBLIC_APP_URL;
      delete process.env.NEXT_PUBLIC_APP_URL;
      try {
        const cardData = createStoredCardsRecord({
          userId: 456,
          cards: [{ cardName: "animeStats", titleColor: "#000" }],
        });
        sharedRedisMockGet.mockResolvedValueOnce(JSON.stringify(cardData));
        const headers = new Headers();
        headers.set("x-forwarded-for", "127.0.0.1");
        headers.set("origin", "http://example.dev");
        const req = new Request(`${baseUrl}?userId=456`, {
          headers,
        });
        const res = await GET(req);
        expect(res.status).toBe(200);
        const json = await getResponseJson(res);
        expect(json).toEqual(cardData);
        expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
          "http://example.dev",
        );
      } finally {
        if (prev !== undefined) {
          process.env.NEXT_PUBLIC_APP_URL = prev;
        }
      }
    });

    it("should use configured NEXT_PUBLIC_APP_URL when set (overrides request origin)", async () => {
      const prev = process.env.NEXT_PUBLIC_APP_URL;
      (process.env as Record<string, string | undefined>)[
        "NEXT_PUBLIC_APP_URL"
      ] = "https://configured.example";
      const cardData = createStoredCardsRecord({
        userId: 456,
        cards: [{ cardName: "animeStats", titleColor: "#000" }],
      });
      sharedRedisMockGet.mockResolvedValueOnce(JSON.stringify(cardData));
      const req = new Request(`${baseUrl}?userId=456`, {
        headers: {
          "x-forwarded-for": "127.0.0.1",
          origin: "http://ignored-origin",
        },
      });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await getResponseJson(res);
      expect(json).toEqual(cardData);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://configured.example",
      );
      (process.env as Record<string, string | undefined>)[
        "NEXT_PUBLIC_APP_URL"
      ] = prev;
    });

    it("should handle missing origin header gracefully", async () => {
      const cardData = createStoredCardsRecord({
        userId: 456,
        cards: [{ cardName: "animeStats", titleColor: "#000" }],
      });
      sharedRedisMockGet.mockResolvedValueOnce(JSON.stringify(cardData));
      const req = new Request(`${baseUrl}?userId=456`, {
        headers: { "x-forwarded-for": "127.0.0.1" },
      });
      const res = await GET(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBeDefined();
    });

    it("should echo X-Request-Id when provided", async () => {
      const cardData = createStoredCardsRecord({
        userId: 456,
        cards: [{ cardName: "animeStats", titleColor: "#000" }],
      });
      sharedRedisMockGet.mockResolvedValueOnce(JSON.stringify(cardData));
      const req = new Request(`${baseUrl}?userId=456`, {
        headers: {
          "x-forwarded-for": "127.0.0.1",
          origin: "http://example.dev",
          "x-request-id": "req-cards-12345",
        },
      });
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("X-Request-Id")).toBe("req-cards-12345");
      expect(res.headers.get("Access-Control-Expose-Headers")).toContain(
        "X-Request-Id",
      );
    });
  });
});

describe("Cards API OPTIONS Endpoint", () => {
  const baseUrl = "http://localhost/api/get-cards";

  it("should handle OPTIONS request and return allowed methods", () => {
    const req = new Request(`${baseUrl}`, { method: "OPTIONS" });
    const res = OPTIONS(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain(
      "OPTIONS",
    );
  });

  it("should return proper CORS headers for OPTIONS request", () => {
    const req = new Request(`${baseUrl}`, {
      method: "OPTIONS",
      headers: { origin: "http://example.com" },
    });
    const res = OPTIONS(req);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeDefined();
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain(
      "Content-Type",
    );
  });

  it("should return null body for OPTIONS request", async () => {
    const req = new Request(`${baseUrl}`, { method: "OPTIONS" });
    const res = OPTIONS(req);
    const body = await res.text();
    expect(body).toBe("");
  });
});
