import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import {
  fetchUserData,
  fetchUserDataForCard,
  resolveUserIdFromUsername,
} from "@/lib/card-data/fetching";
import { CardDataError } from "@/lib/card-data/validation";
import {
  allowConsoleWarningsAndErrors,
  sharedRedisMockGet,
  sharedRedisMockIncr,
  sharedRedisMockMget,
} from "@/tests/unit/__setup__";

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return { promise, resolve, reject };
}

async function flushMicrotasks(iterations = 6) {
  for (let index = 0; index < iterations; index += 1) {
    await Promise.resolve();
  }
}

function createSplitCommit(userId: string) {
  return JSON.stringify({
    userId,
    storageFormat: "split-user-v2",
    schemaVersion: 2,
    revision: 3,
    createdAt: "2026-03-27T00:00:00.000Z",
    updatedAt: "2026-03-27T00:00:01.000Z",
    committedAt: "2026-03-27T00:00:02.000Z",
  });
}

function createMetaPart(userId: string) {
  return JSON.stringify({
    userId,
    username: "test-user",
    createdAt: "2026-03-27T00:00:00.000Z",
    updatedAt: "2026-03-27T00:00:01.000Z",
  });
}

function createStatisticsPart() {
  return JSON.stringify({
    anime: { count: 1 },
    manga: { count: 0 },
  });
}

describe("card-data fetchUserData", () => {
  beforeEach(() => {
    allowConsoleWarningsAndErrors();
    sharedRedisMockGet.mockReset();
    sharedRedisMockIncr.mockReset();
    sharedRedisMockMget.mockReset();
    sharedRedisMockIncr.mockResolvedValue(1);
    sharedRedisMockGet.mockImplementation(() => Promise.resolve(null));
    sharedRedisMockMget.mockImplementation(async (...keys: string[]) =>
      keys.map(() => null),
    );
  });

  afterEach(() => {
    mock.clearAllMocks();
  });

  it("starts card and user reads together before either one resolves", async () => {
    const cardsDeferred = createDeferred<string | null>();
    const userDeferred = createDeferred<Array<string | null>>();

    sharedRedisMockGet.mockImplementation((key: string) => {
      if (key === "cards:42") {
        return cardsDeferred.promise;
      }

      if (key === "user:42:commit") {
        return Promise.resolve(createSplitCommit("42"));
      }

      return Promise.resolve(null);
    });
    sharedRedisMockMget.mockImplementation(async (...keys: string[]) => {
      expect(keys).toEqual(["user:42:meta", "user:42:statistics"]);
      return userDeferred.promise;
    });

    const fetchPromise = fetchUserData(42, "animeStats");
    let resolved = false;
    void fetchPromise.then(() => {
      resolved = true;
    });

    await flushMicrotasks();

    expect(sharedRedisMockGet).toHaveBeenCalledWith("cards:42");
    expect(sharedRedisMockMget).toHaveBeenCalledWith(
      "user:42:meta",
      "user:42:statistics",
    );
    expect(resolved).toBe(false);

    userDeferred.resolve([createMetaPart("42"), createStatisticsPart()]);
    await Promise.resolve();

    expect(resolved).toBe(false);

    cardsDeferred.resolve(
      JSON.stringify({
        userId: 42,
        updatedAt: "2026-03-27T00:00:03.000Z",
        cards: [],
      }),
    );

    const result = await fetchPromise;

    expect(result.cardDoc).toEqual({
      userId: 42,
      updatedAt: "2026-03-27T00:00:03.000Z",
      cards: [],
    });
    expect(result.userDoc).toMatchObject({ userId: "42" });
  });

  it("preserves card-read error precedence even when the user read also fails", async () => {
    sharedRedisMockGet.mockRejectedValueOnce(
      new Error("Redis connection failed"),
    );
    sharedRedisMockMget.mockRejectedValueOnce(new Error("Redis mget failure"));

    let error: unknown;
    try {
      await fetchUserData(42, "animeStats");
    } catch (error_) {
      error = error_;
    }

    expect(error).toBeInstanceOf(CardDataError);
    expect((error as CardDataError).message).toBe(
      "Server Error: Card data is temporarily unavailable",
    );
    expect((error as CardDataError).status).toBe(503);
    expect(sharedRedisMockIncr).not.toHaveBeenCalled();
  });

  it("increments corrupted-card analytics when the stored card document is invalid JSON", async () => {
    sharedRedisMockGet.mockImplementation((key: string) => {
      if (key === "cards:42") {
        return Promise.resolve("{not-json");
      }

      if (key === "user:42:commit") {
        return Promise.resolve(createSplitCommit("42"));
      }

      return Promise.resolve(null);
    });
    sharedRedisMockMget.mockResolvedValueOnce([
      createMetaPart("42"),
      createStatisticsPart(),
    ]);

    let error: unknown;
    try {
      await fetchUserData(42, "animeStats");
    } catch (error_) {
      error = error_;
    }

    expect(error).toBeInstanceOf(CardDataError);
    expect((error as CardDataError).message).toBe(
      "Server Error: Corrupted card configuration",
    );
    expect((error as CardDataError).status).toBe(500);
    expect(sharedRedisMockIncr).toHaveBeenCalledWith(
      "analytics:card_svg:corrupted_card_records",
    );
  });
});

