import { GET, OPTIONS } from "./route";

/**
 * Mocked Redis getter shared by the card API tests.
 * @source
 */
let mockRedisGet = jest.fn();
let mockRedisIncr = jest.fn();

function createRedisFromEnvMock() {
  return {
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
 * Extracts the parsed JSON payload from a response for assertions.
 * @param response - HTTP response produced by the handler.
 * @returns Parsed JSON payload.
 * @source
 */
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
async function getResponseJson(response: Response): Promise<any> {
  return response.json();
}

describe("Cards API GET Endpoint", () => {
  const baseUrl = "http://localhost/api/get-cards";

  beforeEach(() => {
    jest.useFakeTimers();
    mockRedisIncr.mockResolvedValue(1);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
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
      mockRedisGet.mockResolvedValueOnce(JSON.stringify(cardData));
      const req = new Request(`${baseUrl}?userId=0`, {
        headers: { "x-forwarded-for": "127.0.0.1" },
      });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await getResponseJson(res);
      expect(json).toEqual(cardData);
      expect(mockRedisGet).toHaveBeenCalledWith("cards:0");
    });

    it("should successfully handle very large userId values", async () => {
      const cardData = {
        cards: [{ cardName: "animeStats", titleColor: "#000" }],
      };
      const largeId = "999999999";
      mockRedisGet.mockResolvedValueOnce(JSON.stringify(cardData));
      const req = new Request(`${baseUrl}?userId=${largeId}`, {
        headers: { "x-forwarded-for": "127.0.0.1" },
      });
      const res = await GET(req);
      expect(res.status).toBe(200);
      expect(mockRedisGet).toHaveBeenCalledWith(`cards:${largeId}`);
    });
  });

  describe("Redis Data Retrieval", () => {
    it("should return 404 if cards are not found in Redis", async () => {
      mockRedisGet.mockResolvedValueOnce(null);
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
      mockRedisGet.mockResolvedValueOnce(JSON.stringify(cardData));
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
      mockRedisGet.mockResolvedValueOnce(JSON.stringify(cardData));
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
      mockRedisGet.mockResolvedValueOnce(JSON.stringify(cardData));
      const req = new Request(`${baseUrl}?userId=100`, {
        headers: { "x-forwarded-for": "127.0.0.1" },
      });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await getResponseJson(res);
      expect(json.cards).toEqual([]);
    });

    it("should query Redis with correct key format", async () => {
      mockRedisGet.mockResolvedValueOnce(null);
      const userId = "12345";
      const req = new Request(`${baseUrl}?userId=${userId}`, {
        headers: { "x-forwarded-for": "127.0.0.1" },
      });
      await GET(req);
      expect(mockRedisGet).toHaveBeenCalledWith(`cards:${userId}`);
    });
  });

  describe("Error Handling", () => {
    it("should return 500 if an error occurs during card data retrieval", async () => {
      mockRedisGet.mockRejectedValueOnce(new Error("Redis error"));
      const req = new Request(`${baseUrl}?userId=123`, {
        headers: { "x-forwarded-for": "127.0.0.1" },
      });
      const res = await GET(req);
      expect(res.status).toBe(500);
      const json = await getResponseJson(res);
      expect(json.error).toBe("Failed to fetch cards");
    });

    it("should handle safeParse errors gracefully", async () => {
      mockRedisGet.mockResolvedValueOnce("invalid json {{{");
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
      expect(mockRedisIncr).toHaveBeenCalledWith(
        "analytics:cards_api:failed_requests",
      );
    });

    it("should track failed requests analytics on Redis error", async () => {
      mockRedisGet.mockRejectedValueOnce(new Error("Redis error"));
      const req = new Request(`${baseUrl}?userId=123`, {
        headers: { "x-forwarded-for": "127.0.0.1" },
      });
      await GET(req);
      expect(mockRedisIncr).toHaveBeenCalledWith(
        "analytics:cards_api:failed_requests",
      );
    });
  });

  describe("Analytics Tracking", () => {
    it("should increment successful requests counter on successful retrieval", async () => {
      const cardData = {
        cards: [{ cardName: "animeStats", titleColor: "#000" }],
      };
      mockRedisGet.mockResolvedValueOnce(JSON.stringify(cardData));
      const req = new Request(`${baseUrl}?userId=456`, {
        headers: { "x-forwarded-for": "127.0.0.1" },
      });
      await GET(req);
      expect(mockRedisIncr).toHaveBeenCalledWith(
        "analytics:cards_api:successful_requests",
      );
    });

    it("should not track analytics on invalid userId (only error increment)", async () => {
      const req = new Request(`${baseUrl}?userId=invalid`, {
        headers: { "x-forwarded-for": "127.0.0.1" },
      });
      await GET(req);
      expect(mockRedisIncr).toHaveBeenCalledTimes(1);
      expect(mockRedisIncr).toHaveBeenCalledWith(
        "analytics:cards_api:failed_requests",
      );
    });
  });

  describe("Performance Monitoring", () => {
    it("should handle fast responses normally", async () => {
      const cardData = {
        cards: [{ cardName: "animeStats", titleColor: "#000" }],
      };
      mockRedisGet.mockResolvedValueOnce(JSON.stringify(cardData));
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
      mockRedisGet.mockImplementationOnce(() => {
        jest.advanceTimersByTime(600);
        return Promise.resolve(JSON.stringify(cardData));
      });
      const req = new Request(`${baseUrl}?userId=456`, {
        headers: { "x-forwarded-for": "127.0.0.1" },
      });
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();
      const res = await GET(req);
      expect(res.status).toBe(200);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("CORS Headers", () => {
    it("should return proper CORS headers with Content-Type", async () => {
      const cardData = {
        cards: [{ cardName: "animeStats", titleColor: "#000" }],
      };
      mockRedisGet.mockResolvedValueOnce(JSON.stringify(cardData));
      const req = new Request(`${baseUrl}?userId=456`, {
        headers: { "x-forwarded-for": "127.0.0.1" },
      });
      const res = await GET(req);
      expect(res.headers.get("Content-Type")).toBe("application/json");
      expect(res.headers.get("Access-Control-Allow-Origin")).toBeDefined();
    });

    it("should set CORS Access-Control-Allow-Origin to the request origin when present in dev", async () => {
      const cardData = {
        cards: [{ cardName: "animeStats", titleColor: "#000" }],
      };
      mockRedisGet.mockResolvedValueOnce(JSON.stringify(cardData));
      const req = new Request(`${baseUrl}?userId=456`, {
        headers: {
          "x-forwarded-for": "127.0.0.1",
          origin: "http://example.dev",
        },
      });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await getResponseJson(res);
      expect(json).toEqual(cardData);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "http://example.dev",
      );
    });

    it("should use configured NEXT_PUBLIC_APP_URL when set (overrides request origin)", async () => {
      const prev = process.env.NEXT_PUBLIC_APP_URL;
      (process.env as Record<string, string | undefined>)[
        "NEXT_PUBLIC_APP_URL"
      ] = "https://configured.example";
      const cardData = {
        cards: [{ cardName: "animeStats", titleColor: "#000" }],
      };
      mockRedisGet.mockResolvedValueOnce(JSON.stringify(cardData));
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
      mockRedisGet.mockResolvedValueOnce(JSON.stringify(cardData));
      const req = new Request(`${baseUrl}?userId=456`, {
        headers: { "x-forwarded-for": "127.0.0.1" },
      });
      const res = await GET(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBeDefined();
    });
  });

  describe("IP Tracking", () => {
    it("should extract IP from x-forwarded-for header", async () => {
      mockRedisGet.mockResolvedValueOnce(null);
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();
      const req = new Request(`${baseUrl}?userId=123`, {
        headers: { "x-forwarded-for": "192.168.1.100" },
      });
      await GET(req);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("192.168.1.100"),
      );
      consoleSpy.mockRestore();
    });

    it("should use unknown IP when x-forwarded-for header is missing", async () => {
      mockRedisGet.mockResolvedValueOnce(null);
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();
      const req = new Request(`${baseUrl}?userId=123`);
      await GET(req);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("unknown IP"),
      );
      consoleSpy.mockRestore();
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
