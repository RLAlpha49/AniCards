import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import {
  allowConsoleWarningsAndErrors,
  sharedRedisMockGet,
  sharedRedisMockLtrim,
  sharedRedisMockMget,
  sharedRedisMockRpush,
  sharedRedisMockScan,
  sharedRedisMockSet,
} from "@/tests/unit/__setup__";

const {
  deleteUserRecord,
  fetchUserDataParts,
  reconstructUserRecord,
  saveUserRecord,
} = await import("@/lib/server/user-data");

describe("user-data persistence", () => {
  beforeEach(() => {
    allowConsoleWarningsAndErrors();
    sharedRedisMockGet.mockReset();
    sharedRedisMockMget.mockReset();
    sharedRedisMockSet.mockReset();
    sharedRedisMockRpush.mockReset();
    sharedRedisMockLtrim.mockReset();
    sharedRedisMockScan.mockReset();
    sharedRedisMockGet.mockResolvedValue(null);
    sharedRedisMockScan.mockResolvedValue([0, []]);
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
    sharedRedisMockScan.mockResolvedValueOnce([0, ["username:user-five"]]);
    sharedRedisMockMget.mockImplementation(async (...keys: string[]) =>
      keys.map(() =>
        keys.every((key) => key.startsWith("username:")) ? "5" : null,
      ),
    );

    await deleteUserRecord("5");

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
});
