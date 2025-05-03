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
    const req = new Request("http://localhost/api/cron/data-validation", {
      headers: { "x-cron-secret": "wrongsecret" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const text = await res.text();
    expect(text).toBe("Unauthorized");
  });

  it("should generate a data validation report successfully with no issues", async () => {
    // For each pattern we return predetermined keys.
    mockKeys.mockImplementation((pattern: string) => {
      switch (pattern) {
        case "user:*":
          return Promise.resolve(["user:1"]);
        case "cards:*":
          return Promise.resolve(["cards:1"]);
        case "username:*":
          return Promise.resolve(["username:1"]);
        case "analytics:*":
          // Return one non-report key and one list key.
          return Promise.resolve(["analytics:dummy", "analytics:reports"]);
        default:
          return Promise.resolve([]);
      }
    });

    // For non-list keys, return valid JSON strings:
    mockGet.mockImplementation((key: string) => {
      if (key === "user:1") {
        return Promise.resolve(JSON.stringify(validUserRecord));
      } else if (key === "cards:1") {
        return Promise.resolve(JSON.stringify(validCardsRecord));
      } else if (key === "username:1") {
        // Valid username record: expected to be a number.
        return Promise.resolve("123");
      } else if (key === "analytics:dummy") {
        // Return a number as string so that safeParse returns number.
        return Promise.resolve("456");
      }
      return Promise.resolve(null);
    });

    // For the list key "analytics:reports", return one valid report.
    mockLrange.mockImplementation((key: string) => {
      if (key === "analytics:reports") {
        return Promise.resolve([JSON.stringify(validReport)]);
      }
      return Promise.resolve([]);
    });

    // Simulate successful report saving.
    mockRpush.mockResolvedValue(1);

    const req = new Request("http://localhost/api/cron/data-validation", {
      headers: { "x-cron-secret": CRON_SECRET },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    // The response will be a JSON report containing summary, details, issues, and generatedAt.
    const report = await res.json();

    // Check that summary text exists.
    expect(report).toHaveProperty("summary");
    expect(report).toHaveProperty("details");
    expect(report).toHaveProperty("issues");
    expect(report).toHaveProperty("generatedAt");

    // Verify no issues occurred.
    expect(report.issues.length).toBe(0);

    // Check details for each pattern.
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
    // For "analytics:*", two keys are processed:
    // - "analytics:dummy" (value 456, which is valid)
    // - "analytics:reports" (with one valid report)
    // The total "checked" will be 1 (for dummy) + list reports count.
    expect(report.details["analytics:*"]).toEqual({
      checked: 2,
      inconsistencies: 0,
    });

    // Verify that the report was saved to the Redis list.
    expect(mockRpush).toHaveBeenCalledWith(
      "data_validation:reports",
      expect.any(String),
    );
  });

  it("should return 500 and an error message if redis keys retrieval fails", async () => {
    // Simulate a failure when fetching keys.
    mockKeys.mockRejectedValueOnce(new Error("Redis keys error"));
    const req = new Request("http://localhost/api/cron/data-validation", {
      headers: { "x-cron-secret": CRON_SECRET },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).toBe("Data validation check failed");
  });
});
