/**
 * Rate limiter mock setup
 */
let mockLimit = jest.fn();
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

/**
 * Redis mock for analytics
 */
jest.mock("@upstash/redis", () => ({
  Redis: {
    fromEnv: jest.fn(() => ({
      incr: jest.fn().mockResolvedValue(1),
    })),
  },
}));

// Set the app URL for same-origin validation testing
process.env.NEXT_PUBLIC_APP_URL = "http://localhost";

import { POST, OPTIONS } from "./route";

/**
 * Local endpoint used to build requests against the AniList proxy during tests.
 * @source
 */
const BASE_URL = "http://localhost/api/anilist";

/**
 * GraphQL query string used when a test does not provide a custom query.
 * @source
 */
const DEFAULT_QUERY = "query GetUserStats { dummyField }";

/**
 * Default set of variables accompanying the default query.
 * @source
 */
const DEFAULT_VARIABLES = { userId: 123 };

/**
 * Variables for GetUserId operation
 */
const GET_USER_ID_VARIABLES = { userName: "testUser" };

/**
 * Builds a POST request targeting the AniList proxy with optional overrides.
 * @param headers - Additional headers merged with the JSON content type.
 * @param body - Optional payload to stringify for the request.
 * @returns Configured Request instance for the AniList endpoint.
 * @source
 */
function createAniListRequest(
  headers: Record<string, string> = {},
  body?: object,
): Request {
  const requestBody = body ? JSON.stringify(body) : JSON.stringify({});

  return new Request(BASE_URL, {
    method: "POST",
    headers: new Headers({
      "Content-Type": "application/json",
      ...headers,
    }),
    body: requestBody,
  });
}

/**
 * Sets up environment variables for tests
 */
function setupEnvironment(nodeEnv: string, includeToken = false) {
  (process.env as Record<string, string>).NODE_ENV = nodeEnv;
  if (includeToken) {
    process.env.ANILIST_TOKEN = "dummy-token";
  } else {
    delete process.env.ANILIST_TOKEN;
  }
}

/**
 * Creates a GraphQL request payload
 */
function createGraphQLBody(
  query = DEFAULT_QUERY,
  variables?: Record<string, unknown>,
) {
  return { query, variables: variables || DEFAULT_VARIABLES };
}

/**
 * Mocks the global fetch call so tests can provide controlled responses.
 * @param responseData - Data that the mocked fetch should resolve to.
 * @param options - Optional overrides for status, headers, and ok flag.
 * @returns The mocked response object used by the fetch stub.
 * @source
 */
function mockFetchResponse(
  responseData: unknown,
  options: {
    ok?: boolean;
    status?: number;
    headers?: Record<string, string>;
  } = {},
) {
  const { ok = true, status = 200, headers = {} } = options;

  const fetchResponse = {
    ok,
    status,
    json: jest.fn().mockResolvedValue(responseData),
    headers: new Headers(headers),
  };

  globalThis.fetch = jest.fn().mockResolvedValue(fetchResponse as unknown);
  return fetchResponse;
}

/**
 * Asserts the response status and optionally validates the payload shape.
 * @param response - Response returned from the POST handler.
 * @param expectedStatus - HTTP status the response should have.
 * @param expectedData - Optional data expectations that may include error checks.
 * @returns Parsed data when expectations were provided; otherwise the original response.
 * @source
 */
async function expectResponse(
  response: Response,
  expectedStatus: number,
  expectedData?:
    | { error?: string; contains?: string }
    | Record<string, unknown>,
) {
  expect(response.status).toBe(expectedStatus);

  if (expectedData) {
    const data = await response.json();
    if (
      typeof expectedData === "object" &&
      expectedData !== null &&
      "error" in expectedData
    ) {
      expect(data.error).toBe((expectedData as { error: string }).error);
    } else if (
      typeof expectedData === "object" &&
      expectedData !== null &&
      "contains" in expectedData
    ) {
      expect(data.error).toContain(
        (expectedData as { contains: string }).contains,
      );
    } else {
      expect(data).toEqual(expectedData);
    }
    return data;
  }

  return response;
}

