/**
 * Per-request batched observability for the card endpoint.
 *
 * A card request used to send each analytics counter and each URL-profile
 * write as its own Redis call. A cache miss cost three: one `INCR` for the
 * cache outcome, one for the success counter, and one pipeline for the URL
 * tracker. A cache hit cost two. That traffic is only read by dashboards and
 * by the `cards:<id>` removal audit.
 *
 * This module queues every counter for one request onto a single pipeline.
 * Callers record an outcome at the point they learn it and send the batch
 * once, at the request's terminal point. If nothing was recorded, nothing is
 * sent.
 *
 * A cache hit sends the batch through {@link CardRequestMetrics.flushInBackground},
 * because the response is already rendered and must not wait on analytics. A
 * cache miss sends it through {@link CardRequestMetrics.flush} before returning,
 * because the tracker data decides the `cards:<id>` migration.
 *
 * Failures are logged and swallowed, as before: observability never changes
 * the card response.
 *
 * @source
 */

import { after } from "next/server";
import { buildAnalyticsMetricKey, redisClient } from "@/lib/api-utils";
import {
  queueCardUrlProfileWrites,
  type CardUrlOutcome,
  type CardUrlProfilePipeline,
  type CardUrlUserIdentifier,
} from "@/lib/server/url-usage";

/** Analytics endpoint key shared by every card counter. @source */
const CARD_SVG_METRIC_ENDPOINT = "card_svg";

/** The pipeline calls this module needs from `@upstash/redis`. @source */
interface CardMetricsPipeline extends CardUrlProfilePipeline {
  incr(key: string): unknown;
  exec(): Promise<unknown>;
}

/** Batched observability writes for one card request. @source */
export interface CardRequestMetrics {
  /** Queues the cache hit or miss counter. */
  recordCache(outcome: "hit" | "miss"): void;
  /** Queues the successful card counter. */
  recordSuccess(): void;
  /** Queues the failed card counter. */
  recordFailure(): void;
  /**
   * Queues the URL profile counters for the cards-key removal audit.
   *
   * @param profile - Canonical profile from `buildCardUrlProfile`.
   * @param outcome - Cache outcome and response status for this request.
   * @param userIdentifier - URL user identifier for database-dependent
   *   profiles, when the request supplies one.
   */
  recordUrlProfile(
    profile: string,
    outcome: CardUrlOutcome,
    userIdentifier?: CardUrlUserIdentifier,
  ): void;
  /**
   * Sends every queued command in one pipeline and clears the queue.
   *
   * Resolves once the pipeline has run, or once a failure has been logged.
   * Further calls do nothing until another outcome is recorded, so a request
   * can flush once without every caller having to coordinate.
   */
  flush(): Promise<void>;
  /**
   * Sends the queued commands without delaying the response.
   *
   * The pipeline runs inside Next's `after`, so a serverless runtime does not
   * freeze before it lands. Outside a request scope (unit tests, scripts) it
   * runs detached instead.
   */
  flushInBackground(): void;
}

/**
 * Creates the metrics collector for one card request.
 *
 * @returns A collector that holds at most one pipeline for its lifetime.
 * @source
 */
export function createCardRequestMetrics(): CardRequestMetrics {
  let pipeline: CardMetricsPipeline | undefined;

  const queue = (): CardMetricsPipeline => {
    pipeline ??= redisClient.pipeline() as unknown as CardMetricsPipeline;
    return pipeline;
  };

  const takePipeline = (): CardMetricsPipeline | undefined => {
    const pending = pipeline;
    pipeline = undefined;
    return pending;
  };

  return {
    recordCache(outcome) {
      queue().incr(
        buildAnalyticsMetricKey(
          CARD_SVG_METRIC_ENDPOINT,
          outcome === "hit" ? "cache_hits" : "cache_misses",
        ),
      );
    },

    recordSuccess() {
      queue().incr(
        buildAnalyticsMetricKey(
          CARD_SVG_METRIC_ENDPOINT,
          "successful_requests",
        ),
      );
    },

    recordFailure() {
      queue().incr(
        buildAnalyticsMetricKey(CARD_SVG_METRIC_ENDPOINT, "failed_requests"),
      );
    },

    recordUrlProfile(profile, outcome, userIdentifier) {
      queueCardUrlProfileWrites(queue(), profile, outcome, userIdentifier);
    },

    async flush() {
      await takePipeline()
        ?.exec()
        .catch((error: unknown) => {
          console.warn("[Card Metrics] Failed to record card metrics:", error);
        });
    },

    flushInBackground() {
      const pending = takePipeline();
      if (!pending) return;

      const run = () =>
        pending.exec().catch((error: unknown) => {
          console.warn("[Card Metrics] Failed to record card metrics:", error);
        });

      try {
        after(run());
      } catch {
        void run();
      }
    },
  };
}
