/**
 * URL usage tracking for the `cards:<userId>` removal audit.
 *
 * Records a canonical profile for each valid card SVG request so the audit can
 * report which URL shapes people use and how many of them still need the stored
 * card configuration. A separate daily hash maps database-dependent profiles
 * to the URL's user identifier, stored as either `userId` or `userName`.
 * Neither hash stores IP addresses or cache-busting parameters, and both expire
 * after 90 days.
 *
 * @source
 */

import { redisClient } from "@/lib/api-utils";
import { colorPresets } from "@/components/stat-card-generator/constants";
import { clampBorderRadius } from "@/lib/utils";
import type { CardConfigClassification } from "@/lib/card-data/config";

/** Redis key prefix for daily card URL profile buckets. @source */
const CARD_URL_PROFILE_PREFIX = "card_url_profiles";

/** Redis key prefix for daily users of database-backed URL profiles. @source */
const CARD_URL_USER_PROFILE_PREFIX = "card_url_user_profiles";

/** Retention for daily profile buckets, matching the analytics report window. @source */
const CARD_URL_PROFILE_TTL_SECONDS = 90 * 24 * 60 * 60;

/** Route paths that reach the card handler, including both rewrite aliases. @source */
const KNOWN_ROUTE_PATHS = new Set(["/card.svg", "/api/card.svg", "/api/card"]);

/**
 * Renderable card variations. Mirrors the keys of `VARIATION_LABEL_MAP` in
 * `lib/card-groups.ts`; `tests/unit/server/url-usage.test.ts` fails when the
 * two lists drift apart.
 * @source
 */
export const KNOWN_VARIATIONS = new Set([
  "default",
  "vertical",
  "compact",
  "minimal",
  "badges",
  "pie",
  "donut",
  "bar",
  "radar",
  "horizontal",
  "cumulative",
  "anime",
  "manga",
  "characters",
  "staff",
  "studios",
  "mixed",
  "github",
  "fire",
  "combined",
  "split",
]);

/** Card types whose URL may carry a favorites flag. @source */
const FAVORITES_CARD_TYPES = new Set([
  "animeVoiceActors",
  "animeStudios",
  "animeStaff",
  "mangaStaff",
]);

/** Card types whose URL may carry a status-colors flag. @source */
const STATUS_COLOR_CARD_TYPES = new Set([
  "animeStatusDistribution",
  "mangaStatusDistribution",
]);

/** Variations that render pie-like charts and may carry pie percentages. @source */
const PIE_VARIATIONS = new Set(["pie", "donut"]);

/** Validated request fields needed to build a canonical URL profile. @source */
export interface CardUrlProfileInput {
  /** Client-facing pathname, for example `/card.svg` or `/api/card.svg`. */
  routePath: string;
  /** Validated card type, which may carry a variation suffix. */
  cardType: string;
  /** Card type with any variation suffix removed. */
  baseCardType: string;
  /** Explicit `variation` query parameter, when present. */
  variationParam: string | null;
  colorPresetParam: string | null;
  titleColorParam: string | null;
  backgroundColorParam: string | null;
  textColorParam: string | null;
  circleColorParam: string | null;
  borderColorParam: string | null;
  borderRadiusParam: string | null;
  showFavoritesParam: string | null;
  statusColorsParam: string | null;
  piePercentagesParam: string | null;
  gridColsParam: string | null;
  gridRowsParam: string | null;
  /** Whether the URL alone can render the card, and why not when it cannot. */
  classification: CardConfigClassification;
}

/** Cache outcome and response status recorded alongside a URL profile. @source */
export interface CardUrlOutcome {
  cache: "hit" | "stale" | "miss";
  status: number;
}

/** User identifier supplied by the card URL. @source */
export interface CardUrlUserIdentifier {
  type: "userId" | "userName";
  value: string;
}

/**
 * The pipeline surface the profile writes need. Structural, so callers can pass
 * a real `@upstash/redis` pipeline and tests can pass a stub.
 * @source
 */
export interface CardUrlProfilePipeline {
  hincrby(key: string, field: string, increment: number): unknown;
  expire(key: string, seconds: number, option: "NX"): unknown;
}

/**
 * Builds the Redis key for a day's URL profile bucket.
 * @param now - Timestamp used to pick the UTC day; defaults to the current time.
 * @returns Key in the form `card_url_profiles:<YYYY-MM-DD>`.
 * @source
 */
