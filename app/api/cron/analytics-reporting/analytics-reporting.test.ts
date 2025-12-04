import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import {
  sharedRedisMockKeys,
  sharedRedisMockGet,
  sharedRedisMockRpush,
} from "../../__setup__.test";

const { POST } = await import("./route");

/**
 * Dummy cron secret to satisfy authorization for analytics cron tests.
 * @source
 */
const CRON_SECRET = "testsecret";

/**
 * Base URL used to build cron requests for analytics reporting.
 * @source
 */
const BASE_URL = "http://localhost/api/cron/analytics-reporting";

/**
 * Builds a cron request that includes the provided secret header.
 * @param secret - Cron secret to include in the request; pass null to omit header.
 * @returns Configured request targeting the analytics cron route.
 * @source
 */
function createCronRequest(secret: string | null = CRON_SECRET): Request {
  const headers: Record<string, string> = {};
  if (secret !== null) {
    headers["x-cron-secret"] = secret;
  }
  return new Request(BASE_URL, { headers });
}

/**
 * Asserts that the response matches the expected status and text body.
 * @param response - Response returned by the cron handler.
 * @param expectedStatus - Expected HTTP status code.
 * @param expectedText - Expected response text body.
 * @source
 */
async function expectErrorResponse(
  response: Response,
  expectedStatus: number,
  expectedText: string,
) {
  expect(response.status).toBe(expectedStatus);
  const text = await response.text();
  expect(text).toBe(expectedText);
}

/**
 * Asserts the response represents a successful analytics report and returns it.
 * @param response - Response object from the analytics cron handler.
 * @returns Parsed analytics report payload.
 * @source
 */
async function expectSuccessfulReport(response: Response) {
  expect(response.status).toBe(200);
  const report = await response.json();

  // Report should contain required properties
  expect(report).toHaveProperty("summary");
  expect(report).toHaveProperty("raw_data");
  expect(report).toHaveProperty("generatedAt");

  // Validate timestamp format (ISO 8601)
  expect(() => new Date(report.generatedAt)).not.toThrow();

  return report;
}

/**
 * Configures Redis mocks to simulate a successful analytics run.
 * @source
 */
function setupSuccessfulAnalyticsMocks() {
  // Simulate Redis returning analytics keys
  sharedRedisMockKeys.mockResolvedValueOnce([
    "analytics:visits",
    "analytics:anilist_api:successful_requests",
  ]);

  // Simulate Redis get responses for each key
  sharedRedisMockGet.mockImplementation((key: string) => {
    if (key === "analytics:visits") {
      return Promise.resolve("100");
    } else if (key === "analytics:anilist_api:successful_requests") {
      return Promise.resolve("200");
    }
    return Promise.resolve(null);
  });

  // Simulate rpush success
  sharedRedisMockRpush.mockResolvedValueOnce(1);
}

