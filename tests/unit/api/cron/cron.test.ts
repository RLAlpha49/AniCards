/**
 * Regression coverage for the scheduled user refresh job.
 * The helpers below make retry and removal branches explicit so the suite can
 * focus on batching decisions and failure bookkeeping instead of fetch ceremony.
 */

import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import {
  sharedRedisMockDel,
  sharedRedisMockGet,
  sharedRedisMockMget,
  sharedRedisMockPipelineExec,
  sharedRedisMockScan,
  sharedRedisMockSet,
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
  sharedRedisMockScan.mockResolvedValueOnce([
    0,
    userIds.map((id) => `user:${id}`),
  ]);
  sharedRedisMockGet.mockImplementation((key: string) => {
    if (key.startsWith("failed_updates:")) {
      return Promise.resolve(null);
    }
    const id = key.split(":")[1];
    return Promise.resolve(
      JSON.stringify(createMockUserRecord(id, daysOldById?.[id] ?? 0)),
    );
  });
}

function createJsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Cron API Route", () => {
  beforeEach(() => {
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
    sharedRedisMockScan.mockReset();
    sharedRedisMockMget.mockImplementation(async (...keys: string[]) =>
      keys.map(() => null),
    );
    sharedRedisMockPipelineExec.mockResolvedValue([]);
  });

  afterEach(() => {
    mock.clearAllMocks();
    delete process.env.CRON_SECRET;
    delete process.env.ALLOW_UNSECURED_CRON_IN_DEV;
  });

  it("rejects invalid or missing cron secrets", async () => {
    expect((await POST(createCronRequest("wrongsecret"))).status).toBe(401);
    expect((await POST(createCronRequest(null))).status).toBe(401);
  });

  it("fails closed when CRON_SECRET is missing unless explicitly allowed in development", async () => {
    delete process.env.CRON_SECRET;
    const closedResponse = await POST(createCronRequest(null));
    expect(closedResponse.status).toBe(503);
    expect(await closedResponse.text()).toBe("CRON_SECRET is not configured");

    process.env = { ...process.env, NODE_ENV: "development" };
    process.env.ALLOW_UNSECURED_CRON_IN_DEV = "true";
    sharedRedisMockScan.mockResolvedValueOnce([0, []]);
    const bypassResponse = await POST(createCronRequest(null));
    expect(bypassResponse.status).toBe(200);
  });

  it("returns an operator summary when there are no users", async () => {
    sharedRedisMockScan.mockResolvedValueOnce([0, []]);

    const response = await POST(createCronRequest());
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain(
      "Updated 0/0 users successfully. Failed: 0, Removed: 0",
    );
    expect(text).toContain("Recommended schedules to refresh all 0 users");
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
  });

  it("tracks 404 failures and removes users on the third consecutive miss", async () => {
    mockUserRecords(["123"]);
    sharedRedisMockScan.mockResolvedValueOnce([
      0,
      ["username:user123", "username:old-user123"],
    ]);
    sharedRedisMockMget
      .mockImplementationOnce(async (...keys: string[]) => keys.map(() => null))
      .mockImplementationOnce(async (...keys: string[]) =>
        keys.map(() => "123"),
      );
    sharedRedisMockGet.mockImplementation((key: string) => {
      if (key === "failed_updates:123") {
        return Promise.resolve("2");
      }
      const id = key.split(":")[1];
      return Promise.resolve(JSON.stringify(createMockUserRecord(id)));
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
      "user:123",
      "cards:123",
      "failed_updates:123",
      "username:user123",
      "username:old-user123",
    );
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

  it("returns 500 when Redis scanning or metadata loading fails critically", async () => {
    sharedRedisMockScan.mockRejectedValueOnce(
      new Error("Redis connection error"),
    );
    const scanFailure = await POST(createCronRequest());
    expect(scanFailure.status).toBe(500);
    expect(await scanFailure.text()).toBe("Cron job failed");

    sharedRedisMockScan.mockResolvedValueOnce([0, ["user:123"]]);
    sharedRedisMockGet.mockRejectedValueOnce(new Error("Redis error"));
    const getFailure = await POST(createCronRequest());
    expect(getFailure.status).toBe(500);
    expect(await getFailure.text()).toBe("Cron job failed");
  });
});
