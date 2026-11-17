/**
 * Request preparation for the card endpoint.
 *
 * Two questions are answered before anything is rendered: what the request
 * asked for, and which stored records the render needs. Both are translation
 * over the query string and the stored data, so they live here and the route
 * stays a sequence of parse, delegate, respond.
 *
 * Errors are returned as data rather than as `Response` objects. A test for a
 * validation rule calls this module with a query string; it does not need to
 * build a request or parse a response.
 *
 * @source
 */

import { CARD_REGISTRY } from "@/lib/cards/registry";
import {
  fetchUserData,
  fetchUserDataForCard,
  validateAndNormalizeUserRecord,
  processCardConfig,
  resolveUserIdFromUsername,
  classifyCardConfigSource,
  needsCardConfigFromDb,
  buildCardConfigFromParams,
  processFavorites,
} from "@/lib/card-data";
import { generateCacheKey } from "@/lib/stores/svg-cache";
import { buildCardUrlProfile } from "@/lib/server/url-usage";
import type { CardRequestMetrics } from "@/lib/server/card-metrics";
import type { StoredCardConfig, UserRecord } from "@/lib/types/records";

/** Whitelist of supported card types the API will render. @source */
const ALLOWED_CARD_TYPES = new Set<string>(
  CARD_REGISTRY.map((card) => card.id),
);

/**
 * A card request that cannot be rendered, with the status to answer with.
 *
 * The message carries the `Client Error:`, `Not Found:` or `Server Error:`
 * prefix that the response builder and the error card rely on.
 * @source
 */
export interface CardRequestError {
  message: string;
  status: number;
}

/**
 * Parsed and validated parameters required by the card renderer.
 *
 * Numeric and normalized inputs are provided so subsequent logic can assume
 * well-formed values.
 * @source
 */
export interface ValidatedParams {
  userId: string;
  userName: string | null;
  cardType: string;
  numericUserId: number;
  baseCardType: string;
  variationParam: string | null;
  showFavoritesParam: string | null;
  statusColorsParam: string | null;
  piePercentagesParam: string | null;
  gridColsParam: string | null;
  gridRowsParam: string | null;
  colorPresetParam: string | null;
  titleColorParam: string | null;
  backgroundColorParam: string | null;
  textColorParam: string | null;
  circleColorParam: string | null;
  borderColorParam: string | null;
  borderRadiusParam: string | null;
  // Cache busting param
  _t: string | null;
}

/**
 * Everything the route needs to look up a cached render or ask for a new one.
 *
 * Built before the cache lookup so a hit can answer without touching the
 * stored records.
 * @source
 */
export interface CardRequestPlan {
  /** Validated query parameters. */
  params: ValidatedParams;
  /** Resolved numeric user ID, from the query or the username index. */
  userId: number;
  /** Canonical URL profile for the cards-key removal audit. */
  urlProfile: string;
  /** In-process cache key for this exact render. */
  cacheKey: string;
  /** True when the request asked for a render that skips stored copies. */
  bypassCache: boolean;
}

/** The stored records a render reads. @source */
export interface CardRenderInputs {
  userDoc: UserRecord;
  cardConfig: StoredCardConfig;
  effectiveVariation: string;
  favorites: string[];
}

/**
 * Extracts required query parameters from the request and performs validation.
 *
 * Supports both userId and userName parameters. At least one must be provided.
 * If only userName is provided, the caller looks up the numeric ID.
 *
 * @param request - The incoming HTTP request containing the query string.
 * @returns The validated parameters, or the error to answer with.
 * @source
 */
