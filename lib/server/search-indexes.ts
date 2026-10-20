/**
 * Upstash Redis Search indexes owned by this project.
 *
 * Redis Search uses the `SEARCH.*` command family, which a plain Redis server
 * does not implement. The local Docker stack therefore answers "unknown
 * command", and a database where the index was never created answers null from
 * `describe()`. Every helper here returns null in both cases, so callers keep
 * their scan path as the fallback and a missing index degrades speed rather
 * than breaking the cron.
 *
 * Index definitions live here rather than only in the console, so
 * `scripts/redis/apply-search-indexes.ts` and the runtime cannot drift.
 *
 * Writes are indexed asynchronously. A document written seconds ago may not be
 * returned yet. That is acceptable for maintenance work like the daily repair.
 * Do not use these helpers for a read that must observe a write from the same
 * request.
 *
 * Behavior verified against a live Upstash database:
 *
 * - A document is searchable only if it has at least one schema field. The
 *   other nine parts of a user record match the `user:` prefix but carry no
 *   schema field, so a field filter never returns them.
 * - `DATE` fields index ISO 8601 strings only. A numeric epoch stored in
 *   `updatedAt` is silently skipped. `splitUserRecord` always writes a string,
 *   so the records this project stores are covered.
 * - A `KEYWORD` field holds strings only. A numeric value under the same path
 *   matches nothing and does not raise an error, which is why `cards:userId`
 *   and `user:userId` cannot share one index: `user:<id>:meta` stores the ID
 *   as a string and `cards:<id>` stores it as a number.
 * - The free plan allows one index, so only the first definition is created.
 *   The helper for a missing index returns null and the caller scans instead.
 *
 * @source
 */

import type { Redis } from "@upstash/redis";
import { USER_ACTIVITY_KEY_PREFIX } from "@/lib/server/user-activity";

/** Index over `user:*` documents. @source */
export const USERS_SEARCH_INDEX = "idx:users";

/** Index over `cards:*` documents. @source */
export const CARDS_SEARCH_INDEX = "idx:cards";

/** Index over `user_activity:*` documents. @source */
export const ACTIVITY_SEARCH_INDEX = "idx:activity";

/**
 * One index definition.
 *
 * The schema is written as plain descriptors. `s.object(...)` from the SDK
 * produces the same shape, but importing the builder at module scope would
 * touch `@upstash/redis` while the unit suite has replaced that module with a
 * stub, and the stub has no `s` export.
 * @source
 */
export interface SearchIndexDefinition {
  name: string;
  dataType: "string";
  prefix: string;
  schema: Record<string, unknown>;
}

/**
 * Every index the project owns, in priority order.
 *
 * Both prefixes end with a colon on purpose. `username:alpha49` starts with
 * `user`, so the prefix `user` would pull every username key into the users
 * index as a malformed document.
 *
 * A prefix matches the key start, so `user:` takes in all ten parts of a user
 * record, not only `:meta`. Those extra documents carry no schema field, so
 * they are never returned by a field filter, but they do count toward the
 * document budget.
 *
 * The two families need separate indexes because `userId` has a different
 * JSON type in each: a string in `user:<id>:meta`, a number in `cards:<id>`.
 * `KEYWORD` indexes strings only and returns nothing for the numeric form, so
 * sharing one field between them would silently match nothing for cards.
 *
 * The order matters on a one-index plan, because only the first definition is
 * created. `idx:users` backs the rebuild of the refresh index, which is the
 * only work in the cron path whose cost scales with the whole database.
 * `idx:cards` and `idx:activity` are optimizations for reads that already have
 * a working path, so they come after it.
 *
 * `idx:activity` is last for a second reason. Its prefix is a literal today,
 * and every key it covers also expires on its own, so a missed index drops a
 * reporting query rather than a correctness guarantee.
 * @source
 */
