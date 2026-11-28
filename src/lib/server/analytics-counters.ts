/**
 * Best-effort analytics counters.
 *
 * `incrementAnalytics` swallows its own errors, and `runAfterResponse` hands
 * work to Next's `after` so counting never delays a card response.
 * @source
 */
import { after } from "next/server";
import { Redis } from "@upstash/redis";
import { logWith } from "@/lib/log";
import { redisClient } from "@/lib/server/redis";

/**
 * Safely increments a Redis-based analytics counter. This function
 * intentionally swallows errors to avoid affecting primary request paths.
 * @param metric - Redis key for the analytics counter to increment.
 * @source
 */
export async function incrementAnalytics(metric: string): Promise<void> {
  try {
    await redisClient.incr(metric);
  } catch (error) {
    // Silently fail analytics to avoid affecting main functionality
    logWith(
      "warn",
      "Analytics",
      `Failed to increment analytics for ${metric}:`,
      error,
    );
  }
}

/**
 * Hands a best-effort write to Next's `after`, so the response is sent now
 * while the write is still guaranteed to land.
 *
 * A serverless runtime can freeze an invocation the moment its response is
 * returned, which drops any Redis command still in flight. `after` keeps the
 * invocation alive until the promise settles without delaying the response.
 * Outside a request scope (unit tests, scripts) `after` throws, and the write
 * is left to settle on its own, which is enough for a process that will not be
 * frozen.
 *
 * @param task - Promise for a write that must not block the response, or
 *   undefined when there is nothing to keep alive.
 * @source
 */
export function runAfterResponse(task: Promise<unknown> | undefined): void {
  if (!task) return;
  try {
    after(task);
  } catch {
    /* no request scope; let the write settle on its own */
    void task.catch(() => {});
  }
}

/**
 * Increments an analytics counter without delaying the response.
 *
 * The counter is part of the request's evidence trail, not part of its
 * answer, so it must neither block the caller nor be dropped when the runtime
 * freezes the invocation. See {@link runAfterResponse}.
 *
 * @param metric - Redis key for the analytics counter to increment.
 * @source
 */
export function incrementAnalyticsInBackground(metric: string): void {
  runAfterResponse(incrementAnalytics(metric));
}

/**
 * Build a canonical analytics Redis key using a stable endpoint key.
 * Example: buildAnalyticsMetricKey("store_cards", "failed_requests")
 * returns "analytics:store_cards:failed_requests".
 * An optional extraSuffix is appended if provided for more granular metrics.
 */
export function buildAnalyticsMetricKey(
  endpointKey: string,
  metric: string,
  extraSuffix?: string,
): string {
  const normalized = String(endpointKey).toLowerCase().replaceAll(/\s+/g, "_");
  const base = `analytics:${normalized}:${metric}`;
  return extraSuffix ? `${base}:${extraSuffix}` : base;
}
