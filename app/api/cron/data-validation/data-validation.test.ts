import { POST } from "./route";

/**
 * Mocked keys command used across the validation cron tests.
 * @source
 */
const mockKeys = jest.fn();
/**
 * Mocked get command used to simulate Redis values.
 * @source
 */
const mockGet = jest.fn();
/**
 * Mocked lrange command for fetching analytics report lists.
 * @source
 */
const mockLrange = jest.fn();
/**
 * Mocked rpush command for storing validation reports.
 * @source
 */
const mockRpush = jest.fn();

/**
 * Fake Redis client exposing the mocked methods.
 * @source
 */
const fakeRedisClient = {
  keys: mockKeys,
  get: mockGet,
  lrange: mockLrange,
  rpush: mockRpush,
};

jest.mock("@upstash/redis", () => ({
  Redis: {
    fromEnv: jest.fn(() => fakeRedisClient),
  },
}));

/**
 * Dummy cron secret for bypassing authorization in validation tests.
 * @source
 */
const CRON_SECRET = "testsecret";
process.env.CRON_SECRET = CRON_SECRET;

/**
 * Base URL used when constructing data validation cron requests.
 * @source
 */
const BASE_URL = "http://localhost/api/cron/data-validation";

/**
 * Builds a cron POST request that includes the cron secret header.
 * @param secret - Secret header value to include.
 * @returns Configured Request object for the data validation endpoint.
 * @source
 */
function createCronRequest(secret: string = CRON_SECRET): Request {
  return new Request(BASE_URL, {
    headers: { "x-cron-secret": secret },
  });
}

/**
 * Configures Redis mocks to simulate a healthy validation run.
 * @source
 */
function setupSuccessfulRedisMocks() {
  mockKeys.mockImplementation((pattern: string) => {
    switch (pattern) {
      case "user:*":
        return Promise.resolve(["user:1"]);
      case "cards:*":
        return Promise.resolve(["cards:1"]);
      case "username:*":
        return Promise.resolve(["username:1"]);
      case "analytics:*":
        return Promise.resolve(["analytics:dummy", "analytics:reports"]);
      default:
        return Promise.resolve([]);
    }
  });

  mockGet.mockImplementation((key: string) => {
    if (key === "user:1") {
      return Promise.resolve(JSON.stringify(validUserRecord));
    } else if (key === "cards:1") {
      return Promise.resolve(JSON.stringify(validCardsRecord));
    } else if (key === "username:1") {
      return Promise.resolve("123");
    } else if (key === "analytics:dummy") {
      return Promise.resolve("456");
    }
    return Promise.resolve(null);
  });

  mockLrange.mockImplementation((key: string) => {
    if (key === "analytics:reports") {
      return Promise.resolve([JSON.stringify(validReport)]);
    }
    return Promise.resolve([]);
  });

  mockRpush.mockResolvedValue(1);
}

/**
 * Asserts the response contains a valid validation report and returns it.
 * @param response - HTTP response returned by the cron endpoint.
 * @returns Parsed validation report JSON.
 * @source
 */
async function expectValidationReport(response: Response) {
  expect(response.status).toBe(200);

  const report = await response.json();
  expect(report).toHaveProperty("summary");
  expect(report).toHaveProperty("details");
  expect(report).toHaveProperty("issues");
  expect(report).toHaveProperty("generatedAt");

  return report;
}

/**
 * Asserts that the response matches the expected status code and body.
 * @param response - HTTP response from the cron handler.
 * @param status - Expected HTTP status.
 * @param message - Expected response text.
 * @source
 */
async function expectErrorResponse(
  response: Response,
  status: number,
  message: string,
) {
  expect(response.status).toBe(status);
  const text = await response.text();
  expect(text).toBe(message);
}

/**
 * Representative user record used in successful validation scenarios.
 * @source
 */
const validUserRecord = {
  userId: 1,
  username: "testuser",
  ip: "127.0.0.1",
  createdAt: "2021-01-01T00:00:00Z",
  updatedAt: "2021-01-02T00:00:00Z",
  stats: {},
};

/**
 * Representative cards record used in successful validation scenarios.
 * @source
 */
const validCardsRecord = {
  userId: 1,
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
  updatedAt: "2021-01-02T00:00:00Z",
};

/**
 * Representative analytics report used in successful validation scenarios.
 * @source
 */
const validReport = {
  generatedAt: "2021-01-01T00:00:00Z",
  raw_data: { "analytics:visits": 100 },
  summary: { visits: 100 },
};

describe("Data Validation Cron API POST Endpoint", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return 401 Unauthorized when the cron secret is missing or invalid", async () => {
    const req = createCronRequest("wrongsecret");
    const res = await POST(req);
    await expectErrorResponse(res, 401, "Unauthorized");
  });

  it("should generate a data validation report successfully with no issues", async () => {
    setupSuccessfulRedisMocks();

    const req = createCronRequest();
    const res = await POST(req);

    const report = await expectValidationReport(res);

    // Verify no issues occurred
    expect(report.issues.length).toBe(0);

    // Check details for each pattern
    expect(report.details["user:*"]).toEqual({
      checked: 1,
      inconsistencies: 0,
    });
    expect(report.details["cards:*"]).toEqual({
      checked: 1,
      inconsistencies: 0,
    });
    expect(report.details["username:*"]).toEqual({
      checked: 1,
      inconsistencies: 0,
    });
    expect(report.details["analytics:*"]).toEqual({
      checked: 2,
      inconsistencies: 0,
    });

    // Verify that the report was saved to the Redis list
    expect(mockRpush).toHaveBeenCalledWith(
      "data_validation:reports",
      expect.any(String),
    );
  });

  it("should return 500 and an error message if redis keys retrieval fails", async () => {
    // Simulate a failure when fetching keys
    mockKeys.mockRejectedValueOnce(new Error("Redis keys error"));

    const req = createCronRequest();
    const res = await POST(req);

    await expectErrorResponse(res, 500, "Data validation check failed");
  });
});
