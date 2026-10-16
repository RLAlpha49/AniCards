import { Redis } from "@upstash/redis";
import { USER_STATS_QUERY } from "@/lib/anilist/queries";
import {
  displayNames,
  validateAndNormalizeUserRecord,
} from "@/lib/card-data/validation";
import { splitUserRecord } from "@/lib/server/user-data";
import type { UserRecord } from "@/lib/types/records";

const DEFAULT_LOCAL_REDIS_URL = "http://localhost:8079";
const DEFAULT_LOCAL_REDIS_TOKEN = "local_dev_token";
const ANI_LIST_REQUEST_TIMEOUT_MS = 15_000;
const ANI_LIST_MAX_RETRIES = 3;
const ANI_LIST_RETRY_DELAY_MS = 500;
const USER_ID = 542244;
const USERNAME = "Alpha49";
const FAVORITE_CARD_NAMES = new Set([
  "animeVoiceActors",
  "animeStudios",
  "animeStaff",
  "mangaStaff",
]);
const PIE_CARD_NAMES = new Set([
  "animeGenres",
  "animeTags",
  "animeVoiceActors",
  "animeStudios",
  "animeStaff",
  "animeStatusDistribution",
  "animeFormatDistribution",
  "animeCountry",
  "mangaGenres",
  "mangaTags",
  "mangaStaff",
  "mangaStatusDistribution",
  "mangaFormatDistribution",
  "mangaCountry",
]);

function assertLocalRedis(url: string): void {
  const parsed = new URL(url);
  const isHostLoopback = ["localhost", "127.0.0.1"].includes(parsed.hostname);
  const isComposeProxy =
    parsed.hostname === "serverless-redis-http" &&
    (parsed.port === "" || parsed.port === "80");
  if (
    parsed.protocol !== "http:" ||
    (!(isHostLoopback && parsed.port) && !isComposeProxy)
  ) {
    throw new Error(
      `Refusing to seed non-local Redis URL: ${url}. Expected a loopback address or the Compose Redis proxy.`,
    );
  }
}

function isTransientAniListStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function waitForRetry(delayMs: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.reject(signal.reason ?? new Error("Seed was cancelled."));
  }

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
      reject(signal.reason ?? new Error("Seed was cancelled."));
    };
    const timeout = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);

    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
}

async function fetchUserRecord(signal: AbortSignal): Promise<UserRecord> {
  let payload: unknown;

  for (let attempt = 0; attempt <= ANI_LIST_MAX_RETRIES; attempt += 1) {
    if (signal.aborted) {
      throw signal.reason ?? new Error("Seed was cancelled.");
    }

    const timeoutSignal = AbortSignal.timeout(ANI_LIST_REQUEST_TIMEOUT_MS);
    const requestSignal = AbortSignal.any([signal, timeoutSignal]);

    try {
      const response = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          query: USER_STATS_QUERY,
          variables: { userId: USER_ID },
        }),
        signal: requestSignal,
      });

      if (!response.ok) {
        if (
          !isTransientAniListStatus(response.status) ||
          attempt === ANI_LIST_MAX_RETRIES
        ) {
          throw new Error(
            `AniList request failed with HTTP ${response.status}.`,
          );
        }

        await response.body?.cancel();
        await waitForRetry(ANI_LIST_RETRY_DELAY_MS * 2 ** attempt, signal);
        continue;
      }

      payload = await response.json();
      break;
    } catch (error: unknown) {
      if (signal.aborted) {
        throw signal.reason ?? error;
      }

      const isTransientNetworkError =
        timeoutSignal.aborted || error instanceof TypeError;
      if (!isTransientNetworkError || attempt === ANI_LIST_MAX_RETRIES) {
        throw error;
      }

      await waitForRetry(ANI_LIST_RETRY_DELAY_MS * 2 ** attempt, signal);
    }
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("AniList returned an invalid response.");
  }

  const result = payload as {
    data?: Record<string, unknown>;
    errors?: { message?: string }[];
  };
  if (result.errors?.length) {
    throw new Error(
      `AniList query failed: ${result.errors.map((error) => error.message).join("; ")}`,
    );
  }
  if (!result.data?.User || typeof result.data.User !== "object") {
    throw new Error(`AniList user ${USERNAME} was not found.`);
  }

  const user = result.data.User as {
    name?: string;
    statistics?: { anime?: { count?: number }; manga?: { count?: number } };
  };
  if (user.name?.toLowerCase() !== USERNAME.toLowerCase()) {
    throw new Error(
      `AniList returned unexpected user ${user.name ?? "(no name)"}.`,
    );
  }
  if (!user.statistics?.anime || !user.statistics.manga) {
    throw new Error(`AniList returned incomplete statistics for ${USERNAME}.`);
  }

  const now = new Date().toISOString();
  const normalized = validateAndNormalizeUserRecord({
    userId: String(USER_ID),
    username: USERNAME,
    createdAt: now,
    updatedAt: now,
    stats: result.data as unknown as UserRecord["stats"],
  });
  if ("error" in normalized) {
    throw new Error(
      `AniList profile could not be normalized: ${normalized.error}`,
    );
  }
  return normalized.normalized;
}

function makeCardConfigurations() {
  return Object.keys(displayNames).map((cardName) => ({
    cardName,
    variation:
      cardName === "activityHeatmap"
        ? "github"
        : cardName === "favoritesGrid"
          ? "mixed"
          : FAVORITE_CARD_NAMES.has(cardName)
            ? "bar"
            : PIE_CARD_NAMES.has(cardName)
              ? "bar"
              : "default",
    colorPreset: "anilistDark",
    ...(FAVORITE_CARD_NAMES.has(cardName) ? { showFavorites: true } : {}),
    ...(cardName === "favoritesGrid" ? { gridCols: 3, gridRows: 3 } : {}),
  }));
}

async function main(): Promise<void> {
  const url =
    process.env.LOCAL_REDIS_URL ??
    process.env.UPSTASH_REDIS_REST_URL ??
    DEFAULT_LOCAL_REDIS_URL;
  assertLocalRedis(url);

  const token =
    process.env.LOCAL_REDIS_TOKEN ??
    process.env.UPSTASH_REDIS_REST_TOKEN ??
    DEFAULT_LOCAL_REDIS_TOKEN;
  const redis = new Redis({ url, token });
  const pong = await redis.ping();
  if (pong !== "PONG") throw new Error("Local Redis did not return PONG.");

  const abortController = new AbortController();
  const abortSeed = () => abortController.abort();
  process.once("SIGINT", abortSeed);
  process.once("SIGTERM", abortSeed);

  let record: UserRecord;
  try {
    record = await fetchUserRecord(abortController.signal);
  } finally {
    process.off("SIGINT", abortSeed);
    process.off("SIGTERM", abortSeed);
  }

  const split = splitUserRecord(record);

  const pipeline = redis.pipeline();
  for (const [part, value] of Object.entries(split)) {
    pipeline.set(`user:${USER_ID}:${part}`, JSON.stringify(value));
  }
  pipeline.set(`username:${USERNAME.toLowerCase()}`, String(USER_ID));
  pipeline.set(
    `cards:${USER_ID}`,
    JSON.stringify({
      userId: USER_ID,
      updatedAt: record.updatedAt,
      cards: makeCardConfigurations(),
    }),
  );

  await pipeline.exec();
  console.log(
    `Seeded AniList user ${USERNAME} (userId=${USER_ID}) with ${Object.keys(displayNames).length} supported card configurations into ${url}.`,
  );
}

main().catch((error: unknown) => {
  console.error("Local Redis seed failed:", error);
  process.exitCode = 1;
});
