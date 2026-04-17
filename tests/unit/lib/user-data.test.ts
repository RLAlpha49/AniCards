import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import { flushScheduledTelemetryTasksForTests } from "@/lib/api/telemetry";
import type { PersistedUserRecord } from "@/lib/types/records";
import {
  allowConsoleWarningsAndErrors,
  getStringValue,
  installStatefulRedisEvalHarness,
  sharedRedisMockDel,
  sharedRedisMockEval,
  sharedRedisMockGet,
  sharedRedisMockLrange,
  sharedRedisMockLtrim,
  sharedRedisMockMget,
  sharedRedisMockRpush,
  sharedRedisMockSadd,
  sharedRedisMockScan,
  sharedRedisMockSet,
  sharedRedisMockSmembers,
  sharedRedisMockSrem,
  sharedRedisMockZadd,
  sharedRedisMockZcard,
  sharedRedisMockZrange,
  sharedRedisMockZrem,
} from "@/tests/unit/__setup__";

const {
  USER_RECORD_SCHEMA_VERSION,
  deleteUserRecord,
  fetchUserDataParts,
  getPersistedUserState,
  listPublicUserProfileSitemapEntries,
  listStalestUserIds,
  recordManualPrivacyRightsAuditEvent,
  reconstructPublicUserRecord,
  reconstructUserBootstrapRecord,
  reconstructUserRecord,
  saveUserRecord,
  splitUserRecord,
  UserDataIntegrityError,
  UserRecordUsernameConflictError,
} = await import("@/lib/server/user-data");

const compareAlphabetically = (left: string, right: string) =>
  left.localeCompare(right);

function createPersistedUserRecord(
  overrides: Partial<
    Pick<
      PersistedUserRecord,
      "userId" | "username" | "createdAt" | "updatedAt" | "requestMetadata"
    >
  > = {},
): PersistedUserRecord {
  const userId = overrides.userId ?? "21";
  const username = overrides.username ?? "RoundTripUser";

  return {
    userId,
    username,
    createdAt: overrides.createdAt ?? "2026-03-27T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-03-27T00:00:01.000Z",
    requestMetadata: overrides.requestMetadata ?? {
      lastSeenIpBucket: "loopback",
    },
    aggregates: {
      animeSourceMaterialDistributionTotals: [{ source: "MANGA", count: 1 }],
    },
    stats: {
      User: {
        stats: {
          activityHistory: [{ date: 1_700_000_000, amount: 2 }],
        },
        favourites: {
          anime: {
            nodes: [
              {
                id: 1,
                title: { romaji: "Example Anime" },
                coverImage: { medium: "https://example.com/anime.webp" },
              },
            ],
          },
          manga: { nodes: [] },
          characters: { nodes: [] },
          staff: { nodes: [] },
          studios: { nodes: [] },
        },
        statistics: {
          anime: {
            count: 1,
            episodesWatched: 12,
            minutesWatched: 288,
            meanScore: 85,
            standardDeviation: 0,
            genres: [{ genre: "Action", count: 1 }],
            tags: [],
            voiceActors: [],
            studios: [],
            staff: [],
          },
          manga: {
            count: 1,
            chaptersRead: 10,
            volumesRead: 2,
            meanScore: 80,
            standardDeviation: 0,
            genres: [{ genre: "Drama", count: 1 }],
            tags: [],
            staff: [],
          },
        },
        name: "Round Trip User",
        avatar: {
          medium: "https://example.com/avatar-medium.webp",
          large: "https://example.com/avatar-large.webp",
        },
        createdAt: 1_700_000_000,
      },
      followersPage: { pageInfo: { total: 1 }, followers: [{ id: 2 }] },
      followingPage: { pageInfo: { total: 1 }, following: [{ id: 3 }] },
      threadsPage: { pageInfo: { total: 1 }, threads: [{ id: 4 }] },
      threadCommentsPage: {
        pageInfo: { total: 1 },
        threadComments: [{ id: 5 }],
      },
      reviewsPage: { pageInfo: { total: 1 }, reviews: [{ id: 6 }] },
      animePlanning: {
        lists: [
          {
            name: "Planning",
            entries: [
              {
                id: 7,
                progress: 0,
                media: {
                  id: 70,
                  title: { romaji: "Planned Anime" },
                },
              },
            ],
          },
        ],
      },
      animeCurrent: {
        lists: [
          {
            name: "Current",
            entries: [
              {
                id: 8,
                progress: 3,
                media: {
                  id: 80,
                  title: { romaji: "Current Anime" },
                  episodes: 12,
                },
              },
            ],
          },
        ],
      },
      animeRewatched: {
        lists: [
          {
            name: "Rewatched",
            entries: [
              {
                id: 9,
                repeat: 1,
                media: {
                  id: 90,
                  title: { romaji: "Rewatched Anime" },
                },
              },
            ],
          },
        ],
      },
      animeCompleted: {
        lists: [
          {
            name: "Completed",
            entries: [
              {
                id: 10,
                score: 90,
                media: {
                  id: 100,
                  title: { romaji: "Completed Anime" },
                  genres: ["Action"],
                },
              },
            ],
          },
        ],
      },
      animeDropped: {
        lists: [
          {
            name: "Dropped",
            entries: [
              {
                id: 11,
                progress: 2,
                media: {
                  id: 110,
                  title: { romaji: "Dropped Anime" },
                },
              },
            ],
          },
        ],
      },
      mangaPlanning: { lists: [] },
      mangaCurrent: { lists: [] },
      mangaReread: { lists: [] },
      mangaCompleted: { lists: [] },
      mangaDropped: { lists: [] },
    },
  };
}

