/**
 * Applies every QStash schedule this project owns.
 *
 * This script is the only writer for these schedules. A schedule created or
 * edited in the Upstash console is overwritten the next time this runs, so
 * change the list below and run the script instead of editing the console.
 *
 * Run with `bun run scripts/qstash/apply-schedules.ts`. Requires
 * `QSTASH_TOKEN`, `CRON_SECRET`, and `NEXT_PUBLIC_APP_URL` (or
 * `NEXT_PUBLIC_SITE_URL`) in the environment.
 *
 * Every schedule uses a readable id. QStash updates a schedule when the id
 * already exists, so re-running the script is safe and the id survives.
 *
 * The two schedules that were running before this script existed had
 * QStash-generated ids. Those are listed in `SUPERSEDED_SCHEDULE_IDS` and
 * deleted before the new ids are created: a readable id on its own would
 * create a second schedule and leave the generated one firing alongside it.
 * @source
 */

import { Client } from "@upstash/qstash";

export type ScheduleDefinition = {
  scheduleId: string;
  destination: string;
  cron: string;
  retries: number;
};

/**
 * Ids this script has replaced with readable ones. Deleted before the new
 * schedules are created, so the account never holds both.
 * @source
 */
export const SUPERSEDED_SCHEDULE_IDS = [
  "scd_7V68DENrUXhL7bev8V2op22okbBW",
  "scd_5cSuMdydgZd9njNNvh8JmTwHFYax",
];

/**
 * Resolves the deployment origin the schedules point at.
 * @returns The origin without a trailing slash.
 * @source
 */
export function resolveAppOrigin(): string {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (!configured) {
    throw new Error(
      "Set NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_SITE_URL to the deployment origin.",
    );
  }
  return new URL(configured).origin;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set.`);
  return value;
}

/**
 * Builds the schedule list for one deployment origin.
 *
 * It is a function rather than a constant so the definitions can be asserted
 * in a test without reading the environment. The crons match the cadence
 * documented in `docs/UPSTASH_SERVICES_PLAN.md`.
 *
 * @param origin - Deployment origin without a trailing slash.
 * @returns Every schedule this project owns.
 * @source
 */
export function buildSchedules(origin: string): ScheduleDefinition[] {
  return [
    {
      scheduleId: "anicards-refresh-dispatch",
      destination: `${origin}/api/cron`,
      cron: "*/20 * * * *",
      retries: 3,
    },
    {
      scheduleId: "anicards-analytics-report",
      destination: `${origin}/api/cron/analytics-reporting`,
      cron: "0 0 * * *",
      retries: 3,
    },
    {
      scheduleId: "anicards-repair-index",
      destination: `${origin}/api/cron/repair-index`,
      cron: "0 3 * * *",
      retries: 3,
    },
  ];
}

/**
 * Deletes the generated ids this script has replaced.
 *
 * Existing ids are read first so the delete calls only target schedules that
 * are really there. The SDK throws on a non-2xx reply, so deleting a missing
 * id would fail the run for no reason. Running before the create calls means
 * a failure here stops the run with the old schedules untouched rather than
 * leaving both the old and the new schedule delivering.
 *
 * @returns The ids that were removed.
 * @source
 */
async function retireSupersededSchedules(client: Client): Promise<string[]> {
  if (SUPERSEDED_SCHEDULE_IDS.length === 0) return [];

  const existing = new Set(
    (await client.schedules.list()).map((schedule) => schedule.scheduleId),
  );
  const removed: string[] = [];

  for (const scheduleId of SUPERSEDED_SCHEDULE_IDS) {
    if (!existing.has(scheduleId)) continue;
    await client.schedules.delete(scheduleId);
    removed.push(scheduleId);
    console.log(`retired ${scheduleId}`);
  }

  return removed;
}

/**
 * Applies every schedule and retires the generated ids it replaced.
 * @param client - QStash client built from the environment token.
 * @param cronSecret - Secret forwarded to each destination.
 * @param origin - Deployment origin the destinations point at.
 * @returns The applied ids and the retired ids.
 * @source
 */
export async function applySchedules(
  client: Client,
  cronSecret: string,
  origin: string,
): Promise<{ applied: string[]; retired: string[] }> {
  const retired = await retireSupersededSchedules(client);
  const applied: string[] = [];

  for (const schedule of buildSchedules(origin)) {
    const { scheduleId } = await client.schedules.create({
      ...schedule,
      headers: { "x-cron-secret": cronSecret },
    });
    applied.push(scheduleId);
    // The secret is deliberately not logged.
    console.log(
      `applied ${scheduleId} -> ${schedule.destination} (${schedule.cron})`,
    );
  }

  if (retired.length === 0) {
    console.log("no superseded schedules were present");
  }

  return { applied, retired };
}

if (import.meta.main) {
  const token = requireEnv("QSTASH_TOKEN");
  const cronSecret = requireEnv("CRON_SECRET");
  const origin = resolveAppOrigin();
  await applySchedules(new Client({ token }), cronSecret, origin);
}