export function buildCardUrlProfileKey(now: Date = new Date()): string {
  return `${CARD_URL_PROFILE_PREFIX}:${now.toISOString().slice(0, 10)}`;
}

/**
 * Builds the Redis key for a day's user-to-profile counts.
 * @param now - Timestamp used to pick the UTC day; defaults to the current time.
 * @returns Key in the form `card_url_user_profiles:<YYYY-MM-DD>`.
 * @source
 */
export function buildCardUrlUserProfileKey(now: Date = new Date()): string {
  return `${CARD_URL_USER_PROFILE_PREFIX}:${now.toISOString().slice(0, 10)}`;
}

/**
 * Maps an HTTP status to a coarse class so the report stays readable.
 * @param status - Response status code.
 * @returns One of `2xx`, `3xx`, `4xx`, `5xx`, or `other`.
 * @source
 */
export function statusClass(status: number): string {
  if (status >= 500) return "5xx";
  if (status >= 400) return "4xx";
  if (status >= 300) return "3xx";
  if (status >= 200) return "2xx";
  return "other";
}

/**
 * Restricts the recorded pathname to the routes that reach the card handler.
 * @param pathname - Pathname taken from the request URL.
 * @returns The pathname when known, otherwise `/other`.
 * @source
 */
function normalizeRoutePath(pathname: string): string {
  return KNOWN_ROUTE_PATHS.has(pathname) ? pathname : "/other";
}

/**
 * Resolves the variation a request asks for, preferring the explicit
 * `variation` parameter over a suffix on the card type.
 * @param input - Validated request fields.
 * @returns A known variation name, `default`, or `unknown`.
 * @source
 */
function resolveVariation(input: CardUrlProfileInput): string {
  if (input.variationParam) {
    return normalizeVariation(input.variationParam);
  }

  const suffix = input.cardType.startsWith(`${input.baseCardType}-`)
    ? input.cardType.slice(input.baseCardType.length + 1)
    : "";

  return normalizeVariation(suffix);
}

/**
 * Keeps variation values inside the known set so the profile stays bounded.
 * @param raw - Candidate variation value.
 * @returns The value when known, `default` when absent, otherwise `unknown`.
 * @source
 */
function normalizeVariation(raw: string): string {
  if (!raw) return "default";
  return KNOWN_VARIATIONS.has(raw) ? raw : "unknown";
}

/**
 * Describes how the URL supplies colors without recording arbitrary values.
 * Named presets are a bounded set, so they are recorded by name. Individual
 * colors are unbounded, so their presence is recorded instead of their value.
 * @param input - Validated request fields.
 * @returns A `colorPreset` or `colors` entry for the profile.
 * @source
 */
function describeColors(input: CardUrlProfileInput): [string, string] {
  const preset = input.colorPresetParam;

  if (preset === "custom") {
    return ["colorPreset", "custom"];
  }

  if (preset) {
    return [
      "colorPreset",
      Object.hasOwn(colorPresets, preset) ? preset : "unknown",
    ];
  }

  const hasIndividualColors =
    !!input.titleColorParam &&
    !!input.backgroundColorParam &&
    !!input.textColorParam &&
    !!input.circleColorParam;

  return ["colors", hasIndividualColors ? "explicit" : "none"];
}

/**
 * Records a boolean-style parameter as its literal value or `unset`.
 * @param raw - Raw query parameter value.
 * @returns `true`, `false`, or `unset`.
 * @source
 */
function describeFlag(raw: string | null): string {
  return raw === "true" || raw === "false" ? raw : "unset";
}

/**
 * Records a favorites-grid dimension using the same clamp the renderer applies.
 * @param raw - Raw query parameter value.
 * @returns A value between 1 and 5, or `unset`.
 * @source
 */
function describeGridDim(raw: string | null): string {
  if (raw === null) return "unset";
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return "unset";
  return String(Math.max(1, Math.min(5, parsed)));
}

/**
 * Records a border radius using the same clamp the renderer applies.
 * @param raw - Raw query parameter value.
 * @returns The clamped radius, or null when the parameter is absent or invalid.
 * @source
 */
function describeBorderRadius(raw: string | null): string | null {
  if (raw === null) return null;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return null;
  return String(clampBorderRadius(parsed));
}

