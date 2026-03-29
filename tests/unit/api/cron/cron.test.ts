/**
 * Regression coverage for the scheduled user refresh job.
 * The helpers below make retry and removal branches explicit so the suite can
 * focus on batching decisions and failure bookkeeping instead of fetch ceremony.
 */

import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import {
  allowConsoleWarningsAndErrors,
  sharedRedisMockDel,
  sharedRedisMockGet,
  sharedRedisMockLtrim,
  sharedRedisMockMget,
  sharedRedisMockPipelineExec,
  sharedRedisMockRpush,
  sharedRedisMockSadd,
  sharedRedisMockSet,
  sharedRedisMockSmembers,
  sharedRedisMockSrem,
  sharedRedisMockZadd,
  sharedRedisMockZcard,
  sharedRedisMockZrange,
} from "@/tests/unit/__setup__";

const { POST } = await import("@/app/api/cron/route");

const CRON_SECRET = "testsecret";

function createCronRequest(secret: string | null = CRON_SECRET): Request {
  return new Request("http://localhost/api/cron", {
    headers: secret ? { "x-cron-secret": secret } : {},
  });
}

function createMockUserRecord(userId: string, daysOld = 0) {
  const date = new Date();
  date.setDate(date.getDate() - daysOld);
  return {
    userId,
    username: `user${userId}`,
    stats: { existing: true },
    updatedAt: date.toISOString(),
    createdAt: date.toISOString(),
  };
}

function createStoredSplitUser(userId: string, daysOld = 0) {
  const record = createMockUserRecord(userId, daysOld);
  return {
    meta: {
      userId,
      username: record.username,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    },
    activity: {
      activityHistory: [],
    },
    favourites: {
      anime: { nodes: [] },
      manga: { nodes: [] },
      characters: { nodes: [] },
      staff: { nodes: [] },
      studios: { nodes: [] },
    },
    statistics: {
      anime: {},
      manga: {},
    },
    pages: {
      followersPage: { pageInfo: { total: 0 }, followers: [] },
      followingPage: { pageInfo: { total: 0 }, following: [] },
      threadsPage: { pageInfo: { total: 0 }, threads: [] },
      threadCommentsPage: { pageInfo: { total: 0 }, threadComments: [] },
      reviewsPage: { pageInfo: { total: 0 }, reviews: [] },
    },
    planning: {},
    current: {},
    rewatched: {},
    completed: {},
  };
}

function mockStaleUserIndex(userIds: string[], totalUsers = userIds.length) {
  sharedRedisMockZcard.mockResolvedValueOnce(totalUsers);
  sharedRedisMockZrange.mockResolvedValueOnce(userIds);
}

