import { GET } from "./route";

/** Mocked Redis get function used by tests to simulate varied responses. @source */
let mockRedisGet = jest.fn();

/**
 * Creates a named redis client mock using the local get mock to avoid nesting.
 */
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
 * Extracts the response JSON payload for assertions.
 * @param response - Response to parse.
 * @returns Parsed JSON from the response body.
 * @source
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getResponseJson(response: Response): Promise<any> {
  return response.json();
}

const API_BASE = "http://localhost/api/user";
const DEFAULT_HEADERS = { "x-forwarded-for": "127.0.0.1" };

function createReq(query?: string): Request {
  const url = query?.length ? `${API_BASE}?${query}` : API_BASE;
  return new Request(url, {
    headers: DEFAULT_HEADERS as Record<string, string>,
  });
}

async function callGet(query?: string): Promise<Response> {
  return GET(createReq(query));
}

async function expectError(
  query: string | undefined,
  status: number,
  errorMsg: string,
) {
  const res = await callGet(query);
  expect(res.status).toBe(status);
  const json = await getResponseJson(res);
  expect(json?.error).toBe(errorMsg);
}

async function expectOkJson(query: string | undefined, expected: unknown) {
  const res = await callGet(query);
  expect(res.status).toBe(200);
  const json = await getResponseJson(res);
  expect(json).toEqual(expected);
}

function mockRedisSequence(...values: Array<unknown>) {
  for (const v of values) {
    if (v instanceof Error) {
      mockRedisGet.mockRejectedValueOnce(v);
    } else {
      mockRedisGet.mockResolvedValueOnce(v);
    }
  }
}

describe("User API GET Endpoint", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return 400 error for missing userId parameter", async () => {
    // Call the API without the required 'userId' query parameter and expect an error
    await expectError(undefined, 400, "Missing userId or username parameter");
  });

  it("should return 400 error for invalid userId format", async () => {
    // A non‑numeric userId should trigger an error.
    await expectError("userId=abc", 400, "Invalid userId parameter");
  });

  it("should return 404 error if user data is not found", async () => {
    // Simulate Redis returning no data for the given key.
    mockRedisSequence(null);
    await expectError("userId=123", 404, "User not found");
  });

  it("should return 200 and the user data when found", async () => {
    // Simulate valid user data stored in Redis.
    const userData = {
      userId: 123,
      username: "testUser",
      stats: { score: 10 },
    };
    mockRedisSequence(JSON.stringify(userData));
    await expectOkJson("userId=123", userData);
  });

  it("should return 400 for invalid username parameter", async () => {
    await expectError(
      "username=***invalid***",
      400,
      "Invalid username parameter",
    );
  });

  it("should return 404 when username is valid but user not found", async () => {
    // Simulate no index record for the username
    mockRedisSequence(null);
    await expectError("username=unknownuser", 404, "User not found");
  });

  it("should return 200 and the user data when username maps to an existing user", async () => {
    // Simulate mapping from username index to userId and existing user record
    const userData = {
      userId: 123,
      username: "testUser",
      stats: { score: 10 },
    };
    mockRedisSequence("123", JSON.stringify(userData));
    await expectOkJson("username=testUser", userData);
  });

  it("should return 500 error if an error occurs during Redis fetch", async () => {
    // Simulate an error when fetching data from Redis.
    mockRedisSequence(new Error("Redis error"));
    await expectError("userId=123", 500, "Failed to fetch user data");
  });
});
