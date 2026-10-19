/**
 * Applies every QStash schedule this project owns.
 *
 * This script is the only writer for these schedules. A schedule created or
 * edited in the Upstash console is overwritten the next time this runs, so
 * change the list below and run the script instead of editing the console.
 *
 * Run with `node scripts/qstash/apply-schedules.ts` (or `bun run ...`). The
 * script loads `.env` itself, so `QSTASH_TOKEN` and `CRON_SECRET` come from
 * there. It also needs a public origin: pass `--origin=https://example.com`,
 * or set `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SITE_URL`.
 *
 * The development `.env` points `NEXT_PUBLIC_APP_URL` at `localhost`, and
 * QStash delivers from its own network, so a loopback destination never
 * receives anything. The origin is checked here instead of trusted, because a
 * run with the development value would retire the live schedules and recreate
 * them against an address that cannot be reached.
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

/** Hosts that only resolve on the machine running this script. @source */
const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Prefix of the command-line origin override. @source */
const ORIGIN_FLAG = "--origin=";

/**
 * Reads `--origin=<value>` from the command line.
 * @returns The value, or undefined when the flag is absent.
 * @source
 */
function readOriginOverride(): string | undefined {
  const flag = process.argv.find((argument) =>
    argument.startsWith(ORIGIN_FLAG),
  );
  return flag?.slice(ORIGIN_FLAG.length);
}

/**
 * Resolves the deployment origin the schedules point at.
 *
 * The destination is reachable only from Upstash's network, so it must be a
 * public https origin. The development `.env` holds `http://localhost:3000`;
 * accepting it would retire the live schedules and recreate them against an
 * address QStash cannot reach.
 *
 * @param override - Origin passed as `--origin=`, if any.
 * @returns The origin without a trailing slash.
 * @source
 */
export function resolveAppOrigin(override?: string): string {
  const configured =
    override ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL;
  if (!configured) {
    throw new Error(
      "Set NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_SITE_URL, or pass --origin=<https origin>.",
    );
  }
  const url = new URL(configured);
  if (url.protocol !== "https:") {
    throw new Error(
      `Schedule destinations must use https: ${url.origin} would receive the cron secret in cleartext.`,
    );
  }
  if (LOOPBACK_HOSTNAMES.has(url.hostname)) {
    throw new Error(
      `QStash cannot reach a loopback destination: ${url.origin}. Pass --origin=<https origin>.`,
    );
  }
  return url.origin;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set.`);
  return value;
}

/**
 * Loads `.env` from the working directory.
 *
 * Node does not read `.env` for a plain `node script.ts` invocation, so every
 * required variable looked missing. Bun loads it on its own; loading it again
 * is harmless because an existing value is never overwritten. A missing file
 * is not an error, so an operator who exports the variables still can run it.
 * @source
 */
function loadDotEnv(): void {
  try {
    process.loadEnvFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
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
  loadDotEnv();
  const token = requireEnv("QSTASH_TOKEN");
  const cronSecret = requireEnv("CRON_SECRET");
  const origin = resolveAppOrigin(readOriginOverride());
  await applySchedules(new Client({ token }), cronSecret, origin);
}
