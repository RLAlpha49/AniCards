import { POST } from "./route";

// -- Setup fake Redis client --
const mockKeys = jest.fn();
const mockGet = jest.fn();
const mockLrange = jest.fn();
const mockRpush = jest.fn();

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

// Set a dummy CRON_SECRET for testing.
const CRON_SECRET = "testsecret";
process.env.CRON_SECRET = CRON_SECRET;

// Helper functions to reduce code duplication
const BASE_URL = "http://localhost/api/cron/data-validation";

// Helper to create request with cron secret
function createCronRequest(secret: string = CRON_SECRET): Request {
  return new Request(BASE_URL, {
    headers: { "x-cron-secret": secret },
  });
}

// Helper to setup Redis mocks for successful validation
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

// Helper to validate successful response with report structure
async function expectValidationReport(response: Response) {
  expect(response.status).toBe(200);

  const report = await response.json();
  expect(report).toHaveProperty("summary");
  expect(report).toHaveProperty("details");
  expect(report).toHaveProperty("issues");
  expect(report).toHaveProperty("generatedAt");

  return report;
}

// Helper to expect error response
async function expectErrorResponse(
  response: Response,
  status: number,
  message: string,
) {
  expect(response.status).toBe(status);
  const text = await response.text();
  expect(text).toBe(message);
}

// -- Valid records for testing --
const validUserRecord = {
  userId: 1,
  username: "testuser",
  ip: "127.0.0.1",
  createdAt: "2021-01-01T00:00:00Z",
  updatedAt: "2021-01-02T00:00:00Z",
  stats: {},
};

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
