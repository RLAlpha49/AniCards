import { Client, type FlowControl } from "@upstash/qstash";

/**
 * Flow control for the per-user refresh messages.
 *
 * `rate: 60, period: "1m"` keeps cron traffic at 60 AniList requests a
 * minute, which leaves room for the generator's `/api/anilist` calls. Revise
 * the rate against the `X-RateLimit-Remaining` header AniList reports, not a
 * guess.
 *
 * `parallelism: 10` is the free plan ceiling. A pay-as-you-go account raises
 * the ceiling, so the value only needs to stay at or below it.
 * @source
 */
export const REFRESH_FLOW_CONTROL = {
  key: "anilist-refresh",
  rate: 60,
  period: "1m",
  parallelism: 10,
} satisfies FlowControl;

/** Delivery attempts QStash makes for one refresh message. @source */
export const REFRESH_MESSAGE_RETRIES = 3;

let client: Client | undefined;

/**
 * Returns the shared QStash client.
 *
 * The client is created on first use so importing a route does not read the
 * environment or open a connection. A missing token fails here rather than
 * producing an unauthorized publish later.
 *
 * @returns The QStash client configured from the environment.
 * @source
 */
export function getQstashClient(): Client {
  if (!client) {
    const token = process.env.QSTASH_TOKEN;
    if (!token) {
      throw new Error("QSTASH_TOKEN is not configured");
    }
    client = new Client({ token });
  }
  return client;
}