describe("card-data fetchUserDataForCard", () => {
  beforeEach(() => {
    allowConsoleWarningsAndErrors();
    sharedRedisMockGet.mockReset();
    sharedRedisMockIncr.mockReset();
    sharedRedisMockMget.mockReset();
    sharedRedisMockIncr.mockResolvedValue(1);
    sharedRedisMockGet.mockImplementation(() => Promise.resolve(null));
    sharedRedisMockMget.mockImplementation(async (...keys: string[]) =>
      keys.map(() => null),
    );
  });

  afterEach(() => {
    mock.clearAllMocks();
  });

  it("loads only the parts required for a card and reconstructs the user record", async () => {
    sharedRedisMockGet.mockImplementation((key: string) => {
      if (key === "user:42:commit") {
        return Promise.resolve(createSplitCommit("42"));
      }

      return Promise.resolve(null);
    });
    sharedRedisMockMget.mockImplementation(async (...keys: string[]) => {
      expect(keys).toEqual(["user:42:meta", "user:42:statistics"]);
      return [createMetaPart("42"), createStatisticsPart()];
    });

    const userDoc = await fetchUserDataForCard(42, "animeStats");

    expect(userDoc).toMatchObject({
      userId: "42",
      username: "test-user",
      stats: {
        User: {
          statistics: {
            anime: { count: 1 },
            manga: { count: 0 },
          },
        },
      },
    });
  });

  it("returns a 503 when the user-data backplane is unavailable", async () => {
    sharedRedisMockGet.mockRejectedValueOnce(
      new Error("Redis connection failed"),
    );

    let error: unknown;
    try {
      await fetchUserDataForCard(42, "animeStats");
    } catch (error_) {
      error = error_;
    }

    expect(error).toBeInstanceOf(CardDataError);
    expect((error as CardDataError).message).toBe(
      "Server Error: User data is temporarily unavailable",
    );
    expect((error as CardDataError).status).toBe(503);
  });
});

describe("card-data resolveUserIdFromUsername", () => {
  beforeEach(() => {
    allowConsoleWarningsAndErrors();
    sharedRedisMockGet.mockReset();
    sharedRedisMockGet.mockImplementation(() => Promise.resolve(null));
  });

  afterEach(() => {
    mock.clearAllMocks();
  });

  it("normalizes usernames before looking up the username index", async () => {
    sharedRedisMockGet.mockResolvedValueOnce("42");

    const userId = await resolveUserIdFromUsername("  Test-User  ");

    expect(sharedRedisMockGet).toHaveBeenCalledWith("username:test-user");
    expect(userId).toBe(42);

    const consoleLogCalls = (
      console.log as unknown as {
        mock: {
          calls: Array<[string]>;
        };
      }
    ).mock.calls;

    expect(consoleLogCalls).toHaveLength(2);

    const searchLog = JSON.parse(String(consoleLogCalls[0]?.[0])) as {
      message?: string;
      context?: {
        username?: string;
      };
    };
    const resolvedLog = JSON.parse(String(consoleLogCalls[1]?.[0])) as {
      message?: string;
      context?: {
        username?: string;
        userId?: string;
      };
    };

    expect(searchLog.message).toBe("Searching username index");
    expect(searchLog.context?.username).toBe("te***(9)");
    expect(resolvedLog.message).toBe("Resolved lookup by username");
    expect(resolvedLog.context?.username).toBe("te***(9)");
    expect(resolvedLog.context?.userId).toBe("id:***42");
    expect(JSON.stringify([searchLog, resolvedLog])).not.toContain("test-user");
  });

  it("returns null for missing or non-numeric username index entries", async () => {
    sharedRedisMockGet.mockResolvedValueOnce(null);
    expect(await resolveUserIdFromUsername("unknown-user")).toBeNull();

    sharedRedisMockGet.mockResolvedValueOnce("not-a-number");
    expect(await resolveUserIdFromUsername("broken-user")).toBeNull();
  });
});