/**
 * Builds the canonical profile string for a card request.
 *
 * The profile carries the route path, card type, variation, the rendering
 * parameters that decide whether the stored card record is needed, and the
 * configuration source. The profile never carries `userId`, `userName`, an IP
 * address, the `_t` cache buster, or any unrecognized query parameter. A
 * separate hash associates database-dependent profiles with the exact user
 * identifier supplied by the URL, either `userId` or `userName`.
 *
 * @param input - Validated request fields and the configuration classification.
 * @returns A profile such as
 *   `/card.svg?cardType=animeStats&variation=compact&colorPreset=anilistDark&source=url`.
 * @source
 */
export function buildCardUrlProfile(input: CardUrlProfileInput): string {
  const search = new URLSearchParams();
  const variation = resolveVariation(input);

  search.set("cardType", input.baseCardType);
  search.set("variation", variation);
  search.set(...describeColors(input));

  if (FAVORITES_CARD_TYPES.has(input.baseCardType)) {
    search.set("showFavorites", describeFlag(input.showFavoritesParam));
  }
  if (STATUS_COLOR_CARD_TYPES.has(input.baseCardType)) {
    search.set("statusColors", describeFlag(input.statusColorsParam));
  }
  if (PIE_VARIATIONS.has(variation)) {
    search.set("piePercentages", describeFlag(input.piePercentagesParam));
  }
  if (input.baseCardType === "favoritesGrid") {
    search.set("gridCols", describeGridDim(input.gridColsParam));
    search.set("gridRows", describeGridDim(input.gridRowsParam));
  }

  if (input.borderColorParam) {
    search.set("borderColor", "set");
  }
  const borderRadius = describeBorderRadius(input.borderRadiusParam);
  if (borderRadius !== null) {
    search.set("borderRadius", borderRadius);
  }

  search.set("source", input.classification.source);
  if (input.classification.reason) {
    search.set("reason", input.classification.reason);
  }

  return `${normalizeRoutePath(input.routePath)}?${search.toString()}`;
}

/**
 * Counts one card request against its URL profile in the current daily bucket.
 * When the URL needs stored configuration, also counts the profile against the
 * `userId` or `userName` supplied by the URL.
 *
 * Tracking is best-effort: failures are logged and swallowed so they never
 * affect the card response. The bucket expires after 90 days, and the TTL is
 * only applied when the key has none, so the window does not slide forward.
 *
 * @param profile - Canonical profile from {@link buildCardUrlProfile}.
 * @param outcome - Cache outcome and response status for this request.
 * @param userIdentifier - User identifier from the URL for database-dependent
 *   profiles, when present.
 * @source
 */
export async function trackCardUrlProfile(
  profile: string,
  outcome: CardUrlOutcome,
  userIdentifier?: CardUrlUserIdentifier,
): Promise<void> {
  try {
    const pipeline = redisClient.pipeline();
    queueCardUrlProfileWrites(pipeline, profile, outcome, userIdentifier);
    await pipeline.exec();
  } catch (error) {
    console.warn("[Card URL Usage] Failed to record URL profile:", error);
  }
}

/**
 * Queues the profile increments and the non-sliding TTL onto an existing
 * pipeline, so callers can send them with the rest of a request's writes.
 *
 * The aggregate bucket always gets one `HINCRBY`. When the URL needs stored
 * configuration, the user bucket gets a second one. Both TTLs are `NX`, so the
 * 90-day window starts at the first write of the day and does not slide.
 *
 * @param pipeline - Pipeline to queue the commands onto.
 * @param profile - Canonical profile from {@link buildCardUrlProfile}.
 * @param outcome - Cache outcome and response status for this request.
 * @param userIdentifier - User identifier from the URL for database-dependent
 *   profiles, when present.
 * @param now - Timestamp used to pick the UTC day; defaults to the current time.
 * @source
 */
export function queueCardUrlProfileWrites(
  pipeline: CardUrlProfilePipeline,
  profile: string,
  outcome: CardUrlOutcome,
  userIdentifier?: CardUrlUserIdentifier,
  now: Date = new Date(),
): void {
  const key = buildCardUrlProfileKey(now);
  const field = `${profile}|cache=${outcome.cache}|status=${statusClass(outcome.status)}`;

  pipeline.hincrby(key, field, 1);
  pipeline.expire(key, CARD_URL_PROFILE_TTL_SECONDS, "NX");

  if (userIdentifier) {
    const userKey = buildCardUrlUserProfileKey(now);
    pipeline.hincrby(
      userKey,
      `${userIdentifier.type}=${userIdentifier.value}|${profile}`,
      1,
    );
    pipeline.expire(userKey, CARD_URL_PROFILE_TTL_SECONDS, "NX");
  }
}
