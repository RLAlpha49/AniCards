import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import {
  redisClient,
  incrementAnalytics,
  isValidUsername,
  jsonWithCors,
  apiJsonHeaders,
} from "@/lib/api-utils";
import {
  fetchUserDataParts,
  reconstructUserRecord,
  USER_DATA_PARTS,
  type UserDataPart,
} from "@/lib/server/user-data";
import { getUserActivity, type UserActivity } from "@/lib/server/user-activity";

/**
 * A browser may keep a copy but must revalidate it with the ETag before reuse.
 * A record older than the last cron refresh is then a 304 instead of a full
 * body.
 * @source
 */
const USER_RESPONSE_CACHE_CONTROL = "private, no-cache";

/**
 * Parses the `parts` query parameter into stored part names.
 *
 * `meta` is always read because its presence is how the route detects a
 * missing user. An absent or empty parameter keeps the full record, so clients
 * that predate the parameter see no change. Parts are returned in storage
 * order, so the same set always produces the same response and ETag.
 *
 * @param raw - Value of the parts query parameter.
 * @returns Selected parts in storage order, or null when a part is unknown.
 * @source
 */
function parseRequestedParts(raw: string | null): UserDataPart[] | null {
  if (raw === null || raw.trim() === "") return [...USER_DATA_PARTS];

  const requested = new Set<UserDataPart>(["meta"]);
  for (const value of raw.split(",")) {
    const part = value.trim();
    if (!part) continue;
    if (!USER_DATA_PARTS.includes(part as UserDataPart)) return null;
    requested.add(part as UserDataPart);
  }

  return USER_DATA_PARTS.filter((part) => requested.has(part));
}

/**
 * Builds a weak ETag for a user response.
 *
 * Every input the body depends on is part of the tag: the selected parts, the
 * identity fields from meta, the meta timestamp the cron writes, and the
 * activity timestamp the card route writes. A record without a readable
 * `updatedAt` gets no ETag, so a legacy record is never reported as unchanged.
 *
 * @param userDataParts - Parts read for this request.
 * @param selectedParts - Parts the caller asked for.
 * @param activity - Activity state merged into the response.
 * @returns A quoted weak validator, or null when it cannot be built.
 * @source
 */
function buildUserEtag(
  userDataParts: Partial<Record<UserDataPart, unknown>>,
  selectedParts: UserDataPart[],
  activity: UserActivity,
): string | null {
  const meta = userDataParts.meta as
    { updatedAt?: unknown; username?: unknown } | undefined;
  const updatedAt = meta?.updatedAt;
  if (typeof updatedAt !== "string" && typeof updatedAt !== "number") {
    return null;
  }

  const username = typeof meta?.username === "string" ? meta.username : "";
  const digest = createHash("sha256")
    .update(
      [
        String(updatedAt),
        username,
        activity.lastCardRequestAt ?? "",
        selectedParts.join(","),
      ].join("|"),
    )
    .digest("hex")
    .slice(0, 32);
  return `W/"${digest}"`;
}

/**
 * Checks an If-None-Match header against the response ETag.
 *
 * The comparison ignores the weak prefix and covers comma-separated lists and
 * `*`, as RFC 9110 requires for If-None-Match.
 *
 * @param presented - Value of the If-None-Match header, if any.
 * @param etag - ETag the response would carry.
 * @returns True when the stored copy still matches.
 * @source
 */
