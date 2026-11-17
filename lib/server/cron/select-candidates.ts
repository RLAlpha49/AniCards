/**
 * Candidate selection for the refresh dispatch.
 *
 * The refresh index is a sorted set of every known user, scored by when their
 * stats were last written. A dispatch walks it from the stalest score upward
 * and keeps the first batch of users who are not cooling down.
 *
 * A single page is not enough to fill a batch: cooled-down and stale entries
 * stay in the index until the job reaches them, so they can fill a page on
 * their own and would otherwise stall every later user behind them. Paging is
 * bounded, so a queue that has drifted cannot turn one dispatch into an
 * unbounded number of Redis reads.
 *
 * Selection is read-only and returns data, which makes it testable without a
 * request, a QStash client, or a Redis write.
 *
 * @source
 */

import { redisClient } from "@/lib/api-utils";
import { buildRefreshCooldownKey } from "@/lib/server/refresh-cooldown";
import {
  USER_REFRESH_INDEX_KEY,
  USER_REFRESH_INDEX_UNREADABLE_SCORE,
} from "@/lib/server/user-data";

/** One user in the refresh index, with the score that ordered them. @source */
export type UserRefreshCandidate = { id: string; updatedAt: number };

/** Everything the dispatch reports about how the batch was chosen. @source */
export type UserRefreshIndexSelection = {
  cooldownResults: (string | number | null)[];
  fetchedCandidateIds: string[];
  candidates: UserRefreshCandidate[];
  cooledDownUserIds: Set<string>;
  eligibleUsers: UserRefreshCandidate[];
  indexPagesRead: number;
  indexExhausted: boolean;
};

/** One page of index entries, with the cooldown reads for that page. @source */
type UserRefreshIndexPage = {
  candidateIds: string[];
  candidates: UserRefreshCandidate[];
  cooldowns: (string | number | null)[];
};

/** Users published per run. @source */
export const BATCH_SIZE = 5;
/**
 * Index entries read per page. Five batches wide, so a page can lose users to
 * cooldown and still fill the batch from the rest of the page.
 * @source
 */
const INDEX_WINDOW_PAGE_SIZE = BATCH_SIZE * 5;
/**
 * Maximum index pages read per run. Reasons to page: skipped cooldown entries
 * and index entries whose record is gone. The cap bounds selection to ten
 * ZRANGE and ten MGET commands no matter how far the queue has drifted.
 * @source
 */
const INDEX_WINDOW_PAGE_LIMIT = 10;

async function readRefreshIndexPage(
  start: number,
  seenUserIds: Set<string>,
): Promise<UserRefreshIndexPage | null> {
  const indexEntries = await redisClient.zrange<(number | string)[]>(
    USER_REFRESH_INDEX_KEY,
    start,
    start + INDEX_WINDOW_PAGE_SIZE - 1,
    { withScores: true },
  );

  const candidates: UserRefreshCandidate[] = [];
  for (let i = 0; i + 1 < indexEntries.length; i += 2) {
    const id = String(indexEntries[i]);
    if (!/^\d+$/.test(id)) continue;
    if (seenUserIds.has(id)) continue;
    seenUserIds.add(id);
    candidates.push({
      id,
      updatedAt: Number(indexEntries[i + 1]) || 0,
    });
  }

  if (candidates.length === 0) return null;

  const candidateIds = candidates.map(({ id }) => id);
  const cooldownKeys = candidateIds.map(buildRefreshCooldownKey);
  const cooldowns = await redisClient.mget<(string | number | null)[]>(
    ...cooldownKeys,
  );

  return { candidateIds, candidates, cooldowns };
}

function collectEligibleRefreshCandidates(
  page: UserRefreshIndexPage,
  selection: UserRefreshIndexSelection,
): void {
  for (let i = 0; i < page.candidateIds.length; i++) {
    if (page.cooldowns[i]) {
      selection.cooledDownUserIds.add(page.candidateIds[i]);
      continue;
    }
    selection.candidates.push(page.candidates[i]);
    if (selection.eligibleUsers.length < BATCH_SIZE) {
      selection.eligibleUsers.push(page.candidates[i]);
    }
  }
}

export async function selectRefreshIndexUsers(
  totalUsers: number,
): Promise<UserRefreshIndexSelection> {
  const selection: UserRefreshIndexSelection = {
    cooldownResults: [],
    fetchedCandidateIds: [],
    candidates: [],
    cooledDownUserIds: new Set<string>(),
    eligibleUsers: [],
    indexPagesRead: 0,
    indexExhausted: true,
  };
  const seenUserIds = new Set<string>();

  for (
    let pageNumber = 0;
    pageNumber < INDEX_WINDOW_PAGE_LIMIT &&
    selection.eligibleUsers.length < BATCH_SIZE;
    pageNumber++
  ) {
    const start = pageNumber * INDEX_WINDOW_PAGE_SIZE;
    if (start >= totalUsers) {
      selection.indexExhausted = true;
      break;
    }

    selection.indexPagesRead++;
    selection.indexExhausted = start + INDEX_WINDOW_PAGE_SIZE >= totalUsers;

    const page = await readRefreshIndexPage(start, seenUserIds);
    if (!page) continue;

    selection.fetchedCandidateIds.push(...page.candidateIds);
    selection.cooldownResults.push(...page.cooldowns);
    collectEligibleRefreshCandidates(page, selection);
  }

  return selection;
}

/**
 * Formats how long the oldest selected record has been waiting, using its
 * index score, which is already a millisecond timestamp.
 *
 * @param score - Score read from the refresh index, or undefined when nothing
 *   was selected.
 * @returns A minute count, `none` when nothing was selected, or `unknown` for
 *   a score that is not a usable timestamp.
 * @source
 */
export function formatOldestStaleAge(score: number | undefined): string {
  if (score === undefined) return "none";
  if (score === USER_REFRESH_INDEX_UNREADABLE_SCORE) return "unknown";
  // A zero or non-finite score is not a timestamp, so it has no age to report.
  // Printing the epoch-relative difference here would read as tens of millions
  // of minutes and misrepresent the queue's health.
  if (!Number.isFinite(score) || score <= 0) return "unknown";
  return `${Math.floor(Math.max(0, Date.now() - score) / 60_000)} minutes`;
}

/**
 * Measures a value read back from Redis for the payload-size metric.
 *
 * The Upstash client parses stored JSON, so a cooldown written as `"1"` comes
 * back as the number `1`, and an absent key comes back as null. Coercing here
 * keeps the metric from throwing on a numeric reply.
 *
 * @param value - Value returned by a Redis read.
 * @returns Byte length of the value's serialized form, or 0 when it is empty.
 * Never throws on unusual or non-serializable values.
 * @source
 */
export function measureRedisValueBytes(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "string") return Buffer.byteLength(value);
  if (typeof value === "number" || typeof value === "boolean") {
    return Buffer.byteLength(String(value));
  }
  try {
    return Buffer.byteLength(JSON.stringify(value) ?? "");
  } catch {
    // A circular or otherwise unserializable value cannot be stored in Redis
    // either, so it contributes no measurable payload bytes.
    return 0;
  }
}
