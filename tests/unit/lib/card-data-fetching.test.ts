import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import { fetchUserData } from "@/lib/card-data/fetching";
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
        return Promise.resolve(
          JSON.stringify({
            userId: "42",
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

    userDeferred.resolve([
      JSON.stringify({
        userId: "42",
        username: "test-user",
        createdAt: "2026-03-27T00:00:00.000Z",
        updatedAt: "2026-03-27T00:00:01.000Z",
      }),
      JSON.stringify({ anime: {}, manga: {} }),
    ]);
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
});