export function extractAndValidateParams(
  request: Request,
): { params: ValidatedParams } | { error: CardRequestError } {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const userName = searchParams.get("userName");
  const cardType = searchParams.get("cardType");

  // Must have cardType
  if (!cardType) {
    console.warn(`⚠️ [Card SVG] Missing parameter: cardType`);
    return {
      error: {
        message: "Client Error: Missing parameter: cardType",
        status: 400,
      },
    };
  }

  // Must have either userId or userName
  if (!userId && !userName) {
    console.warn(`⚠️ [Card SVG] Missing parameter: userId or userName`);
    return {
      error: {
        message: "Client Error: Missing parameter: userId or userName",
        status: 400,
      },
    };
  }

  // If userId is provided, validate it's numeric
  let numericUserId = 0;
  if (userId) {
    numericUserId = Number.parseInt(userId);
    if (Number.isNaN(numericUserId)) {
      console.warn(`⚠️ [Card SVG] Invalid user ID format: ${userId}`);
      return {
        error: { message: "Client Error: Invalid user ID", status: 400 },
      };
    }
  }

  const [baseCardType] = cardType.split("-");
  if (!ALLOWED_CARD_TYPES.has(baseCardType)) {
    console.warn(`⚠️ [Card SVG] Invalid card type: ${cardType}`);
    return {
      error: { message: "Client Error: Invalid card type", status: 400 },
    };
  }

  return {
    params: {
      userId: userId || "",
      userName,
      cardType,
      numericUserId,
      baseCardType,
      variationParam: searchParams.get("variation"),
      showFavoritesParam: searchParams.get("showFavorites"),
      statusColorsParam: searchParams.get("statusColors"),
      piePercentagesParam: searchParams.get("piePercentages"),
      gridColsParam: searchParams.get("gridCols"),
      gridRowsParam: searchParams.get("gridRows"),
      colorPresetParam: searchParams.get("colorPreset"),
      titleColorParam: searchParams.get("titleColor"),
      backgroundColorParam: searchParams.get("backgroundColor"),
      textColorParam: searchParams.get("textColor"),
      circleColorParam: searchParams.get("circleColor"),
      borderColorParam: searchParams.get("borderColor"),
      borderRadiusParam: searchParams.get("borderRadius"),
      _t: searchParams.get("_t"),
    },
  };
}

/**
 * Resolves the effective user ID from either the numeric userId or userName.
 * Returns the userId if provided, otherwise looks up the userId from userName.
 *
 * @param params - Validated parameters containing userId and userName.
 * @returns The resolved numeric user ID, or the error to answer with.
 * @source
 */
async function resolveEffectiveUserId(
  params: ValidatedParams,
): Promise<{ userId: number } | { error: CardRequestError }> {
  if (params.numericUserId) {
    return { userId: params.numericUserId };
  }

  if (params.userName) {
    const resolvedUserId = await resolveUserIdFromUsername(params.userName);
    if (resolvedUserId) {
      return { userId: resolvedUserId };
    }

    console.warn(
      `⚠️ [Card SVG] User not found for userName: ${params.userName}`,
    );
    return { error: { message: "Not Found: User not found", status: 404 } };
  }

  // This shouldn't happen due to validation, but handle it anyway
  return {
    error: { message: "Client Error: Missing user identifier", status: 400 },
  };
}

