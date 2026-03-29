import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import {
  allowConsoleWarningsAndErrors,
  sharedRedisMockDel,
  sharedRedisMockGet,
  sharedRedisMockLtrim,
  sharedRedisMockMget,
  sharedRedisMockRpush,
  sharedRedisMockSadd,
  sharedRedisMockScan,
  sharedRedisMockSet,
  sharedRedisMockSmembers,
  sharedRedisMockZadd,
  sharedRedisMockZcard,
  sharedRedisMockZrange,
} from "@/tests/unit/__setup__";

const {
  deleteUserRecord,
  fetchUserDataParts,
  listStalestUserIds,
  reconstructUserRecord,
  saveUserRecord,
} = await import("@/lib/server/user-data");

describe("user-data persistence", () => {
  beforeEach(() => {
    allowConsoleWarningsAndErrors();
    sharedRedisMockDel.mockReset();
    sharedRedisMockGet.mockReset();
    sharedRedisMockMget.mockReset();
    sharedRedisMockSet.mockReset();
    sharedRedisMockRpush.mockReset();
    sharedRedisMockLtrim.mockReset();
    sharedRedisMockSadd.mockReset();
    sharedRedisMockScan.mockReset();
    sharedRedisMockZadd.mockReset();
    sharedRedisMockZcard.mockReset();
    sharedRedisMockZrange.mockReset();
    sharedRedisMockGet.mockResolvedValue(null);
    sharedRedisMockScan.mockResolvedValue([0, []]);
    sharedRedisMockSmembers.mockResolvedValue([]);
    sharedRedisMockZadd.mockResolvedValue(1);
    sharedRedisMockZcard.mockResolvedValue(0);
    sharedRedisMockZrange.mockResolvedValue([]);
    sharedRedisMockMget.mockImplementation(async (...keys: string[]) =>
      keys.map(() => null),
    );
  });

  afterEach(() => {
    mock.clearAllMocks();
  });

  it("writes split user parts to stable keys", async () => {
    await saveUserRecord({
      userId: "5",
      username: "UserFive",
      createdAt: "2026-03-27T00:00:00.000Z",
      updatedAt: "2026-03-27T00:00:01.000Z",
      stats: { score: 5 } as never,
    });

    expect(sharedRedisMockSet).toHaveBeenCalledWith(
      "user:5:meta",
      expect.any(String),
    );
    expect(sharedRedisMockSet).toHaveBeenCalledWith(
      "user:5:activity",
      expect.any(String),
    );
    expect(sharedRedisMockSadd).toHaveBeenCalledWith("users:known-ids", "5");
    expect(sharedRedisMockSadd).toHaveBeenCalledWith(
      "user:5:username-aliases",
      "userfive",
    );

    const userScopedSetKeys = sharedRedisMockSet.mock.calls
      .map((call) => String(call[0]))
      .filter((key) => key.startsWith("user:5:"))
      .sort();

    expect(userScopedSetKeys).toEqual([
      "user:5:activity",
      "user:5:commit",
      "user:5:completed",
      "user:5:current",
      "user:5:favourites",
      "user:5:meta",
      "user:5:pages",
      "user:5:planning",
      "user:5:rewatched",
      "user:5:statistics",
    ]);

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
      action: "save",
      triggerSource: "user_data_save",
      userId: "5",
    });
  });

  it("treats missing stable part keys as corrupt even when the commit pointer exists", async () => {
    sharedRedisMockGet.mockImplementation((key: string) => {
      if (key === "user:9:commit") {
        return Promise.resolve(
          JSON.stringify({
            userId: "9",
            storageFormat: "split-user-v2",
            schemaVersion: 2,
            revision: 3,
            createdAt: "2026-03-27T00:00:00.000Z",
            updatedAt: "2026-03-27T00:00:01.000Z",
            committedAt: "2026-03-27T00:00:02.000Z",
          }),
        );
      }

      return Promise.resolve(null);
    });

    sharedRedisMockMget.mockImplementation(async (...keys: string[]) => {
      expect(keys).toEqual(["user:9:meta", "user:9:activity"]);
      return [null, null];
    });

    let error: unknown;
    try {
      await fetchUserDataParts("9", ["meta", "activity"]);
    } catch (error_) {
      error = error_;
    }

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(
      "Stored split user record is incomplete",
    );
    expect(sharedRedisMockMget).toHaveBeenCalledTimes(1);
  });

  it("avoids duplicate legacy migration saves when another reader already holds the migration lock", async () => {
    const legacyRecord = {
      userId: "13",
      username: "UserThirteen",
      createdAt: "2026-03-27T00:00:00.000Z",
      updatedAt: "2026-03-27T00:00:01.000Z",
      stats: {
        User: {
          stats: { activityHistory: [] },
          favourites: {
            anime: { nodes: [] },
            manga: { nodes: [] },
            characters: { nodes: [] },
            staff: { nodes: [] },
            studios: { nodes: [] },
          },
          statistics: { anime: {}, manga: {} },
        },
        followersPage: { pageInfo: { total: 0 }, followers: [] },
        followingPage: { pageInfo: { total: 0 }, following: [] },
        threadsPage: { pageInfo: { total: 0 }, threads: [] },
        threadCommentsPage: { pageInfo: { total: 0 }, threadComments: [] },
        reviewsPage: { pageInfo: { total: 0 }, reviews: [] },
      },
    } as const;

    sharedRedisMockGet.mockImplementation((key: string) => {
      if (key === "user:13") {
        return Promise.resolve(JSON.stringify(legacyRecord));
      }

      if (key === "user:13:migrating") {
        return Promise.resolve("another-reader");
      }

      return Promise.resolve(null);
    });
    sharedRedisMockSet.mockImplementation((key: string) => {
      if (key === "user:13:migrating") {
        return Promise.resolve(null);
      }

      return Promise.resolve(true);
    });

    const parts = await fetchUserDataParts("13", ["meta", "activity"]);

    expect(parts.meta).toMatchObject({
      userId: "13",
      username: "UserThirteen",
    });
    expect(parts.activity).toMatchObject({ activityHistory: [] });
    expect(sharedRedisMockSet).toHaveBeenCalledWith(
      "user:13:migrating",
      expect.any(String),
      {
        ex: 30,
        nx: true,
      },
    );
    expect(
      sharedRedisMockSet.mock.calls.some(
        ([key]) =>
          String(key).startsWith("user:13:") && key !== "user:13:migrating",
      ),
    ).toBe(false);
    expect(sharedRedisMockDel).not.toHaveBeenCalledWith("user:13:migrating");

    const auditEntry = JSON.parse(
      String(sharedRedisMockRpush.mock.calls.at(-1)?.[1]),
    );
    expect(auditEntry).toMatchObject({
      action: "access",
      triggerSource: "user_data_fetch",
      userId: "13",
    });
  });

  it("skips duplicate split rewrites when the legacy migration lock is already held", async () => {
    sharedRedisMockGet.mockImplementation((key: string) => {
      if (key === "user:14:migrating") {
        return Promise.resolve("another-reader");
      }

      return Promise.resolve(null);
    });
    sharedRedisMockSet.mockImplementation((key: string) => {
      if (key === "user:14:migrating") {
        return Promise.resolve(null);
      }

      return Promise.resolve(true);
    });
    sharedRedisMockMget.mockImplementation(async (...keys: string[]) => {
      expect(keys).toEqual([
        "user:14:meta",
        "user:14:activity",
        "user:14:favourites",
        "user:14:statistics",
        "user:14:pages",
        "user:14:planning",
        "user:14:current",
        "user:14:rewatched",
        "user:14:completed",
        "user:14:aggregates",
      ]);

      return [
        JSON.stringify({
          userId: "14",
          username: "UserFourteen",
          createdAt: "2026-03-27T00:00:00.000Z",
          updatedAt: "2026-03-27T00:00:01.000Z",
        }),
        JSON.stringify({ activityHistory: [] }),
        JSON.stringify({
          anime: { nodes: [] },
          manga: { nodes: [] },
          characters: { nodes: [] },
          staff: { nodes: [] },
          studios: { nodes: [] },
        }),
        JSON.stringify({ anime: {}, manga: {} }),
        JSON.stringify({
          followersPage: { pageInfo: { total: 0 }, followers: [] },
          followingPage: { pageInfo: { total: 0 }, following: [] },
          threadsPage: { pageInfo: { total: 0 }, threads: [] },
          threadCommentsPage: { pageInfo: { total: 0 }, threadComments: [] },
          reviewsPage: { pageInfo: { total: 0 }, reviews: [] },
        }),
        JSON.stringify({}),
        JSON.stringify({}),
        JSON.stringify({}),
        JSON.stringify({}),
        null,
      ];
    });

    const parts = await fetchUserDataParts("14", [
      "meta",
      "activity",
      "favourites",
      "statistics",
      "pages",
      "planning",
      "current",
      "rewatched",
      "completed",
      "aggregates",
    ]);

    expect(parts.meta).toMatchObject({
      userId: "14",
      username: "UserFourteen",
    });
    expect(sharedRedisMockSet).toHaveBeenCalledWith(
      "user:14:migrating",
      expect.any(String),
      {
        ex: 30,
        nx: true,
      },
    );
    expect(
      sharedRedisMockSet.mock.calls.some(
        ([key]) =>
          String(key).startsWith("user:14:") && key !== "user:14:migrating",
      ),
    ).toBe(false);
    expect(sharedRedisMockDel).not.toHaveBeenCalledWith("user:14:migrating");
  });

  it("rewrites legacy raw IP data into request metadata without resurfacing ip", async () => {
    sharedRedisMockGet.mockImplementation((key: string) => {
      if (key === "user:11:commit") {
        return Promise.resolve(
          JSON.stringify({
            userId: "11",
            storageFormat: "split-user-v2",
            schemaVersion: 2,
            revision: 1,
            createdAt: "2026-03-27T00:00:00.000Z",
            updatedAt: "2026-03-27T00:00:01.000Z",
            committedAt: "2026-03-27T00:00:02.000Z",
          }),
        );
      }

      return Promise.resolve(null);
    });

    sharedRedisMockMget.mockImplementation(async (...keys: string[]) => {
      expect(keys).toEqual([
        "user:11:meta",
        "user:11:activity",
        "user:11:favourites",
        "user:11:statistics",
        "user:11:pages",
        "user:11:planning",
        "user:11:current",
        "user:11:rewatched",
        "user:11:completed",
        "user:11:aggregates",
      ]);

      return [
        JSON.stringify({
          userId: "11",
          username: "UserEleven",
          createdAt: "2026-03-27T00:00:00.000Z",
          updatedAt: "2026-03-27T00:00:01.000Z",
          ip: "127.0.0.1",
        }),
        JSON.stringify({ activityHistory: [] }),
        JSON.stringify({
          anime: { nodes: [] },
          manga: { nodes: [] },
          characters: { nodes: [] },
          staff: { nodes: [] },
          studios: { nodes: [] },
        }),
        JSON.stringify({ anime: {}, manga: {} }),
        JSON.stringify({
          followersPage: { pageInfo: { total: 0 }, followers: [] },
          followingPage: { pageInfo: { total: 0 }, following: [] },
          threadsPage: { pageInfo: { total: 0 }, threads: [] },
          threadCommentsPage: { pageInfo: { total: 0 }, threadComments: [] },
          reviewsPage: { pageInfo: { total: 0 }, reviews: [] },
        }),
        JSON.stringify({}),
        JSON.stringify({}),
        JSON.stringify({}),
        JSON.stringify({}),
        null,
      ];
    });

    const parts = await fetchUserDataParts("11", [
      "meta",
      "activity",
      "favourites",
      "statistics",
      "pages",
      "planning",
      "current",
      "rewatched",
      "completed",
      "aggregates",
    ]);

    const reconstructed = reconstructUserRecord(parts);
    expect(reconstructed.requestMetadata).toEqual({
      lastSeenIpBucket: "loopback",
    });
    expect(reconstructed).not.toHaveProperty("ip");

    const auditEntry = JSON.parse(
      String(sharedRedisMockRpush.mock.calls.at(-1)?.[1]),
    );
    expect(auditEntry).toMatchObject({
      action: "access",
      triggerSource: "user_data_fetch",
      userId: "11",
    });
  });

  it("records bounded delete audit events", async () => {
    sharedRedisMockSmembers.mockResolvedValueOnce(["user-five"]);

    await deleteUserRecord("5");

    expect(sharedRedisMockScan).not.toHaveBeenCalled();

    const auditEntry = JSON.parse(
      String(sharedRedisMockRpush.mock.calls.at(-1)?.[1]),
    );
    expect(auditEntry).toMatchObject({
      action: "delete",
      triggerSource: "user_data_delete",
      userId: "5",
    });
    expect(sharedRedisMockLtrim).toHaveBeenCalledWith(
      "telemetry:user-lifecycle-audit:v1",
      -250,
      -1,
    );
  });

  it("deletes the persisted normalized username index when alias tracking is missing", async () => {
    sharedRedisMockGet.mockImplementation((key: string) => {
      if (key === "user:5:commit") {
        return Promise.resolve(
          JSON.stringify({
            userId: "5",
            storageFormat: "split-user-v2",
            schemaVersion: 2,
            revision: 3,
            createdAt: "2026-03-27T00:00:00.000Z",
            updatedAt: "2026-03-27T00:00:01.000Z",
            username: "UserFive",
            usernameNormalized: "userfive",
            committedAt: "2026-03-27T00:00:02.000Z",
          }),
        );
      }

      return Promise.resolve(null);
    });

    await deleteUserRecord("5");

    expect(sharedRedisMockSmembers).toHaveBeenCalledWith(
      "user:5:username-aliases",
    );
    expect(sharedRedisMockDel).toHaveBeenCalledWith(
      "user:5:meta",
      "user:5:activity",
      "user:5:favourites",
      "user:5:statistics",
      "user:5:pages",
      "user:5:planning",
      "user:5:current",
      "user:5:rewatched",
      "user:5:completed",
      "user:5:aggregates",
      "user:5:commit",
      "user:5:username-aliases",
      "user:5",
      "cards:5",
      "failed_updates:5",
      "username:userfive",
    );
    expect(sharedRedisMockScan).not.toHaveBeenCalled();
  });

  it("rebuilds the stale-user index from tracked user ids without a global scan", async () => {
    sharedRedisMockSmembers.mockResolvedValueOnce(["9", "5"]);
    sharedRedisMockGet.mockImplementation((key: string) => {
      if (key === "user:5:commit") {
        return Promise.resolve(
          JSON.stringify({
            userId: "5",
            storageFormat: "split-user-v2",
            schemaVersion: 2,
            revision: 2,
            createdAt: "2026-03-27T00:00:00.000Z",
            updatedAt: "2026-03-27T00:00:05.000Z",
            committedAt: "2026-03-27T00:00:06.000Z",
          }),
        );
      }

      if (key === "user:9:commit") {
        return Promise.resolve(
          JSON.stringify({
            userId: "9",
            storageFormat: "split-user-v2",
            schemaVersion: 2,
            revision: 4,
            createdAt: "2026-03-27T00:00:00.000Z",
            updatedAt: "2026-03-27T00:00:09.000Z",
            committedAt: "2026-03-27T00:00:10.000Z",
          }),
        );
      }

      return Promise.resolve(null);
    });
    sharedRedisMockZrange.mockResolvedValueOnce(["5"]);

    const result = await listStalestUserIds(1);

    expect(result).toEqual({ userIds: ["5"], totalUsers: 2 });
    expect(sharedRedisMockSmembers).toHaveBeenCalledWith("users:known-ids");
    expect(sharedRedisMockScan).not.toHaveBeenCalled();
    expect(sharedRedisMockZadd).toHaveBeenCalledWith(
      "users:stale-by-updated-at",
      expect.objectContaining({ member: "5", score: expect.any(Number) }),
    );
    expect(sharedRedisMockZadd).toHaveBeenCalledWith(
      "users:stale-by-updated-at",
      expect.objectContaining({ member: "9", score: expect.any(Number) }),
    );
  });
});