export const SEARCH_INDEX_DEFINITIONS: SearchIndexDefinition[] = [
  {
    name: USERS_SEARCH_INDEX,
    dataType: "string",
    prefix: "user:",
    schema: {
      userId: { type: "KEYWORD" },
      username: { type: "KEYWORD" },
      name: { type: "TEXT" },
      updatedAt: { type: "DATE", fast: true },
      createdAt: { type: "DATE", fast: true },
      userCreatedAt: { type: "U64", fast: true },
    },
  },
  {
    name: CARDS_SEARCH_INDEX,
    dataType: "string",
    prefix: "cards:",
    schema: {
      userId: { type: "U64", fast: true },
      updatedAt: { type: "DATE", fast: true },
    },
  },
  {
    name: ACTIVITY_SEARCH_INDEX,
    dataType: "string",
    prefix: USER_ACTIVITY_KEY_PREFIX,
    schema: {
      lastCardRequestAt: { type: "DATE", fast: true },
    },
  },
];

/** Keys returned by one lookup, plus whether the caller's cap cut it short. @source */
export interface SearchKeyResult {
  keys: string[];
  /** True when more matches exist than were returned. */
  truncated: boolean;
}

/** Result document shape returned by a query. @source */
interface SearchQueryResult {
  key: string;
}

/** The subset of the index handle these helpers use. @source */
interface SearchIndexHandle {
  query(options: Record<string, unknown>): Promise<SearchQueryResult[]>;
  describe(): Promise<unknown>;
}

/** The subset of the Redis client these helpers use. @source */
interface SearchCapableClient {
  search?: {
    index(params: { name: string }): SearchIndexHandle;
    createIndex(params: Record<string, unknown>): Promise<unknown>;
  };
}

/**
 * Filter that returns every searchable document.
 *
 * Deliberately empty. A date filter such as `updatedAt >= epoch` looks like it
 * selects the same documents, but it drops a record whose timestamp is
 * missing or unparseable, and dropping those from the listing is not the same
 * as dropping them from the index: reconciliation treats an absent key as
 * absent storage. Verified against a live index: a record with
 * `updatedAt: "not-a-date"` is returned by `{}` and omitted by the range
 * filter. The scan this replaces returned it too.
 * @source
 */
const MATCH_ALL_DOCUMENTS: Record<string, unknown> = {};

/**
 * How long a negative availability probe is trusted. A positive result is kept
 * forever, because an index does not disappear on its own. A negative one
 * expires so an index created later is picked up without a redeploy.
 * @source
 */
const AVAILABILITY_RECHECK_MS = 5 * 60 * 1000;

/** Offset accepted by `SEARCH.QUERY`. Deeper paging is not supported. @source */
const MAX_QUERY_OFFSET = 10_000;

/** Results requested per round trip. The command caps this at 1,000. @source */
const QUERY_PAGE_SIZE = 1_000;

interface Availability {
  available: boolean;
  checkedAt: number;
}

const availabilityByIndex = new Map<string, Availability>();
const reportedFailures = new Set<string>();

/**
 * Reads the search surface off a client, or undefined when the SDK or the
 * server does not provide it. The test double for `@upstash/redis` has no
 * `search` property, which is how the suite keeps exercising the scan path.
 * @param client - Redis client to inspect.
 * @returns The search surface, or undefined when unavailable.
 * @source
 */
function readSearchSurface(
  client: Redis,
): SearchCapableClient["search"] | undefined {
  const candidate = (client as unknown as SearchCapableClient).search;
  return candidate && typeof candidate.index === "function"
    ? candidate
    : undefined;
}

/**
 * Logs a failure once per index name. A cron run would otherwise repeat the
 * same warning on every repair until the index is created.
 * @param name - Index name.
 * @param what - Short description of what failed.
 * @param error - Thrown value.
 * @source
 */