describe("Analytics & Reporting Cron API", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = CRON_SECRET;
  });

  afterEach(() => {
    mock.clearAllMocks();
    delete process.env.CRON_SECRET;
  });

  describe("Authorization", () => {
    it("should return 401 Unauthorized when cron secret header is invalid", async () => {
      const req = createCronRequest("wrongsecret");
      const res = await POST(req);
      await expectErrorResponse(res, 401, "Unauthorized");
    });

    it("should return 401 Unauthorized when cron secret header is missing", async () => {
      const req = createCronRequest(null);
      const res = await POST(req);
      await expectErrorResponse(res, 401, "Unauthorized");
    });

    it("should allow request when CRON_SECRET is not set and no secret is required", async () => {
      delete process.env.CRON_SECRET;
      setupSuccessfulAnalyticsMocks();

      const req = createCronRequest(null);
      const res = await POST(req);
      const report = await expectSuccessfulReport(res);

      expect(report).toBeDefined();
      expect(sharedRedisMockRpush).toHaveBeenCalled();
    });

    it("should allow request with correct cron secret", async () => {
      setupSuccessfulAnalyticsMocks();

      const req = createCronRequest(CRON_SECRET);
      const res = await POST(req);
      const report = await expectSuccessfulReport(res);

      expect(report).toBeDefined();
    });
  });

  describe("Analytics Data Collection", () => {
    it("should generate analytics report with simple metrics successfully", async () => {
      setupSuccessfulAnalyticsMocks();

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectSuccessfulReport(res);

      // Verify the summary structure
      expect(report.summary.visits).toBe(100);
      expect(report.summary.anilist_api).toEqual({
        successful_requests: 200,
      });

      // Verify raw_data contains the raw numbers
      expect(report.raw_data).toEqual({
        "analytics:visits": 100,
        "analytics:anilist_api:successful_requests": 200,
      });
    });

    it("should handle empty analytics data (no keys found)", async () => {
      sharedRedisMockKeys.mockResolvedValueOnce([]);
      sharedRedisMockRpush.mockResolvedValueOnce(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectSuccessfulReport(res);

      expect(report.summary).toEqual({});
      expect(report.raw_data).toEqual({});
      expect(sharedRedisMockRpush).toHaveBeenCalledWith(
        "analytics:reports",
        expect.any(String),
      );
    });

    it("should filter out analytics:reports key from data collection", async () => {
      sharedRedisMockKeys.mockResolvedValueOnce([
        "analytics:visits",
        "analytics:reports",
      ]);

      sharedRedisMockGet.mockImplementation((key: string) => {
        if (key === "analytics:visits") {
          return Promise.resolve("50");
        }
        return Promise.resolve(null);
      });

      sharedRedisMockRpush.mockResolvedValueOnce(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectSuccessfulReport(res);

      // analytics:reports should not be in the data
      expect(report.raw_data).toEqual({ "analytics:visits": 50 });
      expect(report.raw_data).not.toHaveProperty("analytics:reports");
    });

    it("should map null/missing redis values to zero", async () => {
      sharedRedisMockKeys.mockResolvedValueOnce(["analytics:missing_metric"]);
      sharedRedisMockGet.mockResolvedValueOnce(null);
      sharedRedisMockRpush.mockResolvedValueOnce(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectSuccessfulReport(res);

      expect(report.raw_data["analytics:missing_metric"]).toBe(0);
      expect(report.summary.missing_metric).toBe(0);
    });

    it("should handle multiple services with multiple metrics", async () => {
      sharedRedisMockKeys.mockResolvedValueOnce([
        "analytics:visits",
        "analytics:api:requests",
        "analytics:api:errors",
        "analytics:cache:hits",
        "analytics:cache:misses",
      ]);

      sharedRedisMockGet.mockImplementation((key: string) => {
        const responses: Record<string, string> = {
          "analytics:visits": "1000",
          "analytics:api:requests": "5000",
          "analytics:api:errors": "25",
          "analytics:cache:hits": "3000",
          "analytics:cache:misses": "1000",
        };
        return Promise.resolve(responses[key] ?? null);
      });

      sharedRedisMockRpush.mockResolvedValueOnce(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectSuccessfulReport(res);

      expect(report.summary).toEqual({
        visits: 1000,
        api: {
          requests: 5000,
          errors: 25,
        },
        cache: {
          hits: 3000,
          misses: 1000,
        },
      });
    });

    it("should handle metrics with multiple colons in the name", async () => {
      sharedRedisMockKeys.mockResolvedValueOnce([
        "analytics:service:metric1:metric2:metric3",
      ]);
      sharedRedisMockGet.mockResolvedValueOnce("42");
      sharedRedisMockRpush.mockResolvedValueOnce(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectSuccessfulReport(res);

      expect(report.summary.service).toEqual({
        "metric1:metric2:metric3": 42,
      });
    });

    it("should parse non-numeric string values using safeParse", async () => {
      sharedRedisMockKeys.mockResolvedValueOnce([
        "analytics:visits",
        "analytics:custom",
      ]);

      sharedRedisMockGet.mockImplementation((key: string) => {
        if (key === "analytics:visits") {
          return Promise.resolve("100");
        } else if (key === "analytics:custom") {
          // Simulate a JSON stringified value
          return Promise.resolve('{"count": 50}');
        }
        return Promise.resolve(null);
      });

      sharedRedisMockRpush.mockResolvedValueOnce(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectSuccessfulReport(res);

      expect(report.raw_data["analytics:visits"]).toBe(100);
      expect(report.raw_data["analytics:custom"]).toEqual({ count: 50 });
    });
  });

  describe("Redis Operations", () => {
    it("should save report to analytics:reports list", async () => {
      setupSuccessfulAnalyticsMocks();

      const req = createCronRequest();
      await POST(req);

      expect(sharedRedisMockRpush).toHaveBeenCalledWith(
        "analytics:reports",
        expect.any(String),
      );

      // Verify that the saved report is valid JSON
      const callArgs = sharedRedisMockRpush.mock.calls[0];
      expect(() => JSON.parse(callArgs[1])).not.toThrow();
    });

    it("should return 500 when redis keys retrieval fails", async () => {
      sharedRedisMockKeys.mockRejectedValueOnce(
        new Error("Redis connection failed"),
      );

      const req = createCronRequest();
      const res = await POST(req);
      await expectErrorResponse(res, 500, "Analytics and reporting job failed");
    });

    it("should return 500 when redis get fails during data fetch", async () => {
      sharedRedisMockKeys.mockResolvedValueOnce(["analytics:visits"]);
      sharedRedisMockGet.mockRejectedValueOnce(new Error("Redis get error"));

      const req = createCronRequest();
      const res = await POST(req);
      await expectErrorResponse(res, 500, "Analytics and reporting job failed");
    });

    it("should return 500 when redis rpush fails during report save", async () => {
      sharedRedisMockKeys.mockResolvedValueOnce(["analytics:visits"]);
      sharedRedisMockGet.mockResolvedValueOnce("100");
      sharedRedisMockRpush.mockRejectedValueOnce(
        new Error("Redis rpush error"),
      );

      const req = createCronRequest();
      const res = await POST(req);
      await expectErrorResponse(res, 500, "Analytics and reporting job failed");
    });
  });

  describe("Report Structure", () => {
    it("should include summary, raw_data, and generatedAt in report", async () => {
      setupSuccessfulAnalyticsMocks();

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectSuccessfulReport(res);

      expect(Object.keys(report).sort((a, b) => a.localeCompare(b))).toEqual([
        "generatedAt",
        "raw_data",
        "summary",
      ]);
    });

    it("should use ISO 8601 timestamp format for generatedAt", async () => {
      setupSuccessfulAnalyticsMocks();

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectSuccessfulReport(res);

      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
      expect(report.generatedAt).toMatch(isoRegex);
    });

    it("should have raw_data matching the collected analytics", async () => {
      sharedRedisMockKeys.mockResolvedValueOnce([
        "analytics:metric1",
        "analytics:metric2",
      ]);

      sharedRedisMockGet.mockImplementation((key: string) => {
        const responses: Record<string, string> = {
          "analytics:metric1": "10",
          "analytics:metric2": "20",
        };
        return Promise.resolve(responses[key] ?? null);
      });

      sharedRedisMockRpush.mockResolvedValueOnce(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectSuccessfulReport(res);

      expect(report.raw_data).toHaveProperty("analytics:metric1", 10);
      expect(report.raw_data).toHaveProperty("analytics:metric2", 20);
    });
  });

  describe("Error Handling & Edge Cases", () => {
    it("should handle concurrent metric fetch gracefully", async () => {
      sharedRedisMockKeys.mockResolvedValueOnce([
        "analytics:a",
        "analytics:b",
        "analytics:c",
      ]);

      sharedRedisMockGet.mockImplementation((key: string) => {
        const responses: Record<string, string> = {
          "analytics:a": "1",
          "analytics:b": "2",
          "analytics:c": "3",
        };
        return Promise.resolve(responses[key] ?? null);
      });

      sharedRedisMockRpush.mockResolvedValueOnce(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectSuccessfulReport(res);

      expect(Object.keys(report.raw_data).length).toBe(3);
      expect(sharedRedisMockGet).toHaveBeenCalledTimes(3);
    });

    it("should handle zero values correctly", async () => {
      sharedRedisMockKeys.mockResolvedValueOnce(["analytics:zero_metric"]);
      sharedRedisMockGet.mockResolvedValueOnce("0");
      sharedRedisMockRpush.mockResolvedValueOnce(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectSuccessfulReport(res);

      expect(report.raw_data["analytics:zero_metric"]).toBe(0);
      expect(report.summary.zero_metric).toBe(0);
    });

    it("should handle large numeric values correctly", async () => {
      sharedRedisMockKeys.mockResolvedValueOnce(["analytics:large_number"]);
      sharedRedisMockGet.mockResolvedValueOnce("999999999999");
      sharedRedisMockRpush.mockResolvedValueOnce(1);

      const req = createCronRequest();
      const res = await POST(req);
      const report = await expectSuccessfulReport(res);

      expect(report.raw_data["analytics:large_number"]).toBe(999999999999);
    });

    it("should return 500 with error message on unexpected error", async () => {
      sharedRedisMockKeys.mockImplementationOnce(() => {
        throw new Error("Unexpected error");
      });

      const req = createCronRequest();
      const res = await POST(req);
      await expectErrorResponse(res, 500, "Analytics and reporting job failed");
    });
  });
});
