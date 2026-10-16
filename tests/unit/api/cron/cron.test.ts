import { afterEach, describe, expect, it, mock } from "bun:test";
import {
  sharedRedisMockScan,
  sharedRedisMockGet,
  sharedRedisMockSet,
  sharedRedisMockDel,
  sharedRedisMockMget,
  sharedRedisMockEval,
  sharedRedisMockZadd,
  sharedRedisMockZrange,
  sharedRedisMockZcard,
  sharedRedisMockZrem,
  sharedRedisMockPipelineExec,
} from "@/tests/unit/__setup__.test";
import {
  splitUserRecord,
  USER_REFRESH_INDEX_KEY,
} from "@/lib/server/user-data";
import type { UserRecord } from "@/lib/types/records";

const { POST } = await import("@/app/api/cron/route");

/**
 * Helper to create a mock user record
 */
function createMockUserRecord(
  userId: string,
  daysOld: number = 0,
  stats = createMockStatsPayload(),
) {
  const date = new Date();
  date.setDate(date.getDate() - daysOld);
  return {
    userId,
    username: `user${userId}`,
    stats: { ...stats, User: { ...stats.User, id: Number(userId) } },
    updatedAt: date.toISOString(),
    ip: "127.0.0.1",
    createdAt: date.toISOString(),
  };
}

function createMockStatsPayload() {
  return {
    User: {
      id: 0,
      statistics: {
        anime: { count: 1 },
        manga: { count: 0 },
      },
      stats: { activityHistory: [] },
      favourites: {
        anime: { nodes: [] },
        manga: { nodes: [] },
        characters: { nodes: [] },
        staff: { nodes: [] },
        studios: { nodes: [] },
      },
    },
    followersPage: { pageInfo: { total: 0 }, followers: [] },
    followingPage: { pageInfo: { total: 0 }, following: [] },
    threadsPage: { pageInfo: { total: 0 }, threads: [] },
    threadCommentsPage: { pageInfo: { total: 0 }, threadComments: [] },
    reviewsPage: { pageInfo: { total: 0 }, reviews: [] },
    userReviews: { pageInfo: { total: 0 }, reviews: [] },
    userRecommendations: { pageInfo: { total: 0 }, recommendations: [] },
    animePlanning: { lists: [] },
    animeCurrent: { lists: [] },
    animeRewatched: { lists: [] },
    animeCompleted: { lists: [] },
    animeDropped: { lists: [] },
    mangaPlanning: { lists: [] },
    mangaCurrent: { lists: [] },
    mangaReread: { lists: [] },
    mangaCompleted: { lists: [] },
    mangaDropped: { lists: [] },
  };
}

/**
 * Feeds the refresh index mocks as ZRANGE ... WITHSCORES returns members and
 * scores interleaved, oldest first.
 */
function mockRefreshIndex(entries: { id: string; updatedAt: number }[]) {
  sharedRedisMockZcard.mockResolvedValueOnce(entries.length);
  const flat: (string | number)[] = [];
  for (const { id, updatedAt } of entries) {
    flat.push(id, updatedAt);
  }
  sharedRedisMockZrange.mockResolvedValueOnce(flat as never);
}

/**
 * Models Redis writes for the cron path. Markers store normally; the index
 * repair lease is a SET NX, so it only succeeds for the caller that wins it.
 * Tests that do not opt in model a lease another run already holds, which
 * keeps the refresh index in place for the duration of the test.
 */
function mockRedisWrites(options: { claimIndexRepairLease?: boolean } = {}) {
  sharedRedisMockSet.mockImplementation(
    async (_key: string, _value: unknown, opts?: { nx?: boolean }) => {
      if (opts?.nx) {
        return options.claimIndexRepairLease ? "OK" : null;
      }
      return "OK";
    },
  );
}

/**
 * Feeds the refresh index from user IDs, mirroring createMockUserRecord where
 * a larger ID means an older record.
 */
function mockRefreshIndexFromUserIds(userIds: string[]) {
  mockRefreshIndex(
    [...userIds]
      .sort((a, b) => Number(b) - Number(a))
      .map((id) => ({ id, updatedAt: Date.now() - Number(id) * 86_400_000 })),
  );
}