function etagMatches(presented: string | null, etag: string): boolean {
  if (!presented) return false;
  const target = etag.replace(/^W\//, "");
  return presented.split(",").some((value) => {
    const candidate = value.trim();
    return candidate === "*" || candidate.replace(/^W\//, "") === target;
  });
}

/** Parts that `stats` is rebuilt from. */
const STATS_BACKED_PARTS: UserDataPart[] = [
  "activity",
  "statistics",
  "favourites",
  "pages",
  "planning",
  "current",
  "rewatched",
  "completed",
];

/**
 * Removes the response fields whose stored part the caller did not request.
 *
 * `reconstructUserRecord` fills a default for every missing part, and a
 * default cannot be told apart from the user's real data. `stats` is a merged
 * view of eight parts, so it is returned only for a full read; a partial read
 * gets the individual fields and their real values.
 *
 * @param userData - Reconstructed record for the parts that were read.
 * @param selectedParts - Parts the caller asked for.
 * @returns The record without fields backed by unrequested parts.
 * @source
 */
function projectRequestedParts(
  userData: Record<string, unknown>,
  selectedParts: UserDataPart[],
): Record<string, unknown> {
  const selected = new Set(selectedParts);
  const projected: Record<string, unknown> = { ...userData };
  if (!STATS_BACKED_PARTS.every((part) => selected.has(part))) {
    delete projected.stats;
  }
  for (const field of ["statistics", "favourites", "pages", "aggregates"]) {
    if (!selected.has(field as UserDataPart)) delete projected[field];
  }
  return projected;
}

/**
 * Retrieves user data by userId or username and records analytics around the lookup.
 * @param request - Incoming request with query parameters and headers.
 * @returns NextResponse carrying the user data or the relevant error payload.
 * @source
 */
export async function GET(request: Request) {
  const startTime = Date.now();
  const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
  console.log(`🚀 [User API] Received request from IP: ${ip}`);

  const { searchParams } = new URL(request.url);
  const userIdParam = searchParams.get("userId");
  const usernameParam = searchParams.get("username");

  if (!userIdParam && !usernameParam) {
    console.warn("⚠️ [User API] Missing userId or username parameter");
    incrementAnalytics("analytics:user_api:failed_requests").catch(() => {});
    return jsonWithCors(
      { error: "Missing userId or username parameter" },
      request,
      400,
    );
  }

  const selectedParts = parseRequestedParts(searchParams.get("parts"));
  if (!selectedParts) {
    console.warn("⚠️ [User API] Invalid parts parameter provided");
    incrementAnalytics("analytics:user_api:failed_requests").catch(() => {});
    return jsonWithCors(
      {
        error: `Invalid parts parameter. Allowed: ${USER_DATA_PARTS.join(", ")}`,
      },
      request,
      400,
    );
  }

  let numericUserId: number | null = null;

  if (userIdParam) {
    numericUserId = Number.parseInt(userIdParam, 10);
    if (Number.isNaN(numericUserId)) {
      console.warn(
        `⚠️ [User API] Invalid userId parameter provided: ${userIdParam}`,
      );
      incrementAnalytics("analytics:user_api:failed_requests").catch(() => {});
      return jsonWithCors({ error: "Invalid userId parameter" }, request, 400);
    }
    console.log(`🚀 [User API] Request received for userId: ${numericUserId}`);
  } else {
    if (!isValidUsername(usernameParam)) {
      console.warn(
        `⚠️ [User API] Invalid username parameter provided: ${usernameParam}`,
      );
      incrementAnalytics("analytics:user_api:failed_requests").catch(() => {});
      return jsonWithCors(
        { error: "Invalid username parameter" },
        request,
        400,
      );
    }

    /**
     * Resolves a normalized username to a numeric user ID via the Redis username index.
     * @param u - The username to normalize and resolve.
     * @returns The resolved user ID or null when the lookup fails.
     * @source
     */
    async function resolveUserIdFromUsername(
      u: string,
    ): Promise<number | null> {
      const normalizedUsername = u.trim().toLowerCase();
      const usernameIndexKey = `username:${normalizedUsername}`;
      console.log(
        `🔍 [User API] Searching user index for username: ${normalizedUsername}`,
      );
      const userIdFromIndex = await redisClient.get(usernameIndexKey);
      if (!userIdFromIndex) return null;
      const candidate = Number.parseInt(userIdFromIndex as string, 10);
      if (Number.isNaN(candidate)) return null;
      console.log(
        `🚀 [User API] Request received for username: ${normalizedUsername} (userId: ${candidate})`,
      );
      return candidate;
    }

    const userId = await resolveUserIdFromUsername(usernameParam!);
    if (!userId) {
      console.warn(
        `⚠️ [User API] User not found for username: ${usernameParam}`,
      );
      incrementAnalytics("analytics:user_api:failed_requests").catch(() => {});
      return jsonWithCors({ error: "User not found" }, request, 404);
    }

    numericUserId = userId;
  }

  try {
    const userDataParts = await fetchUserDataParts(
      numericUserId,
      selectedParts,
    );
    const duration = Date.now() - startTime;

    if (!userDataParts.meta) {
      console.warn(
        `⚠️ [User API] User record not found for userId ${numericUserId} [${duration}ms]`,
      );
      return jsonWithCors({ error: "User not found" }, request, 404);
    }

    const userData = reconstructUserRecord(userDataParts);
    // Activity is derived from card requests only, so a cron refresh that
    // rewrites the record does not make the user look active.
    const activity = await getUserActivity(numericUserId);
    const etag = buildUserEtag(userDataParts, selectedParts, activity);
    const responseHeaders: Record<string, string> = {
      ...apiJsonHeaders(request),
      "Cache-Control": USER_RESPONSE_CACHE_CONTROL,
      // A cross-origin caller needs this to send the validator back.
      "Access-Control-Expose-Headers": "ETag",
    };
    if (etag) responseHeaders.ETag = etag;

    console.log(
      `✅ [User API] Successfully fetched and reconstructed user data for user ${numericUserId} [${duration}ms]`,
    );
    incrementAnalytics("analytics:user_api:successful_requests").catch(
      () => {},
    );

    if (etag && etagMatches(request.headers.get("if-none-match"), etag)) {
      return new Response(null, { status: 304, headers: responseHeaders });
    }

    return NextResponse.json(
      {
        ...projectRequestedParts(
          userData as unknown as Record<string, unknown>,
          selectedParts,
        ),
        ...activity,
      } as unknown,
      { headers: responseHeaders },
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(
      `🔥 [User API] Error fetching user data for user ${numericUserId} [${duration}ms]: ${error.message}`,
    );
    if (error.stack) {
      console.error(`💥 [User API] Stack Trace: ${error.stack}`);
    }
    incrementAnalytics("analytics:user_api:failed_requests").catch(() => {});
    return jsonWithCors({ error: "Failed to fetch user data" }, request, 500);
  }
}

export function OPTIONS(request: Request) {
  const headers = apiJsonHeaders(request);
  return new Response(null, {
    headers: {
      ...headers,
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    },
  });
}
