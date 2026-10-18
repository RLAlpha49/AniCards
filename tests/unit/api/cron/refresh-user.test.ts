import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import {
  sharedRedisMockDel,
  sharedRedisMockEval,
  sharedRedisMockGet,
  sharedRedisMockMget,
  sharedRedisMockPipelineExec,
  sharedRedisMockSet,
  sharedRedisMockZrem,
} from "@/tests/unit/__setup__";
import {
  splitUserRecord,
  USER_REFRESH_INDEX_KEY,
} from "@/lib/server/user-data";
import type { UserRecord } from "@/lib/types/records";

const { POST } = await import("@/app/api/cron/refresh-user/route");

const CRON_SECRET = "testsecret";

/** Saved once and restored after every test; Bun shares one process and one
 * module registry across the suite, so a leaked value changes behavior in
 * later test files. */
const ORIGINAL_CRON_SECRET = process.env.CRON_SECRET;

/**
 * Saved once and restored after every test. Ten tests below assign
 * `globalThis.fetch`, and Bun runs every file in one process, so without this
 * the mock survives the file and every later test sees it.
 */
const ORIGINAL_FETCH = globalThis.fetch;

function createMockStatsPayload() {
  return {
    User: {
      id: 0,
      name: "user123",
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

function createMockUserRecord(userId: string) {
  const date = new Date();
  date.setDate(date.getDate() - Number(userId));
  return {
    userId,
    username: `user${userId}`,
    stats: createMockStatsPayload(),
    updatedAt: date.toISOString(),
    ip: "127.0.0.1",
    createdAt: date.toISOString(),
  };
}

/**
 * Serves the ten record parts for one user, the way the real client does.
 */
function mockUserParts(userId = "123") {
  const user = createMockUserRecord(userId);
  const parts = splitUserRecord(user as unknown as UserRecord);
  sharedRedisMockMget.mockImplementation(async (...keys: string[]) =>
    keys.map((key) => {
      const [, , part] = key.split(":");
      const value = parts[part as keyof typeof parts];
      return value === undefined ? null : JSON.stringify(value);
    }),
  );
}

function successResponse() {
  return {
    ok: true,
    status: 200,
    json: async () => ({ data: createMockStatsPayload() }),
  };
}

/** Serves a stats payload whose `User.name` is a new handle. */
function renamedResponse(
  payload: ReturnType<typeof createMockStatsPayload>,
  name: string,
) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      data: { ...payload, User: { ...payload.User, name } },
    }),
  };
}

function notFoundResponse() {
  return {
    ok: false,
    status: 404,
    json: async () => ({ error: "User not found" }),
  };
}

function serverErrorResponse() {
  return { ok: false, status: 500, json: async () => ({ error: "boom" }) };
}

function toFetchMock(mockFn: ReturnType<typeof mock>) {
  const fetchMock = mockFn as unknown as typeof fetch;
  fetchMock.preconnect = mock();
  return fetchMock;
}

