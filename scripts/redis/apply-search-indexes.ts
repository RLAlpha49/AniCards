/**
 * Creates every Redis Search index this project reads.
 *
 * Run this against the database the application uses, once, and again after a
 * definition in `lib/server/search-indexes.ts` changes. The definitions are
 * imported rather than repeated here, so the script and the runtime cannot
 * disagree about a field name or a prefix.
 *
 * `existsOk` means a re-run is a no-op. A changed schema is not applied to an
 * existing index: SEARCH does not alter a schema in place, so drop the index
 * first (SEARCH.DROP) and run this again. Until then the runtime keeps using
 * whatever the old schema indexes, and any helper whose filter needs a new
 * field falls back to its scan.
 *
 * Run with `bun run db:indexes`, or `bun scripts/redis/apply-search-indexes.ts`.
 * Bun resolves the `@/` path alias; a plain `node` invocation does not.
 *
 * Configuration comes from the same variables the application uses:
 * `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Development points
 * at the Docker proxy on `localhost:8079`, which serves a plain Redis server
 * with no SEARCH commands, so the script refuses a loopback URL unless
 * `--allow-local` is passed. Creating indexes is a production operation.
 *
 * @source
 */

import { Redis } from "@upstash/redis";
import {
  applySearchIndexes,
  SEARCH_INDEX_DEFINITIONS,
} from "@/lib/server/search-indexes";

/**
 * Filter for the verification count.
 *
 * Empty on purpose. The three indexes have different schemas, so any single
 * field filter throws "Field '<name>' not found in schema" on the index that
 * does not declare it. This counts everything searchable, which is the number
 * an operator wants to compare against the key count.
 * @source
 */
const COUNT_ALL_DOCUMENTS = {};

/** Prefix of the loopback override flag. @source */
const ALLOW_LOCAL_FLAG = "--allow-local";

/** Hosts that only resolve on the machine running this script. @source */
const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Loads `.env` from the working directory.
 *
 * A plain `node script.ts` invocation does not read it. Bun loads it on its
 * own, and loading it again is harmless because an existing value is never
 * overwritten. A missing file is not an error, so an operator who exports the
 * variables can still run the script.
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
 * Reads a required environment variable.
 * @param name - Variable name.
 * @returns Its value.
 * @source
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set.`);
  return value;
}

/**
 * Refuses a loopback database unless the caller opts in.
 *
 * The Docker stack has no SEARCH commands, so a run against it fails with a
 * "does not expose the SEARCH commands" error anyway. Checking the URL first
 * turns that into a message that names the cause.
 *
 * The origin is printed on every run. Creating an index is irreversible
 * without SEARCH.DROP, and on a one-index plan it consumes the only slot, so
 * the operator should see which database is about to change. The host is not a
 * secret; the token is never printed.
 *
 * @param url - Configured REST URL.
 * @param allowLocal - Whether `--allow-local` was passed.
 * @source
 */
function assertTargetDatabase(url: string, allowLocal: boolean): void {
  const parsed = new URL(url);
  console.log(`target database: ${parsed.origin}`);
  if (allowLocal || !LOOPBACK_HOSTNAMES.has(parsed.hostname)) return;
  throw new Error(
    `Refusing to create indexes against ${parsed.origin}: a plain Redis server has no SEARCH commands. Pass --allow-local to try anyway.`,
  );
}

/**
 * Verifies that one created index can answer a count.
 *
 * Indexing existing keys is asynchronous. Waiting here means the count covers
 * every key, which is the point of running it right after creation. A count
 * that fails is reported rather than thrown: the index exists either way, and
 * one unreadable count should not hide the others.
 *
 * @param client - Redis client for the target database.
 * @param name - Index that was just applied.
 * @param prefix - Log prefix describing the outcome and schema.
 * @returns Nothing.
 * @source
 */
async function reportIndexDocumentCount(
  client: Redis,
  name: string,
  prefix: string,
): Promise<void> {
  try {
    const index = client.search.index({ name });
    await index.waitIndexing();
    const { count } = await index.count({ filter: COUNT_ALL_DOCUMENTS });
    console.log(`${prefix}: ${count} documents are searchable`);
  } catch (error) {
    console.warn(
      `${prefix}: created, but the verification count failed (${error instanceof Error ? error.message : String(error)})`,
    );
  }
}

/**
 * Creates the indexes and reports each one.
 *
 * The token and URL are not logged. The output names the index, its type, its
 * prefix, and how many documents a field filter can currently return, which is
 * what an operator checks against the console.
 *
 * A refused index is reported and does not stop the rest. On a one-index plan
 * that is the expected result for every definition after the first.
 *
 * The definitions are applied in order, because a one-index plan accepts only
 * the first one. The verification counts then run together: each one only
 * reads, and waiting for all of them shortens the run.
 *
 * @param client - Redis client for the target database.
 * @returns Nothing.
 * @source
 */
async function main(client: Redis): Promise<void> {
  const results = await applySearchIndexes(client);
  let failed = false;
  const verifications: Promise<void>[] = [];

  for (const { name, outcome, reason } of results) {
    const definition = SEARCH_INDEX_DEFINITIONS.find(
      (candidate) => candidate.name === name,
    );
    const described = `type ${definition?.dataType}, prefix ${definition?.prefix}`;

    if (outcome === "rejected") {
      failed = true;
      console.error(`rejected ${name} (${described}): ${reason}`);
      if (reason?.includes("max index count")) {
        console.error(
          "  the plan allows fewer indexes than this project defines; the runtime scans for the missing key family",
        );
      }
      continue;
    }

    const fields = definition ? Object.keys(definition.schema).join(", ") : "";
    const prefix = `${outcome} ${name} (${described}, fields ${fields})`;
    verifications.push(reportIndexDocumentCount(client, name, prefix));
  }

  await Promise.all(verifications);

  if (failed) process.exitCode = 1;
}

if (import.meta.main) {
  loadDotEnv();
  const url = requireEnv("UPSTASH_REDIS_REST_URL");
  const allowLocal = process.argv.includes(ALLOW_LOCAL_FLAG);
  assertTargetDatabase(url, allowLocal);

  const client = new Redis({
    url,
    token: requireEnv("UPSTASH_REDIS_REST_TOKEN"),
  });
  await main(client);
}
