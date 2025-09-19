import { POST } from "./route";

// Set up mocks for @upstash/redis.
const mockKeys = jest.fn();
const mockGet = jest.fn();
const mockRpush = jest.fn();
const fakeRedisClient = {
  keys: mockKeys,
  get: mockGet,
  rpush: mockRpush,
};

jest.mock("@upstash/redis", () => ({
  Redis: {
    fromEnv: jest.fn(() => fakeRedisClient),
  },
}));

// Set a dummy CRON_SECRET for testing.
const CRON_SECRET = "testsecret";
process.env.CRON_SECRET = CRON_SECRET;

// Helper functions to reduce code duplication
const BASE_URL = "http://localhost/api/cron/analytics-reporting";

// Helper to create request with cron secret
function createCronRequest(secret = CRON_SECRET): Request {
  return new Request(BASE_URL, {
    headers: { "x-cron-secret": secret },
  });
}

// Helper to validate error response
async function expectErrorResponse(
  response: Response,
  expectedStatus: number,
  expectedText: string,
) {
  expect(response.status).toBe(expectedStatus);
  const text = await response.text();
  expect(text).toBe(expectedText);
}

// Helper to validate successful analytics report
async function expectSuccessfulReport(response: Response) {
  expect(response.status).toBe(200);
  const report = await response.json();

  // Report should contain required properties
  expect(report).toHaveProperty("summary");
  expect(report).toHaveProperty("raw_data");
  expect(report).toHaveProperty("generatedAt");

  return report;
}

// Helper to setup successful analytics mocks
function setupSuccessfulAnalyticsMocks() {
  // Simulate Redis returning analytics keys
  mockKeys.mockResolvedValueOnce([
    "analytics:visits",
    "analytics:anilist_api:successful_requests",
  ]);

  // Simulate Redis get responses for each key
  mockGet.mockImplementation((key: string) => {
    if (key === "analytics:visits") {
      return Promise.resolve("100");
    } else if (key === "analytics:anilist_api:successful_requests") {
      return Promise.resolve("200");
    }
    return Promise.resolve(null);
  });

  // Simulate rpush success
  mockRpush.mockResolvedValueOnce(1);
}

describe("Analytics & Reporting Cron API POST Endpoint", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return 401 Unauthorized when cron secret is missing or invalid", async () => {
    const req = createCronRequest("wrongsecret");
    const res = await POST(req);
    await expectErrorResponse(res, 401, "Unauthorized");
  });

  it("should generate analytics report successfully", async () => {
    setupSuccessfulAnalyticsMocks();

    const req = createCronRequest();
    const res = await POST(req);
    const report = await expectSuccessfulReport(res);

    // Verify the summary.
    // "analytics:visits" is split into ["analytics", "visits"] so summary.visits should be 100.
    expect(report.summary.visits).toBe(100);
    // "analytics:anilist_api:successful_requests" splits into ["analytics", "anilist_api", "successful_requests"].
    expect(report.summary.anilist_api).toEqual({ successful_requests: 200 });

    // raw_data should contain the raw numbers.
    expect(report.raw_data).toEqual({
      "analytics:visits": 100,
      "analytics:anilist_api:successful_requests": 200,
    });

    // Verify that rpush was called with the "analytics:reports" key.
    expect(mockRpush).toHaveBeenCalledWith(
      "analytics:reports",
      expect.any(String),
    );
  });

  it("should return 500 and an error message if redis keys retrieval fails", async () => {
    // Simulate failure when fetching keys.
    mockKeys.mockRejectedValueOnce(new Error("Redis error"));

    const req = createCronRequest();
    const res = await POST(req);
    await expectErrorResponse(res, 500, "Analytics and reporting job failed");
  });
});
