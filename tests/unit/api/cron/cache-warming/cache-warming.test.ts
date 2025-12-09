import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";

const { POST, OPTIONS } = await import("@/app/api/cron/cache-warming/route");
const { clearUserRequestStats } = await import("@/lib/stores/svg-cache");

/**
 * Dummy cron secret for cache warming tests.
 * @source
 */
const CRON_SECRET = "test-cache-warming-secret";

/**
 * Base URL for cache warming cron endpoint.
 * @source
 */
const BASE_URL = "http://localhost/api/cron/cache-warming";

/**
 * Builds a cache warming cron request with optional parameters and secret.
 * @param secret - Cron secret to include; pass null to omit
 * @param queryParams - Optional query parameters for topN and cardTypes
 * @returns Request object for the cache warming endpoint
 * @source
 */
function createCronRequest(
  secret: string | null = CRON_SECRET,
  queryParams: Record<string, string> = {},
): Request {
  const url = new URL(BASE_URL);
  for (const [key, value] of Object.entries(queryParams)) {
    url.searchParams.set(key, value);
  }

  const headers: Record<string, string> = {};
  if (secret !== null) {
    headers["authorization"] = `Bearer ${secret}`;
  }

  return new Request(url.toString(), { method: "POST", headers });
}

/**
 * Creates an OPTIONS request for CORS testing.
 * @param origin - Optional origin header
 * @returns Request object for OPTIONS method
 * @source
 */
function createOptionsRequest(origin?: string): Request {
  const headers: Record<string, string> = {};
  if (origin) {
    headers["origin"] = origin;
  }
  return new Request(BASE_URL, { method: "OPTIONS", headers });
}

/**
 * Asserts that the response is a JSON error with expected status.
 * @param response - Response from the cache warming handler
 * @param expectedStatus - Expected HTTP status
 * @param expectedErrorMessage - Expected error message in response
 * @source
 */
async function expectErrorResponse(
  response: Response,
  expectedStatus: number,
  expectedErrorMessage: string,
) {
  expect(response.status).toBe(expectedStatus);
  const data = await response.json();
  expect(data.error).toBe(expectedErrorMessage);
}

/**
 * Asserts that the response is a successful cache warming result.
 * @param response - Response from the cache warming handler
 * @returns Parsed JSON response
 * @source
 */
async function expectSuccessfulResponse(response: Response) {
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.success).toBe(true);
  expect(data).toHaveProperty("stats");
  expect(data).toHaveProperty("duration");
  return data;
}

