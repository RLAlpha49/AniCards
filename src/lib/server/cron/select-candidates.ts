/**
 * Candidate selection for the refresh dispatch.
 *
 * The refresh index is a sorted set of every known user, scored by when their
 * stats were last written. A dispatch walks it from the stalest score upward
 * and keeps the first batch of users who are not cooling down.
 *
 * The batch is sized from the index rather than fixed. The schedule runs every
 * 30 minutes, so a run has to cover a 48th of the index for every user to be
 * refreshed once a day. A small index still refreshes one user per run, and a
 * large one stops at five.
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

import "server-only";

import { redisClient } from "@/lib/api-utils";
import { buildRefreshCooldownKey } from "@/lib/server/refresh-cooldown";
import {
  USER_REFRESH_INDEX_KEY,
  USER_REFRESH_INDEX_UNREADABLE_SCORE,
} from "@/lib/server/user-data";

/** One user in the refresh index, with the score that ordered them. @source */
type UserRefreshCandidate = { id: string; updatedAt: number };

/** Everything the dispatch reports about how the batch was chosen. @source */
export type UserRefreshIndexSelection = {
  batchSize: number;
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

/** Minutes between two dispatches. The QStash schedule fires every 30. @source */
export const DISPATCH_INTERVAL_MINUTES = 30;

/**
 * Runs the dispatch performs in 24 hours, which is what the batch size divides
 * the index by.
 * @source
 */
export const DISPATCH_RUNS_PER_DAY = (24 * 60) / DISPATCH_INTERVAL_MINUTES;

/** Fewest users one run publishes, even when the index holds a handful. @source */
export const MIN_REFRESH_BATCH_SIZE = 1;

/** Most users one run publishes, which bounds the AniList traffic per run. @source */
export const MAX_REFRESH_BATCH_SIZE = 5;

/**
 * Index entries read per batch slot. A page five batches wide can lose users to
 * cooldown and still fill the batch from the rest of the page.
 * @source
 */
const INDEX_WINDOW_BATCHES_PER_PAGE = 5;

/**
 * Maximum index pages read per run. Reasons to page: skipped cooldown entries
 * and index entries whose record is gone. The cap bounds selection to ten
 * ZRANGE and ten MGET commands no matter how far the queue has drifted or how
 * small the batch is.
 * @source
 */
const INDEX_WINDOW_PAGE_LIMIT = 10;

/**
 * Sizes one run so every indexed user is refreshed within 24 hours.
 *
 * Every user has to be visited once a day and the dispatch runs every 30
 * minutes, so one run covers a 48th of the index. The result is clamped: a
 * small index still refreshes one user per run, and a large one stops at five
 * so a run cannot spend more of the AniList budget than the schedule can
 * absorb. The cap also caps daily coverage at 240 users; past that point the
 * slowest refresh cycle is longer than a day.
 *
 * @param totalUsers - Number of users in the refresh index.
 * @returns Users to publish this run, or 0 when the index is empty.
 * @source
 */
export function calculateRefreshBatchSize(totalUsers: number): number {
  if (!Number.isFinite(totalUsers) || totalUsers <= 0) return 0;
  const perRun = Math.ceil(totalUsers / DISPATCH_RUNS_PER_DAY);
  return Math.min(
    MAX_REFRESH_BATCH_SIZE,
    Math.max(MIN_REFRESH_BATCH_SIZE, perRun),
  );
}

async function readRefreshIndexPage(
  start: number,
  pageSize: number,
  seenUserIds: Set<string>,
): Promise<UserRefreshIndexPage | null> {
  const indexEntries = await redisClient.zrange<(number | string)[]>(
    USER_REFRESH_INDEX_KEY,
    start,
    start + pageSize - 1,
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
  batchSize: number,
): void {
  for (let i = 0; i < page.candidateIds.length; i++) {
    if (page.cooldowns[i]) {
      selection.cooledDownUserIds.add(page.candidateIds[i]);
      continue;
    }
    selection.candidates.push(page.candidates[i]);
    if (selection.eligibleUsers.length < batchSize) {
      selection.eligibleUsers.push(page.candidates[i]);
    }
  }
}

export async function selectRefreshIndexUsers(
  totalUsers: number,
): Promise<UserRefreshIndexSelection> {
  const batchSize = calculateRefreshBatchSize(totalUsers);
  const pageSize = batchSize * INDEX_WINDOW_BATCHES_PER_PAGE;
  const selection: UserRefreshIndexSelection = {
    batchSize,
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
    selection.eligibleUsers.length < batchSize;
    pageNumber++
  ) {
    const start = pageNumber * pageSize;
    if (start >= totalUsers) {
      selection.indexExhausted = true;
      break;
    }

    selection.indexPagesRead++;
    selection.indexExhausted = start + pageSize >= totalUsers;

    const page = await readRefreshIndexPage(start, pageSize, seenUserIds);
    if (!page) continue;

    selection.fetchedCandidateIds.push(...page.candidateIds);
    selection.cooldownResults.push(...page.cooldowns);
    collectEligibleRefreshCandidates(page, selection, batchSize);
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