function reportFailure(name: string, what: string, error: unknown): void {
  if (reportedFailures.has(name)) return;
  reportedFailures.add(name);
  console.warn(
    `[Redis Search] ${name} ${what}; using the scan path: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
}

/**
 * Returns a handle to an existing index, or null when the index is missing or
 * the server does not implement `SEARCH.*`.
 *
 * `describe()` separates the two failure modes: null for a missing index, a
 * thrown error for an unsupported command. Both land on the scan fallback.
 *
 * @param client - Redis client used for the probe.
 * @param name - Index name.
 * @returns The handle, or null when queries cannot run.
 * @source
 */
async function getIndexHandle(
  client: Redis,
  name: string,
): Promise<SearchIndexHandle | null> {
  const search = readSearchSurface(client);
  if (!search) return null;

  const cached = availabilityByIndex.get(name);
  if (
    cached &&
    (cached.available || Date.now() - cached.checkedAt < AVAILABILITY_RECHECK_MS)
  ) {
    return cached.available ? search.index({ name }) : null;
  }

  let available = false;
  try {
    available = (await search.index({ name }).describe()) !== null;
  } catch (error) {
    reportFailure(name, "is unavailable", error);
  }

  availabilityByIndex.set(name, { available, checkedAt: Date.now() });
  return available ? search.index({ name }) : null;
}

/**
 * Forgets the availability probe for one index.
 *
 * Used by the operator script after it creates an index in the same process,
 * and by tests that need a fresh probe.
 * @param name - Index name, or every index when omitted.
 * @source
 */
export function resetSearchAvailability(name?: string): void {
  if (name === undefined) {
    availabilityByIndex.clear();
    reportedFailures.clear();
    return;
  }
  availabilityByIndex.delete(name);
  reportedFailures.delete(name);
}

/**
 * Reads matching document keys, paging until the cap is reached or the result
 * set ends.
 *
 * Requests one extra key to learn whether the cap cut the list short. The
 * caller can then decide: reconciliation can work from a slice, while an index
 * rebuild must not, because a partial rebuild would drop live users.
 *
 * @param client - Redis client.
 * @param indexName - Index to query.
 * @param filter - JSON filter object.
 * @param limit - Maximum keys to return.
 * @returns Keys and whether they were truncated, or null when the index cannot
 *   answer at all.
 * @source
 */
async function queryIndexKeys(
  client: Redis,
  indexName: string,
  filter: Record<string, unknown>,
  limit: number,
): Promise<SearchKeyResult | null> {
  const index = await getIndexHandle(client, indexName);
  if (!index || limit <= 0) return null;

  const wanted = limit + 1;
  const keys: string[] = [];
  let offset = 0;

  try {
    for (;;) {
      const pageSize = Math.min(QUERY_PAGE_SIZE, wanted - keys.length);
      const results = await index.query({
        filter,
        select: {},
        limit: pageSize,
        offset,
      });

      for (const result of results) {
        if (result && typeof result.key === "string") keys.push(result.key);
      }

      if (results.length < pageSize) break;
      if (keys.length >= wanted) break;

      offset += pageSize;
      if (offset + QUERY_PAGE_SIZE > MAX_QUERY_OFFSET) {
        throw new Error(
          `more than ${MAX_QUERY_OFFSET} matches; the query cannot page further`,
        );
      }
    }
  } catch (error) {
    reportFailure(indexName, "query failed", error);
    return null;
  }

  return {
    keys: keys.slice(0, limit),
    truncated: keys.length > limit,
  };
}

/**
 * Lists `cards:` keys.
 *
 * Replaces `SCAN cards:*` in the orphan audit. The audit still reads each
 * candidate and applies its own age rule, so the deletion decision is
 * unchanged. A record that carries no schema field is not searchable and is
 * therefore absent from the listing; `store-cards` always writes `userId` and
 * `updatedAt`, so only a hand-written key would be missed.
 *
 * @param client - Redis client.
 * @param limit - Maximum keys to return.
 * @returns Keys and whether the cap cut them short, or null when the index
 *   cannot answer.
 * @source
 */
export async function queryCardKeys(
  client: Redis,
  limit: number,
): Promise<SearchKeyResult | null> {
  return queryIndexKeys(
    client,
    CARDS_SEARCH_INDEX,
    MATCH_ALL_DOCUMENTS,
    limit,
  );
}

/**
 * Lists `user:<id>:meta` keys.
 *
 * The suffix check keeps the listing to meta parts. The other nine parts of a
 * user record match the `user:` prefix, but they carry no schema field and so
 * are not searchable; the guard covers a part that later gains one.
 *
 * A meta with no readable `updatedAt` is still returned, because the rebuild
 * scores it with `USER_REFRESH_INDEX_UNREADABLE_SCORE` rather than skipping it.
 * That is the same outcome the scan produced.
 *
 * @param client - Redis client.
 * @param limit - Maximum keys to return.
 * @returns Keys and whether the cap cut them short, or null when the index
 *   cannot answer.
 * @source
 */
export async function queryUserMetaKeys(
  client: Redis,
  limit: number,
): Promise<SearchKeyResult | null> {
  const result = await queryIndexKeys(
    client,
    USERS_SEARCH_INDEX,
    MATCH_ALL_DOCUMENTS,
    limit,
  );
  if (!result) return null;
  return {
    keys: result.keys.filter((key) => key.endsWith(":meta")),
    truncated: result.truncated,
  };
}

/**
 * Lists the `user_activity:` keys recorded since a point in time.
 *
 * Answers "which users requested a card in the last N days" without scanning
 * the key family. The caller does not need this today: `getUserActivity` reads
 * one key by ID. It exists for reporting, and it is the reason the stored value
 * became a JSON object.
 *
 * Keys written by the previous bare-string format are not indexed, because a
 * `STRING` index cannot read a field out of a plain string. Those keys expire
 * on their own within the activity window, and each one becomes indexable the
 * next time that user requests a card.
 *
 * TTL is not a filter here. An expired key is removed from the index when it
 * expires, so every key returned is still live.
 *
 * @param client - Redis client.
 * @param since - Exclusive lower bound on `lastCardRequestAt`.
 * @param limit - Maximum keys to return.
 * @returns Keys and whether the cap cut them short, or null when the index
 *   cannot answer.
 * @source
 */
export async function queryActiveUserKeys(
  client: Redis,
  since: Date,
  limit: number,
): Promise<SearchKeyResult | null> {
  return queryIndexKeys(
    client,
    ACTIVITY_SEARCH_INDEX,
    { lastCardRequestAt: { $gt: since.toISOString() } },
    limit,
  );
}

/** Outcome of one index in {@link applySearchIndexes}. @source */
export interface SearchIndexApplyResult {
  name: string;
  /**
   * `created` when the index is new, `present` when an identical index already
   * exists, `rejected` when the server refused it.
   */
  outcome: "created" | "present" | "rejected";
  /** The server's message, present only on `rejected`. */
  reason?: string;
}

/**
 * Creates every index in {@link SEARCH_INDEX_DEFINITIONS}.
 *
 * Each index is applied on its own, so a refusal does not stop the rest. On a
 * one-index plan the second definition is rejected with a max-index error, and
 * the runtime then falls back to the scan for that key family.
 *
 * `existsOk` makes a second run a no-op. It only tolerates an *identical*
 * definition: a changed schema is reported as "already exists with a different
 * configuration", because SEARCH cannot alter a schema in place. Drop the
 * index and run again to apply a schema change.
 *
 * Index creation is an operator step. The SDK documentation asks that it not
 * run inside a serverless function.
 *
 * @param client - Redis client with a token for the target database.
 * @returns One outcome per definition, in definition order.
 * @source
 */
export async function applySearchIndexes(
  client: Redis,
): Promise<SearchIndexApplyResult[]> {
  const search = readSearchSurface(client);
  if (!search || typeof search.createIndex !== "function") {
    throw new Error(
      "This database does not expose the SEARCH commands. Use an Upstash Redis database, not a plain Redis server.",
    );
  }

  const results: SearchIndexApplyResult[] = [];
  for (const definition of SEARCH_INDEX_DEFINITIONS) {
    try {
      const created = await search.createIndex({
        ...definition,
        existsOk: true,
      });
      results.push({
        name: definition.name,
        outcome: Number(created) === 1 ? "created" : "present",
      });
    } catch (error) {
      results.push({
        name: definition.name,
        outcome: "rejected",
        reason: error instanceof Error ? error.message : String(error),
      });
    }
    resetSearchAvailability(definition.name);
  }

  return results;
}
