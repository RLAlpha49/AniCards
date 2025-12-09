import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import {
  sharedRedisMockGet,
  sharedRedisMockIncr,
} from "@/tests/unit/__setup__.test";

const { GET, OPTIONS } = await import("@/app/api/get-cards/route");

/**
 * Extracts the parsed JSON payload from a response for assertions.
 * @param response - HTTP response produced by the handler.
 * @returns Parsed JSON payload.
 * @source
 */
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
async function getResponseJson(response: Response): Promise<any> {
  return response.json();
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("Cards API GET Endpoint", () => {
  const baseUrl = "http://localhost/api/get-cards";

  beforeEach(() => {
    sharedRedisMockIncr.mockResolvedValue(1);
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

    it("should successfully handle userId as zero", async () => {
      const cardData = {
        cards: [{ cardName: "animeStats", titleColor: "#000" }],
      };
      sharedRedisMockGet.mockResolvedValueOnce(JSON.stringify(cardData));
      const req = new Request(`${baseUrl}?userId=0`, {
        headers: { "x-forwarded-for": "127.0.0.1" },
      });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await getResponseJson(res);
      expect(json).toEqual(cardData);
      expect(sharedRedisMockGet).toHaveBeenCalledWith("cards:0");
    });

    it("should successfully handle very large userId values", async () => {
      const cardData = {
        cards: [{ cardName: "animeStats", titleColor: "#000" }],
      };
      const largeId = "999999999";
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
    });

    it("should successfully return card data when present", async () => {
      const cardData = {
        cards: [{ cardName: "animeStats", titleColor: "#000" }],
      };
      sharedRedisMockGet.mockResolvedValueOnce(JSON.stringify(cardData));
      const req = new Request(`${baseUrl}?userId=456`, {
        headers: { "x-forwarded-for": "127.0.0.1" },
      });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await getResponseJson(res);
      expect(json).toEqual(cardData);
    });

    it("should handle multiple cards in response", async () => {
      const cardData = {
        cards: [
          { cardName: "animeStats", titleColor: "#000" },
          { cardName: "mangaStats", titleColor: "#fff" },
          { cardName: "activityFeed", titleColor: "#f0f" },
        ],
      };
      sharedRedisMockGet.mockResolvedValueOnce(JSON.stringify(cardData));
      const req = new Request(`${baseUrl}?userId=789`, {
        headers: { "x-forwarded-for": "127.0.0.1" },
      });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await getResponseJson(res);
      expect(json.cards).toHaveLength(3);
      expect(json).toEqual(cardData);
    });

    it("should handle empty cards array", async () => {
      const cardData = { cards: [] };
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
      expect(res.status).toBe(500);
      const json = await getResponseJson(res);
      expect(json.error).toBe("Failed to fetch cards");
    });

    it("should handle safeParse errors gracefully", async () => {
      sharedRedisMockGet.mockResolvedValueOnce("invalid json {{{");
      const req = new Request(`${baseUrl}?userId=123`, {
        headers: { "x-forwarded-for": "127.0.0.1" },
      });
      const res = await GET(req);
      expect(res.status).toBe(500);
      const json = await getResponseJson(res);
      expect(json.error).toBe("Failed to fetch cards");
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
      const cardData = {
        cards: [{ cardName: "animeStats", titleColor: "#000" }],
      };
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

  describe("Performance Monitoring", () => {
    it("should handle fast responses normally", async () => {
      const cardData = {
        cards: [{ cardName: "animeStats", titleColor: "#000" }],
      };
      sharedRedisMockGet.mockResolvedValueOnce(JSON.stringify(cardData));
      const req = new Request(`${baseUrl}?userId=456`, {
        headers: { "x-forwarded-for": "127.0.0.1" },
      });
      const res = await GET(req);
      expect(res.status).toBe(200);
    });

    it("should handle slow responses (>500ms) normally but log warning", async () => {
      const cardData = {
        cards: [{ cardName: "animeStats", titleColor: "#000" }],
      };
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
      const cardData = {
        cards: [{ cardName: "animeStats", titleColor: "#000" }],
      };
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
        const cardData = {
          cards: [{ cardName: "animeStats", titleColor: "#000" }],
        };
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
      const cardData = {
        cards: [{ cardName: "animeStats", titleColor: "#000" }],
      };
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
      const cardData = {
        cards: [{ cardName: "animeStats", titleColor: "#000" }],
      };
      sharedRedisMockGet.mockResolvedValueOnce(JSON.stringify(cardData));
      const req = new Request(`${baseUrl}?userId=456`, {
        headers: { "x-forwarded-for": "127.0.0.1" },
      });
      const res = await GET(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBeDefined();
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
