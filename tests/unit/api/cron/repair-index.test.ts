import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import {
  sharedRedisMockDel,
  sharedRedisMockGet,
  sharedRedisMockMget,
  sharedRedisMockScan,
  sharedRedisMockSet,
  sharedRedisMockZadd,
  sharedRedisMockZcard,
  sharedRedisMockZrange,
  sharedRedisMockZrem,
  sharedRedisMockTtl,
  sharedRedisMockPipelineExec,
} from "@/tests/unit/__setup__";
import { INDEX_REPAIR_LEASE_KEY } from "@/lib/server/refresh-index-repair";
import { USER_REFRESH_INDEX_KEY } from "@/lib/server/user-data";

const { POST } = await import("@/app/api/cron/repair-index/route");

const CRON_SECRET = "testsecret";
const ORIGINAL_CRON_SECRET = process.env.CRON_SECRET;
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_DEV_BYPASS = process.env.CRON_SECRET_DEV_BYPASS;

/**
 * Sets `NODE_ENV` for one test.
 *
 * `process.env.NODE_ENV` is typed read-only, so the rest of the suite writes
 * it through a cast. Bun shares one process, so every write is restored in
 * `afterEach`.
 *
 * @param value - Value to set, or undefined to remove the variable.
 */
function setNodeEnv(value: string | undefined): void {
  const env = process.env as unknown as { NODE_ENV?: string };
  if (value === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = value;
}

function repairRequest(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/cron/repair-index", {
    method: "POST",
    headers: { "x-cron-secret": CRON_SECRET, ...headers },
  });
}

/**
 * Models Redis writes for the repair path. The lease is a SET NX, so only the
 * caller that wins it sees "OK".
 */
function mockLease(options: { won?: boolean; fails?: boolean } = {}) {
  sharedRedisMockSet.mockImplementation(
    async (_key: string, _value: unknown, opts?: { nx?: boolean }) => {
      if (opts?.nx) {
        if (options.fails) throw new Error("Redis unavailable");
        return options.won === false ? null : "OK";
      }
      return "OK";
    },
  );
}

