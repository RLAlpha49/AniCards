import { GET } from "./route";

/**
 * Mocked Redis getter shared by the card API tests.
 * @source
 */
let mockRedisGet = jest.fn();

function createRedisFromEnvMock() {
  return {
    get: mockRedisGet,
    incr: jest.fn(async () => 1),
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

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return 400 error for missing userId parameter", async () => {
    const req = new Request(`${baseUrl}`, {
      headers: { "x-forwarded-for": "127.0.0.1" },
    });
    const res = await GET(req);
    expect(res.status).toBe(400);
    const json = await getResponseJson(res);
    expect(json.error).toBe("Missing user ID parameter");
  });

  it("should return 400 error for invalid user ID format", async () => {
    const req = new Request(`${baseUrl}?userId=abc`, {
      headers: { "x-forwarded-for": "127.0.0.1" },
    });
    const res = await GET(req);
    expect(res.status).toBe(400);
    const json = await getResponseJson(res);
    expect(json.error).toBe("Invalid user ID format");
  });

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

  it("should set CORS Access-Control-Allow-Origin to the request origin when present in dev", async () => {
    const cardData = {
      cards: [{ cardName: "animeStats", titleColor: "#000" }],
    };
    mockRedisGet.mockResolvedValueOnce(JSON.stringify(cardData));
    const req = new Request(`${baseUrl}?userId=456`, {
      headers: { "x-forwarded-for": "127.0.0.1", origin: "http://example.dev" },
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
    (process.env as Record<string, string | undefined>)["NEXT_PUBLIC_APP_URL"] =
      "https://configured.example";
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
    (process.env as Record<string, string | undefined>)["NEXT_PUBLIC_APP_URL"] =
      prev;
  });

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
});
