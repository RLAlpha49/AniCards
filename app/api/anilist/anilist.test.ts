import { beforeEach, afterEach } from "node:test";

/**
 * Controls the mocked rate limiter response so initializeApiRequest tests can vary limits.
 * @source
 */
let mockLimit = jest.fn().mockResolvedValue({ success: true });
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
 * Create a consistent, named Redis mock for tests to avoid deep nesting in jest.mock() calls.
 */
function createRedisFromEnvMock() {
  return {
    incr: jest.fn(async () => 1),
  };
}

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
 * Applies NODE_ENV and optionally seeds the AniList token for each test.
 * @param nodeEnv - Environment name to set before running a scenario.
 * @param includeToken - When true, adds a dummy AniList token for authentication paths.
 * @source
 */
function setupEnvironment(nodeEnv: string, includeToken = false) {
  (process.env as Record<string, string>).NODE_ENV = nodeEnv;
  if (includeToken) {
    process.env.ANILIST_TOKEN = "dummy-token";
  }
}

/**
 * Builds a GraphQL request payload, defaulting to the shared query and variables.
 * @param query - Optional GraphQL query string.
 * @param variables - Optional variables object.
 * @returns GraphQL request body used in tests.
 * @source
 */
function createGraphQLBody(
  query = DEFAULT_QUERY,
  variables = DEFAULT_VARIABLES,
) {
  return { query, variables };
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

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    jest.mock("@upstash/redis", () => ({
      Redis: {
        fromEnv: jest.fn(createRedisFromEnvMock),
      },
    }));
    // Reset the default mockLimit behavior for each test
    mockLimit = jest.fn().mockResolvedValue({ success: true });
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it("should simulate 429 rate limit error in development mode", async () => {
    setupEnvironment("development");

    const request = createAniListRequest({ "X-Test-Status": "429" });
    const response = await POST(request);

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");

    await expectResponse(response, 429, {
      error: "Rate limited (test simulation)",
    });
  });

  it("should simulate 500 internal server error in development mode", async () => {
    setupEnvironment("development");

    const request = createAniListRequest({ "X-Test-Status": "500" });
    const response = await POST(request);

    await expectResponse(response, 500, {
      error: "Internal server error (test simulation)",
    });
  });

  it("should forward the request and return json data when AniList API responds successfully", async () => {
    setupEnvironment("production", true);

    const requestBody = createGraphQLBody();
    const request = createAniListRequest({}, requestBody);

    // Mock successful AniList API response
    const mockData = { data: { user: "testUser" } };
    mockFetchResponse(mockData);

    const response = await POST(request);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://graphql.anilist.co",
      expect.any(Object),
    );

    await expectResponse(response, 200, mockData.data);
  });

  it("should reject cross-origin requests in production when origin differs", async () => {
    setupEnvironment("production", true);

    const requestBody = createGraphQLBody();
    const request = createAniListRequest(
      { origin: "http://different-origin.com" },
      requestBody,
    );

    // Mock successful AniList API response (should not be invoked due to origin rejection)
    const mockData = { data: { user: "testUser" } };
    mockFetchResponse(mockData);

    const response = await POST(request);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("should return an error when AniList API response has GraphQL errors", async () => {
    setupEnvironment("production", true);

    const requestBody = createGraphQLBody();
    const request = createAniListRequest({}, requestBody);

    // Simulate GraphQL errors in response
    const errorResponse = { errors: [{ message: "GraphQL error test" }] };
    mockFetchResponse(errorResponse);

    const response = await POST(request);
    await expectResponse(response, 500, { error: "GraphQL error test" });
  });

  it("should handle non-ok responses from AniList API correctly", async () => {
    setupEnvironment("production", true);

    const requestBody = createGraphQLBody();
    const request = createAniListRequest({}, requestBody);

    // Simulate a non-ok response (for example, a rate limit from AniList)
    const fetchResponse = {
      ok: false,
      status: 429,
      json: jest
        .fn()
        .mockResolvedValue({ error: "AniList API was rate limited" }),
      headers: new Headers({
        "retry-after": "60",
      }),
    };
    globalThis.fetch = jest.fn().mockResolvedValue(fetchResponse as unknown);

    const response = await POST(request);
    expect(response.status).toBe(429);
    const data = await response.json();
    // Should combine the error message with the retry header details
    expect(data.error).toContain("AniList API was rate limited");
    expect(data.error).toContain("Retry-After: 60");
  });

  it("should respond to OPTIONS preflight with CORS headers and allowed POST method", async () => {
    const req = new Request(BASE_URL, {
      method: "OPTIONS",
      headers: {
        origin: "http://localhost",
        "Content-Type": "application/json",
      },
    });
    const res = OPTIONS(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://localhost",
    );
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });
});