describe("Refresh index repair route", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = CRON_SECRET;

    sharedRedisMockGet.mockReset();
    sharedRedisMockSet.mockReset();
    sharedRedisMockDel.mockReset();
    sharedRedisMockScan.mockReset();
    sharedRedisMockMget.mockReset();
    sharedRedisMockZadd.mockReset();
    sharedRedisMockZrange.mockReset();
    sharedRedisMockZcard.mockReset();
    sharedRedisMockZrem.mockReset();
    sharedRedisMockTtl.mockReset();
    sharedRedisMockPipelineExec.mockReset();

    sharedRedisMockTtl.mockResolvedValue(-1);
    sharedRedisMockScan.mockResolvedValue([0, []]);
    sharedRedisMockMget.mockResolvedValue([]);
    sharedRedisMockZrange.mockResolvedValue([]);
    sharedRedisMockZcard.mockResolvedValue(0);
    sharedRedisMockPipelineExec.mockResolvedValue([]);
    // A reset mock returns undefined, and the lease release calls `.catch()`
    // on the reply. The real client always returns a promise.
    sharedRedisMockDel.mockResolvedValue(1);
  });

  afterEach(() => {
    mock.clearAllMocks();
    if (ORIGINAL_CRON_SECRET === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = ORIGINAL_CRON_SECRET;
    setNodeEnv(ORIGINAL_NODE_ENV);
    if (ORIGINAL_DEV_BYPASS === undefined)
      delete process.env.CRON_SECRET_DEV_BYPASS;
    else process.env.CRON_SECRET_DEV_BYPASS = ORIGINAL_DEV_BYPASS;
  });

  describe("Authorization", () => {
    it("should reject a request with the wrong secret", async () => {
      const res = await POST(repairRequest({ "x-cron-secret": "nope" }));
      expect(res.status).toBe(401);
      expect(await res.text()).toBe("Unauthorized");
    });

    it("should reject a request with no secret", async () => {
      const res = await POST(
        new Request("http://localhost/api/cron/repair-index", {
          method: "POST",
        }),
      );
      expect(res.status).toBe(401);
      expect(sharedRedisMockScan).not.toHaveBeenCalled();
    });

    it("should answer 503 when CRON_SECRET is not configured", async () => {
      delete process.env.CRON_SECRET;
      const res = await POST(
        new Request("http://localhost/api/cron/repair-index", {
          method: "POST",
        }),
      );
      expect(res.status).toBe(503);
    });

    it("should answer 503 in development unless the bypass is opted into", async () => {
      // Development mode alone used to be enough to skip authorization, which
      // left any dev-mode deployment open on a route that deletes user keys.
      delete process.env.CRON_SECRET;
      setNodeEnv("development");
      delete process.env.CRON_SECRET_DEV_BYPASS;

      const res = await POST(
        new Request("http://localhost/api/cron/repair-index", {
          method: "POST",
        }),
      );

      expect(res.status).toBe(503);
      expect(await res.text()).toBe("Cron authorization is not configured");
      expect(sharedRedisMockScan).not.toHaveBeenCalled();
    });

    it("should skip authorization when the dev bypass is opted into", async () => {
      delete process.env.CRON_SECRET;
      setNodeEnv("development");
      process.env.CRON_SECRET_DEV_BYPASS = "true";
      mockLease();

      const res = await POST(
        new Request("http://localhost/api/cron/repair-index", {
          method: "POST",
        }),
      );

      expect(res.status).toBe(200);
    });
  });

  describe("Repair", () => {
    it("should rebuild the index and report the counts", async () => {
      mockLease();
      sharedRedisMockScan.mockResolvedValueOnce([0, ["user:5:meta"]]);
      sharedRedisMockMget.mockResolvedValueOnce([
        JSON.stringify({ updatedAt: "2024-03-01T00:00:00.000Z" }),
      ]);
      sharedRedisMockZcard.mockResolvedValueOnce(1);
      sharedRedisMockZrange.mockResolvedValueOnce(["5"] as never);
      sharedRedisMockPipelineExec.mockResolvedValue([]);
      sharedRedisMockDel.mockResolvedValue(1);

      const res = await POST(repairRequest());
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.outcome).toBe("repaired");
      expect(body.totalUsers).toBe(1);
      expect(body.rebuildCounts).toEqual({
        indexedUsers: 1,
        missingMetaCount: 0,
        malformedMetaCount: 0,
        droppedStaleMembers: 0,
      });
    });

    it("should sentinel members whose stored meta has no readable timestamp", async () => {
      mockLease();
      sharedRedisMockScan.mockResolvedValueOnce([
        0,
        ["user:5:meta", "user:6:meta"],
      ]);
      sharedRedisMockMget.mockResolvedValueOnce([
        JSON.stringify({ updatedAt: "2024-03-01T00:00:00.000Z" }),
        JSON.stringify({ userId: "6" }),
      ]);
      sharedRedisMockZcard.mockResolvedValueOnce(2);
      sharedRedisMockZrange.mockResolvedValueOnce([] as never);

      const res = await POST(repairRequest());
      expect(res.status).toBe(200);

      expect(sharedRedisMockZadd).toHaveBeenCalledWith(USER_REFRESH_INDEX_KEY, {
        score: Number.MAX_SAFE_INTEGER,
        member: "6",
      });
    });

    it("should drop index members whose record is gone", async () => {
      mockLease();
      sharedRedisMockScan.mockResolvedValueOnce([0, ["user:5:meta"]]);
      sharedRedisMockMget.mockImplementation(async (...keys: string[]) =>
        keys.map((key) =>
          key === "user:5:meta"
            ? JSON.stringify({ updatedAt: "2024-03-01T00:00:00.000Z" })
            : null,
        ),
      );
      sharedRedisMockZcard.mockResolvedValueOnce(3);
      sharedRedisMockZrange.mockResolvedValueOnce(["5", "6", "7"] as never);

      const res = await POST(repairRequest());
      expect(res.status).toBe(200);

      expect(sharedRedisMockZrem).toHaveBeenCalledWith(
        USER_REFRESH_INDEX_KEY,
        "6",
      );
      expect(sharedRedisMockZrem).toHaveBeenCalledWith(
        USER_REFRESH_INDEX_KEY,
        "7",
      );
      expect(sharedRedisMockZrem).not.toHaveBeenCalledWith(
        USER_REFRESH_INDEX_KEY,
        "5",
      );
    });

    it("should reconcile orphaned cards and username keys", async () => {
      mockLease();
      sharedRedisMockZcard.mockResolvedValueOnce(1);
      sharedRedisMockScan.mockImplementation(
        async (_cursor: unknown, opts?: { match?: string }) => {
          const pattern = opts?.match ?? "";
          if (pattern === "user:*:meta") return [0, ["user:5:meta"]];
          if (pattern === "cards:*") return [0, ["cards:5", "cards:6"]];
          if (pattern === "username:*") return [0, ["username:ghost"]];
          return [0, []];
        },
      );
      sharedRedisMockMget.mockImplementation(async (...keys: string[]) =>
        keys.map((key) => {
          if (key === "user:5:meta") {
            return JSON.stringify({ updatedAt: "2024-03-01T00:00:00.000Z" });
          }
          // cards:5 belongs to a live user, cards:6 and username:ghost do not.
          if (key === "cards:6") {
            return JSON.stringify({
              updatedAt: new Date(
                Date.now() - 2 * 60 * 60 * 1000,
              ).toISOString(),
            });
          }
          if (key === "username:ghost") return "777";
          if (key === "user:777:meta") return null;
          return null;
        }),
      );
      sharedRedisMockZrange.mockResolvedValueOnce(["5"] as never);
      sharedRedisMockDel.mockResolvedValue(1);

      const res = await POST(repairRequest());
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.reconciliation).not.toBeNull();
      expect(body.reconciliation.deletedCardsKeys).toBe(1);
      expect(body.reconciliation.deletedUsernameKeys).toBe(1);
    });

    it("should report a partial repair and let the schedule retry when reconciliation throws", async () => {
      // The rebuild succeeded and the cleanup did not. The rebuild is
      // idempotent, so retrying costs one scan and prevents a day without
      // cleanup, which is the coupling this route was split out to remove.
      mockLease();
      sharedRedisMockScan.mockImplementation(
        async (_cursor: unknown, opts?: { match?: string }) => {
          if (opts?.match === "user:*:meta") return [0, ["user:5:meta"]];
          throw new Error("reconciliation blew up");
        },
      );
      sharedRedisMockMget.mockImplementation(async (...keys: string[]) =>
        keys.map((key) =>
          key === "user:5:meta"
            ? JSON.stringify({ updatedAt: "2024-03-01T00:00:00.000Z" })
            : null,
        ),
      );
      sharedRedisMockZcard.mockResolvedValueOnce(1);
      sharedRedisMockZrange.mockResolvedValueOnce([] as never);

      const res = await POST(repairRequest());
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body.outcome).toBe("partial");
      expect(body.reason).toBe("key-reconciliation-failed");
      expect(body.rebuildCounts.indexedUsers).toBe(1);
      // The lease is released so the retry can run immediately.
      expect(sharedRedisMockDel).toHaveBeenCalledWith(INDEX_REPAIR_LEASE_KEY);
    });
  });

  describe("Lease", () => {
    it("should skip when another invocation holds the lease", async () => {
      mockLease({ won: false });

      const res = await POST(repairRequest());
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.outcome).toBe("skipped");
      expect(sharedRedisMockScan).not.toHaveBeenCalled();
    });

    it("should claim the lease with an overlap TTL, not the schedule period", async () => {
      // The daily schedule is the cadence. A lease equal to a day would let a
      // late or killed run turn tomorrow's repair into a silent skip.
      mockLease();
      sharedRedisMockZcard.mockResolvedValueOnce(0);
      sharedRedisMockScan.mockResolvedValueOnce([0, []]);
      sharedRedisMockZrange.mockResolvedValueOnce([] as never);

      await POST(repairRequest());

      expect(sharedRedisMockSet).toHaveBeenCalledWith(
        INDEX_REPAIR_LEASE_KEY,
        "1",
        { nx: true, ex: 900 },
      );
    });

    it("should report how long the held lease still has", async () => {
      mockLease({ won: false });
      sharedRedisMockTtl.mockResolvedValueOnce(420);

      const res = await POST(repairRequest());
      const body = await res.json();

      expect(body.outcome).toBe("skipped");
      expect(body.leaseExpiresInSeconds).toBe(420);
    });

    it("should release the lease when the size read fails after a rebuild", async () => {
      // A kill during the read is the same shape as a throw here: whatever
      // stopped the run must not hold the lease for the next schedule.
      mockLease();
      sharedRedisMockScan.mockResolvedValueOnce([0, ["user:5:meta"]]);
      sharedRedisMockMget.mockResolvedValueOnce([
        JSON.stringify({ updatedAt: "2024-03-01T00:00:00.000Z" }),
      ]);
      sharedRedisMockZcard.mockRejectedValueOnce(new Error("Redis timeout"));

      const res = await POST(repairRequest());
      expect(res.status).toBe(500);
      expect(sharedRedisMockDel).toHaveBeenCalledWith(INDEX_REPAIR_LEASE_KEY);
    });

    it("should answer 500 when the lease cannot be claimed", async () => {
      mockLease({ fails: true });

      const res = await POST(repairRequest());
      expect(res.status).toBe(500);
      expect((await res.json()).outcome).toBe("failed");
    });
  });

  describe("Rebuild failure", () => {
    it("should answer 500 so the schedule retries", async () => {
      mockLease();
      sharedRedisMockScan.mockRejectedValueOnce(new Error("scan blew up"));

      const res = await POST(repairRequest());
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body.outcome).toBe("failed");
      // A code, not the exception text: QStash keeps and displays the body.
      expect(body.reason).toBe("index-rebuild-failed");
    });

    it("should release the lease so the retry can run", async () => {
      // The daily TTL would otherwise make a single failed rebuild wait 24
      // hours for its retry.
      mockLease();
      sharedRedisMockScan.mockRejectedValueOnce(new Error("scan blew up"));
      sharedRedisMockDel.mockResolvedValue(1);

      await POST(repairRequest());
      expect(sharedRedisMockDel).toHaveBeenCalledWith(INDEX_REPAIR_LEASE_KEY);
    });
  });
});
