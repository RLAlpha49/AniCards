import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import {
  sharedQstashPublishJSON,
  sharedRedisMockDel,
  sharedRedisMockGet,
  sharedRedisMockMget,
  sharedRedisMockScan,
  sharedRedisMockSet,
  sharedRedisMockZadd,
  sharedRedisMockZcard,
  sharedRedisMockZrange,
  sharedRedisMockZrem,
  sharedRedisMockPipelineExec,
} from "@/tests/unit/__setup__";
import {
  USER_REFRESH_INDEX_KEY,
  USER_REFRESH_INDEX_UNREADABLE_SCORE,
} from "@/lib/server/user-data";

const { POST } = await import("@/app/api/cron/route");

const CRON_SECRET = "testsecret";

const CONSUMER_URL = "https://anicards.test/api/cron/refresh-user";

/**
 * Environment the dispatcher reads at call time. Saved once and restored after
 * every test, because Bun shares one module registry and one process across the
 * suite: a leaked value changes the CORS origin and the origin check for every
 * later test file.
 */
const ORIGINAL_ENV = {
  CRON_SECRET: process.env.CRON_SECRET,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  QSTASH_TOKEN: process.env.QSTASH_TOKEN,
};

function restoreEnv(): void {
  for (const [name, value] of Object.entries(ORIGINAL_ENV)) {
    const key = name as keyof typeof ORIGINAL_ENV;
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
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
 * Models Redis writes for the dispatch path. Every marker stores normally; the
 * dispatch no longer claims the index repair lease, because repair moved to
 * `/api/cron/repair-index`.
 */
function mockRedisWrites() {
  sharedRedisMockSet.mockImplementation(async () => "OK");
}

/**
 * Feeds the refresh index from user IDs, where a larger ID means an older
 * record.
 */
function mockRefreshIndexFromUserIds(userIds: string[]) {
  mockRefreshIndex(
    [...userIds]
      .sort((a, b) => Number(b) - Number(a))
      .map((id) => ({ id, updatedAt: Date.now() - Number(id) * 86_400_000 })),
  );
}

function cronRequest() {
  return new Request("http://localhost/api/cron", {
    headers: { "x-cron-secret": CRON_SECRET },
  });
}

/**
 * Reads the user ids the dispatcher published, in call order.
 */
function publishedUserIds(): string[] {
  return sharedQstashPublishJSON.mock.calls.map(
    ([request]) => (request as { body: { userId: string } }).body.userId,
  );
}

describe("Cron dispatch API POST Endpoint", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = CRON_SECRET;
    process.env.NEXT_PUBLIC_APP_URL = "https://anicards.test";
    process.env.QSTASH_TOKEN = "test-token";

    sharedQstashPublishJSON.mockClear();
    sharedQstashPublishJSON.mockImplementation(async (..._args: unknown[]) => ({
      messageId: `msg_${sharedQstashPublishJSON.mock.calls.length}`,
    }));

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

    sharedRedisMockMget.mockImplementation(async (...keys: string[]) =>
      keys.map(() => null),
    );
    sharedRedisMockScan.mockResolvedValue([0, []]);
    sharedRedisMockZrange.mockResolvedValue([]);
    sharedRedisMockZcard.mockResolvedValue(0);
    sharedRedisMockPipelineExec.mockResolvedValue([]);
  });

  afterEach(() => {
    mock.clearAllMocks();
    restoreEnv();
  });

  describe("Authorization", () => {
    it("should return 401 Unauthorized when the secret is invalid", async () => {
      const res = await POST(
        new Request("http://localhost/api/cron", {
          headers: { "x-cron-secret": "wrongsecret" },
        }),
      );
      expect(res.status).toBe(401);
      expect(await res.text()).toBe("Unauthorized");
    });

    it("should return 401 Unauthorized when the secret header is missing", async () => {
      const res = await POST(
        new Request("http://localhost/api/cron", { headers: {} }),
      );
      expect(res.status).toBe(401);
      expect(await res.text()).toBe("Unauthorized");
    });

    it("should reject requests when CRON_SECRET is not configured", async () => {
      delete process.env.CRON_SECRET;

      const res = await POST(
        new Request("http://localhost/api/cron", { headers: {} }),
      );
      expect(res.status).toBe(503);
      expect(await res.text()).toBe("Cron authorization is not configured");
    });

    it("should publish nothing when authorization fails", async () => {
      mockRefreshIndex([{ id: "1", updatedAt: 1_000 }]);
      const res = await POST(
        new Request("http://localhost/api/cron", { headers: {} }),
      );
      expect(res.status).toBe(401);
      expect(sharedQstashPublishJSON).not.toHaveBeenCalled();
    });
  });

  describe("Response shape", () => {
    it("should return JSON with CORS headers", async () => {
      const res = await POST(cronRequest());
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("application/json");
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://anicards.test",
      );
    });

    it("should report zero published messages when there are no users", async () => {
      const res = await POST(cronRequest());
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.published).toBe(0);
      expect(body.failed).toBe(0);
      expect(body.messageIds).toEqual([]);
      expect(body.selection.indexedUsers).toBe(0);
      // Repair counts live on the repair route, not here.
      expect(body).not.toHaveProperty("rebuildCounts");
      expect(body).not.toHaveProperty("reconciliation");
      expect(body).not.toHaveProperty("recommendedSchedules");
    });

    it("should answer 503 when no app origin is configured", async () => {
      delete process.env.NEXT_PUBLIC_APP_URL;
      delete process.env.NEXT_PUBLIC_SITE_URL;

      const res = await POST(cronRequest());
      expect(res.status).toBe(503);
      expect((await res.json()).error).toContain("no app origin");
    });

    it("should refuse a plain-http origin that is not loopback", async () => {
      // The cron secret travels in every published message header, so a
      // non-loopback http origin would send it in cleartext.
      process.env.NEXT_PUBLIC_APP_URL = "http://anicards.example";

      const res = await POST(cronRequest());
      expect(res.status).toBe(503);
      expect(sharedQstashPublishJSON).not.toHaveBeenCalled();
    });

    it("should allow a loopback http origin for local development", async () => {
      process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
      mockRefreshIndexFromUserIds(["1"]);
      mockRedisWrites();

      const res = await POST(cronRequest());
      expect(res.status).toBe(200);

      const [request] = sharedQstashPublishJSON.mock.calls[0] as [
        { url: string },
      ];
      expect(request.url).toBe("http://localhost:3000/api/cron/refresh-user");
    });
  });

  describe("Selection", () => {
    it("should rebuild an empty refresh index from stored meta before selecting users", async () => {
      sharedRedisMockScan.mockResolvedValueOnce([
        0,
        ["user:1:meta", "user:2:meta"],
      ]);
      sharedRedisMockMget.mockImplementation(async (...keys: string[]) =>
        keys.map((key) =>
          key.endsWith(":meta")
            ? JSON.stringify({ updatedAt: "2024-03-01T00:00:00.000Z" })
            : null,
        ),
      );
      mockRedisWrites();
      sharedRedisMockDel.mockResolvedValue(1);

      const res = await POST(cronRequest());
      expect(res.status).toBe(200);

      expect(sharedRedisMockZcard).toHaveBeenCalledWith(USER_REFRESH_INDEX_KEY);
      expect(sharedRedisMockZadd).toHaveBeenCalledWith(USER_REFRESH_INDEX_KEY, {
        score: new Date("2024-03-01T00:00:00.000Z").getTime(),
        member: expect.any(String),
      });
    });

    it("should not rebuild, repair, or reconcile a populated index", async () => {
      // Repair and reconciliation moved to the daily `/api/cron/repair-index`
      // schedule. A dispatch that re-did them would scan the keyspace every 20
      // minutes and would couple a refresh failure to a cleanup failure again.
      mockRefreshIndexFromUserIds(["1", "2"]);
      mockRedisWrites();

      const res = await POST(cronRequest());
      expect(res.status).toBe(200);

      expect(sharedRedisMockScan).not.toHaveBeenCalled();
      expect(sharedRedisMockZadd).not.toHaveBeenCalled();
      // No lease claim either: the repair route owns that decision.
      expect(sharedRedisMockSet).not.toHaveBeenCalledWith(
        "users:refresh-index:repair-lease",
        expect.anything(),
        expect.anything(),
      );
      const body = await res.json();
      expect(body.indexRebuilt).toBe(false);
    });

    it("should publish only the 5 stalest users when the index holds more", async () => {
      mockRefreshIndexFromUserIds(
        Array.from({ length: 15 }, (_, i) => String(i + 1)),
      );
      mockRedisWrites();

      const res = await POST(cronRequest());
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.published).toBe(5);
      expect(sharedQstashPublishJSON).toHaveBeenCalledTimes(5);
      expect(body.selection.indexedUsers).toBe(15);
    });

    it("should publish users in index order (oldest first)", async () => {
      mockRefreshIndex([
        { id: "2", updatedAt: new Date("2024-01-01").getTime() },
        { id: "3", updatedAt: new Date("2024-06-01").getTime() },
        { id: "1", updatedAt: new Date("2024-12-01").getTime() },
      ]);
      mockRedisWrites();

      await POST(cronRequest());
      expect(publishedUserIds()).toEqual(["2", "3", "1"]);
    });

    it("should page past a full window of cooled-down users instead of idling", async () => {
      // 25 cooled-down users fill the first page exactly; the 26th should still
      // be selected, which is what a single-page window would fail to do.
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
          return null;
        }),
      );
      mockRedisWrites();

      const res = await POST(cronRequest());
      expect(res.status).toBe(200);

      expect(publishedUserIds()).toEqual([healthyId]);
      expect((await res.json()).selection.coolingDown).toBe(25);
    });

    it("should abort when the index is empty and the rebuild fails", async () => {
      sharedRedisMockZcard.mockResolvedValueOnce(0);
      sharedRedisMockScan.mockRejectedValueOnce(
        new Error("rebuild blew up for an empty index"),
      );

      const res = await POST(cronRequest());
      expect(res.status).toBe(500);
      expect((await res.json()).error).toBe("Cron job failed");
    });

    it("should skip candidates in cooldown and fill the batch from the rest of the window", async () => {
      mockRefreshIndex([
        { id: "10", updatedAt: 1_000 },
        { id: "11", updatedAt: 2_000 },
        { id: "12", updatedAt: 3_000 },
      ]);
      sharedRedisMockMget.mockImplementation(async (...keys: string[]) =>
        keys.map((key) => (key === "cron:refresh-cooldown:10" ? 1 : null)),
      );
      mockRedisWrites();

      const res = await POST(cronRequest());
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.published).toBe(2);
      expect(body.selection.coolingDown).toBe(1);
    });

    it("should report an unreadable stalest score as unknown rather than a huge age", async () => {
      // The sentinel score is not a timestamp. Reporting the epoch-relative
      // difference would print tens of millions of minutes and make a healthy
      // queue look catastrophically behind.
      mockRefreshIndex([
        { id: "123", updatedAt: USER_REFRESH_INDEX_UNREADABLE_SCORE },
      ]);
      mockRedisWrites();

      const res = await POST(cronRequest());
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.selection.oldestStaleRecord).toBe("unknown");
      expect(body.selection.oldestStaleRecord).not.toMatch(/^\d{5,} minutes$/);
    });

    it("should report no stalest record when nothing was selected", async () => {
      // An empty index means no selection happened at all, which is different
      // from a selected record whose age cannot be read.
      sharedRedisMockZcard.mockResolvedValueOnce(0);
      sharedRedisMockScan.mockResolvedValueOnce([0, []]);
      sharedRedisMockZrange.mockResolvedValueOnce([] as never);
      mockRedisWrites();

      const res = await POST(cronRequest());
      expect(res.status).toBe(200);
      expect((await res.json()).selection.oldestStaleRecord).toBe("none");
    });
  });

  describe("Publishing", () => {
    it("should publish one message per selected user to the consumer route", async () => {
      mockRefreshIndexFromUserIds(["1", "2"]);
      mockRedisWrites();

      await POST(cronRequest());

      expect(sharedQstashPublishJSON).toHaveBeenCalledTimes(2);
      const [firstCall] = sharedQstashPublishJSON.mock.calls;
      const request = firstCall[0] as {
        url: string;
        body: { userId: string };
        headers: Record<string, string>;
        retries: number;
        flowControl: Record<string, unknown>;
      };

      expect(request.url).toBe(CONSUMER_URL);
      expect(request.body.userId).toBe("2");
      expect(request.headers["x-cron-secret"]).toBe(CRON_SECRET);
      expect(request.retries).toBe(3);
      expect(request.flowControl).toEqual({
        key: "anilist-refresh",
        rate: 60,
        period: "1m",
        parallelism: 10,
      });
    });

    it("should report the message ids it received", async () => {
      mockRefreshIndexFromUserIds(["1"]);
      mockRedisWrites();

      const res = await POST(cronRequest());
      const body = await res.json();

      expect(body.messageIds).toEqual(["msg_1"]);
      expect(body.failedUserIds).toEqual([]);
    });

    it("should report a failed publish without failing the whole run", async () => {
      mockRefreshIndexFromUserIds(["1", "2"]);
      mockRedisWrites();

      let call = 0;
      sharedQstashPublishJSON.mockImplementation(async () => {
        call += 1;
        if (call === 1) throw new Error("QStash is down");
        return { messageId: `msg_${call}` };
      });

      const res = await POST(cronRequest());
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.published).toBe(1);
      expect(body.failed).toBe(1);
      expect(body.failedUserIds).toHaveLength(1);
    });

    it("should report only a failure code, not the SDK message", async () => {
      // QStash and Upstash keep the response body and show it in consoles.
      mockRefreshIndexFromUserIds(["1"]);
      mockRedisWrites();
      sharedQstashPublishJSON.mockImplementation(async () => {
        throw new Error("upstash endpoint https://qstash.upstash.io rejected");
      });

      const res = await POST(cronRequest());
      const serialized = JSON.stringify(await res.json());
      expect(serialized).not.toContain("qstash.upstash.io");
    });

    it("should mark published users in flight for longer than the retry window", async () => {
      // QStash retries for about 32 minutes while the dispatch runs every 20.
      // Without the marker the next run would queue the same user again.
      mockRefreshIndexFromUserIds(["1"]);
      mockRedisWrites();

      await POST(cronRequest());

      expect(sharedRedisMockSet).toHaveBeenCalledWith(
        "cron:refresh-cooldown:1",
        "1",
        { ex: 2100 },
      );
    });

    it("should not mark a user whose publish failed", async () => {
      mockRefreshIndexFromUserIds(["1"]);
      mockRedisWrites();
      sharedQstashPublishJSON.mockImplementation(async () => {
        throw new Error("QStash is down");
      });

      await POST(cronRequest());

      expect(sharedRedisMockSet).not.toHaveBeenCalledWith(
        "cron:refresh-cooldown:1",
        "1",
        expect.anything(),
      );
    });

    it("should answer 500 when every publish fails", async () => {
      mockRefreshIndexFromUserIds(["1", "2"]);
      mockRedisWrites();
      sharedQstashPublishJSON.mockImplementation(async () => {
        throw new Error("QStash is down");
      });

      const res = await POST(cronRequest());
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.published).toBe(0);
      expect(body.failed).toBe(2);
    });

    it("should leave a user in the index when their publish fails", async () => {
      // The dispatcher never removes a user; only a successful refresh
      // rescores them and only a stale record drops them. A failed publish
      // therefore re-queues on the next run by construction.
      mockRefreshIndexFromUserIds(["1"]);
      mockRedisWrites();
      sharedQstashPublishJSON.mockImplementation(async () => {
        throw new Error("QStash is down");
      });

      await POST(cronRequest());
      expect(sharedRedisMockZrem).not.toHaveBeenCalled();
    });
  });

  describe("Error handling", () => {
    it("should return 500 when reading the index fails", async () => {
      sharedRedisMockZcard.mockRejectedValueOnce(
        new Error("Redis connection error"),
      );
      const res = await POST(cronRequest());
      expect(res.status).toBe(500);
      expect((await res.json()).error).toBe("Cron job failed");
    });

    it("should return 500 when the cooldown read fails", async () => {
      mockRefreshIndex([{ id: "123", updatedAt: 1_000 }]);
      mockRedisWrites();
      sharedRedisMockMget.mockRejectedValueOnce(new Error("Redis error"));

      const res = await POST(cronRequest());
      expect(res.status).toBe(500);
      expect((await res.json()).error).toBe("Cron job failed");
    });
  });
});
