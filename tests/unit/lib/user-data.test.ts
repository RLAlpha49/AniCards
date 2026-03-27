import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import {
  allowConsoleWarningsAndErrors,
  sharedRedisMockGet,
  sharedRedisMockMget,
  sharedRedisMockSet,
} from "@/tests/unit/__setup__";

const { fetchUserDataParts, saveUserRecord } =
  await import("@/lib/server/user-data");

describe("user-data persistence", () => {
  beforeEach(() => {
    allowConsoleWarningsAndErrors();
    sharedRedisMockGet.mockReset();
    sharedRedisMockMget.mockReset();
    sharedRedisMockSet.mockReset();
    sharedRedisMockGet.mockResolvedValue(null);
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
});