function createValidStatsPayload(userId: string) {
  return {
    User: {
      id: Number(userId),
      name: `user${userId}`,
      statistics: {
        anime: {},
        manga: {},
      },
      stats: {
        activityHistory: [],
      },
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
    userReviews: { reviews: [] },
    userRecommendations: { recommendations: [] },
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

function mockUserRecords(
  userIds: string[],
  daysOldById?: Record<string, number>,
) {
  const staleOrderedUserIds = [...userIds].sort(
    (left, right) => (daysOldById?.[right] ?? 0) - (daysOldById?.[left] ?? 0),
  );
  mockStaleUserIndex(staleOrderedUserIds.slice(0, 5), userIds.length);
  sharedRedisMockGet.mockImplementation((key: string) => {
    if (key.startsWith("failed_updates:")) {
      return Promise.resolve(null);
    }

    const commitMatch = /^user:(\d+):commit$/.exec(key);
    if (commitMatch) {
      return Promise.resolve(null);
    }

    const metaMatch = /^user:(\d+):meta$/.exec(key);
    if (metaMatch) {
      const id = metaMatch[1];
      return Promise.resolve(
        JSON.stringify(createStoredSplitUser(id, daysOldById?.[id] ?? 0).meta),
      );
    }

    const legacyMatch = /^user:(\d+)$/.exec(key);
    if (legacyMatch) {
      const id = legacyMatch[1];
      return Promise.resolve(
        JSON.stringify(createMockUserRecord(id, daysOldById?.[id] ?? 0)),
      );
    }

    return Promise.resolve(null);
  });
  sharedRedisMockMget.mockImplementation(async (...keys: string[]) =>
    keys.map((key) => {
      if (key.startsWith("username:")) {
        return null;
      }

      const match = /^user:(\d+):([^:]+)$/.exec(key);
      if (!match) {
        return null;
      }

      const [, id, part] = match;
      const splitUser = createStoredSplitUser(id, daysOldById?.[id] ?? 0);
      const value = splitUser[part as keyof typeof splitUser];
      return value === undefined ? null : JSON.stringify(value);
    }),
  );
}

function createJsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function createDeferredPromise<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

async function expectApiErrorResponse(
  response: Response,
  expectedStatus: number,
  expectedError: string,
) {
  expect(response.status).toBe(expectedStatus);
  expect(response.headers.get("Content-Type")).toContain("application/json");

  const body = (await response.json()) as {
    error: string;
    status: number;
    category: string;
    retryable: boolean;
    recoverySuggestions: unknown[];
  };

  expect(body).toMatchObject({
    error: expectedError,
    status: expectedStatus,
    category: expect.any(String),
    retryable: expect.any(Boolean),
    recoverySuggestions: expect.any(Array),
  });
}

async function flushMicrotasks(iterations = 6) {
  for (let index = 0; index < iterations; index += 1) {
    await Promise.resolve();
  }
}

describe("Cron API Route", () => {
  beforeEach(() => {
    allowConsoleWarningsAndErrors();
    process.env = {
      ...process.env,
      CRON_SECRET,
      NODE_ENV: "test",
    };
    delete process.env.ALLOW_UNSECURED_CRON_IN_DEV;
    sharedRedisMockGet.mockReset();
    sharedRedisMockMget.mockReset();
    sharedRedisMockPipelineExec.mockReset();
    sharedRedisMockSet.mockReset();
    sharedRedisMockDel.mockReset();
    sharedRedisMockRpush.mockReset();
    sharedRedisMockLtrim.mockReset();
    sharedRedisMockSadd.mockReset();
    sharedRedisMockSmembers.mockReset();
    sharedRedisMockSrem.mockReset();
    sharedRedisMockZadd.mockReset();
    sharedRedisMockZcard.mockReset();
    sharedRedisMockZrange.mockReset();
    sharedRedisMockMget.mockImplementation(async (...keys: string[]) =>
      keys.map(() => null),
    );
    sharedRedisMockPipelineExec.mockResolvedValue([]);
    sharedRedisMockSmembers.mockResolvedValue([]);
    sharedRedisMockZadd.mockResolvedValue(1);
    sharedRedisMockZcard.mockResolvedValue(0);
    sharedRedisMockZrange.mockResolvedValue([]);
  });

  afterEach(() => {
    mock.clearAllMocks();
    delete process.env.CRON_SECRET;
    delete process.env.ALLOW_UNSECURED_CRON_IN_DEV;
  });

  it("rejects invalid or missing cron secrets", async () => {
    await expectApiErrorResponse(
      await POST(createCronRequest("wrongsecret")),
      401,
      "Unauthorized",
    );
    await expectApiErrorResponse(
      await POST(createCronRequest(null)),
      401,
      "Unauthorized",
    );
  });

  it("fails closed when CRON_SECRET is missing unless explicitly allowed in development", async () => {
    delete process.env.CRON_SECRET;
    const closedResponse = await POST(createCronRequest(null));
    await expectApiErrorResponse(
      closedResponse,
      503,
      "CRON_SECRET is not configured",
    );

    process.env = { ...process.env, NODE_ENV: "development" };
    process.env.ALLOW_UNSECURED_CRON_IN_DEV = "true";
    sharedRedisMockSmembers.mockResolvedValueOnce([]);
    const bypassResponse = await POST(createCronRequest(null));
    expect(bypassResponse.status).toBe(200);
  });

  it("returns an operator summary when there are no users", async () => {
    sharedRedisMockSmembers.mockResolvedValueOnce([]);

    const response = await POST(createCronRequest());
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain(
      "Updated 0/0 users successfully. Failed: 0, Removed: 0",
    );
    expect(text).toContain("Recommended schedules to refresh all 0 users");
  });

  it("echoes X-Request-Id on cron responses", async () => {
    sharedRedisMockSmembers.mockResolvedValueOnce([]);

    const response = await POST(
      new Request("http://localhost/api/cron", {
        headers: {
          "x-cron-secret": CRON_SECRET,
          "x-request-id": "req-cron-12345",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Request-Id")).toBe("req-cron-12345");
    expect(response.headers.get("Access-Control-Expose-Headers")).toContain(
      "X-Request-Id",
    );
  });

  it("updates only the 5 oldest users in a batch and persists refreshed data", async () => {
    const userIds = Array.from({ length: 15 }, (_, index) => String(index + 1));
    mockUserRecords(
      userIds,
      Object.fromEntries(userIds.map((id) => [id, Number(id)])),
    );

    globalThis.fetch = mock((url: RequestInfo, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      return Promise.resolve(
        createJsonResponse(200, {
          data: createValidStatsPayload(String(body.variables.userId)),
        }),
      );
    }) as unknown as typeof fetch;

    const response = await POST(createCronRequest());
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).toContain(
      "Updated 5/5 users successfully. Failed: 0, Removed: 0",
    );
    expect(text).toContain("Update 5 users/run: 0 */8 * * *");
    expect(text).toContain("Update 10 users/run: 0 */12 * * *");
    expect(globalThis.fetch).toHaveBeenCalledTimes(5);
    expect(sharedRedisMockSet).toHaveBeenCalledWith(
      "user:15:activity",
      expect.any(String),
    );
    expect(sharedRedisMockDel).toHaveBeenCalledWith("failed_updates:15");
    expect(sharedRedisMockZrange).toHaveBeenCalledWith(
      "users:stale-by-updated-at",
      0,
      4,
    );
  });

  it("loads only meta before AniList resolves and defers the remaining split parts until success", async () => {
    mockUserRecords(["123"]);
    const deferredResponse = createDeferredPromise<Response>();

    globalThis.fetch = mock(
      () => deferredResponse.promise,
    ) as unknown as typeof fetch;

    const responsePromise = POST(createCronRequest());

    await flushMicrotasks();

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(sharedRedisMockMget).toHaveBeenCalledTimes(1);
    expect(sharedRedisMockMget.mock.calls[0]).toEqual(["user:123:meta"]);

    deferredResponse.resolve(
      createJsonResponse(200, { data: createValidStatsPayload("123") }),
    );

    const response = await responsePromise;

    expect(response.status).toBe(200);
    expect(sharedRedisMockMget).toHaveBeenCalledTimes(2);
    expect(sharedRedisMockMget.mock.calls[1]).toEqual([
      "user:123:activity",
      "user:123:favourites",
      "user:123:statistics",
      "user:123:pages",
      "user:123:planning",
      "user:123:current",
      "user:123:rewatched",
      "user:123:completed",
      "user:123:aggregates",
    ]);
  });

  it("aborts the overlapping AniList refresh when bootstrap metadata loading fails", async () => {
    mockUserRecords(["123"]);
    let fetchSignal: AbortSignal | undefined;

    globalThis.fetch = mock(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          fetchSignal = init?.signal ?? undefined;
          fetchSignal?.addEventListener(
            "abort",
            () => {
              reject(
                fetchSignal?.reason ??
                  new DOMException("Aborted", "AbortError"),
              );
            },
            { once: true },
          );
        }),
    ) as unknown as typeof fetch;

    sharedRedisMockMget.mockRejectedValueOnce(new Error("Part fetch exploded"));

    const response = await POST(createCronRequest());

    expect(response.status).toBe(200);
    expect(await response.text()).toContain(
      "Updated 0/1 users successfully. Failed: 0, Removed: 0",
    );
    expect(fetchSignal?.aborted).toBe(true);
    expect(sharedRedisMockRpush).toHaveBeenCalledWith(
      "telemetry:error-reports:v1",
      expect.any(String),
    );
  });

  it("tracks 404 failures and removes users on the third consecutive miss", async () => {
    mockUserRecords(["123"]);
    sharedRedisMockSmembers.mockImplementation(async (...args: unknown[]) => {
      const key = String(args[0] ?? "");
      if (key === "user:123:username-aliases") {
        return ["user123", "old-user123"];
      }

      return [];
    });
    sharedRedisMockGet.mockImplementation((key: string) => {
      if (key === "failed_updates:123") {
        return Promise.resolve("2");
      }

      const commitMatch = /^user:(\d+):commit$/.exec(key);
      if (commitMatch) {
        return Promise.resolve(null);
      }

      const metaMatch = /^user:(\d+):meta$/.exec(key);
      if (metaMatch) {
        return Promise.resolve(
          JSON.stringify(createStoredSplitUser(metaMatch[1]).meta),
        );
      }

      const legacyMatch = /^user:(\d+)$/.exec(key);
      if (legacyMatch) {
        return Promise.resolve(
          JSON.stringify(createMockUserRecord(legacyMatch[1])),
        );
      }

      return Promise.resolve(null);
    });
    sharedRedisMockMget.mockImplementation(async (...keys: string[]) => {
      return keys.map((key) => {
        const match = /^user:(\d+):([^:]+)$/.exec(key);
        if (!match) {
          return null;
        }

        const [, id, part] = match;
        const splitUser = createStoredSplitUser(id);
        const value = splitUser[part as keyof typeof splitUser];
        return value === undefined ? null : JSON.stringify(value);
      });
    });
    globalThis.fetch = mock(() =>
      Promise.resolve(createJsonResponse(404, { error: "User not found" })),
    ) as unknown as typeof fetch;

    const response = await POST(createCronRequest());
    const text = await response.text();

    expect(response.status).toBe(200);
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
      "user:123:commit",
      "user:123:username-aliases",
      "user:123",
      "cards:123",
      "failed_updates:123",
      "username:user123",
      "username:old-user123",
    );

    const auditEntry = JSON.parse(
      String(sharedRedisMockRpush.mock.calls.at(-1)?.[1]),
    );
    expect(sharedRedisMockRpush).toHaveBeenCalledWith(
      "telemetry:user-lifecycle-audit:v1",
      expect.any(String),
    );
    expect(sharedRedisMockLtrim).toHaveBeenCalledWith(
      "telemetry:user-lifecycle-audit:v1",
      -250,
      -1,
    );
    expect(auditEntry).toMatchObject({
      action: "delete",
      triggerSource: "cron_cleanup_404",
      userId: "123",
    });
  });

  it("stores repeated 404 counters with a sliding TTL window before deletion threshold", async () => {
    mockUserRecords(["123"]);
    sharedRedisMockGet.mockImplementation((key: string) => {
      if (key === "failed_updates:123") {
        return Promise.resolve("1");
      }

      const commitMatch = /^user:(\d+):commit$/.exec(key);
      if (commitMatch) {
        return Promise.resolve(null);
      }

      const metaMatch = /^user:(\d+):meta$/.exec(key);
      if (metaMatch) {
        return Promise.resolve(
          JSON.stringify(createStoredSplitUser(metaMatch[1]).meta),
        );
      }

      const legacyMatch = /^user:(\d+)$/.exec(key);
      if (legacyMatch) {
        return Promise.resolve(
          JSON.stringify(createMockUserRecord(legacyMatch[1])),
        );
      }

      return Promise.resolve(null);
    });
    globalThis.fetch = mock(() =>
      Promise.resolve(createJsonResponse(404, { error: "User not found" })),
    ) as unknown as typeof fetch;

    const response = await POST(createCronRequest());

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Failed: 1, Removed: 0");
    expect(sharedRedisMockSet).toHaveBeenCalledWith("failed_updates:123", 2, {
      ex: 14 * 24 * 60 * 60,
    });
  });

  it("retries transient transport failures and succeeds on a later attempt", async () => {
    mockUserRecords(["123"]);
    let attempts = 0;
    globalThis.fetch = mock(() => {
      attempts += 1;
      if (attempts < 3) {
        return Promise.reject(new Error("Network error"));
      }
      return Promise.resolve(
        createJsonResponse(200, { data: createValidStatsPayload("123") }),
      );
    }) as unknown as typeof fetch;

    const response = await POST(createCronRequest());
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Updated 1/1 users successfully");
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });

  it("does not count transport failures as 404 removals", async () => {
    mockUserRecords(["123"]);
    globalThis.fetch = mock(() =>
      Promise.reject(new Error("Network error")),
    ) as unknown as typeof fetch;

    const response = await POST(createCronRequest());
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).toContain(
      "Updated 0/1 users successfully. Failed: 0, Removed: 0",
    );
    expect(sharedRedisMockSet).not.toHaveBeenCalledWith(
      "failed_updates:123",
      expect.anything(),
    );
  });

  it("records structured per-user cron errors without aborting the whole job", async () => {
    mockUserRecords(["123"]);
    sharedRedisMockMget.mockRejectedValueOnce(new Error("Part fetch exploded"));

    const response = await POST(
      new Request("http://localhost/api/cron", {
        headers: {
          "x-cron-secret": CRON_SECRET,
          "x-request-id": "req-cron-user-error",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toContain(
      "Updated 0/1 users successfully. Failed: 0, Removed: 0",
    );

    expect(sharedRedisMockRpush).toHaveBeenCalledWith(
      "telemetry:error-reports:v1",
      expect.any(String),
    );
    expect(sharedRedisMockLtrim).toHaveBeenCalledWith(
      "telemetry:error-reports:v1",
      -250,
      -1,
    );

    const serializedReport = sharedRedisMockRpush.mock.calls.at(-1)?.[1];
    const payload = JSON.parse(String(serializedReport)) as {
      metadata?: Record<string, unknown>;
      route?: string;
      source?: string;
      technicalMessage?: string;
      userAction?: string;
    };

    expect(payload.userAction).toBe("cron_refresh_user");
    expect(payload.source).toBe("api_route");
    expect(payload.route).toBe("/api/cron");
    expect(payload.technicalMessage).toBe("Part fetch exploded");
    expect(payload.metadata).toMatchObject({
      endpoint: "cron_job",
      requestId: "req-cron-user-error",
      stage: "fetch_user_data_parts",
      userId: "123",
    });
  });

  it("returns 500 when Redis scanning or metadata loading fails critically", async () => {
    sharedRedisMockSmembers.mockRejectedValueOnce(
      new Error("Redis connection error"),
    );
    const scanFailure = await POST(createCronRequest());
    await expectApiErrorResponse(scanFailure, 500, "Cron job failed");

    sharedRedisMockSmembers.mockResolvedValueOnce(["123"]);
    sharedRedisMockGet.mockRejectedValueOnce(new Error("Redis error"));
    const getFailure = await POST(createCronRequest());
    await expectApiErrorResponse(getFailure, 500, "Cron job failed");
  });
});
