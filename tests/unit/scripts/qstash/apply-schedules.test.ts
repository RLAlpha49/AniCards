import { beforeEach, describe, expect, it } from "bun:test";
import { Client } from "@upstash/qstash";
import {
  sharedQstashSchedulesCreate,
  sharedQstashSchedulesDelete,
  sharedQstashSchedulesList,
} from "@/tests/unit/__setup__";
import {
  applySchedules,
  buildSchedules,
  SUPERSEDED_SCHEDULE_IDS,
} from "@/scripts/qstash/apply-schedules";

const ORIGIN = "https://anicards.test";

describe("QStash schedule definitions", () => {
  it("should define the three schedules documented in the plan", () => {
    // This script is the only writer of production schedules, so a typo in a
    // cron string would ship without any other signal.
    const schedules = buildSchedules(ORIGIN);

    expect(
      schedules.map(({ scheduleId, destination, cron, retries }) => ({
        scheduleId,
        destination,
        cron,
        retries,
      })),
    ).toEqual([
      {
        scheduleId: "anicards-refresh-dispatch",
        destination: `${ORIGIN}/api/cron`,
        cron: "*/20 * * * *",
        retries: 3,
      },
      {
        scheduleId: "anicards-analytics-report",
        destination: `${ORIGIN}/api/cron/analytics-reporting`,
        cron: "0 0 * * *",
        retries: 3,
      },
      {
        scheduleId: "anicards-repair-index",
        destination: `${ORIGIN}/api/cron/repair-index`,
        cron: "0 3 * * *",
        retries: 3,
      },
    ]);
  });

  it("should give every schedule a unique id", () => {
    const ids = buildSchedules(ORIGIN).map(({ scheduleId }) => scheduleId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("applySchedules", () => {
  beforeEach(() => {
    sharedQstashSchedulesCreate.mockClear();
    sharedQstashSchedulesDelete.mockClear();
    sharedQstashSchedulesList.mockReset();
    sharedQstashSchedulesList.mockImplementation(async () => []);
  });

  it("should create every schedule with the secret forwarded", async () => {
    const applied = await applySchedules(
      new Client({ token: "test-token" }),
      "test-secret",
      ORIGIN,
    );

    expect(applied.applied).toEqual([
      "anicards-refresh-dispatch",
      "anicards-analytics-report",
      "anicards-repair-index",
    ]);
    expect(sharedQstashSchedulesCreate).toHaveBeenCalledTimes(3);
    expect(sharedQstashSchedulesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduleId: "anicards-repair-index",
        headers: { "x-cron-secret": "test-secret" },
      }),
    );
  });

  it("should retire the generated ids before creating the readable ones", async () => {
    sharedQstashSchedulesList.mockImplementation(async () =>
      SUPERSEDED_SCHEDULE_IDS.map((scheduleId) => ({ scheduleId })),
    );

    const applied = await applySchedules(
      new Client({ token: "test-token" }),
      "test-secret",
      ORIGIN,
    );

    expect(applied.retired).toEqual(SUPERSEDED_SCHEDULE_IDS);
    expect(sharedQstashSchedulesDelete).toHaveBeenCalledTimes(2);
  });

  it("should not delete an id that is not there", async () => {
    // The SDK throws on a non-2xx reply, so deleting a missing id would fail
    // the run for no reason.
    await applySchedules(
      new Client({ token: "test-token" }),
      "test-secret",
      ORIGIN,
    );

    expect(sharedQstashSchedulesDelete).not.toHaveBeenCalled();
  });
});