function consumerRequest(
  body: unknown,
  headers: Record<string, string> = { "x-cron-secret": CRON_SECRET },
) {
  return new Request("http://localhost/api/cron/refresh-user", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("Refresh user consumer route", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = CRON_SECRET;

    sharedRedisMockGet.mockReset();
    sharedRedisMockSet.mockReset();
    sharedRedisMockDel.mockReset();
    sharedRedisMockMget.mockReset();
    sharedRedisMockZrem.mockReset();
    sharedRedisMockPipelineExec.mockReset();

    sharedRedisMockGet.mockResolvedValue(null);
    sharedRedisMockSet.mockResolvedValue("OK");
    sharedRedisMockPipelineExec.mockResolvedValue([]);
    // A default mock per test: paths that never call AniList still assert on
    // `not.toHaveBeenCalled()`, and the real fetch is restored afterwards.
    globalThis.fetch = toFetchMock(mock());
  });

  afterEach(() => {
    mock.clearAllMocks();
    globalThis.fetch = ORIGINAL_FETCH;
    if (ORIGINAL_CRON_SECRET === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = ORIGINAL_CRON_SECRET;
  });

  describe("Authorization", () => {
    it("should reject a request with the wrong secret", async () => {
      const res = await POST(
        consumerRequest({ userId: "123" }, { "x-cron-secret": "nope" }),
      );
      expect(res.status).toBe(401);
      expect(await res.text()).toBe("Unauthorized");
    });

    it("should reject a request with no secret", async () => {
      const res = await POST(consumerRequest({ userId: "123" }, {}));
      expect(res.status).toBe(401);
    });
  });

  describe("Request body validation", () => {
    it("should answer 489 for a body that is not JSON", async () => {
      const res = await POST(consumerRequest("not json"));
      expect(res.status).toBe(489);
      expect(res.headers.get("Upstash-NonRetryable-Error")).toBe("true");
    });

    it("should answer 489 when userId is missing", async () => {
      const res = await POST(consumerRequest({}));
      expect(res.status).toBe(489);
      expect(res.headers.get("Upstash-NonRetryable-Error")).toBe("true");
    });

    it("should answer 489 when userId is not numeric", async () => {
      const res = await POST(consumerRequest({ userId: "abc" }));
      expect(res.status).toBe(489);
      expect(res.headers.get("Upstash-NonRetryable-Error")).toBe("true");
    });

    it("should answer 489 when userId is zero or negative", async () => {
      for (const userId of ["0", "-5"]) {
        const res = await POST(consumerRequest({ userId }));
        expect(res.status).toBe(489);
      }
    });

    it("should accept a numeric userId", async () => {
      mockUserParts();
      globalThis.fetch = toFetchMock(
        mock().mockResolvedValue(successResponse()),
      );

      const res = await POST(consumerRequest({ userId: 123 }));
      expect(res.status).toBe(200);
    });
  });

  describe("Successful refresh", () => {
    it("should save the record and answer 200", async () => {
      mockUserParts();
      globalThis.fetch = toFetchMock(
        mock().mockResolvedValue(successResponse()),
      );

      const res = await POST(consumerRequest({ userId: "123" }));
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.outcome).toBe("updated");

      const metaWrite = (
        sharedRedisMockSet.mock.calls as [string, unknown][]
      ).find(([key]) => key === "user:123:meta");
      expect(metaWrite).toBeDefined();
      expect(JSON.parse(metaWrite![1] as string).updatedAt).toBeTruthy();
    });

    it("should clear the failure counter, the cooldown, and the claim", async () => {
      mockUserParts();
      globalThis.fetch = toFetchMock(
        mock().mockResolvedValue(successResponse()),
      );

      await POST(consumerRequest({ userId: "123" }));
      expect(sharedRedisMockDel).toHaveBeenCalledWith(
        "failed_updates:123",
        "cron:refresh-cooldown:123",
        "cron:refresh-404-claim:123",
      );
    });

    it("should make one AniList request per delivery", async () => {
      // The retry moved to QStash, so a delivery must not retry inline.
      mockUserParts();
      globalThis.fetch = toFetchMock(
        mock().mockResolvedValue(successResponse()),
      );

      await POST(consumerRequest({ userId: "123" }));
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it("should move the username index when AniList reports a new handle", async () => {
      // A rename only shows up here for a user who never saves through the
      // generator, so this is the only place that keeps their index current.
      mockUserParts();
      globalThis.fetch = toFetchMock(
        mock().mockResolvedValue(
          renamedResponse(createMockStatsPayload(), "renamedUser"),
        ),
      );

      const res = await POST(consumerRequest({ userId: "123" }));
      expect(res.status).toBe(200);

      expect(sharedRedisMockSet).toHaveBeenCalledWith(
        "username:renameduser",
        "123",
      );
      expect(sharedRedisMockEval).toHaveBeenCalledWith(
        expect.any(String),
        ["username:user123"],
        ["123"],
      );
    });

    it("should keep the stored username when the index move fails", async () => {
      // The record must not name a handle the index does not point at, or the
      // next refresh sees the two as equal and skips the repair.
      //
      // The shared eval mock is never reset: it carries the store-cards CAS
      // implementation that other files in this one Bun process rely on, so
      // only this call is overridden.
      mockUserParts();
      sharedRedisMockEval.mockRejectedValueOnce(new Error("Redis error"));
      globalThis.fetch = toFetchMock(
        mock().mockResolvedValue(
          renamedResponse(createMockStatsPayload(), "renamedUser"),
        ),
      );

      const res = await POST(consumerRequest({ userId: "123" }));
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.outcome).toBe("updated");
      const metaWrite = sharedRedisMockSet.mock.calls.find(([key]) =>
        String(key).endsWith(":meta"),
      );
      expect(metaWrite).toBeDefined();
      expect(JSON.parse(metaWrite![1] as string).username).toBe("user123");
    });
  });

  describe("Stale records", () => {
    it("should drop the index entry and answer 200 when meta is missing", async () => {
      sharedRedisMockMget.mockImplementation(async () => [null, null]);

      const res = await POST(consumerRequest({ userId: "123" }));
      expect(res.status).toBe(200);
      expect((await res.json()).outcome).toBe("stale-index-entry-removed");
      expect(sharedRedisMockZrem).toHaveBeenCalledWith(
        USER_REFRESH_INDEX_KEY,
        "123",
      );
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });
  });

  describe("AniList 404 handling", () => {
    it("should count the first 404 and answer 200", async () => {
      mockUserParts();
      globalThis.fetch = toFetchMock(
        mock().mockResolvedValue(notFoundResponse()),
      );

      const res = await POST(consumerRequest({ userId: "123" }));
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.outcome).toBe("not-found");
      expect(body.failures).toBe(1);
      expect(sharedRedisMockSet).toHaveBeenCalledWith("failed_updates:123", 1);
    });

    it("should remove the user after the third 404", async () => {
      mockUserParts();
      sharedRedisMockGet.mockImplementation(async (key: string) =>
        key === "failed_updates:123" ? "2" : null,
      );
      globalThis.fetch = toFetchMock(
        mock().mockResolvedValue(notFoundResponse()),
      );

      const res = await POST(consumerRequest({ userId: "123" }));
      expect(res.status).toBe(200);
      expect((await res.json()).outcome).toBe("removed");

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
      expect(sharedRedisMockZrem).toHaveBeenCalledWith(
        USER_REFRESH_INDEX_KEY,
        "123",
      );
    });

    it("should not double count a redelivered 404 inside the cooldown window", async () => {
      // The claim key is claimed with SET NX. A redelivery finds the claim
      // taken and counts nothing, so a duplicate cannot remove a live user.
      mockUserParts();
      sharedRedisMockSet.mockImplementation(
        async (_key: string, _value: unknown, opts?: { nx?: boolean }) =>
          opts?.nx ? null : "OK",
      );
      globalThis.fetch = toFetchMock(
        mock().mockResolvedValue(notFoundResponse()),
      );

      const res = await POST(consumerRequest({ userId: "123" }));
      expect(res.status).toBe(200);
      expect((await res.json()).outcome).toBe("duplicate-delivery");
      expect(sharedRedisMockSet).toHaveBeenCalledWith(
        "cron:refresh-404-claim:123",
        "1",
        { nx: true, ex: 900 },
      );
      expect(sharedRedisMockSet).not.toHaveBeenCalledWith(
        "failed_updates:123",
        expect.anything(),
      );
    });

    it("should still count a 404 after a retryable failure set the cooldown", async () => {
      // The retry cooldown and the 404 claim are separate keys. Sharing one
      // meant a 404 that followed a 5xx was dropped as a duplicate and never
      // counted, which could stall removal indefinitely.
      mockUserParts();
      sharedRedisMockGet.mockImplementation(async (key: string) =>
        key === "cron:refresh-cooldown:123" ? "1" : null,
      );
      globalThis.fetch = toFetchMock(
        mock().mockResolvedValue(notFoundResponse()),
      );

      const res = await POST(consumerRequest({ userId: "123" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.outcome).toBe("not-found");
      expect(body.failures).toBe(1);
      expect(sharedRedisMockSet).toHaveBeenCalledWith("failed_updates:123", 1);
    });
  });

  describe("Retryable failures", () => {
    it("should answer 500 on an AniList 5xx", async () => {
      mockUserParts();
      globalThis.fetch = toFetchMock(
        mock().mockResolvedValue(serverErrorResponse()),
      );

      const res = await POST(consumerRequest({ userId: "123" }));
      expect(res.status).toBe(500);
      expect((await res.json()).outcome).toBe("retryable");
      // No retry inside the delivery, and no 404 counter touched.
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      expect(sharedRedisMockSet).not.toHaveBeenCalledWith(
        "failed_updates:123",
        expect.anything(),
      );
    });

    it("should answer 500 on a network error", async () => {
      mockUserParts();
      globalThis.fetch = toFetchMock(
        mock().mockRejectedValue(new Error("Network error")),
      );

      const res = await POST(consumerRequest({ userId: "123" }));
      expect(res.status).toBe(500);
      expect((await res.json()).outcome).toBe("retryable");
    });

    it("should answer 500 when the stored record cannot be read", async () => {
      sharedRedisMockMget.mockRejectedValueOnce(new Error("Redis error"));

      const res = await POST(consumerRequest({ userId: "123" }));
      expect(res.status).toBe(500);
      expect((await res.json()).outcome).toBe("retryable");
    });

    it("should set the cooldown on a retryable failure", async () => {
      mockUserParts();
      globalThis.fetch = toFetchMock(
        mock().mockResolvedValue(serverErrorResponse()),
      );

      await POST(consumerRequest({ userId: "123" }));
      expect(sharedRedisMockSet).toHaveBeenCalledWith(
        "cron:refresh-cooldown:123",
        "1",
        { ex: 900, nx: true },
      );
    });

    it("should leave a longer in-flight claim in place", async () => {
      // The dispatcher claims the key for 35 minutes so QStash's last retry
      // still lands. A failure must not shorten it to 15 minutes.
      mockUserParts();
      sharedRedisMockSet.mockImplementation(
        async (_key: string, _value: unknown, opts?: { nx?: boolean }) =>
          opts?.nx ? null : "OK",
      );
      globalThis.fetch = toFetchMock(
        mock().mockResolvedValue(serverErrorResponse()),
      );

      await POST(consumerRequest({ userId: "123" }));
      expect(sharedRedisMockSet).toHaveBeenCalledWith(
        "cron:refresh-cooldown:123",
        "1",
        { ex: 900, nx: true },
      );
      // The claim was not taken, so no unconditional write happened either.
      expect(sharedRedisMockSet).not.toHaveBeenCalledWith(
        "cron:refresh-cooldown:123",
        "1",
        { ex: 900 },
      );
    });
  });

  describe("Rejected records", () => {
    it("should answer 200 and set the cooldown when the stored record has an unusable id", async () => {
      // The message carries a valid id, but the stored meta names something
      // else. Nothing a retry can fix, so the outcome is final for this
      // message and the user cools down.
      const user = createMockUserRecord("123");
      const parts = splitUserRecord(user as unknown as UserRecord);
      sharedRedisMockMget.mockImplementation(async (...keys: string[]) =>
        keys.map((key) => {
          const [, , part] = key.split(":");
          if (part === "meta") {
            return JSON.stringify({ ...parts.meta, userId: "not-a-number" });
          }
          const value = parts[part as keyof typeof parts];
          return value === undefined ? null : JSON.stringify(value);
        }),
      );

      const res = await POST(consumerRequest({ userId: "123" }));
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.outcome).toBe("rejected");
      // The body carries a code, not the exception detail: QStash keeps it.
      expect(body.reason).toBe("invalid-stored-user-id");
      expect(sharedRedisMockSet).toHaveBeenCalledWith(
        "cron:refresh-cooldown:123",
        "1",
        { ex: 900, nx: true },
      );
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });
  });
});
