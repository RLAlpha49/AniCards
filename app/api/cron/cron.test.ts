import { afterEach, describe, expect, it, mock } from "bun:test";
import {
  sharedRedisMockKeys,
  sharedRedisMockGet,
  sharedRedisMockSet,
  sharedRedisMockDel,
} from "../__setup__.test";

const { POST } = await import("./route");

/**
 * Helper to create a mock user record
 */
function createMockUserRecord(userId: string, daysOld: number = 0) {
  const date = new Date();
  date.setDate(date.getDate() - daysOld);
  return {
    userId,
    username: `user${userId}`,
    stats: { dummy: Number(userId) },
    updatedAt: date.toISOString(),
  };
}

/**
 * Async function that returns successful stats
 */
async function jsonSuccessResponse() {
  return { data: { stats: "mocked" } };
}

/**
 * Async function that returns 404 error
 */
async function json404Response() {
  return { error: "User not found" };
}

/**
 * Async function that returns 500 error
 */
async function json500Response() {
  return { error: "Internal Server Error" };
}

/**
 * Creates a successful fetch response
 */
function createSuccessResponse() {
  return {
    ok: true,
    status: 200,
    json: jsonSuccessResponse,
  };
}

/**
 * Creates a 404 fetch response
 */
function create404Response() {
  return {
    ok: false,
    status: 404,
    json: json404Response,
  };
}

/**
 * Creates a 500 fetch response
 */
function create500Response() {
  return {
    ok: false,
    status: 500,
    json: json500Response,
  };
}

/**
 * Helper to setup mock fetch for successful response
 */
function setupSuccessfulFetch() {
  return toFetchMock(mock().mockResolvedValue(createSuccessResponse()));
}

/**
 * Helper to setup mock fetch for 404 response
 */
function setup404Fetch() {
  return toFetchMock(mock().mockResolvedValue(create404Response()));
}

/**
 * Helper to setup mock fetch for 500 response
 */
function setup500Fetch() {
  return toFetchMock(mock().mockResolvedValue(create500Response()));
}

/**
 * Creates a fetch implementation that retries on error
 */
function createRetryFetchImplementation(successAfterAttempt: number) {
  let callCount = 0;
  return async () => {
    callCount += 1;
    if (callCount < successAfterAttempt) {
      throw new Error("Network error");
    }
    return createSuccessResponse();
  };
}

/**
 * Helper to setup mock fetch with retry logic
 */
function setupRetryFetch(successAfterAttempt: number) {
  return toFetchMock(
    mock().mockImplementation(
      createRetryFetchImplementation(successAfterAttempt),
    ),
  );
}

/**
 * Helper to setup persistent network error
 */
function setupNetworkErrorFetch() {
  return toFetchMock(mock().mockRejectedValue(new Error("Network error")));
}

/**
 * Creates a fetch implementation with mixed outcomes
 */
function createMixedOutcomesFetchImplementation(failureUserIds: string[]) {
  return async (url: RequestInfo, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(init.body as string) : {};
    const userID = String(body.variables?.userId || "");
    if (failureUserIds.includes(userID)) {
      return create404Response();
    }
    return createSuccessResponse();
  };
}

function toFetchMock(mockFn: ReturnType<typeof mock>) {
  const fetchMock = mockFn as unknown as typeof fetch;
  fetchMock.preconnect = mock() as (typeof fetch)["preconnect"];
  return fetchMock;
}

/**
 * Dummy cron secret used to satisfy authorization checks in tests.
 * @source
 */
const CRON_SECRET = "testsecret";
process.env.CRON_SECRET = CRON_SECRET;