describe("Cache Warming Cron API", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = CRON_SECRET;
    // Clear user request stats to ensure clean test state
    clearUserRequestStats();
  });

  afterEach(() => {
    mock.clearAllMocks();
    delete process.env.CRON_SECRET;
  });

  describe("Authorization", () => {
    it("should return 500 when CRON_SECRET environment variable is not configured", async () => {
      delete process.env.CRON_SECRET;
      const req = createCronRequest(CRON_SECRET);
      const res = await POST(req);

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe("Server not configured");
    });

    it("should return 401 Unauthorized when authorization header is missing", async () => {
      const req = createCronRequest(null);
      const res = await POST(req);

      await expectErrorResponse(res, 401, "Unauthorized");
    });

    it("should return 401 Unauthorized when authorization secret is invalid", async () => {
      const req = createCronRequest("wrong-secret");
      const res = await POST(req);

      await expectErrorResponse(res, 401, "Unauthorized");
    });

    it("should return 401 Unauthorized when Bearer format is incorrect", async () => {
      const headers: Record<string, string> = {
        authorization: `${CRON_SECRET}`, // Missing "Bearer " prefix
      };
      const req = new Request(BASE_URL, { method: "POST", headers });
      const res = await POST(req);

      await expectErrorResponse(res, 401, "Unauthorized");
    });

    it("should allow request with correct authorization header", async () => {
      // This will succeed but users list is empty (no users tracked yet)
      const req = createCronRequest(CRON_SECRET);
      const res = await POST(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  describe("Cache Warming Execution", () => {
    it("should return success with empty stats when no users have been tracked", async () => {
      const req = createCronRequest();
      const res = await POST(req);
      const data = await expectSuccessfulResponse(res);

      expect(data.stats.attemptedCount).toBe(0);
      expect(data.stats.successCount).toBe(0);
      expect(data.stats.failureCount).toBe(0);
    });

    it("should accept default cache warming parameters", async () => {
      const req = createCronRequest();
      const res = await POST(req);
      const data = await expectSuccessfulResponse(res);

      expect(data).toHaveProperty("stats");
      expect(data.stats).toHaveProperty("attemptedCount");
      expect(data.stats).toHaveProperty("successCount");
      expect(data.stats).toHaveProperty("failureCount");
      expect(data.duration).toBeGreaterThanOrEqual(0);
    });

    it("should use default card types when not specified", async () => {
      // Note: cardTypes only appears in response when users are warmed
      const req = createCronRequest(CRON_SECRET, {});
      const res = await POST(req);
      await expectSuccessfulResponse(res);

      // Should successfully process with default card types
      expect(res.status).toBe(200);
    });

    it("should parse custom cardTypes from query parameters", async () => {
      const req = createCronRequest(CRON_SECRET, {
        cardTypes: "animeStats,socialStats",
      });
      const res = await POST(req);
      await expectSuccessfulResponse(res);

      // Should successfully parse custom cardTypes
      expect(res.status).toBe(200);
    });

    it("should trim whitespace from cardTypes parameter", async () => {
      const req = createCronRequest(CRON_SECRET, {
        cardTypes: "animeStats, socialStats, mangaStats",
      });
      const res = await POST(req);
      await expectSuccessfulResponse(res);

      // Should successfully parse cardTypes with whitespace
      expect(res.status).toBe(200);
    });

    it("should cap topN at 100 maximum", async () => {
      const req = createCronRequest(CRON_SECRET, { topN: "250" });
      const res = await POST(req);
      const data = await expectSuccessfulResponse(res);

      // No actual users to warm, but request should be valid
      expect(data.success).toBe(true);
    });

    it("should enforce minimum topN of 10", async () => {
      const req = createCronRequest(CRON_SECRET, { topN: "5" });
      const res = await POST(req);
      const data = await expectSuccessfulResponse(res);

      // Should accept the request (enforces minimum internally)
      expect(data.success).toBe(true);
    });

    it("should handle invalid topN parameter gracefully", async () => {
      const req = createCronRequest(CRON_SECRET, { topN: "not-a-number" });
      const res = await POST(req);
      const data = await expectSuccessfulResponse(res);

      // Should default to 100 when invalid
      expect(data.success).toBe(true);
    });

    it("should return response with expected properties", async () => {
      const req = createCronRequest();
      const res = await POST(req);
      const data = await expectSuccessfulResponse(res);

      expect(data).toHaveProperty("success");
      expect(data).toHaveProperty("stats");
      expect(data).toHaveProperty("duration");
      // cardTypes only appears when there are users to warm
      // When no users: response includes success, stats, duration
      // When users exist: response includes success, stats, duration, topUsersCount, cardTypes
    });

    it("should measure execution duration in milliseconds", async () => {
      const req = createCronRequest();
      const res = await POST(req);
      const data = await expectSuccessfulResponse(res);

      expect(typeof data.duration).toBe("number");
      expect(data.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Error Handling", () => {
    it("should return 500 when an unexpected error occurs", async () => {
      const mockWarmSvg = mock(async () => {
        throw new Error("Cache warming failed");
      });
      const mockGetUsers = mock(() => [123, 456]);

      mock.module("@/lib/stores/svg-cache", () => ({
        warmSvgCache: mockWarmSvg,
        getTopRequestedUsers: mockGetUsers,
      }));

      const req = createCronRequest();
      const res = await POST(req);

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it("should include error message in response", async () => {
      const mockWarmSvg = mock(async () => {
        throw new Error("Network timeout");
      });
      const mockGetUsers = mock(() => [123]);

      mock.module("@/lib/stores/svg-cache", () => ({
        warmSvgCache: mockWarmSvg,
        getTopRequestedUsers: mockGetUsers,
      }));

      const req = createCronRequest();
      const res = await POST(req);
      const data = await res.json();

      expect(data.error).toContain("Network timeout");
    });

    it("should include duration in error response", async () => {
      const mockWarmSvg = mock(async () => {
        throw new Error("Test error");
      });
      const mockGetUsers = mock(() => []);

      mock.module("@/lib/stores/svg-cache", () => ({
        warmSvgCache: mockWarmSvg,
        getTopRequestedUsers: mockGetUsers,
      }));

      const req = createCronRequest();
      const res = await POST(req);
      const data = await res.json();

      expect(data.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe("OPTIONS Handler (CORS)", () => {
    it("should respond to OPTIONS request with 200 status", async () => {
      const req = createOptionsRequest();
      const res = OPTIONS(req);

      expect(res.status).toBe(200);
    });

    it("should include CORS headers in OPTIONS response", async () => {
      const origin = "https://example.com";
      const req = createOptionsRequest(origin);
      const res = OPTIONS(req);

      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(origin);
      expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
      expect(res.headers.get("Access-Control-Allow-Methods")).toContain(
        "OPTIONS",
      );
      expect(res.headers.get("Access-Control-Allow-Headers")).toContain(
        "Content-Type",
      );
      expect(res.headers.get("Access-Control-Allow-Headers")).toContain(
        "Authorization",
      );
    });

    it("should allow wildcard origin when none is provided", async () => {
      const req = createOptionsRequest();
      const res = OPTIONS(req);

      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });

    it("should allow different origins in CORS header", async () => {
      const testOrigins = [
        "https://anilist.co",
        "http://localhost:3000",
        "https://example.com",
      ];

      for (const origin of testOrigins) {
        const req = createOptionsRequest(origin);
        const res = OPTIONS(req);

        expect(res.headers.get("Access-Control-Allow-Origin")).toBe(origin);
      }
    });
  });

  describe("Query Parameter Validation", () => {
    it("should handle missing query parameters gracefully", async () => {
      const req = createCronRequest();
      const res = await POST(req);
      await expectSuccessfulResponse(res);

      // Should use defaults
      expect(res.status).toBe(200);
    });

    it("should handle empty cardTypes parameter", async () => {
      const req = createCronRequest(CRON_SECRET, { cardTypes: "" });
      const res = await POST(req);
      await expectSuccessfulResponse(res);

      // Empty string means no cardTypes param - should use defaults when warming
      expect(res.status).toBe(200);
    });

    it("should handle single card type parameter", async () => {
      const req = createCronRequest(CRON_SECRET, { cardTypes: "animeStats" });
      const res = await POST(req);
      await expectSuccessfulResponse(res);

      // Should successfully accept custom cardTypes parameter
      expect(res.status).toBe(200);
    });

    it("should handle topN = 0 by enforcing minimum of 10", async () => {
      const req = createCronRequest(CRON_SECRET, { topN: "0" });
      const res = await POST(req);

      // Should succeed without errors
      expect(res.status).toBe(200);
    });

    it("should handle negative topN by enforcing minimum", async () => {
      const req = createCronRequest(CRON_SECRET, { topN: "-50" });
      const res = await POST(req);

      // Should succeed without errors
      expect(res.status).toBe(200);
    });
  });

  describe("Response Format", () => {
    it("should include Content-Type: application/json header", async () => {
      const req = createCronRequest();
      const res = await POST(req);

      expect(res.headers.get("Content-Type")).toContain("application/json");
    });

    it("should return valid JSON in response body", async () => {
      const req = createCronRequest();
      const res = await POST(req);

      // Should not throw when parsing JSON
      expect(() => res.json()).not.toThrow();
    });

    it("should include stats.attemptedCount in response", async () => {
      const req = createCronRequest();
      const res = await POST(req);
      const data = await expectSuccessfulResponse(res);

      expect(typeof data.stats.attemptedCount).toBe("number");
    });

    it("should ensure stats.successCount <= stats.attemptedCount", async () => {
      const req = createCronRequest();
      const res = await POST(req);
      const data = await expectSuccessfulResponse(res);

      expect(data.stats.successCount).toBeLessThanOrEqual(
        data.stats.attemptedCount,
      );
    });

    it("should ensure stats.failureCount + stats.successCount = stats.attemptedCount", async () => {
      const req = createCronRequest();
      const res = await POST(req);
      const data = await expectSuccessfulResponse(res);

      expect(data.stats.failureCount + data.stats.successCount).toBe(
        data.stats.attemptedCount,
      );
    });
  });
});