/** Clamps a grid dimension query parameter to the renderable range. @source */
function normalizeGridDim(
  raw: string | null | undefined,
  fallback = 3,
): number {
  if (raw === null || raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.max(1, Math.min(5, parsed));
}

/**
 * Validates the query and resolves the user, producing the plan the route
 * needs to serve a cached render or ask for a new one.
 *
 * @param request - The incoming card request.
 * @param metrics - Batched metrics for this request; records a failure on a
 *   rejected request.
 * @returns The plan, or the error to answer with.
 * @source
 */
export async function resolveCardRequest(
  request: Request,
  metrics: CardRequestMetrics,
): Promise<{ plan: CardRequestPlan } | { error: CardRequestError }> {
  const paramsResult = extractAndValidateParams(request);
  if ("error" in paramsResult) {
    metrics.recordFailure();
    return paramsResult;
  }
  const params = paramsResult.params;

  const userIdResult = await resolveEffectiveUserId(params);
  if ("error" in userIdResult) {
    metrics.recordFailure();
    return userIdResult;
  }
  const userId = userIdResult.userId;

  console.log(
    `🖼️ [Card SVG] Request for ${params.cardType} card - User ID: ${userId}`,
  );

  // Canonical URL profile for the cards-key removal audit. Built before the
  // cache lookup so cache hits are counted, and written once per request at
  // the terminal points in the route so background revalidation cannot double
  // count. The profile names the URL shape, never the user, so no identifier
  // is tracked.
  const urlProfile = buildCardUrlProfile({
    routePath: new URL(request.url).pathname,
    cardType: params.cardType,
    baseCardType: params.baseCardType,
    variationParam: params.variationParam,
    colorPresetParam: params.colorPresetParam,
    titleColorParam: params.titleColorParam,
    backgroundColorParam: params.backgroundColorParam,
    textColorParam: params.textColorParam,
    circleColorParam: params.circleColorParam,
    borderColorParam: params.borderColorParam,
    borderRadiusParam: params.borderRadiusParam,
    showFavoritesParam: params.showFavoritesParam,
    statusColorsParam: params.statusColorsParam,
    piePercentagesParam: params.piePercentagesParam,
    gridColsParam: params.gridColsParam,
    gridRowsParam: params.gridRowsParam,
    classification: classifyCardConfigSource(params),
  });

  const cacheKey = generateCacheKey(userId, params.cardType, {
    variation: params.variationParam,
    colorPreset: params.colorPresetParam,
    titleColor: params.titleColorParam,
    backgroundColor: params.backgroundColorParam,
    textColor: params.textColorParam,
    circleColor: params.circleColorParam,
    borderColor: params.borderColorParam,
    borderRadius: params.borderRadiusParam,
    showFavorites: params.showFavoritesParam,
    statusColors: params.statusColorsParam,
    piePercentages: params.piePercentagesParam,
    gridCols: normalizeGridDim(params.gridColsParam),
    gridRows: normalizeGridDim(params.gridRowsParam),
  });

  // The `_t` parameter is deliberately absent from the cache key. It exists to
  // bust the browser and CDN copies, not to describe the render, so including
  // it would turn every request into a unique key.
  //
  // Its presence is also a request to not use a stored copy. A caller that
  // adds `_t` wants the card rendered from current data, so the stored copy is
  // skipped for that request. The value is irrelevant: only its presence
  // matters.
  return {
    plan: {
      params,
      userId,
      urlProfile,
      cacheKey,
      bypassCache: params._t !== null,
    },
  };
}

/**
 * Loads the stored records a render reads.
 *
 * A request whose URL carries a complete configuration skips the stored card
 * record and builds the configuration from the query. Otherwise both records
 * are read and the stored configuration is used.
 *
 * @param plan - Resolved request from {@link resolveCardRequest}.
 * @returns The records to render from, or the error to answer with.
 * @source
 */
export async function loadCardRenderInputs(
  plan: CardRequestPlan,
): Promise<{ inputs: CardRenderInputs } | { error: CardRequestError }> {
  const { params, userId } = plan;

  if (needsCardConfigFromDb(params)) {
    const data = await fetchUserData(userId, params.cardType);
    const { cardDoc } = data;
    let userDoc = data.userDoc;

    const validationResult = validateAndNormalizeUserRecord(userDoc);
    if ("error" in validationResult) {
      return {
        error: {
          message:
            validationResult.status === 404
              ? "Not Found: Missing card configuration or stats data"
              : `Server Error: ${validationResult.error}`,
          status: validationResult.status ?? 500,
        },
      };
    }
    userDoc = validationResult.normalized;

    const processed = processCardConfig(cardDoc, params, userDoc);
    return {
      inputs: {
        userDoc,
        cardConfig: processed.cardConfig,
        effectiveVariation: processed.effectiveVariation,
        favorites: processed.favorites,
      },
    };
  }

  // Not using the stored card config; fetch user only and build config from
  // the URL params.
  const userDoc = await fetchUserDataForCard(userId, params.cardType);
  const validationResult = validateAndNormalizeUserRecord(userDoc);
  if ("error" in validationResult) {
    return {
      error: {
        message:
          validationResult.status === 404
            ? "Not Found: Missing card configuration or stats data"
            : `Server Error: ${validationResult.error}`,
        status: validationResult.status ?? 500,
      },
    };
  }

  const normalized = validationResult.normalized;
  const cardConfig = buildCardConfigFromParams(params);
  const effectiveVariation =
    params.variationParam || cardConfig.variation || "default";
  const favorites = processFavorites(
    params.baseCardType,
    params.showFavoritesParam,
    cardConfig.showFavorites,
    normalized,
  );

  return {
    inputs: {
      userDoc: normalized,
      cardConfig,
      effectiveVariation,
      favorites,
    },
  };
}