describe("Cron API POST Endpoint", () => {
  afterEach(() => {
    mock.clearAllMocks();
    delete process.env.CRON_SECRET;
    process.env.CRON_SECRET = CRON_SECRET;
  });

  describe("Authorization", () => {
    it("should return 401 Unauthorized when the secret is invalid", async () => {
      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": "wrongsecret" },
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
      const text = await res.text();
      expect(text).toBe("Unauthorized");
    });

    it("should return 401 Unauthorized when the secret header is missing", async () => {
      const req = new Request("http://localhost/api/cron", {
        headers: {},
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
      const text = await res.text();
      expect(text).toBe("Unauthorized");
    });

    it("should skip authorization check when CRON_SECRET env is not set", async () => {
      delete process.env.CRON_SECRET;
      sharedRedisMockKeys.mockResolvedValueOnce([]);

      const req = new Request("http://localhost/api/cron", {
        headers: {},
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
    });
  });

  describe("CORS and Response Headers", () => {
    it("should set CORS Access-Control-Allow-Origin to the request origin", async () => {
      const prev = process.env.NEXT_PUBLIC_APP_URL;
      delete process.env.NEXT_PUBLIC_APP_URL;
      try {
        sharedRedisMockKeys.mockResolvedValueOnce([]);
        const headers = new Headers();
        headers.set("x-cron-secret", CRON_SECRET);
        headers.set("origin", "http://example.dev");
        const req = new Request("http://localhost/api/cron", {
          method: "POST",
          headers,
        });
        const res = await POST(req);
        expect(res.status).toBe(200);
        expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
          "http://example.dev",
        );
      } finally {
        if (prev !== undefined) {
          process.env.NEXT_PUBLIC_APP_URL = prev;
        }
      }
    });

    it("should set Content-Type to text/plain in response", async () => {
      sharedRedisMockKeys.mockResolvedValueOnce([]);
      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.headers.get("Content-Type")).toBe("text/plain");
    });
  });

  describe("User Processing", () => {
    it("should process with zero users if no keys are found", async () => {
      sharedRedisMockKeys.mockResolvedValueOnce([]);
      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toBe(
        "Updated 0/0 users successfully. Failed: 0, Removed: 0",
      );
      expect(sharedRedisMockKeys).toHaveBeenCalledWith("user:*");
    });

    it("should successfully update all users when all are valid and AniList responds with 200", async () => {
      const userKeys = ["user:1", "user:2", "user:3", "user:4", "user:5"];
      sharedRedisMockKeys.mockResolvedValueOnce(userKeys);

      sharedRedisMockGet.mockImplementation((key: string) => {
        if (key.startsWith("failed_updates:")) {
          return Promise.resolve(null);
        }
        const id = key.split(":")[1];
        return Promise.resolve(JSON.stringify(createMockUserRecord(id, 0)));
      });
      sharedRedisMockSet.mockResolvedValue(true);
      sharedRedisMockDel.mockResolvedValue(1);

      globalThis.fetch = setupSuccessfulFetch();

      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toBe(
        `Updated ${userKeys.length}/${userKeys.length} users successfully. Failed: 0, Removed: 0`,
      );
    });

    it("should process only the 10 oldest users when more than ANILIST_RATE_LIMIT users exist", async () => {
      const userKeys = Array.from({ length: 15 }, (_, i) => `user:${i + 1}`);
      sharedRedisMockKeys.mockResolvedValueOnce(userKeys);

      sharedRedisMockGet.mockImplementation((key: string) => {
        if (key.startsWith("failed_updates:")) {
          return Promise.resolve(null);
        }
        const id = key.split(":")[1];
        const daysOld = Number(id);
        return Promise.resolve(
          JSON.stringify(createMockUserRecord(id, daysOld)),
        );
      });
      sharedRedisMockSet.mockResolvedValue(true);
      sharedRedisMockDel.mockResolvedValue(1);

      globalThis.fetch = setupSuccessfulFetch();

      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("Updated 10/10 users successfully");
      expect(globalThis.fetch).toHaveBeenCalledTimes(10);
    });

    it("should sort users by updatedAt (oldest first) before selecting batch", async () => {
      sharedRedisMockKeys.mockResolvedValueOnce(["user:1", "user:2", "user:3"]);

      const oldDate = new Date("2024-01-01").toISOString();
      const newDate = new Date("2024-12-01").toISOString();

      sharedRedisMockGet.mockImplementation((key: string) => {
        if (key.startsWith("failed_updates:")) {
          return Promise.resolve(null);
        }
        if (key === "user:1") {
          return Promise.resolve(
            JSON.stringify({
              ...createMockUserRecord("1"),
              updatedAt: newDate,
            }),
          );
        }
        if (key === "user:2") {
          return Promise.resolve(
            JSON.stringify({
              ...createMockUserRecord("2"),
              updatedAt: oldDate,
            }),
          );
        }
        if (key === "user:3") {
          return Promise.resolve(
            JSON.stringify({
              ...createMockUserRecord("3"),
              updatedAt: new Date("2024-06-01").toISOString(),
            }),
          );
        }
        return Promise.resolve(null);
      });

      sharedRedisMockSet.mockResolvedValue(true);
      sharedRedisMockDel.mockResolvedValue(1);

      globalThis.fetch = setupSuccessfulFetch();

      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);

      const text = await res.text();
      expect(text).toContain("Updated 3/3");
    });
  });

  describe("404 Failure Handling and User Removal", () => {
    it("should increment failure counter on 404 error (first attempt)", async () => {
      sharedRedisMockKeys.mockResolvedValueOnce(["user:123"]);

      sharedRedisMockGet.mockImplementation((key: string) => {
        if (key.startsWith("failed_updates:")) {
          return Promise.resolve(null); // No previous failures
        }
        return Promise.resolve(JSON.stringify(createMockUserRecord("123")));
      });
      sharedRedisMockSet.mockResolvedValue(true);
      sharedRedisMockDel.mockResolvedValue(1);

      globalThis.fetch = setup404Fetch();

      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("Failed: 1");

      expect(sharedRedisMockSet).toHaveBeenCalledWith("failed_updates:123", 1);
    });

    it("should increment failure counter on 404 error (second attempt)", async () => {
      sharedRedisMockKeys.mockResolvedValueOnce(["user:123"]);

      sharedRedisMockGet.mockImplementation((key: string) => {
        if (key === "failed_updates:123") {
          return Promise.resolve("1"); // Already has 1 failure
        }
        return Promise.resolve(JSON.stringify(createMockUserRecord("123")));
      });
      sharedRedisMockSet.mockResolvedValue(true);
      sharedRedisMockDel.mockResolvedValue(1);

      globalThis.fetch = setup404Fetch();

      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);

      expect(sharedRedisMockSet).toHaveBeenCalledWith("failed_updates:123", 2);
    });

    it("should remove user after 3 consecutive 404 failures", async () => {
      sharedRedisMockKeys.mockResolvedValueOnce(["user:123"]);

      sharedRedisMockGet.mockImplementation((key: string) => {
        if (key === "failed_updates:123") {
          return Promise.resolve("2"); // Already has 2 failures
        }
        return Promise.resolve(JSON.stringify(createMockUserRecord("123")));
      });
      sharedRedisMockSet.mockResolvedValue(true);
      sharedRedisMockDel.mockResolvedValue(1);

      globalThis.fetch = setup404Fetch();

      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("Failed: 1, Removed: 1");

      expect(sharedRedisMockDel).toHaveBeenCalledWith("user:123");
      expect(sharedRedisMockDel).toHaveBeenCalledWith("failed_updates:123");
      expect(sharedRedisMockDel).toHaveBeenCalledWith("cards:123");
    });
  });

  describe("Retry Logic and Network Errors", () => {
    it("should retry on network errors and eventually succeed", async () => {
      sharedRedisMockKeys.mockResolvedValueOnce(["user:123"]);

      sharedRedisMockGet.mockImplementation((key: string) => {
        if (key.startsWith("failed_updates:")) {
          return Promise.resolve(null);
        }
        return Promise.resolve(JSON.stringify(createMockUserRecord("123")));
      });
      sharedRedisMockSet.mockResolvedValue(true);
      sharedRedisMockDel.mockResolvedValue(1);

      globalThis.fetch = setupRetryFetch(3);

      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("Updated 1/1");
      expect(globalThis.fetch).toHaveBeenCalledTimes(3);
    });

    it("should fail after 3 retry attempts on persistent network error", async () => {
      sharedRedisMockKeys.mockResolvedValueOnce(["user:123"]);

      sharedRedisMockGet.mockImplementation((key: string) => {
        if (key.startsWith("failed_updates:")) {
          return Promise.resolve(null);
        }
        return Promise.resolve(JSON.stringify(createMockUserRecord("123")));
      });
      sharedRedisMockSet.mockResolvedValue(true);
      sharedRedisMockDel.mockResolvedValue(1);

      globalThis.fetch = setupNetworkErrorFetch();

      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("Failed: 0"); // Not a 404, so not counted as failed
      // Verify fetch was retried 3 times
      expect(globalThis.fetch).toHaveBeenCalledTimes(3);
    });

    it("should handle non-404 HTTP errors without tracking as failure", async () => {
      sharedRedisMockKeys.mockResolvedValueOnce(["user:123"]);

      sharedRedisMockGet.mockImplementation((key: string) => {
        if (key.startsWith("failed_updates:")) {
          return Promise.resolve(null);
        }
        return Promise.resolve(JSON.stringify(createMockUserRecord("123")));
      });
      sharedRedisMockSet.mockResolvedValue(true);
      sharedRedisMockDel.mockResolvedValue(1);

      globalThis.fetch = setup500Fetch();

      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("Failed: 0, Removed: 0");
      expect(sharedRedisMockSet).not.toHaveBeenCalledWith(
        expect.stringContaining("failed_updates"),
        expect.anything(),
      );
    });
  });

  describe("Data Persistence", () => {
    it("should update user stats in Redis with fetched data", async () => {
      sharedRedisMockKeys.mockResolvedValueOnce(["user:123"]);

      sharedRedisMockGet.mockImplementation((key: string) => {
        if (key.startsWith("failed_updates:")) {
          return Promise.resolve(null);
        }
        return Promise.resolve(JSON.stringify(createMockUserRecord("123")));
      });
      sharedRedisMockSet.mockResolvedValue(true);
      sharedRedisMockDel.mockResolvedValue(1);

      const mockStatsData = { data: { stats: { updated: "data" } } };
      globalThis.fetch = toFetchMock(
        mock().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => mockStatsData,
        }),
      );

      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);

      // Verify that sharedRedisMockSet was called to update user data
      expect(sharedRedisMockSet).toHaveBeenCalledWith(
        "user:123",
        expect.stringContaining(JSON.stringify(mockStatsData.data)),
      );
    });

    it("should update user's updatedAt timestamp after successful fetch", async () => {
      sharedRedisMockKeys.mockResolvedValueOnce(["user:123"]);

      sharedRedisMockGet.mockImplementation((key: string) => {
        if (key.startsWith("failed_updates:")) {
          return Promise.resolve(null);
        }
        return Promise.resolve(JSON.stringify(createMockUserRecord("123")));
      });
      sharedRedisMockSet.mockResolvedValue(true);
      sharedRedisMockDel.mockResolvedValue(1);

      globalThis.fetch = toFetchMock(
        mock().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ data: { stats: "mocked" } }),
        }),
      );

      const beforeTime = new Date();
      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      const afterTime = new Date();

      expect(res.status).toBe(200);

      // Extract the call to sharedRedisMockSet for user:123
      const setCall = (
        sharedRedisMockSet.mock.calls as [string, unknown][]
      ).find(([key]) => key === "user:123");
      expect(setCall).toBeDefined();

      if (setCall) {
        const userData = JSON.parse(setCall[1] as string);
        const updatedAtTime = new Date(userData.updatedAt);
        expect(updatedAtTime.getTime()).toBeGreaterThanOrEqual(
          beforeTime.getTime(),
        );
        expect(updatedAtTime.getTime()).toBeLessThanOrEqual(
          afterTime.getTime(),
        );
      }
    });

    it("should clear failure tracking after successful update", async () => {
      sharedRedisMockKeys.mockResolvedValueOnce(["user:123"]);

      sharedRedisMockGet.mockImplementation((key: string) => {
        if (key.startsWith("failed_updates:")) {
          return Promise.resolve("1"); // Had previous failures
        }
        return Promise.resolve(JSON.stringify(createMockUserRecord("123")));
      });
      sharedRedisMockSet.mockResolvedValue(true);
      sharedRedisMockDel.mockResolvedValue(1);

      globalThis.fetch = toFetchMock(
        mock().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ data: { stats: "mocked" } }),
        }),
      );

      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);

      // Verify failure tracking key was deleted
      expect(sharedRedisMockDel).toHaveBeenCalledWith("failed_updates:123");
    });
  });

  describe("Invalid Data Handling", () => {
    it("should skip users with invalid/unparseable data", async () => {
      sharedRedisMockKeys.mockResolvedValueOnce(["user:123", "user:456"]);

      sharedRedisMockGet.mockImplementation((key: string) => {
        if (key.startsWith("failed_updates:")) {
          return Promise.resolve(null);
        }
        if (key === "user:123") {
          return Promise.resolve(null);
        }
        return Promise.resolve(JSON.stringify(createMockUserRecord("456")));
      });
      sharedRedisMockSet.mockResolvedValue(true);
      sharedRedisMockDel.mockResolvedValue(1);

      globalThis.fetch = setupSuccessfulFetch();

      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("Updated 1/1");
    });
    it("should handle users with missing optional fields (empty username)", async () => {
      sharedRedisMockKeys.mockResolvedValueOnce(["user:123"]);

      sharedRedisMockGet.mockImplementation((key: string) => {
        if (key.startsWith("failed_updates:")) {
          return Promise.resolve(null);
        }
        return Promise.resolve(
          JSON.stringify({
            userId: "123",
            stats: { dummy: 1 },
            updatedAt: new Date(2024, 0, 1).toISOString(),
          }),
        );
      });
      sharedRedisMockSet.mockResolvedValue(true);
      sharedRedisMockDel.mockResolvedValue(1);

      globalThis.fetch = setupSuccessfulFetch();

      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("Updated 1/1");
    });

    it("should handle null user data from Redis gracefully", async () => {
      sharedRedisMockKeys.mockResolvedValueOnce(["user:123"]);

      sharedRedisMockGet.mockImplementation((key: string) => {
        if (key.startsWith("failed_updates:")) {
          return Promise.resolve(null);
        }
        return Promise.resolve(null);
      });
      sharedRedisMockSet.mockResolvedValue(true);
      sharedRedisMockDel.mockResolvedValue(1);

      globalThis.fetch = setupSuccessfulFetch();

      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("Updated 0/0");
    });
  });

  describe("Error Handling", () => {
    it("should return 500 and error message if Redis keys retrieval fails", async () => {
      sharedRedisMockKeys.mockRejectedValueOnce(
        new Error("Redis connection error"),
      );
      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.status).toBe(500);
      const text = await res.text();
      expect(text).toBe("Cron job failed");
    });

    it("should handle individual user processing errors gracefully", async () => {
      sharedRedisMockKeys.mockResolvedValueOnce(["user:123", "user:456"]);

      sharedRedisMockGet.mockImplementation((key: string) => {
        if (key.startsWith("failed_updates:")) {
          return Promise.resolve(null);
        }
        if (key === "user:123") {
          return Promise.resolve(null);
        }
        return Promise.resolve(JSON.stringify(createMockUserRecord("456")));
      });
      sharedRedisMockSet.mockResolvedValue(true);
      sharedRedisMockDel.mockResolvedValue(1);

      globalThis.fetch = setupSuccessfulFetch();

      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("Updated 1/1");
    });

    it("should return 500 status when critical error occurs during batch processing", async () => {
      sharedRedisMockKeys.mockResolvedValueOnce(["user:123"]);
      sharedRedisMockGet.mockRejectedValueOnce(new Error("Redis error"));

      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.status).toBe(500);
      const text = await res.text();
      expect(text).toBe("Cron job failed");
    });
  });

  describe("Mixed Scenarios", () => {
    it("should handle mix of successful and failed updates in same batch", async () => {
      sharedRedisMockKeys.mockResolvedValueOnce(["user:1", "user:2", "user:3"]);

      sharedRedisMockGet.mockImplementation((key: string) => {
        if (key.startsWith("failed_updates:")) {
          return Promise.resolve(null);
        }
        if (key === "user:1") {
          return Promise.resolve(JSON.stringify(createMockUserRecord("1")));
        }
        if (key === "user:2") {
          return Promise.resolve(JSON.stringify(createMockUserRecord("2")));
        }
        if (key === "user:3") {
          return Promise.resolve(JSON.stringify(createMockUserRecord("3")));
        }
        return Promise.resolve(null);
      });
      sharedRedisMockSet.mockResolvedValue(true);
      sharedRedisMockDel.mockResolvedValue(1);

      globalThis.fetch = toFetchMock(
        mock().mockImplementation(
          createMixedOutcomesFetchImplementation(["2"]),
        ),
      );

      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("Updated 2/3");
      expect(text).toContain("Failed: 1");
    });

    it("should handle processing 10 users (at rate limit) with mixed outcomes", async () => {
      const userKeys = Array.from({ length: 10 }, (_, i) => `user:${i + 1}`);
      sharedRedisMockKeys.mockResolvedValueOnce(userKeys);

      sharedRedisMockGet.mockImplementation((key: string) => {
        if (key.startsWith("failed_updates:")) {
          return Promise.resolve(null);
        }
        const id = key.split(":")[1];
        return Promise.resolve(JSON.stringify(createMockUserRecord(id)));
      });
      sharedRedisMockSet.mockResolvedValue(true);
      sharedRedisMockDel.mockResolvedValue(1);

      globalThis.fetch = toFetchMock(
        mock().mockImplementation(
          createMixedOutcomesFetchImplementation(["3", "7"]),
        ),
      );

      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("Updated 8/10");
      expect(text).toContain("Failed: 2");
    });
  });
});
