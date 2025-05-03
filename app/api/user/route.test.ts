import { GET } from "./route";

// Declare mockRedisGet so tests can simulate Redis responses.
// eslint-disable-next-line no-var
var mockRedisGet = jest.fn();

jest.mock("@upstash/redis", () => {
  return {
    Redis: {
      fromEnv: jest.fn(() => ({
        get: mockRedisGet,
        incr: jest.fn(() => Promise.resolve(1)),
      })),
    },
  };
});

// Helper function to extract JSON from the response.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getResponseJson(response: Response): Promise<any> {
  return response.json();
}

describe("User API GET Endpoint", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return 400 error for missing userId parameter", async () => {
    // Create a request without the required 'userId' query parameter.
    const req = new Request("http://localhost/api/user", {
      headers: { "x-forwarded-for": "127.0.0.1" },
    });
    const res = await GET(req);
    expect(res.status).toBe(400);

    const json = await getResponseJson(res);
    expect(json.error).toBe("Missing userId or username parameter");
  });

  it("should return 400 error for invalid userId format", async () => {
    // A non‑numeric userId should trigger an error.
    const req = new Request("http://localhost/api/user?userId=abc", {
      headers: { "x-forwarded-for": "127.0.0.1" },
    });
    const res = await GET(req);
    expect(res.status).toBe(400);

    const json = await getResponseJson(res);
    expect(json.error).toBe("Invalid userId parameter");
  });

  it("should return 404 error if user data is not found", async () => {
    // Simulate Redis returning no data for the given key.
    mockRedisGet.mockResolvedValueOnce(null);

    const req = new Request("http://localhost/api/user?userId=123", {
      headers: { "x-forwarded-for": "127.0.0.1" },
    });
    const res = await GET(req);
    expect(res.status).toBe(404);

    const json = await getResponseJson(res);
    expect(json.error).toBe("User not found");
  });

  it("should return 200 and the user data when found", async () => {
    // Simulate valid user data stored in Redis.
    const userData = {
      userId: 123,
      username: "testUser",
      stats: { score: 10 },
    };
    mockRedisGet.mockResolvedValueOnce(JSON.stringify(userData));

    const req = new Request("http://localhost/api/user?userId=123", {
      headers: { "x-forwarded-for": "127.0.0.1" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await getResponseJson(res);
    expect(json).toEqual(userData);
  });

  it("should return 500 error if an error occurs during Redis fetch", async () => {
    // Simulate an error when fetching data from Redis.
    mockRedisGet.mockRejectedValueOnce(new Error("Redis error"));

    const req = new Request("http://localhost/api/user?userId=123", {
      headers: { "x-forwarded-for": "127.0.0.1" },
    });
    const res = await GET(req);
    expect(res.status).toBe(500);

    const json = await getResponseJson(res);
    expect(json.error).toBe("Failed to fetch user data");
  });
});