function createCommitPointer(options: {
  userId: string;
  revision?: number;
  username?: string;
  usernameNormalized?: string;
  createdAt?: string;
  updatedAt?: string;
}) {
  return JSON.stringify({
    userId: options.userId,
    storageFormat: "split-user-v2",
    schemaVersion: USER_RECORD_SCHEMA_VERSION,
    revision: options.revision ?? 1,
    createdAt: options.createdAt ?? "2026-03-27T00:00:00.000Z",
    updatedAt: options.updatedAt ?? "2026-03-27T00:00:01.000Z",
    ...(options.username ? { username: options.username } : {}),
    ...(options.usernameNormalized
      ? { usernameNormalized: options.usernameNormalized }
      : {}),
    committedAt: "2026-03-27T00:00:02.000Z",
  });
}

describe("user-data persistence", () => {
  beforeEach(() => {
    allowConsoleWarningsAndErrors();
    installStatefulRedisEvalHarness();
    sharedRedisMockDel.mockReset();
    sharedRedisMockGet.mockReset();
    sharedRedisMockLrange.mockReset();
    sharedRedisMockMget.mockReset();
    sharedRedisMockSet.mockReset();
    sharedRedisMockRpush.mockReset();
    sharedRedisMockLtrim.mockReset();
    sharedRedisMockSadd.mockReset();
    sharedRedisMockSmembers.mockReset();
    sharedRedisMockSrem.mockReset();
    sharedRedisMockScan.mockReset();
    sharedRedisMockZadd.mockReset();
    sharedRedisMockZcard.mockReset();
    sharedRedisMockZrange.mockReset();
    sharedRedisMockZrem.mockReset();
    sharedRedisMockGet.mockResolvedValue(null);
    sharedRedisMockLrange.mockResolvedValue([]);
    sharedRedisMockScan.mockResolvedValue([0, []]);
    sharedRedisMockSmembers.mockResolvedValue([]);
    sharedRedisMockSrem.mockResolvedValue(1);
    sharedRedisMockZadd.mockResolvedValue(1);
    sharedRedisMockZcard.mockResolvedValue(0);
    sharedRedisMockZrange.mockResolvedValue([]);
    sharedRedisMockZrem.mockResolvedValue(1);
    sharedRedisMockMget.mockImplementation(async (...keys: string[]) =>
      keys.map(() => null),
    );
  });

  afterEach(async () => {
    await flushScheduledTelemetryTasksForTests();
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
      .filter((key) => key.startsWith("user:5:") && !key.includes(":snapshot:"))
      .sort(compareAlphabetically);

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

  it("throws a username conflict error when the canonical alias is already owned by another user", async () => {
    sharedRedisMockEval.mockResolvedValueOnce([2, "88"]);

    let error: unknown;
    try {
      await saveUserRecord(
        createPersistedUserRecord({
          userId: "5",
          username: "TakenName",
        }),
      );
    } catch (error_) {
      error = error_;
    }

    expect(error).toBeInstanceOf(UserRecordUsernameConflictError);
    const usernameConflictError = error as InstanceType<
      typeof UserRecordUsernameConflictError
    >;
    expect(usernameConflictError.conflictingUserId).toBe("88");
  });

  it("roundtrips split records back into the persisted user shape", () => {
    const record = createPersistedUserRecord();

    const split = splitUserRecord(record);

    expect(split.meta).toMatchObject({
      userId: "21",
      username: "RoundTripUser",
      requestMetadata: { lastSeenIpBucket: "loopback" },
      name: "Round Trip User",
    });
    expect(split.current).toMatchObject({
      animeCurrent: {
        lists: [
          {
            entries: [
              {
                id: 8,
              },
            ],
          },
        ],
      },
    });
    expect(split.completed).toMatchObject({
      animeCompleted: {
        lists: [
          {
            entries: [
              {
                id: 10,
              },
            ],
          },
        ],
      },
      animeDropped: {
        lists: [
          {
            entries: [
              {
                id: 11,
              },
            ],
          },
        ],
      },
    });

    const reconstructed = reconstructUserRecord(split);

    expect(reconstructed).toMatchObject({
      userId: "21",
      username: "RoundTripUser",
      requestMetadata: { lastSeenIpBucket: "loopback" },
      statistics: {
        anime: { count: 1 },
        manga: { count: 1 },
      },
      favourites: {
        anime: {
          nodes: [{ id: 1 }],
        },
      },
      pages: {
        followersPage: {
          pageInfo: { total: 1 },
        },
      },
      aggregates: {
        animeSourceMaterialDistributionTotals: [{ source: "MANGA", count: 1 }],
      },
    });
    expect(reconstructed.stats).toMatchObject({
      User: {
        name: "Round Trip User",
        avatar: { medium: "https://example.com/avatar-medium.webp" },
        createdAt: 1_700_000_000,
      },
      animeCurrent: {
        lists: [
          {
            entries: [{ id: 8 }],
          },
        ],
      },
      animeCompleted: {
        lists: [
          {
            entries: [{ id: 10 }],
          },
        ],
      },
    });
    expect(reconstructed).not.toHaveProperty("ip");
  });

  it("builds bounded public and bootstrap DTOs from split records", () => {
    const split = splitUserRecord(createPersistedUserRecord());

    const publicRecord = reconstructPublicUserRecord(split);
    const bootstrapRecord = reconstructUserBootstrapRecord({
      meta: split.meta,
    });

    expect(publicRecord).toMatchObject({
      userId: 21,
      username: "RoundTripUser",
      stats: {
        User: {
          name: "Round Trip User",
        },
      },
      aggregates: {
        animeSourceMaterialDistributionTotals: [{ source: "MANGA", count: 1 }],
      },
    });
    expect(bootstrapRecord).toEqual({
      userId: 21,
      username: "RoundTripUser",
      avatarUrl: "https://example.com/avatar-medium.webp",
    });
  });

  it("strips snapshot timestamps from public record metadata while preserving the stable identifier", () => {
    const split = splitUserRecord(createPersistedUserRecord());

    const publicRecord = reconstructPublicUserRecord(split, {
      state: {
        userId: "21",
        storageFormat: "split",
        schemaVersion: USER_RECORD_SCHEMA_VERSION,
        revision: 3,
        createdAt: "2026-03-27T00:00:00.000Z",
        updatedAt: "2026-03-27T00:00:01.000Z",
        committedAt: "2026-03-27T00:00:02.000Z",
        username: "RoundTripUser",
        normalizedUsername: "roundtripuser",
        snapshot: {
          token: "snapshot-21-3",
          revision: 3,
          updatedAt: "2026-03-27T00:00:01.000Z",
          committedAt: "2026-03-27T00:00:02.000Z",
        },
      },
    });
    const bootstrapRecord = reconstructUserBootstrapRecord(
      { meta: split.meta },
      {
        state: {
          userId: "21",
          storageFormat: "split",
          schemaVersion: USER_RECORD_SCHEMA_VERSION,
          revision: 3,
          createdAt: "2026-03-27T00:00:00.000Z",
          updatedAt: "2026-03-27T00:00:01.000Z",
          committedAt: "2026-03-27T00:00:02.000Z",
          username: "RoundTripUser",
          normalizedUsername: "roundtripuser",
          snapshot: {
            token: "snapshot-21-3",
            revision: 3,
            updatedAt: "2026-03-27T00:00:01.000Z",
            committedAt: "2026-03-27T00:00:02.000Z",
          },
        },
      },
    );

    expect(publicRecord.recordMeta).toMatchObject({
      storageFormat: "committed-split",
      schemaVersion: USER_RECORD_SCHEMA_VERSION,
      snapshot: {
        token: "snapshot-21-3",
        revision: 3,
      },
    });
    expect(publicRecord.recordMeta?.snapshot).not.toHaveProperty("updatedAt");
    expect(publicRecord.recordMeta?.snapshot).not.toHaveProperty("committedAt");
    expect(bootstrapRecord.recordMeta?.snapshot).toEqual({
      token: "snapshot-21-3",
      revision: 3,
    });
  });

  it("prefers the commit pointer when loading persisted split state", async () => {
    sharedRedisMockGet.mockImplementation((key: string) => {
      if (key === "user:22:commit") {
        return Promise.resolve(
          createCommitPointer({
            userId: "22",
            revision: 4,
            username: "StateUser",
            usernameNormalized: "stateuser",
          }),
        );
      }

      return Promise.resolve(null);
    });

    const state = await getPersistedUserState("22");

    expect(state).toEqual({
      committedAt: "2026-03-27T00:00:02.000Z",
      userId: "22",
      storageFormat: "split",
      schemaVersion: USER_RECORD_SCHEMA_VERSION,
      revision: 4,
      createdAt: "2026-03-27T00:00:00.000Z",
      updatedAt: "2026-03-27T00:00:01.000Z",
      username: "StateUser",
      normalizedUsername: "stateuser",
    });
    expect(sharedRedisMockGet.mock.calls).toEqual([["user:22:commit"]]);
  });

  it("falls back to the legacy raw record when no split state exists", async () => {
    const legacyRecord = createPersistedUserRecord({
      userId: "23",
      username: "LegacyUser",
    });

    sharedRedisMockGet.mockImplementation((key: string) => {
      if (key === "user:23") {
        return Promise.resolve(JSON.stringify(legacyRecord));
      }

      return Promise.resolve(null);
    });

    const state = await getPersistedUserState("23");

    expect(state).toEqual({
      userId: "23",
      storageFormat: "legacy",
      schemaVersion: 1,
      revision: 0,
      createdAt: "2026-03-27T00:00:00.000Z",
      updatedAt: "2026-03-27T00:00:01.000Z",
      username: "LegacyUser",
      normalizedUsername: "legacyuser",
    });
    expect(sharedRedisMockGet).toHaveBeenCalledWith("user:23:commit");
    expect(sharedRedisMockGet).toHaveBeenCalledWith("user:23:meta");
    expect(sharedRedisMockGet).toHaveBeenCalledWith("user:23");
  });

  it("cleans up stale username aliases when saving a renamed user", async () => {
    sharedRedisMockSmembers.mockResolvedValueOnce(["oldname", "legacy-name"]);

    await saveUserRecord(
      createPersistedUserRecord({ userId: "24", username: "NewName" }),
      {
        existingState: {
          userId: "24",
          storageFormat: "split",
          schemaVersion: USER_RECORD_SCHEMA_VERSION,
          revision: 3,
          createdAt: "2026-03-27T00:00:00.000Z",
          updatedAt: "2026-03-27T00:00:01.000Z",
          username: "OldName",
          normalizedUsername: "oldname",
        },
      },
    );

    expect(sharedRedisMockSadd).toHaveBeenCalledWith(
      "user:24:username-aliases",
      "oldname",
      "legacy-name",
      "newname",
    );
    expect(sharedRedisMockSet).toHaveBeenCalledWith("username:newname", "24");
    expect(sharedRedisMockDel).toHaveBeenCalledWith(
      "username:oldname",
      "username:legacy-name",
    );
    expect(sharedRedisMockScan).not.toHaveBeenCalled();
  });

  it("surfaces invalid committed split JSON as a UserDataIntegrityError", async () => {
    sharedRedisMockGet.mockImplementation((key: string) => {
      if (key === "user:25:commit") {
        return Promise.resolve(
          createCommitPointer({ userId: "25", revision: 2 }),
        );
      }

      return Promise.resolve(null);
    });
    sharedRedisMockMget.mockResolvedValueOnce([
      JSON.stringify({
        userId: "25",
        username: "CorruptUser",
        createdAt: "2026-03-27T00:00:00.000Z",
        updatedAt: "2026-03-27T00:00:01.000Z",
      }),
      "[object Object]",
    ]);

    let error: unknown;
    try {
      await fetchUserDataParts("25", ["meta", "activity"]);
    } catch (error_) {
      error = error_;
    }

    expect(error).toBeInstanceOf(UserDataIntegrityError);
    const integrityError = error as InstanceType<typeof UserDataIntegrityError>;
    expect(integrityError.message).toBe(
      "Stored user payload is not valid JSON",
    );
    expect(integrityError.publicMessage).toBe(
      "Stored user record is incomplete or corrupted",
    );
  });

  it("migrates legacy records to split storage when it wins the migration lock", async () => {
    const legacyRecord = createPersistedUserRecord({
      userId: "26",
      username: "MigratingUser",
    });
    let migrationToken: string | null = null;

    sharedRedisMockGet.mockImplementation((key: string) => {
      if (key === "user:26") {
        return Promise.resolve(JSON.stringify(legacyRecord));
      }

      if (key === "user:26:migrating") {
        return Promise.resolve(migrationToken);
      }

      return Promise.resolve(null);
    });
    sharedRedisMockSet.mockImplementation((key: string, value: unknown) => {
      if (key === "user:26:migrating") {
        migrationToken = String(value);
        return Promise.resolve("OK");
      }

      return Promise.resolve(true);
    });

    const parts = await fetchUserDataParts("26", ["meta", "activity"]);

    expect(parts.meta).toMatchObject({
      userId: "26",
      username: "MigratingUser",
    });
    expect(parts.activity).toMatchObject({
      activityHistory: [{ date: 1_700_000_000, amount: 2 }],
    });
    expect(migrationToken).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(sharedRedisMockSet).toHaveBeenCalledWith(
      "user:26:migrating",
      expect.any(String),
      {
        ex: 30,
        nx: true,
      },
    );
    expect(sharedRedisMockSet).toHaveBeenCalledWith(
      "user:26:meta",
      expect.any(String),
    );
    expect(sharedRedisMockSet).toHaveBeenCalledWith(
      "user:26:commit",
      expect.any(String),
    );
    expect(sharedRedisMockDel).toHaveBeenCalledWith("user:26");
    expect(sharedRedisMockDel).toHaveBeenCalledWith("user:26:migrating");
  });

  it("treats missing committed snapshot part keys as corrupt when the commit pointer exists", async () => {
    sharedRedisMockGet.mockImplementation((key: string) => {
      if (key === "user:9:commit") {
        return Promise.resolve(
          JSON.stringify({
            userId: "9",
            storageFormat: "split-user-v2",
            readShape: "committed-user-snapshot-v1",
            schemaVersion: 2,
            revision: 3,
            createdAt: "2026-03-27T00:00:00.000Z",
            updatedAt: "2026-03-27T00:00:01.000Z",
            committedAt: "2026-03-27T00:00:02.000Z",
            snapshotToken: "snapshot-9",
            snapshotKeyPrefix: "user:9:snapshot:snapshot-9",
          }),
        );
      }

      return Promise.resolve(null);
    });

    sharedRedisMockMget.mockImplementation(async (...keys: string[]) => {
      expect(keys).toEqual([
        "user:9:snapshot:snapshot-9:meta",
        "user:9:snapshot:snapshot-9:activity",
      ]);
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

    await flushScheduledTelemetryTasksForTests();

    const auditEntry = JSON.parse(
      String(sharedRedisMockRpush.mock.calls.at(-1)?.[1]),
    );
    expect(auditEntry).toMatchObject({
      action: "access",
      triggerSource: "user_data_fetch",
      userId: "13",
    });
  });

  it("skips access audit writes when hot-path reads disable auditing", async () => {
    sharedRedisMockGet.mockImplementation((key: string) => {
      if (key === "user:27:commit") {
        return Promise.resolve(
          createCommitPointer({
            userId: "27",
            revision: 2,
            username: "HotPathUser",
            usernameNormalized: "hotpathuser",
          }),
        );
      }

      return Promise.resolve(null);
    });
    sharedRedisMockMget.mockResolvedValueOnce([
      JSON.stringify({
        userId: "27",
        username: "HotPathUser",
        createdAt: "2026-03-27T00:00:00.000Z",
        updatedAt: "2026-03-27T00:00:01.000Z",
      }),
      JSON.stringify({ activityHistory: [] }),
    ]);

    const parts = await fetchUserDataParts("27", ["meta", "activity"], {
      audit: false,
    });

    await flushScheduledTelemetryTasksForTests();

    expect(parts.meta).toMatchObject({
      userId: "27",
      username: "HotPathUser",
    });
    expect(sharedRedisMockRpush).not.toHaveBeenCalled();
    expect(sharedRedisMockLtrim).not.toHaveBeenCalled();
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

    await flushScheduledTelemetryTasksForTests();

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

  it("records manual privacy-rights intake and fulfillment audit events", async () => {
    await recordManualPrivacyRightsAuditEvent({
      userId: "55",
      requestType: "delete",
      stage: "intake",
    });
    await recordManualPrivacyRightsAuditEvent({
      userId: "55",
      requestType: "delete",
      stage: "fulfillment",
    });

    const auditCalls = sharedRedisMockRpush.mock.calls.filter(
      ([key]) => key === "telemetry:user-lifecycle-audit:v1",
    );

    expect(auditCalls).toHaveLength(2);
    expect(JSON.parse(String(auditCalls[0]?.[1]))).toMatchObject({
      action: "privacy_request_intake",
      triggerSource: "privacy_request_delete",
      userId: "55",
    });
    expect(JSON.parse(String(auditCalls[1]?.[1]))).toMatchObject({
      action: "privacy_request_fulfillment",
      triggerSource: "privacy_request_delete",
      userId: "55",
    });
  });

  it("prunes expired lifecycle audit entries before appending the next event", async () => {
    const now = Date.now();

    sharedRedisMockLrange.mockResolvedValueOnce([
      JSON.stringify({
        action: "save",
        timestamp: new Date(now - 120_000).toISOString(),
        expiresAt: new Date(now - 1).toISOString(),
        triggerSource: "user_data_save",
        userId: "old-user",
      }),
      JSON.stringify({
        action: "access",
        timestamp: new Date(now - 1_000).toISOString(),
        expiresAt: new Date(now + 60_000).toISOString(),
        triggerSource: "user_data_fetch",
        userId: "recent-user",
      }),
    ]);

    await deleteUserRecord("5");

    const auditCalls = sharedRedisMockRpush.mock.calls.filter(
      ([key]) => key === "telemetry:user-lifecycle-audit:v1",
    );

    expect(sharedRedisMockDel).toHaveBeenCalledWith(
      "telemetry:user-lifecycle-audit:v1",
    );
    expect(auditCalls).toHaveLength(2);
    expect(JSON.parse(String(auditCalls[0]?.[1]))).toMatchObject({
      action: "access",
      userId: "recent-user",
    });
    expect(JSON.parse(String(auditCalls.at(-1)?.[1]))).toMatchObject({
      action: "delete",
      triggerSource: "user_data_delete",
      userId: "5",
    });
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

      if (key === "username:userfive") {
        return Promise.resolve("5");
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
      "cards:5:meta",
      "failed_updates:5",
      "username:userfive",
    );
    expect(sharedRedisMockScan).not.toHaveBeenCalled();
  });

  it("only removes username aliases that still belong to the deleted user", async () => {
    sharedRedisMockSmembers.mockResolvedValueOnce(["userfive", "shared-alias"]);
    sharedRedisMockGet.mockImplementation((key: string) => {
      if (key === "username:userfive") {
        return Promise.resolve("5");
      }

      if (key === "username:shared-alias") {
        return Promise.resolve("99");
      }

      return Promise.resolve(null);
    });

    const result = await deleteUserRecord("5");
    const deletedKeys = (sharedRedisMockDel.mock.calls.at(-1) ?? []).map(
      String,
    );

    expect(result.usernameIndexKeys).toEqual(["username:userfive"]);
    expect(deletedKeys).toContain("username:userfive");
    expect(deletedKeys).not.toContain("username:shared-alias");
    expect(sharedRedisMockSrem).toHaveBeenCalledWith("users:known-ids", "5");
    expect(sharedRedisMockZrem).toHaveBeenCalledWith(
      "users:stale-by-updated-at",
      "5",
    );
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

  it("incrementally repairs missing stale-user index members when the registry outgrows the sorted set", async () => {
    sharedRedisMockSmembers.mockImplementation(async (...args: unknown[]) => {
      const key = getStringValue(args[0]);

      if (key === "users:known-ids") {
        return ["9", "5", "7"];
      }

      return [];
    });
    sharedRedisMockGet.mockImplementation((key: string) => {
      if (key === "user:5:commit") {
        return Promise.resolve(
          createCommitPointer({
            userId: "5",
            revision: 2,
            updatedAt: "2026-03-27T00:00:05.000Z",
          }),
        );
      }

      if (key === "user:7:commit") {
        return Promise.resolve(
          createCommitPointer({
            userId: "7",
            revision: 3,
            updatedAt: "2026-03-27T00:00:07.000Z",
          }),
        );
      }

      if (key === "user:9:commit") {
        return Promise.resolve(
          createCommitPointer({
            userId: "9",
            revision: 4,
            updatedAt: "2026-03-27T00:00:09.000Z",
          }),
        );
      }

      return Promise.resolve(null);
    });
    sharedRedisMockZcard.mockResolvedValueOnce(2).mockResolvedValueOnce(3);
    sharedRedisMockZrange.mockResolvedValueOnce(["5", "9"]);
    sharedRedisMockZrange.mockResolvedValueOnce(["5", "7"]);

    const result = await listStalestUserIds(2);

    expect(result).toEqual({ userIds: ["5", "7"], totalUsers: 3 });
    expect(sharedRedisMockSmembers).toHaveBeenCalledWith("users:known-ids");
    expect(sharedRedisMockZadd).toHaveBeenCalledWith(
      "users:stale-by-updated-at",
      expect.objectContaining({ member: "7", score: expect.any(Number) }),
    );
    expect(sharedRedisMockZrem).not.toHaveBeenCalled();
    expect(sharedRedisMockScan).not.toHaveBeenCalled();
  });

  it("drains stale-user index repair backlogs across multiple bounded batches", async () => {
    const indexedUserId = "100";
    const repairedUserIds = Array.from({ length: 30 }, (_, index) =>
      String(index + 101),
    );
    const trackedUserIds = [indexedUserId, ...repairedUserIds];

    sharedRedisMockSmembers.mockImplementation(async (...args: unknown[]) => {
      const key = getStringValue(args[0]);

      if (key === "users:known-ids") {
        return trackedUserIds;
      }

      return [];
    });
    sharedRedisMockGet.mockImplementation((key: string) => {
      const commitMatch = /^user:(\d+):commit$/.exec(key);
      if (!commitMatch) {
        return Promise.resolve(null);
      }

      const userId = commitMatch[1];
      const updatedAtSecond = String(Number(userId) - 100).padStart(2, "0");

      return Promise.resolve(
        createCommitPointer({
          userId,
          revision: Number(userId),
          updatedAt: `2026-03-27T00:00:${updatedAtSecond}.000Z`,
        }),
      );
    });
    sharedRedisMockZcard
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(trackedUserIds.length);
    sharedRedisMockZrange
      .mockResolvedValueOnce([indexedUserId])
      .mockResolvedValueOnce([
        indexedUserId,
        repairedUserIds[0],
        repairedUserIds[1],
      ]);

    const result = await listStalestUserIds(3);

    expect(result).toEqual({
      userIds: [indexedUserId, repairedUserIds[0], repairedUserIds[1]],
      totalUsers: trackedUserIds.length,
    });
    const repairedMembers = sharedRedisMockZadd.mock.calls.flatMap((call) => {
      const entry = (call as readonly unknown[]).at(1);

      if (
        typeof entry === "object" &&
        entry !== null &&
        "member" in entry &&
        typeof entry.member === "string"
      ) {
        return [entry.member];
      }

      return [];
    });

    expect(repairedMembers).toHaveLength(repairedUserIds.length);
    const lastRepairedUserId = repairedUserIds.at(-1);
    if (!lastRepairedUserId) {
      throw new Error("Expected at least one repaired user id.");
    }
    expect(repairedMembers).toContain(lastRepairedUserId);
    expect(sharedRedisMockZrange).toHaveBeenNthCalledWith(
      1,
      "users:stale-by-updated-at",
      0,
      0,
    );
    expect(sharedRedisMockZrange).toHaveBeenNthCalledWith(
      2,
      "users:stale-by-updated-at",
      0,
      2,
    );
    expect(sharedRedisMockZrem).not.toHaveBeenCalled();
    expect(sharedRedisMockScan).not.toHaveBeenCalled();
  });

  it("lists canonical public profile sitemap entries from tracked user state without a global scan", async () => {
    sharedRedisMockSmembers.mockResolvedValueOnce(["9", "5", "7", "11"]);
    sharedRedisMockGet.mockImplementation((key: string) => {
      if (key === "user:5:commit") {
        return Promise.resolve(
          createCommitPointer({
            userId: "5",
            username: "ZetaUser",
            updatedAt: "2026-03-27T00:00:05-05:00",
          }),
        );
      }

      if (key === "user:7:commit") {
        return Promise.resolve(
          createCommitPointer({
            userId: "7",
            updatedAt: "2026-03-27T00:00:07.000Z",
          }),
        );
      }

      if (key === "user:9:commit") {
        return Promise.resolve(
          createCommitPointer({
            userId: "9",
            username: "Alpha49",
            updatedAt: "2026-03-27T00:00:09.000Z",
          }),
        );
      }

      if (key === "user:11") {
        return Promise.resolve(
          JSON.stringify(
            createPersistedUserRecord({
              userId: "11",
              username: "Beta User",
              updatedAt: "2026-03-27T00:00:11.000Z",
            }),
          ),
        );
      }

      return Promise.resolve(null);
    });

    const result = await listPublicUserProfileSitemapEntries();

    expect(result).toEqual([
      {
        username: "Alpha49",
        lastmod: "2026-03-27T00:00:09.000Z",
      },
      {
        username: "Beta User",
        lastmod: "2026-03-27T00:00:11.000Z",
      },
      {
        username: "ZetaUser",
        lastmod: "2026-03-27T05:00:05.000Z",
      },
    ]);
    expect(sharedRedisMockSmembers).toHaveBeenCalledWith("users:known-ids");
    expect(sharedRedisMockScan).not.toHaveBeenCalled();
  });

  it("prunes orphaned registry entries and stale sorted-set members during cardinality repair", async () => {
    sharedRedisMockSmembers.mockImplementation(async (...args: unknown[]) => {
      const key = String(args[0] ?? "");

      if (key === "users:known-ids") {
        return ["5", "7"];
      }

      return [];
    });
    sharedRedisMockGet.mockImplementation((key: string) => {
      if (key === "user:5:commit") {
        return Promise.resolve(
          createCommitPointer({
            userId: "5",
            revision: 2,
            updatedAt: "2026-03-27T00:00:05.000Z",
          }),
        );
      }

      if (key === "user:7:commit") {
        return Promise.resolve(null);
      }

      return Promise.resolve(null);
    });
    sharedRedisMockZcard.mockResolvedValueOnce(3).mockResolvedValueOnce(1);
    sharedRedisMockZrange.mockResolvedValueOnce(["5", "9", "11"]);
    sharedRedisMockZrange.mockResolvedValueOnce(["5"]);

    const result = await listStalestUserIds(1);

    expect(result).toEqual({ userIds: ["5"], totalUsers: 1 });
    expect(sharedRedisMockSrem).toHaveBeenCalledWith("users:known-ids", "7");
    expect(sharedRedisMockZrem).toHaveBeenCalledWith(
      "users:stale-by-updated-at",
      "9",
      "11",
    );
    expect(sharedRedisMockScan).not.toHaveBeenCalled();
  });
});