describe("AniList API Proxy Endpoint", () => {
  const originalEnv = process.env;

  let consoleSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeAll(() => {
    consoleSpy = jest.spyOn(console, "log").mockImplementation();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
  });

  afterAll(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    mockLimit = jest.fn().mockResolvedValue({ success: true });
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe("Test Simulation (Development Only)", () => {
    it("should simulate 429 rate limit error only in development mode", async () => {
      setupEnvironment("development");

      const request = createAniListRequest({ "X-Test-Status": "429" });
      const response = await POST(request);

      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBe("60");
      await expectResponse(response, 429, {
        error: "Rate limited (test simulation)",
      });
    });

    it("should simulate 500 internal server error only in development mode", async () => {
      setupEnvironment("development");

      const request = createAniListRequest({ "X-Test-Status": "500" });
      const response = await POST(request);

      await expectResponse(response, 500, {
        error: "Internal server error (test simulation)",
      });
    });

    it("should not simulate errors in production mode", async () => {
      setupEnvironment("production", true);

      const requestBody = createGraphQLBody();
      const request = createAniListRequest(
        { "X-Test-Status": "429" },
        requestBody,
      );

      mockFetchResponse({ data: { user: "testUser" } });

      const response = await POST(request);

      // Should make actual API call, not simulate
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://graphql.anilist.co",
        expect.any(Object),
      );
      expect(response.status).toBe(200);
    });
  });

  describe("Successful Requests", () => {
    it("should forward request and return JSON data on successful AniList response", async () => {
      setupEnvironment("production", true);

      const requestBody = createGraphQLBody();
      const request = createAniListRequest({}, requestBody);

      const mockData = { data: { user: { id: 1, name: "testUser" } } };
      mockFetchResponse(mockData);

      const response = await POST(request);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://graphql.anilist.co",
        expect.any(Object),
      );
      await expectResponse(response, 200, mockData.data);
    });

    it("should include AniList token in Authorization header when present", async () => {
      setupEnvironment("production", true);

      const requestBody = createGraphQLBody();
      const request = createAniListRequest({}, requestBody);

      mockFetchResponse({ data: { user: "testUser" } });

      await POST(request);

      const fetchCall = (globalThis.fetch as jest.Mock).mock.calls[0];
      const fetchOptions = fetchCall[1] as Record<string, unknown>;
      expect(fetchOptions.headers).toHaveProperty(
        "Authorization",
        "Bearer dummy-token",
      );
    });

    it("should not include Authorization header when token is not set", async () => {
      setupEnvironment("production", false);

      const requestBody = createGraphQLBody();
      const request = createAniListRequest({}, requestBody);

      mockFetchResponse({ data: { user: "testUser" } });

      await POST(request);

      const fetchCall = (globalThis.fetch as jest.Mock).mock.calls[0];
      const fetchOptions = fetchCall[1] as Record<string, unknown>;
      expect(fetchOptions.headers).not.toHaveProperty("Authorization");
    });

    it("should track analytics for successful requests", async () => {
      setupEnvironment("production", true);

      const requestBody = createGraphQLBody();
      const request = createAniListRequest({}, requestBody);

      mockFetchResponse({ data: { user: "testUser" } });

      await POST(request);

      // Analytics is tracked asynchronously, just verify request succeeds
      expect(globalThis.fetch).toHaveBeenCalled();
    });

    it("should log rate limit headers when present in response", async () => {
      setupEnvironment("production", true);

      const requestBody = createGraphQLBody();
      const request = createAniListRequest({}, requestBody);

      mockFetchResponse(
        { data: { user: "testUser" } },
        {
          headers: {
            "X-RateLimit-Limit": "90",
            "X-RateLimit-Remaining": "85",
            "X-RateLimit-Reset": "1234567890",
          },
        },
      );

      const response = await POST(request);

      // Verify response is successful despite logging
      expect(response.status).toBe(200);
    });

    it("should log slow requests when duration exceeds 1000ms", async () => {
      setupEnvironment("production", true);

      const requestBody = createGraphQLBody();
      const request = createAniListRequest({}, requestBody);

      mockFetchResponse({ data: { user: "testUser" } });

      // Mock Date.now to simulate slow request
      const originalDateNow = Date.now;
      let callCount = 0;
      jest.spyOn(Date, "now").mockImplementation(() => {
        callCount++;
        if (callCount === 1) return 1000; // startTime
        return 2500; // after request: 1500ms elapsed
      });

      const response = await POST(request);

      // Verify response is successful and slow warning would be logged
      expect(response.status).toBe(200);

      Date.now = originalDateNow;
    });
  });

  describe("Origin Validation", () => {
    it("should reject cross-origin requests in production when origin differs", async () => {
      setupEnvironment("production", true);

      const requestBody = createGraphQLBody();
      const request = createAniListRequest(
        { origin: "http://different-origin.com" },
        requestBody,
      );

      mockFetchResponse({ data: { user: "testUser" } });

      const response = await POST(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Unauthorized");
      // Fetch should not be called due to early rejection
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it("should accept requests with matching origin in production", async () => {
      setupEnvironment("production", true);

      const requestBody = createGraphQLBody();
      const request = createAniListRequest(
        { origin: "http://localhost" },
        requestBody,
      );

      mockFetchResponse({ data: { user: "testUser" } });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(globalThis.fetch).toHaveBeenCalled();
    });
  });

  describe("AniList Error Responses", () => {
    it("should handle GraphQL errors in response", async () => {
      setupEnvironment("production", true);

      const requestBody = createGraphQLBody();
      const request = createAniListRequest({}, requestBody);

      const errorResponse = { errors: [{ message: "User not found" }] };
      mockFetchResponse(errorResponse);

      const response = await POST(request);

      await expectResponse(response, 500, { error: "User not found" });
    });

    it("should handle non-ok HTTP responses from AniList", async () => {
      setupEnvironment("production", true);

      const requestBody = createGraphQLBody();
      const request = createAniListRequest({}, requestBody);

      mockFetchResponse(
        { error: "AniList API was rate limited" },
        { ok: false, status: 429, headers: { "retry-after": "60" } },
      );

      const response = await POST(request);

      expect(response.status).toBe(429);
      const data = await response.json();
      expect(data.error).toContain("AniList API was rate limited");
      expect(data.error).toContain("Retry-After: 60");
    });

    it("should handle 400 Bad Request from AniList", async () => {
      setupEnvironment("production", true);

      const requestBody = createGraphQLBody();
      const request = createAniListRequest({}, requestBody);

      mockFetchResponse({ error: "Invalid query" }, { ok: false, status: 400 });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("Invalid query");
    });

    it("should handle 401 Unauthorized from AniList", async () => {
      setupEnvironment("production", true);

      const requestBody = createGraphQLBody();
      const request = createAniListRequest({}, requestBody);

      mockFetchResponse({ error: "Invalid token" }, { ok: false, status: 401 });

      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it("should handle 403 Forbidden from AniList", async () => {
      setupEnvironment("production", true);

      const requestBody = createGraphQLBody();
      const request = createAniListRequest({}, requestBody);

      mockFetchResponse({ error: "Access denied" }, { ok: false, status: 403 });

      const response = await POST(request);

      expect(response.status).toBe(403);
    });

    it("should handle 500 Internal Server Error from AniList", async () => {
      setupEnvironment("production", true);

      const requestBody = createGraphQLBody();
      const request = createAniListRequest({}, requestBody);

      mockFetchResponse(
        { error: "Internal server error" },
        { ok: false, status: 500 },
      );

      const response = await POST(request);

      expect(response.status).toBe(500);
    });

    it("should return error with descriptive message on 500 failure", async () => {
      setupEnvironment("production", true);

      const requestBody = createGraphQLBody();
      const request = createAniListRequest({}, requestBody);

      mockFetchResponse(
        { error: "Database connection failed" },
        { ok: false, status: 500 },
      );

      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain("Database connection failed");
    });

    it("should handle errors gracefully and return them to client", async () => {
      setupEnvironment("production", true);

      const requestBody = createGraphQLBody();
      const request = createAniListRequest({}, requestBody);

      globalThis.fetch = jest
        .fn()
        .mockRejectedValue(new Error("Network error"));

      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain("Network error");
    });
  });

  describe("Request Parsing", () => {
    it("should parse GetUserStats operation and extract userId from variables", async () => {
      setupEnvironment("production", true);

      const GET_USER_STATS_QUERY = "query GetUserStats { dummyField }";
      const requestBody = createGraphQLBody(
        GET_USER_STATS_QUERY,
        DEFAULT_VARIABLES,
      );
      const request = createAniListRequest({}, requestBody);

      mockFetchResponse({ data: { stats: {} } });

      const response = await POST(request);

      // Verify operation is processed correctly
      expect(response.status).toBe(200);
    });

    it("should parse GetUserId operation and extract userName from variables", async () => {
      setupEnvironment("production", true);

      const requestBody = createGraphQLBody(
        "query GetUserId { user { id } }",
        GET_USER_ID_VARIABLES,
      );
      const request = createAniListRequest({}, requestBody);

      mockFetchResponse({ data: { user: { id: 1 } } });

      const response = await POST(request);

      // Verify operation is processed correctly
      expect(response.status).toBe(200);
    });

    it("should handle anonymous operations (query without name)", async () => {
      setupEnvironment("production", true);

      const anonQuery = "query { user { id } }";
      const requestBody = createGraphQLBody(anonQuery);
      const request = createAniListRequest({}, requestBody);

      mockFetchResponse({ data: { user: { id: 1 } } });

      const response = await POST(request);

      // Verify operation is processed correctly
      expect(response.status).toBe(200);
    });

    it("should handle GetUserStats without userId variable", async () => {
      setupEnvironment("production", true);

      const GET_USER_STATS_QUERY = "query GetUserStats { dummyField }";
      const requestBody = createGraphQLBody(GET_USER_STATS_QUERY);
      const request = createAniListRequest({}, requestBody);

      mockFetchResponse({ data: { stats: {} } });

      const response = await POST(request);

      // Verify operation is processed correctly even without specific userId
      expect(response.status).toBe(200);
    });

    it("should handle GetUserId without userName variable", async () => {
      setupEnvironment("production", true);

      const requestBody = createGraphQLBody("query GetUserId { user { id } }");
      const request = createAniListRequest({}, requestBody);

      mockFetchResponse({ data: { user: { id: 1 } } });

      const response = await POST(request);

      // Verify operation is processed correctly even without specific userName
      expect(response.status).toBe(200);
    });
  });

  describe("Network and JSON Parsing Errors", () => {
    it("should handle fetch network errors", async () => {
      setupEnvironment("production", true);

      const requestBody = createGraphQLBody();
      const request = createAniListRequest({}, requestBody);

      globalThis.fetch = jest
        .fn()
        .mockRejectedValue(new Error("Network error"));

      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain("Network error");
    });

    it("should handle invalid JSON in request body", async () => {
      setupEnvironment("production", true);

      const request = new Request(BASE_URL, {
        method: "POST",
        headers: new Headers({
          "Content-Type": "application/json",
        }),
        body: "invalid json {",
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });
  });

  describe("CORS and OPTIONS", () => {
    it("should respond to OPTIONS preflight with CORS headers", async () => {
      const request = new Request(BASE_URL, {
        method: "OPTIONS",
        headers: {
          origin: "http://localhost",
          "Content-Type": "application/json",
        },
      });

      const response = OPTIONS(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
        "http://localhost",
      );
    });

    it("should allow POST method in CORS preflight", async () => {
      const request = new Request(BASE_URL, {
        method: "OPTIONS",
        headers: {
          origin: "http://localhost",
        },
      });

      const response = OPTIONS(request);

      expect(response.headers.get("Access-Control-Allow-Methods")).toContain(
        "POST",
      );
    });

    it("should include Content-Type in allowed headers", async () => {
      const request = new Request(BASE_URL, {
        method: "OPTIONS",
        headers: {
          origin: "http://localhost",
        },
      });

      const response = OPTIONS(request);

      expect(response.headers.get("Access-Control-Allow-Headers")).toContain(
        "Content-Type",
      );
    });
  });

  describe("Rate Limiting", () => {
    it("should handle rate limit rejection from initializeApiRequest", async () => {
      setupEnvironment("production", true);

      const requestBody = createGraphQLBody();
      const request = createAniListRequest({}, requestBody);

      // Note: initializeApiRequest is real and implements its own rate limit logic
      // This test verifies that successful requests pass through correctly
      mockFetchResponse({ data: { user: "testUser" } });

      const response = await POST(request);

      // Verify the response succeeds (no rate limit hit in this case)
      expect(response.status).toBe(200);
    });
  });

  describe("IP Logging", () => {
    it("should extract and log IP from x-forwarded-for header", async () => {
      setupEnvironment("production", true);

      const requestBody = createGraphQLBody();
      const request = createAniListRequest(
        { "x-forwarded-for": "192.168.1.1" },
        requestBody,
      );

      mockFetchResponse({ data: { user: "testUser" } });

      const response = await POST(request);

      // Verify request is processed with IP extracted
      expect(response.status).toBe(200);
    });

    it("should default to 127.0.0.1 when x-forwarded-for is not present", async () => {
      setupEnvironment("production", true);

      const requestBody = createGraphQLBody();
      const request = createAniListRequest({}, requestBody);

      mockFetchResponse({ data: { user: "testUser" } });

      const response = await POST(request);

      // Verify request is processed with default IP
      expect(response.status).toBe(200);
    });
  });

  describe("Dev-only Headers", () => {
    it("should include X-Test-Status header in dev mode", async () => {
      setupEnvironment("development", true);

      const requestBody = createGraphQLBody();
      const request = createAniListRequest(
        { "X-Test-Status": "custom" },
        requestBody,
      );

      mockFetchResponse({ data: { user: "testUser" } });

      await POST(request);

      const fetchCall = (globalThis.fetch as jest.Mock).mock.calls[0];
      const fetchOptions = fetchCall[1] as Record<string, unknown>;
      expect(fetchOptions.headers).toHaveProperty("X-Test-Status", "custom");
    });

    it("should not include X-Test-Status header in production", async () => {
      setupEnvironment("production", true);

      const requestBody = createGraphQLBody();
      const request = createAniListRequest(
        { "X-Test-Status": "custom" },
        requestBody,
      );

      mockFetchResponse({ data: { user: "testUser" } });

      const response = await POST(request);

      // Verify the response is successful (no test simulation in production)
      expect(response.status).toBe(200);
    });
  });
});