function mockUserDataMget(
  options: {
    invalidMetaUserIds?: string[];
    missingUsernameUserIds?: string[];
  } = {},
) {
  sharedRedisMockMget.mockImplementation(async (...keys: string[]) =>
    keys.map((key) => {
      if (key.startsWith("cron:refresh-cooldown:")) return null;
      const [, userId, part] = key.split(":");
      if (part === "meta" && options.invalidMetaUserIds?.includes(userId)) {
        return null;
      }
      const user = createMockUserRecord(userId, Number(userId));
      const parts = splitUserRecord(user as unknown as UserRecord);
      if (part === "meta") {
        const { username, ...meta } = parts.meta;
        return JSON.stringify({
          ...meta,
          ...(options.missingUsernameUserIds?.includes(userId)
            ? {}
            : { username }),
          updatedAt: user.updatedAt,
        });
      }
      const value = parts[part as keyof ReturnType<typeof splitUserRecord>];
      return value === undefined ? null : JSON.stringify(value);
    }),
  );
}

/**
 * Async function that returns successful stats
 */
async function jsonSuccessResponse() {
  return { data: createMockStatsPayload() };
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
  fetchMock.preconnect = mock();
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
    sharedRedisMockGet.mockReset();
    sharedRedisMockSet.mockReset();
    sharedRedisMockDel.mockReset();
    sharedRedisMockScan.mockReset();
    sharedRedisMockMget.mockReset();
    sharedRedisMockZadd.mockReset();
    sharedRedisMockZrange.mockReset();
    sharedRedisMockZcard.mockReset();
    sharedRedisMockZrem.mockReset();
    sharedRedisMockPipelineExec.mockReset();

    // Restore default behaviors
    sharedRedisMockMget.mockImplementation(async (...keys: string[]) =>
      keys.map(() => null),
    );
    sharedRedisMockScan.mockResolvedValue([0, []]);
    sharedRedisMockZrange.mockResolvedValue([]);
    sharedRedisMockZcard.mockResolvedValue(0);
    sharedRedisMockPipelineExec.mockResolvedValue([]);

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

    it("should reject requests when CRON_SECRET is not configured", async () => {
      delete process.env.CRON_SECRET;

      const req = new Request("http://localhost/api/cron", {
        headers: {},
      });
      const res = await POST(req);
      expect(res.status).toBe(503);
      expect(await res.text()).toBe("Cron authorization is not configured");
    });
  });

  describe("CORS and Response Headers", () => {
    it("should set CORS Access-Control-Allow-Origin to the request origin", async () => {
      const prev = process.env.NEXT_PUBLIC_APP_URL;
      delete process.env.NEXT_PUBLIC_APP_URL;
      try {
        sharedRedisMockScan.mockResolvedValueOnce([0, []]);
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
      sharedRedisMockScan.mockResolvedValueOnce([0, []]);
      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.headers.get("Content-Type")).toBe("text/plain");
    });
  });

  describe("User Processing", () => {
    it("should process with zero users if the index and storage are empty", async () => {
      sharedRedisMockScan.mockResolvedValueOnce([0, []]);
      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain(
        "Updated 0/0 users successfully. Failed: 0, Removed: 0",
      );
      // Should include scheduling recommendations even when there are zero users
      expect(text).toContain(
        `Recommended schedules to refresh all 0 users at least once per 24 hours:`,
      );
      expect(sharedRedisMockScan).toHaveBeenCalledWith(
        0,
        expect.objectContaining({ match: "user:*:meta" }),
      );
    });

    it("should rebuild an empty refresh index from stored meta before selecting users", async () => {
      const userKeys = ["user:1:meta", "user:2:meta", "user:3:meta"];
      sharedRedisMockScan.mockResolvedValueOnce([0, userKeys]);

      mockUserDataMget();
      mockRedisWrites();
      sharedRedisMockDel.mockResolvedValue(1);

      globalThis.fetch = setupSuccessfulFetch();

      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);

      expect(sharedRedisMockZcard).toHaveBeenCalledWith(USER_REFRESH_INDEX_KEY);
      expect(sharedRedisMockZadd).toHaveBeenCalledWith(
        USER_REFRESH_INDEX_KEY,
        expect.objectContaining({ member: expect.any(String) }),
      );
    });

    it("should rebuild the index when the repair lease is available and rescore from stored meta", async () => {
      sharedRedisMockZcard.mockResolvedValueOnce(1);
      // Rebuild scans meta keys and reads their updatedAt values.
      sharedRedisMockScan.mockResolvedValueOnce([
        0,
        ["user:5:meta", "user:6:meta"],
      ]);
      mockUserDataMget();
      mockRedisWrites({ claimIndexRepairLease: true });
      sharedRedisMockDel.mockResolvedValue(1);

      globalThis.fetch = setupSuccessfulFetch();

      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);

      // The rebuild replaced the index contents from storage.
      expect(sharedRedisMockZadd).toHaveBeenCalledWith(
        USER_REFRESH_INDEX_KEY,
        expect.objectContaining({ member: expect.any(String) }),
      );
      expect(sharedRedisMockZadd.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it("should skip the rebuild when another run holds the repair lease", async () => {
      mockRefreshIndexFromUserIds(["1", "2"]);
      mockUserDataMget();
      mockRedisWrites();

      globalThis.fetch = setupSuccessfulFetch();

      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);

      expect(sharedRedisMockScan).not.toHaveBeenCalled();
    });

    it("should successfully update all users when all are valid and AniList responds with 200", async () => {
      const userIds = ["1", "2", "3", "4", "5"];
      mockRefreshIndexFromUserIds(userIds);
      mockUserDataMget();
      mockRedisWrites();
      sharedRedisMockDel.mockResolvedValue(1);

      globalThis.fetch = setupSuccessfulFetch();

      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain(
        `Updated ${userIds.length}/${userIds.length} users successfully. Failed: 0, Removed: 0`,
      );
      expect(text).toContain(
        `Recommended schedules to refresh all ${userIds.length} users at least once per 24 hours:`,
      );
    });

    it("should process only the 5 oldest users when the index holds more", async () => {
      const userIds = Array.from({ length: 15 }, (_, i) => String(i + 1));
      mockRefreshIndexFromUserIds(userIds);

      mockUserDataMget();
      mockRedisWrites();
      sharedRedisMockDel.mockResolvedValue(1);

      globalThis.fetch = setupSuccessfulFetch();

      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("Updated 5/5 users successfully");

      // Verify the cron recommendations are included and correct for 15 users
      expect(text).toContain("Update 5 users/run: 0 */8 * * *");
      expect(text).toContain("Update 10 users/run: 0 */12 * * *");

      expect(globalThis.fetch).toHaveBeenCalledTimes(5);
    });

    it("should process users in index order (oldest first)", async () => {
      mockRefreshIndex([
        { id: "2", updatedAt: new Date("2024-01-01").getTime() },
        { id: "3", updatedAt: new Date("2024-06-01").getTime() },
        { id: "1", updatedAt: new Date("2024-12-01").getTime() },
      ]);

      mockUserDataMget();
      mockRedisWrites();
      sharedRedisMockDel.mockResolvedValue(1);

      const processedUserIds: string[] = [];
      globalThis.fetch = toFetchMock(
        mock().mockImplementation(
          async (_url: RequestInfo, init?: RequestInit) => {
            const body = init?.body ? JSON.parse(init.body as string) : {};
            processedUserIds.push(String(body.variables?.userId || ""));
            return createSuccessResponse();
          },
        ),
      );

      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);

      const text = await res.text();
      expect(text).toContain("Updated 3/3");
      expect(processedUserIds).toEqual(["2", "3", "1"]);
    });

    it("should page past a full window of cooled-down users instead of idling", async () => {
      // 25 cooled-down users fill the first page exactly; the 26th should still
      // be selected, which is what the old single-page window failed to do.
      const cooledDownIds = Array.from({ length: 25 }, (_, i) => String(i + 1));
      const healthyId = "26";
      const indexEntries = [
        ...cooledDownIds.map((id, index) => ({ id, updatedAt: index + 1 })),
        { id: healthyId, updatedAt: 1_000 },
      ];
      const flatIndex: (string | number)[] = [];
      for (const { id, updatedAt } of indexEntries) {
        flatIndex.push(id, updatedAt);
      }
      sharedRedisMockZcard.mockResolvedValueOnce(indexEntries.length);
      sharedRedisMockZrange.mockImplementation(async (...args: unknown[]) => {
        const start = Number(args[1]);
        const stop = Number(args[2]);
        return flatIndex.slice(start * 2, (stop + 1) * 2);
      });

      sharedRedisMockMget.mockImplementation(async (...keys: string[]) =>
        keys.map((key) => {
          if (key.startsWith("cron:refresh-cooldown:")) {
            const id = key.slice("cron:refresh-cooldown:".length);
            // The SDK parses the stored "1", so a cooldown reads back as a
            // number. Returning a string here is what hid the payload-size
            // metric throwing on the real value.
            return cooledDownIds.includes(id) ? 1 : null;
          }
          const [, userId, part] = key.split(":");
          const user = createMockUserRecord(userId, Number(userId));
          const value = splitUserRecord(user as unknown as UserRecord)[
            part as keyof ReturnType<typeof splitUserRecord>
          ];
          return value === undefined ? null : JSON.stringify(value);
        }),
      );
      mockRedisWrites();
      sharedRedisMockDel.mockResolvedValue(1);

      const processedUserIds: string[] = [];
      globalThis.fetch = toFetchMock(
        mock().mockImplementation(
          async (_url: RequestInfo, init?: RequestInit) => {
            const body = init?.body ? JSON.parse(init.body as string) : {};
            processedUserIds.push(String(body.variables?.userId || ""));
            return createSuccessResponse();
          },
        ),
      );

      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);

      // The batch is not empty, and the healthy user is the one refreshed.
      expect(processedUserIds).toEqual([healthyId]);
      const text = await res.text();
      expect(text).toContain("Updated 1/1 users successfully");
      expect(text).toContain("cooling down: 25");
    });

    it("should keep the batch running when the periodic repair fails", async () => {
      // A stale but non-empty index: the repair is owed, the rebuild throws,
      // and the run must still refresh users from the existing index.
      mockRefreshIndex([{ id: "7", updatedAt: 1_000 }]);
      // The rebuild starts with a SCAN of the meta keyspace; make it fail.
      sharedRedisMockScan.mockRejectedValueOnce(new Error("rebuild blew up"));
      mockUserDataMget();
      mockRedisWrites({ claimIndexRepairLease: true });
      sharedRedisMockDel.mockResolvedValue(1);

      globalThis.fetch = setupSuccessfulFetch();

      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);

      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("Updated 1/1 users successfully");
      // The lease was released so the next run can retry the repair.
      expect(sharedRedisMockDel).toHaveBeenCalledWith(
        "users:refresh-index:repair-lease",
      );
    });

    it("should abort when the index is empty and the rebuild fails", async () => {
      // No index means nothing to select from, so this failure is fatal.
      sharedRedisMockZcard.mockResolvedValueOnce(0);
      sharedRedisMockScan.mockRejectedValueOnce(
        new Error("rebuild blew up for an empty index"),
      );

      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);

      expect(res.status).toBe(500);
      expect(await res.text()).toBe("Cron job failed");
    });

    it("should score rebuilt index entries from stored meta and sentinel unreadable ones", async () => {
      sharedRedisMockZcard.mockResolvedValueOnce(1);
      sharedRedisMockScan.mockResolvedValueOnce([
        0,
        ["user:5:meta", "user:6:meta"],
      ]);
      sharedRedisMockMget.mockImplementationOnce(async (...keys: string[]) =>
        keys.map((key) => {
          if (key === "user:5:meta") {
            return JSON.stringify({ updatedAt: "2024-03-01T00:00:00.000Z" });
          }
          // Meta with no readable updatedAt.
          return JSON.stringify({ userId: "6" });
        }),
      );
      mockRedisWrites({ claimIndexRepairLease: true });
      sharedRedisMockDel.mockResolvedValue(1);

      globalThis.fetch = setupSuccessfulFetch();

      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);

      expect(sharedRedisMockZadd).toHaveBeenCalledWith(USER_REFRESH_INDEX_KEY, {
        score: new Date("2024-03-01T00:00:00.000Z").getTime(),
        member: "5",
      });
      expect(sharedRedisMockZadd).toHaveBeenCalledWith(USER_REFRESH_INDEX_KEY, {
        score: Number.MAX_SAFE_INTEGER,
        member: "6",
      });
      // The rebuild no longer deletes the live index.
      expect(sharedRedisMockDel).not.toHaveBeenCalledWith(
        USER_REFRESH_INDEX_KEY,
      );
    });

    it("should drop index members whose record is gone during a rebuild", async () => {
      // The scan proves 5 exists. The index also claims 6 and 7, and their meta
      // reads come back empty, so the rebuild drops them rather than leaving
      // them to occupy the small selection window until the queue reaches them.
      sharedRedisMockZcard.mockResolvedValueOnce(3);
      sharedRedisMockScan.mockResolvedValueOnce([0, ["user:5:meta"]]);
      sharedRedisMockZrange.mockResolvedValueOnce(["5", "6", "7"] as never);
      sharedRedisMockMget.mockImplementation(async (...keys: string[]) =>
        keys.map((key) => {
          if (key.startsWith("cron:refresh-cooldown:")) return null;
          if (key === "user:5:meta") {
            return JSON.stringify({ updatedAt: "2024-03-01T00:00:00.000Z" });
          }
          // The rebuild's own scan of live meta keys, then the confirmation
          // read for the uncovered members: both find nothing.
          if (key.startsWith("user:") && key.endsWith(":meta")) return null;
          const [, userId, part] = key.split(":");
          const user = createMockUserRecord(userId, Number(userId));
          const value = splitUserRecord(user as unknown as UserRecord)[
            part as keyof ReturnType<typeof splitUserRecord>
          ];
          return value === undefined ? null : JSON.stringify(value);
        }),
      );
      mockRedisWrites({ claimIndexRepairLease: true });
      sharedRedisMockDel.mockResolvedValue(1);

      globalThis.fetch = setupSuccessfulFetch();

      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);

      expect(sharedRedisMockZrem).toHaveBeenCalledWith(
        USER_REFRESH_INDEX_KEY,
        "6",
      );
      expect(sharedRedisMockZrem).toHaveBeenCalledWith(
        USER_REFRESH_INDEX_KEY,
        "7",
      );
      // A member the scan did cover keeps its entry.
      expect(sharedRedisMockZrem).not.toHaveBeenCalledWith(
        USER_REFRESH_INDEX_KEY,
        "5",
      );
    });

    it("should skip candidates in cooldown and fill the batch from the rest of the window", async () => {
      mockRefreshIndex([
        { id: "10", updatedAt: 1_000 },
        { id: "11", updatedAt: 2_000 },
        { id: "12", updatedAt: 3_000 },
      ]);

      sharedRedisMockMget.mockImplementation(async (...keys: string[]) =>
        keys.map((key) => {
          if (key.startsWith("cron:refresh-cooldown:")) {
            // Numeric, matching the SDK's parsed reply.
            return key === "cron:refresh-cooldown:10" ? 1 : null;
          }
          const [, userId, part] = key.split(":");
          const user = createMockUserRecord(userId, Number(userId));
          const value = splitUserRecord(user as unknown as UserRecord)[
            part as keyof ReturnType<typeof splitUserRecord>
          ];
          return value === undefined ? null : JSON.stringify(value);
        }),
      );
      mockRedisWrites();
      sharedRedisMockDel.mockResolvedValue(1);

      globalThis.fetch = setupSuccessfulFetch();

      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("Updated 2/2 users successfully");
      expect(text).toContain("cooling down: 1");
    });

    it("should drop index entries whose stored meta is missing", async () => {
      mockRefreshIndex([{ id: "123", updatedAt: 1_000 }]);
      sharedRedisMockMget.mockImplementation(async () => [null]);
      mockRedisWrites();
      sharedRedisMockDel.mockResolvedValue(1);

      globalThis.fetch = setupSuccessfulFetch();

      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("Updated 0/0 users successfully");
      expect(text).toContain("Stale index entries dropped: 1");
      expect(sharedRedisMockZrem).toHaveBeenCalledWith(
        USER_REFRESH_INDEX_KEY,
        "123",
      );
    });

    it("should report an unreadable stalest score as unknown rather than a huge age", async () => {
      // The sentinel score is not a timestamp. Reporting the epoch-relative
      // difference would print tens of millions of minutes and make a healthy
      // queue look catastrophically behind.
      mockRefreshIndex([{ id: "123", updatedAt: Number.MAX_SAFE_INTEGER }]);
      mockUserDataMget();
      mockRedisWrites();
      sharedRedisMockDel.mockResolvedValue(1);
      globalThis.fetch = setupSuccessfulFetch();

      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);

      const text = await res.text();
      expect(text).toContain("oldest stale record: unknown");
      expect(text).not.toMatch(/oldest stale record: \d{5,} minutes/);
    });

    it("should report no stalest record when nothing was selected", async () => {
      // An empty index means no selection happened at all, which is different
      // from a selected record whose age cannot be read.
      sharedRedisMockZcard.mockResolvedValueOnce(0);
      sharedRedisMockScan.mockResolvedValueOnce([0, []]);
      sharedRedisMockZrange.mockResolvedValueOnce([] as never);
      mockUserDataMget();
      mockRedisWrites();
      sharedRedisMockDel.mockResolvedValue(1);
      globalThis.fetch = setupSuccessfulFetch();

      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);

      expect(await res.text()).toContain("oldest stale record: none");
    });
  });

  describe("404 Failure Handling and User Removal", () => {
    it("should increment failure counter on 404 error (first attempt)", async () => {
      mockRefreshIndex([{ id: "123", updatedAt: 1_000 }]);

      mockUserDataMget();
      sharedRedisMockGet.mockResolvedValue(null);
      mockRedisWrites();
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
      mockRefreshIndex([{ id: "123", updatedAt: 1_000 }]);
      mockUserDataMget();
      sharedRedisMockGet.mockResolvedValue(null);
      sharedRedisMockGet.mockResolvedValueOnce("1");
      mockRedisWrites();
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
      mockRefreshIndex([{ id: "123", updatedAt: 1_000 }]);
      mockUserDataMget();
      sharedRedisMockGet.mockImplementation(async (key: string) => {
        if (key === "failed_updates:123") return "2";
        if (key === "user:123:meta") {
          return JSON.stringify({ username: "user123" });
        }
        return null;
      });
      sharedRedisMockEval.mockResolvedValueOnce(1);
      mockRedisWrites();
      sharedRedisMockDel.mockResolvedValue(1);

      globalThis.fetch = setup404Fetch();

      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("Failed: 1, Removed: 1");

      expect(sharedRedisMockDel).toHaveBeenCalledWith(
        "user:123:meta",
        "user:123:activity",
        "user:123:favourites",
        "user:123:statistics",
        "user:123:pages",
        "user:123:planning",
        "user:123:current",
        "user:123:rewatched",
        "user:123:completed",
        "user:123:aggregates",
      );
      expect(sharedRedisMockDel).toHaveBeenCalledWith("failed_updates:123");
      expect(sharedRedisMockDel).toHaveBeenCalledWith("cards:123");
      // A removed record must also leave the refresh queue.
      expect(sharedRedisMockZrem).toHaveBeenCalledWith(
        USER_REFRESH_INDEX_KEY,
        "123",
      );
      expect(sharedRedisMockEval).toHaveBeenCalledWith(
        expect.any(String),
        ["username:user123"],
        ["123"],
      );
    });
  });

  describe("Retry Logic and Network Errors", () => {
    it("should retry on network errors and eventually succeed", async () => {
      mockRefreshIndex([{ id: "123", updatedAt: 1_000 }]);

      mockUserDataMget();
      mockRedisWrites();
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
      mockRefreshIndex([{ id: "123", updatedAt: 1_000 }]);

      mockUserDataMget();
      mockRedisWrites();
      sharedRedisMockDel.mockResolvedValue(1);

      globalThis.fetch = setupNetworkErrorFetch();

      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("Failed: 1"); // Not a 404, so no failure counter is stored.
      // Verify fetch was retried 3 times
      expect(globalThis.fetch).toHaveBeenCalledTimes(3);
    });

    it("should handle non-404 HTTP errors without tracking as failure", async () => {
      mockRefreshIndex([{ id: "123", updatedAt: 1_000 }]);

      mockUserDataMget();
      mockRedisWrites();
      sharedRedisMockDel.mockResolvedValue(1);

      globalThis.fetch = setup500Fetch();

      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("Failed: 1, Removed: 0");
      expect(sharedRedisMockSet).not.toHaveBeenCalledWith(
        expect.stringContaining("failed_updates"),
        expect.anything(),
      );
    });
  });

  describe("Data Persistence", () => {
    it("should update user stats in Redis with fetched data", async () => {
      mockRefreshIndex([{ id: "123", updatedAt: 1_000 }]);

      mockUserDataMget();
      mockRedisWrites();
      sharedRedisMockDel.mockResolvedValue(1);

      // The stored record comes from the same payload, so only the statistics
      // count differs from what is already saved.
      const changedStats = createMockStatsPayload();
      changedStats.User.statistics.anime.count = 2;
      globalThis.fetch = toFetchMock(
        mock().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ data: changedStats }),
        }),
      );

      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);

      // Changed parts are written and unchanged parts are left alone.
      expect(sharedRedisMockSet).toHaveBeenCalledWith(
        "user:123:statistics",
        expect.stringContaining('"count":2'),
      );
      expect(sharedRedisMockSet).not.toHaveBeenCalledWith(
        "user:123:activity",
        expect.anything(),
      );
    });

    it("should update user's updatedAt timestamp after successful fetch", async () => {
      mockRefreshIndex([{ id: "123", updatedAt: 1_000 }]);
      mockUserDataMget();
      mockRedisWrites();
      sharedRedisMockDel.mockResolvedValue(1);

      globalThis.fetch = toFetchMock(
        mock().mockResolvedValue(createSuccessResponse()),
      );

      const beforeTime = new Date();
      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      const afterTime = new Date();

      expect(res.status).toBe(200);

      // Extract the call to sharedRedisMockSet for user:123:meta
      const setCall = (
        sharedRedisMockSet.mock.calls as [string, unknown][]
      ).find(([key]) => key === "user:123:meta");
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
      mockRefreshIndex([{ id: "123", updatedAt: 1_000 }]);

      mockUserDataMget();
      sharedRedisMockGet.mockResolvedValue(null);
      sharedRedisMockGet.mockResolvedValueOnce("1");
      mockRedisWrites();
      sharedRedisMockDel.mockResolvedValue(1);

      globalThis.fetch = setupSuccessfulFetch();

      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);

      // Verify failure tracking key was deleted
      expect(sharedRedisMockDel).toHaveBeenCalledWith(
        "failed_updates:123",
        "cron:refresh-cooldown:123",
      );
    });
  });

  describe("Invalid Data Handling", () => {
    it("should skip users with invalid/unparseable data", async () => {
      mockRefreshIndex([
        { id: "456", updatedAt: 1_000 },
        { id: "123", updatedAt: 2_000 },
      ]);
      mockUserDataMget({ invalidMetaUserIds: ["123"] });
      mockRedisWrites();
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
      mockRefreshIndex([{ id: "123", updatedAt: 1_000 }]);
      mockUserDataMget({ missingUsernameUserIds: ["123"] });
      mockRedisWrites();
      sharedRedisMockDel.mockResolvedValue(1);

      globalThis.fetch = setupSuccessfulFetch();

      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("Updated 1/1");
      expect(sharedRedisMockDel).not.toHaveBeenCalledWith(
        expect.stringMatching(/^username:/),
      );
    });

    it("should handle null user data from Redis gracefully", async () => {
      mockRefreshIndex([{ id: "123", updatedAt: 1_000 }]);

      sharedRedisMockGet.mockImplementation((key: string) => {
        if (key.startsWith("failed_updates:")) {
          return Promise.resolve(null);
        }
        return Promise.resolve(null);
      });
      mockRedisWrites();
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
      sharedRedisMockZcard.mockRejectedValueOnce(
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
      mockRefreshIndex([
        { id: "456", updatedAt: 1_000 },
        { id: "123", updatedAt: 2_000 },
      ]);
      mockUserDataMget({ invalidMetaUserIds: ["123"] });
      mockRedisWrites();
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
      mockRefreshIndex([{ id: "123", updatedAt: 1_000 }]);
      mockRedisWrites();
      sharedRedisMockMget.mockRejectedValueOnce(new Error("Redis error"));

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
      mockRefreshIndexFromUserIds(["1", "2", "3"]);

      mockUserDataMget();
      mockRedisWrites();
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

    it("should handle processing 5 users (at rate limit) with mixed outcomes", async () => {
      mockRefreshIndexFromUserIds(
        Array.from({ length: 5 }, (_, i) => String(i + 1)),
      );

      mockUserDataMget();
      mockRedisWrites();
      sharedRedisMockDel.mockResolvedValue(1);

      globalThis.fetch = toFetchMock(
        mock().mockImplementation(
          createMixedOutcomesFetchImplementation(["3", "5"]),
        ),
      );

      const req = new Request("http://localhost/api/cron", {
        headers: { "x-cron-secret": CRON_SECRET },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("Updated 3/5");
      expect(text).toContain("Failed: 2");
    });
  });
});
