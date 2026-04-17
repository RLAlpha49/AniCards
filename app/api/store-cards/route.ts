/**
 * Stores user card configuration snapshots while preserving editor-friendly,
 * partial-update semantics.
 *
 * The card editor does not resend every persisted field on each save, so this
 * route merges incoming changes with the existing Redis record, keeps omitted
 * explicit per-card settings intact, and stores only the authored card-order
 * signal needed to reconstruct untouched supported cards at read/editor time.
 */
import type { NextResponse } from "next/server";

import { redisClient } from "@/lib/api/clients";
import { apiJsonHeaders, jsonWithCors } from "@/lib/api/cors";
import { apiErrorResponse, handleError } from "@/lib/api/errors";
import { logPrivacySafe, logSuccess } from "@/lib/api/logging";
import { createProtectedWriteGrantCookieHeader } from "@/lib/api/protected-write-grants";
import { readJsonRequestBody } from "@/lib/api/request-body";
import {
  initializeApiRequest,
  validateProtectedWriteGrant,
} from "@/lib/api/request-guards";
import {
  buildAnalyticsMetricKey,
  buildFailedRequestMetricKeys,
  buildLatencyBucketMetricKeys,
  incrementAnalytics,
  scheduleAnalyticsBatch,
  scheduleLowValueAnalyticsBatch,
} from "@/lib/api/telemetry";
import {
  storeCardsRequestSchema,
  validateCardData,
} from "@/lib/api/validation";
import {
  getStoredCardsMetaKey,
  parseStoredCardsRecord as parsePersistedCardsRecord,
} from "@/lib/card-data/fetching";
import { displayNames, isValidCardType } from "@/lib/card-data/validation";
import { releaseUnpinnedRetainedUserSnapshot } from "@/lib/server/user-data";
import {
  CARDS_RECORD_SCHEMA_VERSION,
  CardsRecord,
  GlobalCardSettings,
  StoredCardConfig,
} from "@/lib/types/records";
import {
  clampBorderRadius,
  getColorInvalidReason,
  validateColorValue,
} from "@/lib/utils";

function sanitizeStoredBorderColor(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return validateColorValue(trimmed) ? trimmed : undefined;
}

/**
 * Card types that support pie variation and thus can use showPiePercentages.
 * @source
 */
const CARD_TYPES_WITH_PIE_VARIATION = new Set([
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

/**
 * Card types that may render favorites and therefore store `showFavorites`.
 */
const CARD_TYPES_WITH_FAVORITES = new Set([
  "animeVoiceActors",
  "animeStudios",
  "animeStaff",
  "mangaStaff",
]);

function scheduleStoreCardsMetric(
  endpoint: string,
  endpointKey: string,
  metric: "failed_requests" | "successful_requests",
  request: Request,
  options?: {
    durationMs?: number;
    reasonCode?: string;
  },
): void {
  const metrics =
    metric === "failed_requests"
      ? [
          ...buildFailedRequestMetricKeys(endpointKey, options?.reasonCode),
          ...(typeof options?.durationMs === "number"
            ? buildLatencyBucketMetricKeys(
                endpointKey,
                options.durationMs,
                "failure",
              )
            : []),
        ]
      : [
          buildAnalyticsMetricKey(endpointKey, metric),
          ...(typeof options?.durationMs === "number"
            ? buildLatencyBucketMetricKeys(
                endpointKey,
                options.durationMs,
                "success",
              )
            : []),
        ];

  const scheduleMetrics =
    metric === "failed_requests"
      ? scheduleLowValueAnalyticsBatch
      : scheduleAnalyticsBatch;

  scheduleMetrics(metrics, {
    endpoint,
    taskName: metrics[0],
    request,
  });
}

/**
 * Cached list of supported base card types.
 * Used to normalize persisted editor order and synthesize omitted defaults.
 */
const SUPPORTED_BASE_CARD_TYPES = Object.keys(displayNames);

/**
 * Returns true when a merged stored card config needs explicit persistence.
 * Untouched disabled cards are synthesized at read/editor time instead.
 */
function shouldPersistExplicitStoredCardConfig(
  card: StoredCardConfig,
): boolean {
  if (card.disabled !== true) {
    return true;
  }

  if (card.variation && card.variation !== "default") {
    return true;
  }

  if (card.useCustomSettings === true) {
    return true;
  }

  return (
    card.colorPreset !== undefined ||
    card.titleColor !== undefined ||
    card.backgroundColor !== undefined ||
    card.textColor !== undefined ||
    card.circleColor !== undefined ||
    card.borderColor !== undefined ||
    card.borderRadius !== undefined ||
    card.showFavorites !== undefined ||
    card.useStatusColors !== undefined ||
    card.showPiePercentages !== undefined ||
    card.gridCols !== undefined ||
    card.gridRows !== undefined
  );
}

function normalizeSupportedCardOrder(order?: readonly string[]): string[] {
  if (!order || order.length === 0) return [];

  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const item of order) {
    if (!isValidCardType(item)) continue;
    if (seen.has(item)) continue;
    seen.add(item);
    normalized.push(item);
  }

  return normalized;
}

function expandSupportedCardOrderSignal(
  orderSignal: readonly string[] | undefined,
  fallbackOrder: readonly string[],
): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();

  for (const name of normalizeSupportedCardOrder(orderSignal)) {
    if (seen.has(name)) continue;
    seen.add(name);
    ordered.push(name);
  }

  for (const name of fallbackOrder) {
    if (seen.has(name)) continue;
    seen.add(name);
    ordered.push(name);
  }

  return ordered;
}

function areStringArraysEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

function compressSupportedCardOrderSignal(
  order: readonly string[],
  fallbackOrder: readonly string[],
): string[] {
  const normalizedOrder = expandSupportedCardOrderSignal(order, fallbackOrder);

  for (
    let prefixLength = 0;
    prefixLength <= normalizedOrder.length;
    prefixLength += 1
  ) {
    const candidateSignal = normalizedOrder.slice(0, prefixLength);

    if (
      areStringArraysEqual(
        expandSupportedCardOrderSignal(candidateSignal, fallbackOrder),
        normalizedOrder,
      )
    ) {
      return candidateSignal;
    }
  }

  return normalizedOrder;
}

function resolveStoredCardOrderState(opts: {
  hasIncomingCardOrder: boolean;
  incomingCardOrder?: string[];
  existingCardOrder?: string[];
  existingCards: StoredCardConfig[];
}): {
  effectiveFullCardOrder: string[];
  persistedCardOrder: string[];
} {
  const fallbackOrder = SUPPORTED_BASE_CARD_TYPES;

  let effectiveFullCardOrder: string[];
  if (opts.hasIncomingCardOrder) {
    effectiveFullCardOrder = expandSupportedCardOrderSignal(
      opts.incomingCardOrder ?? [],
      fallbackOrder,
    );
  } else if (opts.existingCardOrder && opts.existingCardOrder.length > 0) {
    effectiveFullCardOrder = expandSupportedCardOrderSignal(
      opts.existingCardOrder,
      fallbackOrder,
    );
  } else {
    effectiveFullCardOrder = expandSupportedCardOrderSignal(
      opts.existingCards.map((card) => card.cardName),
      fallbackOrder,
    );
  }

  return {
    effectiveFullCardOrder,
    persistedCardOrder: compressSupportedCardOrderSignal(
      effectiveFullCardOrder,
      fallbackOrder,
    ),
  };
}

/**
 * Checks if a card type supports pie variation.
 * @source
 */
function supportsPieVariation(cardName: string): boolean {
  return CARD_TYPES_WITH_PIE_VARIATION.has(cardName);
}

function parseExistingCardsRecord(
  rawValue: unknown,
  endpoint: string,
  endpointKey: string,
  cardsKey: string,
  userId: number,
): CardsRecord | undefined {
  if (rawValue === undefined || rawValue === null) return undefined;

  try {
    return parsePersistedCardsRecord(
      typeof rawValue === "string" ? rawValue : JSON.stringify(rawValue),
      `${endpoint}:stored-cards:${cardsKey}`,
      userId,
      {
        allowLegacyMissingUpdatedAt: true,
      },
    );
  } catch (error) {
    logPrivacySafe("warn", endpoint, "Stored card record corrupted", {
      cardsKey,
      error: error instanceof Error ? error.message : String(error),
    });
    incrementAnalytics(
      buildAnalyticsMetricKey(endpointKey, "corrupted_records"),
    ).catch(() => {});
  }

  return undefined;
}

function filterSupportedStoredCards(
  cards: StoredCardConfig[],
  endpoint: string,
  cardsKey: string,
): StoredCardConfig[] {
  const filtered = cards.filter((card) => isValidCardType(card.cardName));

  if (filtered.length !== cards.length) {
    logPrivacySafe(
      "warn",
      endpoint,
      "Removed unsupported card types from stored record",
      { cardsKey },
    );
  }

  return filtered;
}

/**
 * Computes the effective border radius from incoming and previous values.
 * @source
 */
function computeBorderRadius(
  incoming: StoredCardConfig,
  previous: StoredCardConfig | undefined,
): number | undefined {
  const incomingRadius = Number.isFinite(incoming.borderRadius)
    ? incoming.borderRadius
    : undefined;
  const previousRadius = Number.isFinite(previous?.borderRadius)
    ? previous!.borderRadius
    : undefined;
  const effectiveRadius = incomingRadius ?? previousRadius;
  return typeof effectiveRadius === "number"
    ? clampBorderRadius(effectiveRadius)
    : undefined;
}

/**
 * Computes effective showPiePercentages value from incoming and previous values.
 * @source
 */
function computeShowPiePercentages(
  incoming: StoredCardConfig,
  previous: StoredCardConfig | undefined,
): boolean | undefined {
  const variation = incoming.variation ?? previous?.variation;
  const shouldSave =
    supportsPieVariation(incoming.cardName) &&
    (variation === "pie" || variation === "donut");

  if (!shouldSave) return undefined;

  if (typeof incoming.showPiePercentages === "boolean") {
    return incoming.showPiePercentages;
  }
  if (typeof previous?.showPiePercentages === "boolean") {
    return previous.showPiePercentages;
  }
  return undefined;
}

/**
 * Computes effective showFavorites value from incoming and previous values.
 * @source
 */
function computeShowFavorites(
  incoming: StoredCardConfig,
  previous: StoredCardConfig | undefined,
): boolean | undefined {
  if (!CARD_TYPES_WITH_FAVORITES.has(incoming.cardName)) return undefined;

  if (typeof incoming.showFavorites === "boolean") {
    return incoming.showFavorites;
  }
  if (typeof previous?.showFavorites === "boolean") {
    return previous.showFavorites;
  }
  return undefined;
}

/**
 * Clamps a grid dimension value to valid range (1-5).
 * @source
 */
function clampGridDim(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const n = Math.trunc(value);
  if (n < 1) return 1;
  if (n > 5) return 5;
  return n;
}

/**
 * Merge advanced global settings (useStatusColors, showPiePercentages,
 * showFavorites, gridCols, gridRows) by preferring incoming values and
 * falling back to previous values when omitted. Grid dims are clamped.
 */
function mergeGlobalAdvancedSettings(
  incoming?: Partial<GlobalCardSettings>,
  previous?: GlobalCardSettings,
) {
  const useStatusColors =
    typeof incoming?.useStatusColors === "boolean"
      ? incoming.useStatusColors
      : previous?.useStatusColors;

  const showPiePercentages =
    typeof incoming?.showPiePercentages === "boolean"
      ? incoming.showPiePercentages
      : previous?.showPiePercentages;

  const showFavorites =
    typeof incoming?.showFavorites === "boolean"
      ? incoming.showFavorites
      : previous?.showFavorites;

  const gridCols =
    clampGridDim(incoming?.gridCols) ?? clampGridDim(previous?.gridCols);
  const gridRows =
    clampGridDim(incoming?.gridRows) ?? clampGridDim(previous?.gridRows);

  return {
    useStatusColors,
    showPiePercentages,
    showFavorites,
    gridCols,
    gridRows,
  };
}

function shouldPersistIndividualColorsForPreset(preset: string | undefined) {
  return !preset || preset === "custom";
}

/**
 * Process a single global color field into `sanitized`.
 * Returns the key (string) when the value is invalid (string or non-string) so callers
 * can surface an explicit error instead of silently ignoring invalid inputs.
 */
function processGlobalColorField(
  sanitized: Partial<GlobalCardSettings>,
  key: keyof GlobalCardSettings,
  value: unknown,
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "string") {
    if (!validateColorValue(value)) return key as string;
    (sanitized as Record<string, unknown>)[key as string] = value;
    return undefined;
  }
  if (validateColorValue(value)) {
    (sanitized as Record<string, unknown>)[key as string] = value;
    return undefined;
  }
  return key as string;
}

function sanitizeGlobalColorFields(
  incoming: Partial<GlobalCardSettings>,
  sanitized: Partial<GlobalCardSettings>,
): string | undefined {
  const colorKeys: Array<keyof GlobalCardSettings> = [
    "titleColor",
    "backgroundColor",
    "textColor",
    "circleColor",
  ];

  for (const key of colorKeys) {
    const val = (incoming as Record<string, unknown>)[key as string];
    const invalidKey = processGlobalColorField(sanitized, key, val);
    if (invalidKey) return invalidKey;
  }

  return undefined;
}

function sanitizeGlobalBooleanFields(
  incoming: Partial<GlobalCardSettings>,
  sanitized: Partial<GlobalCardSettings>,
): void {
  const booleanKeys: Array<keyof GlobalCardSettings> = [
    "borderEnabled",
    "useStatusColors",
    "showPiePercentages",
    "showFavorites",
  ];
  for (const key of booleanKeys) {
    const val = (incoming as Record<string, unknown>)[key as string];
    if (typeof val === "boolean") {
      (sanitized as Record<string, unknown>)[key as string] = val;
    }
  }
}

function sanitizeGlobalBorderFields(
  incoming: Partial<GlobalCardSettings>,
  sanitized: Partial<GlobalCardSettings>,
): string | undefined {
  if (typeof incoming.borderColor === "string") {
    const borderColor = sanitizeStoredBorderColor(incoming.borderColor);
    if (!borderColor) return "borderColor";
    sanitized.borderColor = borderColor;
  }
  if (
    typeof incoming.borderRadius === "number" &&
    Number.isFinite(incoming.borderRadius)
  ) {
    sanitized.borderRadius = clampBorderRadius(incoming.borderRadius);
  }

  return undefined;
}

function sanitizeGlobalGridFields(
  incoming: Partial<GlobalCardSettings>,
  sanitized: Partial<GlobalCardSettings>,
): void {
  const cols = clampGridDim(incoming.gridCols);
  if (typeof cols === "number") sanitized.gridCols = cols;
  const rows = clampGridDim(incoming.gridRows);
  if (typeof rows === "number") sanitized.gridRows = rows;
}

/**
 * Sanitize incoming partial GlobalCardSettings by picking only known keys
 * and validating/coercing where appropriate. Uses strict validateColorValue
 * for string color inputs to avoid accepting arbitrary strings.
 */
function sanitizeIncomingGlobalSettings(
  incoming?: Partial<GlobalCardSettings>,
):
  | { sanitized?: Partial<GlobalCardSettings>; invalidColorStringKey?: string }
  | undefined {
  if (!incoming || typeof incoming !== "object") return undefined;
  const sanitized: Partial<GlobalCardSettings> = {};

  const preset =
    typeof incoming.colorPreset === "string"
      ? incoming.colorPreset.trim()
      : undefined;
  const shouldAcceptIndividualColors =
    shouldPersistIndividualColorsForPreset(preset);

  if (preset) {
    sanitized.colorPreset = preset;
  }

  if (shouldAcceptIndividualColors) {
    const invalidKey = sanitizeGlobalColorFields(incoming, sanitized);
    if (invalidKey) return { invalidColorStringKey: invalidKey };
  }

  sanitizeGlobalBooleanFields(incoming, sanitized);
  const borderInvalidKey = sanitizeGlobalBorderFields(incoming, sanitized);
  if (borderInvalidKey) return { invalidColorStringKey: borderInvalidKey };
  sanitizeGlobalGridFields(incoming, sanitized);

  return Object.keys(sanitized).length ? { sanitized } : undefined;
}

function inferUseCustomSettings(
  incoming: StoredCardConfig,
  previous: StoredCardConfig | undefined,
): boolean {
  if (typeof incoming.useCustomSettings === "boolean") {
    return incoming.useCustomSettings;
  }

  if (typeof previous?.useCustomSettings === "boolean") {
    return previous.useCustomSettings;
  }

  const baseCardType = (incoming.cardName || "").split("-")[0] || "";

  return (
    incoming.colorPreset !== undefined ||
    incoming.titleColor !== undefined ||
    incoming.backgroundColor !== undefined ||
    incoming.textColor !== undefined ||
    incoming.circleColor !== undefined ||
    incoming.borderColor !== undefined ||
    incoming.borderRadius !== undefined ||
    incoming.showFavorites !== undefined ||
    incoming.useStatusColors !== undefined ||
    incoming.showPiePercentages !== undefined ||
    ((baseCardType === "favoritesGrid" ||
      previous?.gridCols !== undefined ||
      previous?.gridRows !== undefined) &&
      (incoming.gridCols !== undefined || incoming.gridRows !== undefined))
  );
}

function resolveStoredCardColorSettings(
  incoming: StoredCardConfig,
  previous: StoredCardConfig | undefined,
  useCustomSettings: boolean,
): {
  effectiveColorPreset?: StoredCardConfig["colorPreset"];
  titleColor?: StoredCardConfig["titleColor"];
  backgroundColor?: StoredCardConfig["backgroundColor"];
  textColor?: StoredCardConfig["textColor"];
  circleColor?: StoredCardConfig["circleColor"];
} {
  const effectiveColorPreset = useCustomSettings
    ? (incoming.colorPreset ?? previous?.colorPreset)
    : undefined;
  const shouldSaveIndividualColors =
    useCustomSettings &&
    (!effectiveColorPreset || effectiveColorPreset === "custom");

  return {
    effectiveColorPreset,
    titleColor: shouldSaveIndividualColors
      ? (incoming.titleColor ?? previous?.titleColor)
      : undefined,
    backgroundColor: shouldSaveIndividualColors
      ? (incoming.backgroundColor ?? previous?.backgroundColor)
      : undefined,
    textColor: shouldSaveIndividualColors
      ? (incoming.textColor ?? previous?.textColor)
      : undefined,
    circleColor: shouldSaveIndividualColors
      ? (incoming.circleColor ?? previous?.circleColor)
      : undefined,
  };
}

function resolveStoredCardGridSettings(
  incoming: StoredCardConfig,
  previous: StoredCardConfig | undefined,
  useCustomSettings: boolean,
  baseCardType: string,
): {
  gridCols?: number;
  gridRows?: number;
} {
  if (!useCustomSettings || baseCardType !== "favoritesGrid") {
    return {
      gridCols: undefined,
      gridRows: undefined,
    };
  }

  return {
    gridCols:
      clampGridDim(incoming.gridCols) ?? clampGridDim(previous?.gridCols),
    gridRows:
      clampGridDim(incoming.gridRows) ?? clampGridDim(previous?.gridRows),
  };
}

function resolveStoredCardAdvancedSettings(
  incoming: StoredCardConfig,
  previous: StoredCardConfig | undefined,
  useCustomSettings: boolean,
): {
  borderColor?: string;
  borderRadius?: number;
  showFavorites?: boolean;
  useStatusColors?: boolean;
  showPiePercentages?: boolean;
} {
  if (!useCustomSettings) {
    return {
      borderColor: undefined,
      borderRadius: undefined,
      showFavorites: undefined,
      useStatusColors: undefined,
      showPiePercentages: undefined,
    };
  }

  return {
    borderColor:
      sanitizeStoredBorderColor(incoming.borderColor) ??
      sanitizeStoredBorderColor(previous?.borderColor),
    borderRadius: computeBorderRadius(incoming, previous),
    showFavorites: computeShowFavorites(incoming, previous),
    useStatusColors: incoming.useStatusColors ?? previous?.useStatusColors,
    showPiePercentages: computeShowPiePercentages(incoming, previous),
  };
}

/**
 * Builds a StoredCardConfig from incoming card data, merging with previous if needed.
 * Only saves individual colors when colorPreset is "custom" or not set.
 * Disabled cards preserve per-card settings so toggling visibility does not drop customizations.
 * If useCustomSettings is false, skips colorPreset and color fields (card references globalSettings).
 * Per-card `borderColor` and `borderRadius` are preserved from previous config when omitted,
 * even if global borders are disabled. Per-card border values are only omitted when
 * `useCustomSettings` is false.
 * @source
 */
function buildCardConfig(
  incoming: StoredCardConfig,
  previous: StoredCardConfig | undefined,
): StoredCardConfig {
  const useCustomSettings = inferUseCustomSettings(incoming, previous);
  const baseCardType = (incoming.cardName || "").split("-")[0] || "";
  const { effectiveColorPreset, ...colorSettings } =
    resolveStoredCardColorSettings(incoming, previous, useCustomSettings);
  const gridSettings = resolveStoredCardGridSettings(
    incoming,
    previous,
    useCustomSettings,
    baseCardType,
  );
  const advancedSettings = resolveStoredCardAdvancedSettings(
    incoming,
    previous,
    useCustomSettings,
  );

  return {
    cardName: incoming.cardName,
    disabled: incoming.disabled === true ? true : undefined,
    variation: incoming.variation ?? previous?.variation,
    colorPreset: effectiveColorPreset,
    ...colorSettings,
    ...advancedSettings,
    ...gridSettings,
    useCustomSettings,
  };
}

/**
 * Apply incoming cards into the existing cards map by merging values and
 * preserving previous values when appropriate.
 */
function applyIncomingCards(
  existingCardsMap: Map<string, StoredCardConfig>,
  incomingCards: StoredCardConfig[],
) {
  for (const card of incomingCards) {
    const previous = existingCardsMap.get(card.cardName);
    existingCardsMap.set(card.cardName, buildCardConfig(card, previous));
  }
}

/**
 * Build the final stored cards array in a deterministic order.
 *
 * Priority:
 * 1) Incoming cards order (authoritative when provided)
 * 2) Existing stored order for any cards omitted by the request
 * 3) Any newly-supported card types appended in SUPPORTED_BASE_CARD_TYPES order
 */
function buildOrderedStoredCards(opts: {
  effectiveCardOrder: string[];
  mergedExplicitCardsByName: Map<string, StoredCardConfig>;
}): StoredCardConfig[] {
  const ordered: StoredCardConfig[] = [];
  const seen = new Set<string>();

  const pushByName = (name: string) => {
    if (seen.has(name)) return;
    const merged = opts.mergedExplicitCardsByName.get(name);
    if (!merged) return;
    ordered.push(merged);
    seen.add(name);
  };

  for (const name of opts.effectiveCardOrder) {
    pushByName(name);
  }

  for (const name of opts.mergedExplicitCardsByName.keys()) {
    pushByName(name);
  }

  return ordered;
}

function normalizeIncomingCardOrder(raw: unknown): {
  cardOrder?: string[];
  invalid: boolean;
  provided: boolean;
} {
  if (raw === undefined) return { invalid: false, provided: false };
  if (!Array.isArray(raw)) return { invalid: true, provided: true };

  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (typeof item !== "string") return { invalid: true, provided: true };
    const trimmed = item.trim();
    if (!trimmed) continue;
    if (!isValidCardType(trimmed)) return { invalid: true, provided: true };
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return {
    invalid: false,
    provided: true,
    cardOrder: normalized,
  };
}

function computeEffectiveBorderRadius(
  effectiveBorderEnabled: boolean | undefined,
  incoming?: Partial<GlobalCardSettings>,
  existing?: GlobalCardSettings,
): number | undefined {
  if (!effectiveBorderEnabled) return undefined;
  if (typeof incoming?.borderRadius === "number") {
    return clampBorderRadius(incoming.borderRadius);
  }
  if (typeof existing?.borderRadius === "number") {
    return clampBorderRadius(existing.borderRadius);
  }
  return undefined;
}

/**
 * Normalize a GlobalCardSettings object according to color preset rules.
 * If a non-custom preset is set, the individual color fields are cleared to
 * avoid persisting them for known presets.
 */
function normalizeGlobalColorsForPreset(
  settings: GlobalCardSettings | undefined,
): GlobalCardSettings | undefined {
  if (!settings) return settings;
  const preset =
    typeof settings.colorPreset === "string"
      ? settings.colorPreset.trim()
      : undefined;
  if (preset && preset !== "custom") {
    return {
      ...settings,
      colorPreset: preset,
      titleColor: undefined,
      backgroundColor: undefined,
      textColor: undefined,
      circleColor: undefined,
    };
  }
  return preset ? { ...settings, colorPreset: preset } : settings;
}

/**
 * Validate `validated` (result of `validateCardData`) and `statsData`. Returns
 * a `NextResponse` when validation fails; otherwise `undefined`.
 */
async function validateIncomingPayload(
  validated: ReturnType<typeof validateCardData>,
  endpoint: string,
  endpointKey: string,
  request: Request,
  startTime: number,
): Promise<NextResponse | undefined> {
  if (!validated.success) {
    scheduleStoreCardsMetric(
      endpoint,
      endpointKey,
      "failed_requests",
      request,
      {
        durationMs: Date.now() - startTime,
        reasonCode: "payload_rejected",
      },
    );
    return validated.error;
  }

  return undefined;
}

type ParsedStoreCardsBody = {
  userId: number;
  incomingCards: unknown;
  incomingCardsCount: number;
  globalSettings?: Partial<GlobalCardSettings>;
  hasCardOrder: boolean;
  ifMatchRevision?: number;
  ifMatchSnapshotToken?: string;
  ifMatchUpdatedAt?: string;
  cardOrder?: string[];
};

type StoreCardsRouteContext = {
  endpoint: string;
  endpointKey: string;
  request: Request;
  startTime: number;
};

const STORE_CARDS_IF_MATCH_COMPARE_AND_SET_LUA = `
local function parse_json_object(raw)
  if type(raw) ~= "string" or string.len(raw) == 0 then
    return nil
  end

  local ok, decoded = pcall(cjson.decode, raw)
  if not ok or type(decoded) ~= "table" then
    return nil
  end

  return decoded
end

local function build_user_snapshot()
  local commitPointer = parse_json_object(redis.call("GET", KEYS[3]))
  if commitPointer then
    local revision = tonumber(commitPointer["revision"])
    local updatedAt = type(commitPointer["updatedAt"]) == "string" and commitPointer["updatedAt"] or nil
    local committedAt = type(commitPointer["committedAt"]) == "string" and commitPointer["committedAt"] or nil
    local token = type(commitPointer["snapshotToken"]) == "string" and commitPointer["snapshotToken"] or nil
    local snapshotKeyPrefix = type(commitPointer["snapshotKeyPrefix"]) == "string" and commitPointer["snapshotKeyPrefix"] or nil

    if revision and revision > 0 and updatedAt and string.len(updatedAt) > 0 and committedAt and string.len(committedAt) > 0 and token and string.len(token) > 0 and snapshotKeyPrefix and string.len(snapshotKeyPrefix) > 0 then
      return {
        committedAt = committedAt,
        revision = revision,
        token = token,
        updatedAt = updatedAt,
      }
    end
  end

  return nil
end

local function build_cards_meta(nextRecord, userSnapshot, version)
  local cardsMeta = {
    userId = nextRecord["userId"],
    updatedAt = nextRecord["updatedAt"],
    version = version,
    userSnapshot = userSnapshot,
  }

  if type(nextRecord["schemaVersion"]) == "number" and nextRecord["schemaVersion"] > 0 then
    cardsMeta["schemaVersion"] = nextRecord["schemaVersion"]
  end

  return cardsMeta
end

local current = redis.call("GET", KEYS[1])

local function write_next_record()
  local nextRecord = parse_json_object(ARGV[2])
  if not nextRecord then
    redis.call("SET", KEYS[1], ARGV[2])
    return {1}
  end

  local userSnapshot = build_user_snapshot()
  if not userSnapshot then
    return {2}
  end

  local currentRecord = parse_json_object(current)
  local currentVersion = currentRecord and tonumber(currentRecord["version"]) or 0
  local nextVersion = currentVersion and currentVersion > 0 and (currentVersion + 1) or 1

  nextRecord["userSnapshot"] = userSnapshot
  nextRecord["version"] = nextVersion

  redis.call("SET", KEYS[1], cjson.encode(nextRecord))
  redis.call("SET", KEYS[2], cjson.encode(build_cards_meta(nextRecord, userSnapshot, nextVersion)))

  return {1, nextRecord["updatedAt"], tostring(nextVersion), userSnapshot["token"], tostring(userSnapshot["revision"]), userSnapshot["updatedAt"], userSnapshot["committedAt"]}
end

local expectedSerializedCurrent = type(ARGV[3]) == "string" and string.len(ARGV[3]) > 0 and ARGV[3] or nil
if not current then
  if expectedSerializedCurrent then
    return {0}
  end

  return write_next_record()
end

if expectedSerializedCurrent and current ~= expectedSerializedCurrent then
  local decodedCurrent = parse_json_object(current)
  local currentUpdatedAt = decodedCurrent and type(decodedCurrent["updatedAt"]) == "string" and string.len(decodedCurrent["updatedAt"]) > 0 and decodedCurrent["updatedAt"] or nil

  return {0, currentUpdatedAt}
end

local ok, decoded = pcall(cjson.decode, current)
if not ok or type(decoded) ~= "table" then
  if expectedSerializedCurrent then
    return {0}
  end

  return write_next_record()
end

local currentUpdatedAt = type(decoded["updatedAt"]) == "string" and string.len(decoded["updatedAt"]) > 0 and decoded["updatedAt"] or nil
local expectedUpdatedAt = type(ARGV[1]) == "string" and string.len(ARGV[1]) > 0 and ARGV[1] or nil
if expectedUpdatedAt and currentUpdatedAt ~= expectedUpdatedAt then
  return {0, currentUpdatedAt}
end

return write_next_record()
`;

type IfMatchUpdatedAtCheckResult = {
  conflictResponse?: NextResponse;
  expectedSerializedCurrentRecord?: string;
  shouldEnforceAtomicCheck: boolean;
};

type StoreCardsAtomicWriteResult =
  | {
      didWrite: true;
      updatedAt?: string;
      userSnapshot?: Required<NonNullable<CardsRecord["userSnapshot"]>>;
    }
  | {
      didWrite: false;
      currentUpdatedAt?: string;
      reason: "conflict" | "missing_user_snapshot";
    };

type SuccessfulStoreCardsAtomicWriteResult = Extract<
  StoreCardsAtomicWriteResult,
  { didWrite: true }
>;

async function createIfMatchConflictResponse(
  currentUpdatedAt: string | undefined,
  endpoint: string,
  endpointKey: string,
  request: Request,
  startTime: number,
): Promise<NextResponse> {
  scheduleStoreCardsMetric(endpoint, endpointKey, "failed_requests", request, {
    durationMs: Date.now() - startTime,
    reasonCode: "if_match_conflict",
  });

  return apiErrorResponse(
    request,
    409,
    "Conflict: data was updated elsewhere. Please reload and try again.",
    {
      category: "invalid_data",
      retryable: false,
      additionalFields: currentUpdatedAt
        ? {
            currentUpdatedAt,
          }
        : undefined,
    },
  );
}

async function createMissingUserSnapshotResponse(
  endpoint: string,
  endpointKey: string,
  request: Request,
  startTime: number,
): Promise<NextResponse> {
  scheduleStoreCardsMetric(endpoint, endpointKey, "failed_requests", request, {
    durationMs: Date.now() - startTime,
    reasonCode: "missing_user_snapshot",
  });

  return apiErrorResponse(
    request,
    409,
    "Conflict: a persisted user snapshot is required before saving cards. Please reload user data and try again.",
    {
      category: "invalid_data",
      retryable: false,
    },
  );
}

function getExistingCardsRecordUpdatedAt(
  existingRecord: CardsRecord | undefined,
): string | undefined {
  if (
    typeof existingRecord?.updatedAt === "string" &&
    existingRecord.updatedAt.length > 0
  ) {
    return existingRecord.updatedAt;
  }

  return undefined;
}

async function createStoreCardsIfMatchConflictResult(
  currentUpdatedAt: string | undefined,
  routeContext: StoreCardsRouteContext,
): Promise<IfMatchUpdatedAtCheckResult> {
  return {
    shouldEnforceAtomicCheck: false,
    conflictResponse: await createIfMatchConflictResponse(
      currentUpdatedAt,
      routeContext.endpoint,
      routeContext.endpointKey,
      routeContext.request,
      routeContext.startTime,
    ),
  };
}

function resolveStoreCardsSchemaIssueDetails(issueField: unknown): {
  message: string;
  reasonCode: string;
} {
  if (issueField === "userId") {
    return {
      message: "Invalid userId",
      reasonCode: "invalid_user_id",
    };
  }

  if (issueField === "cardOrder") {
    return {
      message: "Invalid cardOrder",
      reasonCode: "invalid_card_order",
    };
  }

  return {
    message: "Invalid data",
    reasonCode: "payload_rejected",
  };
}

async function parseStoreCardsRequestBody(
  request: Request,
  endpoint: string,
  endpointKey: string,
  startTime: number,
): Promise<{ parsed?: ParsedStoreCardsBody; errorResponse?: NextResponse }> {
  const bodyResult = await readJsonRequestBody<Record<string, unknown>>(
    request,
    {
      endpointName: endpoint,
      endpointKey,
    },
  );
  if (!bodyResult.success) {
    return {
      errorResponse: bodyResult.errorResponse,
    };
  }

  const body = bodyResult.data;

  const parsedBody = storeCardsRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    const issueField = parsedBody.error.issues[0]?.path[0];
    const issueDetails = resolveStoreCardsSchemaIssueDetails(issueField);

    scheduleStoreCardsMetric(
      endpoint,
      endpointKey,
      "failed_requests",
      request,
      {
        durationMs: Date.now() - startTime,
        reasonCode: issueDetails.reasonCode,
      },
    );

    return {
      errorResponse: apiErrorResponse(request, 400, issueDetails.message, {
        category: "invalid_data",
        retryable: false,
      }),
    };
  }

  const {
    userId,
    cards: incomingCards,
    globalSettings,
    ifMatchRevision,
    ifMatchSnapshotToken,
    ifMatchUpdatedAt,
    cardOrder: rawCardOrder,
  } = parsedBody.data;

  const incomingCardsCount = Array.isArray(incomingCards)
    ? incomingCards.length
    : 0;

  const cardOrderResult = normalizeIncomingCardOrder(rawCardOrder);
  if (cardOrderResult.invalid) {
    scheduleStoreCardsMetric(
      endpoint,
      endpointKey,
      "failed_requests",
      request,
      {
        durationMs: Date.now() - startTime,
        reasonCode: "invalid_card_order",
      },
    );
    return {
      errorResponse: apiErrorResponse(request, 400, "Invalid cardOrder", {
        category: "invalid_data",
        retryable: false,
      }),
    };
  }
  const cardOrder = cardOrderResult.cardOrder;

  return {
    parsed: {
      userId,
      incomingCards,
      incomingCardsCount,
      globalSettings,
      hasCardOrder: cardOrderResult.provided,
      ifMatchRevision,
      ifMatchSnapshotToken,
      ifMatchUpdatedAt,
      cardOrder,
    },
  };
}
async function enforceIfMatchUpdatedAt(params: {
  existingData: unknown;
  existingRecord: CardsRecord | undefined;
  ifMatchUpdatedAt: string | undefined;
  ifMatchRevision: number | undefined;
  ifMatchSnapshotToken: string | undefined;
  routeContext: StoreCardsRouteContext;
}): Promise<IfMatchUpdatedAtCheckResult> {
  const {
    existingData,
    existingRecord,
    ifMatchUpdatedAt,
    ifMatchRevision,
    ifMatchSnapshotToken,
    routeContext,
  } = params;

  if (typeof existingData !== "string" || existingData.length === 0) {
    return { shouldEnforceAtomicCheck: false };
  }
  const existingUpdatedAt = getExistingCardsRecordUpdatedAt(existingRecord);

  if (!ifMatchUpdatedAt) {
    return createStoreCardsIfMatchConflictResult(
      existingUpdatedAt,
      routeContext,
    );
  }

  if (!existingRecord || !existingUpdatedAt) {
    return createStoreCardsIfMatchConflictResult(undefined, routeContext);
  }

  if (
    typeof ifMatchRevision === "number" &&
    existingRecord.userSnapshot?.revision !== ifMatchRevision
  ) {
    return createStoreCardsIfMatchConflictResult(
      existingUpdatedAt,
      routeContext,
    );
  }

  if (
    ifMatchSnapshotToken &&
    existingRecord.userSnapshot?.token !== ifMatchSnapshotToken
  ) {
    return createStoreCardsIfMatchConflictResult(
      existingUpdatedAt,
      routeContext,
    );
  }

  if (existingUpdatedAt !== ifMatchUpdatedAt) {
    return createStoreCardsIfMatchConflictResult(
      existingUpdatedAt,
      routeContext,
    );
  }

  return {
    shouldEnforceAtomicCheck: true,
    expectedSerializedCurrentRecord: existingData,
  };
}

function normalizeStoreCardsAtomicStatus(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function parseStoreCardsAtomicString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function parseStoreCardsAtomicUserSnapshot(
  result: unknown[],
): Required<NonNullable<CardsRecord["userSnapshot"]>> | undefined {
  const snapshotToken = parseStoreCardsAtomicString(result[3]);
  const snapshotRevision = normalizeStoreCardsAtomicStatus(result[4]);
  const snapshotUpdatedAt = parseStoreCardsAtomicString(result[5]);
  const snapshotCommittedAt = parseStoreCardsAtomicString(result[6]);

  if (
    !snapshotToken ||
    typeof snapshotRevision !== "number" ||
    snapshotRevision <= 0 ||
    !snapshotUpdatedAt ||
    !snapshotCommittedAt
  ) {
    return undefined;
  }

  return {
    token: snapshotToken,
    revision: snapshotRevision,
    updatedAt: snapshotUpdatedAt,
    committedAt: snapshotCommittedAt,
  };
}

function parseStoreCardsSuccessfulAtomicWriteResult(
  result: unknown[],
): SuccessfulStoreCardsAtomicWriteResult {
  const userSnapshot = parseStoreCardsAtomicUserSnapshot(result);

  return {
    didWrite: true,
    updatedAt: parseStoreCardsAtomicString(result[1]),
    ...(userSnapshot ? { userSnapshot } : {}),
  };
}

function createUnexpectedStoreCardsAtomicWriteError(): never {
  throw new Error(
    "Unexpected result from store-cards optimistic concurrency script",
  );
}

function parseStoreCardsAtomicWriteResult(
  result: unknown,
): StoreCardsAtomicWriteResult {
  if (!Array.isArray(result)) {
    if (normalizeStoreCardsAtomicStatus(result) === 1) {
      return { didWrite: true };
    }

    createUnexpectedStoreCardsAtomicWriteError();
  }

  const status = normalizeStoreCardsAtomicStatus(result[0]);
  if (status === 1) {
    return parseStoreCardsSuccessfulAtomicWriteResult(result);
  }

  if (status === 0) {
    return {
      didWrite: false,
      reason: "conflict",
      currentUpdatedAt: parseStoreCardsAtomicString(result[1]),
    };
  }

  if (status === 2) {
    return {
      didWrite: false,
      reason: "missing_user_snapshot",
    };
  }

  createUnexpectedStoreCardsAtomicWriteError();
}

async function storeCardsRecord(params: {
  cardsKey: string;
  expectedSerializedCurrentRecord?: string;
  userId: number;
  serializedCardData: string;
  ifMatchUpdatedAt?: string;
  shouldEnforceAtomicCheck: boolean;
}): Promise<StoreCardsAtomicWriteResult> {
  const {
    cardsKey,
    expectedSerializedCurrentRecord,
    userId,
    serializedCardData,
    ifMatchUpdatedAt,
    shouldEnforceAtomicCheck,
  } = params;

  const result = await redisClient.eval(
    STORE_CARDS_IF_MATCH_COMPARE_AND_SET_LUA,
    [
      cardsKey,
      getStoredCardsMetaKey(userId),
      `user:${userId}:commit`,
      `user:${userId}:meta`,
      `user:${userId}`,
    ],
    [
      ifMatchUpdatedAt && shouldEnforceAtomicCheck ? ifMatchUpdatedAt : "",
      serializedCardData,
      expectedSerializedCurrentRecord ?? "",
    ],
  );

  return parseStoreCardsAtomicWriteResult(result);
}

type LoadedStoreCardsState = {
  existingCards: StoredCardConfig[];
  existingCardOrder?: string[];
  existingGlobalSettings?: GlobalCardSettings;
  ifMatchCheck: IfMatchUpdatedAtCheckResult;
};

async function loadExistingStoreCardsState(params: {
  cardsKey: string;
  userId: number;
  ifMatchUpdatedAt?: string;
  ifMatchRevision?: number;
  ifMatchSnapshotToken?: string;
  routeContext: StoreCardsRouteContext;
}): Promise<LoadedStoreCardsState | { errorResponse: NextResponse }> {
  const {
    cardsKey,
    userId,
    ifMatchUpdatedAt,
    ifMatchRevision,
    ifMatchSnapshotToken,
    routeContext,
  } = params;

  const existingData = await redisClient.get(cardsKey);
  const existingRecord = parseExistingCardsRecord(
    existingData,
    routeContext.endpoint,
    routeContext.endpointKey,
    cardsKey,
    userId,
  );

  const ifMatchCheck = await enforceIfMatchUpdatedAt({
    existingData,
    existingRecord,
    ifMatchUpdatedAt,
    ifMatchRevision,
    ifMatchSnapshotToken,
    routeContext,
  });
  if (ifMatchCheck.conflictResponse) {
    return {
      errorResponse: ifMatchCheck.conflictResponse,
    };
  }

  return {
    existingCards: filterSupportedStoredCards(
      existingRecord?.cards ?? [],
      routeContext.endpoint,
      cardsKey,
    ),
    existingCardOrder: existingRecord?.cardOrder,
    existingGlobalSettings: existingRecord?.globalSettings,
    ifMatchCheck,
  };
}

function buildStoreCardsRecordData(params: {
  userId: number;
  orderedStoredCards: StoredCardConfig[];
  persistedCardOrder: string[];
  mergedGlobalSettings?: GlobalCardSettings;
}): CardsRecord {
  const cardData: CardsRecord = {
    userId: params.userId,
    cards: params.orderedStoredCards,
    globalSettings: params.mergedGlobalSettings,
    updatedAt: new Date().toISOString(),
    schemaVersion: CARDS_RECORD_SCHEMA_VERSION,
  };

  if (params.persistedCardOrder.length > 0) {
    cardData.cardOrder = params.persistedCardOrder;
  }

  return cardData;
}

async function prepareStoreCardsRecordForWrite(params: {
  incomingCards: StoredCardConfig[];
  existingCards: StoredCardConfig[];
  existingCardOrder?: string[];
  existingGlobalSettings?: GlobalCardSettings;
  cardOrder?: string[];
  hasCardOrder: boolean;
  globalSettings?: Partial<GlobalCardSettings>;
  userId: number;
  routeContext: StoreCardsRouteContext;
}): Promise<{ cardData: CardsRecord } | { errorResponse: NextResponse }> {
  const {
    incomingCards,
    existingCards,
    existingCardOrder,
    existingGlobalSettings,
    cardOrder,
    hasCardOrder,
    globalSettings,
    userId,
    routeContext,
  } = params;

  const assembly = await assembleStoredCardsAndGlobalSettings({
    incomingCards,
    existingCards,
    existingCardOrder,
    existingGlobalSettings,
    cardOrder,
    hasCardOrder,
    globalSettings,
    endpoint: routeContext.endpoint,
    endpointKey: routeContext.endpointKey,
    request: routeContext.request,
    startTime: routeContext.startTime,
  });
  if ("errorResponse" in assembly) {
    return assembly;
  }

  const { orderedStoredCards, mergedGlobalSettings, persistedCardOrder } =
    assembly;

  const colorValidationError = await validateCardColors(
    orderedStoredCards,
    routeContext.endpoint,
    routeContext.endpointKey,
    routeContext.request,
    routeContext.startTime,
  );
  if (colorValidationError) {
    return {
      errorResponse: colorValidationError,
    };
  }

  return {
    cardData: buildStoreCardsRecordData({
      userId,
      orderedStoredCards,
      persistedCardOrder,
      mergedGlobalSettings,
    }),
  };
}

async function createStoreCardsSuccessResponse(params: {
  userId: number;
  endpoint: string;
  endpointKey: string;
  request: Request;
  startTime: number;
  cardData: CardsRecord;
  storeResult: SuccessfulStoreCardsAtomicWriteResult;
}): Promise<NextResponse> {
  const {
    userId,
    endpoint,
    endpointKey,
    request,
    startTime,
    cardData,
    storeResult,
  } = params;
  const duration = Date.now() - startTime;
  logSuccess(endpoint, userId, duration, "Stored cards", request);
  scheduleStoreCardsMetric(
    endpoint,
    endpointKey,
    "successful_requests",
    request,
    {
      durationMs: duration,
    },
  );

  const storedUpdatedAt = storeResult.updatedAt ?? cardData.updatedAt;

  try {
    await releaseUnpinnedRetainedUserSnapshot(userId);
  } catch (error) {
    logPrivacySafe(
      "warn",
      endpoint,
      "Stored cards succeeded but retained snapshot cleanup could not be completed",
      {
        userId,
        error: error instanceof Error ? error.message : String(error),
      },
      request,
    );
  }

  const protectedWriteGrantHeader = await createProtectedWriteGrantCookieHeader(
    {
      source: "stored_user",
      userId,
    },
  );

  const responseBody: {
    success: true;
    userId: number;
    updatedAt: string;
    userSnapshot?: Required<NonNullable<CardsRecord["userSnapshot"]>>;
  } = {
    success: true,
    userId,
    updatedAt: storedUpdatedAt,
  };

  if (storeResult.userSnapshot) {
    responseBody.userSnapshot = storeResult.userSnapshot;
  }

  return jsonWithCors(
    responseBody,
    request,
    undefined,
    protectedWriteGrantHeader
      ? {
          "Set-Cookie": protectedWriteGrantHeader,
        }
      : undefined,
  );
}

/**
 * Build merged global settings from sanitized incoming and existing settings.
 * Encapsulates color preset normalization and conditional persistence rules.
 */
function buildMergedGlobalSettings(
  sanitized?: Partial<GlobalCardSettings>,
  existing?: GlobalCardSettings,
  effective?: {
    borderEnabled?: boolean;
    borderColor?: string;
    borderRadius?: number;
    useStatusColors?: boolean;
    showPiePercentages?: boolean;
    showFavorites?: boolean;
    gridCols?: number;
    gridRows?: number;
  },
): GlobalCardSettings | undefined {
  const mergedColorPresetRaw = sanitized?.colorPreset ?? existing?.colorPreset;
  const mergedColorPreset =
    typeof mergedColorPresetRaw === "string"
      ? mergedColorPresetRaw.trim()
      : undefined;
  const shouldPersistGlobalColors =
    !mergedColorPreset || mergedColorPreset === "custom";

  if (!sanitized) return normalizeGlobalColorsForPreset(existing);

  return normalizeGlobalColorsForPreset({
    colorPreset: mergedColorPreset,
    titleColor: shouldPersistGlobalColors
      ? (sanitized.titleColor ?? existing?.titleColor)
      : undefined,
    backgroundColor: shouldPersistGlobalColors
      ? (sanitized.backgroundColor ?? existing?.backgroundColor)
      : undefined,
    textColor: shouldPersistGlobalColors
      ? (sanitized.textColor ?? existing?.textColor)
      : undefined,
    circleColor: shouldPersistGlobalColors
      ? (sanitized.circleColor ?? existing?.circleColor)
      : undefined,
    borderEnabled: effective?.borderEnabled,
    borderColor: effective?.borderColor,
    borderRadius: effective?.borderRadius,
    useStatusColors: effective?.useStatusColors,
    showPiePercentages: effective?.showPiePercentages,
    showFavorites: effective?.showFavorites,
    gridCols: effective?.gridCols,
    gridRows: effective?.gridRows,
  });
}

function validateAndSanitizeStoreCardsGlobalSettings(params: {
  globalSettings?: Partial<GlobalCardSettings>;
  endpoint: string;
  endpointKey: string;
  request: Request;
  startTime: number;
}):
  | { sanitizedGlobalSettings?: Partial<GlobalCardSettings> }
  | { errorResponse: NextResponse } {
  const sanitizeResult = sanitizeIncomingGlobalSettings(params.globalSettings);
  if (!sanitizeResult?.invalidColorStringKey) {
    return {
      sanitizedGlobalSettings: sanitizeResult?.sanitized,
    };
  }

  logPrivacySafe(
    "warn",
    params.endpoint,
    "Invalid globalSettings color value",
    { invalidColorKey: sanitizeResult.invalidColorStringKey },
    params.request,
  );
  scheduleStoreCardsMetric(
    params.endpoint,
    params.endpointKey,
    "failed_requests",
    params.request,
    {
      durationMs: Date.now() - params.startTime,
      reasonCode: "payload_rejected",
    },
  );

  return {
    errorResponse: apiErrorResponse(params.request, 400, "Invalid data", {
      category: "invalid_data",
      retryable: false,
    }),
  };
}

function buildMergedExplicitStoredCardsByName(
  existingCardsMap: Map<string, StoredCardConfig>,
): Map<string, StoredCardConfig> {
  const mergedExplicitCardsByName = new Map<string, StoredCardConfig>();

  for (const [cardName, card] of existingCardsMap) {
    if (!shouldPersistExplicitStoredCardConfig(card)) {
      continue;
    }

    mergedExplicitCardsByName.set(cardName, card);
  }

  return mergedExplicitCardsByName;
}

function resolveMergedStoreCardsGlobalSettings(params: {
  sanitizedGlobalSettings?: Partial<GlobalCardSettings>;
  existingGlobalSettings?: GlobalCardSettings;
}): GlobalCardSettings | undefined {
  const { sanitizedGlobalSettings, existingGlobalSettings } = params;
  const effectiveBorderEnabled =
    sanitizedGlobalSettings?.borderEnabled ??
    existingGlobalSettings?.borderEnabled;
  const effectiveBorderRadius = computeEffectiveBorderRadius(
    effectiveBorderEnabled,
    sanitizedGlobalSettings,
    existingGlobalSettings,
  );
  const effectiveBorderColor = effectiveBorderEnabled
    ? (sanitizeStoredBorderColor(sanitizedGlobalSettings?.borderColor) ??
      sanitizeStoredBorderColor(existingGlobalSettings?.borderColor))
    : undefined;

  const {
    useStatusColors: effectiveUseStatusColors,
    showPiePercentages: effectiveShowPiePercentages,
    showFavorites: effectiveShowFavorites,
    gridCols: effectiveGridCols,
    gridRows: effectiveGridRows,
  } = mergeGlobalAdvancedSettings(
    sanitizedGlobalSettings,
    existingGlobalSettings,
  );

  return buildMergedGlobalSettings(
    sanitizedGlobalSettings,
    existingGlobalSettings,
    {
      borderEnabled: effectiveBorderEnabled,
      borderColor: effectiveBorderColor,
      borderRadius: effectiveBorderRadius,
      useStatusColors: effectiveUseStatusColors,
      showPiePercentages: effectiveShowPiePercentages,
      showFavorites: effectiveShowFavorites,
      gridCols: effectiveGridCols,
      gridRows: effectiveGridRows,
    },
  );
}

/**
 * Assemble stored cards and merged global settings.
 */
async function assembleStoredCardsAndGlobalSettings(params: {
  incomingCards: StoredCardConfig[];
  existingCards: StoredCardConfig[];
  existingCardOrder?: string[];
  existingGlobalSettings?: GlobalCardSettings;
  cardOrder?: string[];
  hasCardOrder: boolean;
  globalSettings?: Partial<GlobalCardSettings>;
  endpoint: string;
  endpointKey: string;
  request: Request;
  startTime: number;
}): Promise<
  | {
      orderedStoredCards: StoredCardConfig[];
      persistedCardOrder: string[];
      mergedGlobalSettings?: GlobalCardSettings;
    }
  | { errorResponse: NextResponse }
> {
  const {
    incomingCards,
    existingCards,
    existingCardOrder,
    existingGlobalSettings,
    cardOrder,
    hasCardOrder,
    globalSettings,
    endpoint,
    endpointKey,
    request,
    startTime,
  } = params;

  const existingCardsMap = new Map<string, StoredCardConfig>(
    existingCards.map((card) => [card.cardName, card]),
  );

  const globalSettingsResult = validateAndSanitizeStoreCardsGlobalSettings({
    globalSettings,
    endpoint,
    endpointKey,
    request,
    startTime,
  });
  if ("errorResponse" in globalSettingsResult) {
    return globalSettingsResult;
  }
  const { sanitizedGlobalSettings } = globalSettingsResult;

  applyIncomingCards(existingCardsMap, incomingCards);
  const mergedExplicitCardsByName =
    buildMergedExplicitStoredCardsByName(existingCardsMap);

  const { effectiveFullCardOrder, persistedCardOrder } =
    resolveStoredCardOrderState({
      hasIncomingCardOrder: hasCardOrder,
      incomingCardOrder: cardOrder,
      existingCardOrder,
      existingCards,
    });

  const orderedStoredCards = buildOrderedStoredCards({
    effectiveCardOrder: effectiveFullCardOrder,
    mergedExplicitCardsByName,
  });

  const mergedGlobalSettings = resolveMergedStoreCardsGlobalSettings({
    sanitizedGlobalSettings,
    existingGlobalSettings,
  });

  return { orderedStoredCards, mergedGlobalSettings, persistedCardOrder };
}

/**
 * Validate per-card colors on stored cards and return a NextResponse on failure.
 */
async function validateCardColors(
  orderedStoredCards: StoredCardConfig[],
  endpoint: string,
  endpointKey: string,
  request: Request,
  startTime: number,
): Promise<NextResponse | undefined> {
  const requiredColorFields = [
    "titleColor",
    "backgroundColor",
    "textColor",
    "circleColor",
  ];

  const cardsToCheck = orderedStoredCards
    .map((card, idx) => ({ card, idx }))
    .filter(
      ({ card }) =>
        card.disabled !== true &&
        card.useCustomSettings === true &&
        (!card.colorPreset || card.colorPreset === "custom"),
    );

  for (const { card, idx } of cardsToCheck) {
    for (const field of requiredColorFields) {
      const val = (card as unknown as Record<string, unknown>)[field];
      if (val === undefined || val === null) {
        logPrivacySafe(
          "warn",
          endpoint,
          "Card missing required color field after merge",
          { cardIndex: idx, field },
          request,
        );
        scheduleStoreCardsMetric(
          endpoint,
          endpointKey,
          "failed_requests",
          request,
          {
            durationMs: Date.now() - startTime,
            reasonCode: "payload_rejected",
          },
        );
        return apiErrorResponse(request, 400, "Invalid data", {
          category: "invalid_data",
          retryable: false,
        });
      }
      if (!validateColorValue(val)) {
        const reason = getColorInvalidReason(val);
        const reasonSuffix = reason ? ` (${reason})` : "";
        logPrivacySafe(
          "warn",
          endpoint,
          "Card invalid color or gradient format after merge",
          { cardIndex: idx, field, reason: reasonSuffix || undefined },
          request,
        );
        scheduleStoreCardsMetric(
          endpoint,
          endpointKey,
          "failed_requests",
          request,
          {
            durationMs: Date.now() - startTime,
            reasonCode: "payload_rejected",
          },
        );
        return apiErrorResponse(request, 400, "Invalid data", {
          category: "invalid_data",
          retryable: false,
        });
      }
    }
  }
  return undefined;
}

/**
 * Validates, persists, and reports analytics for the user card configuration payload.
 * @param request - Incoming request containing the user ID, stats, and card array.
 * @returns A NextResponse that signals success or propagates a validation/error response.
 * @source
 */
export async function POST(request: Request): Promise<NextResponse> {
  const init = await initializeApiRequest(
    request,
    "Store Cards",
    "store_cards",
    undefined,
    {
      requireRequestProof: true,
      requireVerifiedClientIp: true,
    },
  );
  if (init.errorResponse) return init.errorResponse;

  const { startTime, endpoint, endpointKey } = init;
  const routeContext: StoreCardsRouteContext = {
    endpoint,
    endpointKey,
    request,
    startTime,
  };

  try {
    const bodyParse = await parseStoreCardsRequestBody(
      request,
      endpoint,
      endpointKey,
      startTime,
    );
    if (bodyParse.errorResponse) return bodyParse.errorResponse;
    const {
      userId,
      incomingCards,
      incomingCardsCount,
      globalSettings,
      hasCardOrder,
      ifMatchRevision,
      ifMatchSnapshotToken,
      ifMatchUpdatedAt,
      cardOrder,
    } = bodyParse.parsed!;
    logPrivacySafe(
      "log",
      endpoint,
      "Processing store-cards payload",
      { userId, incomingCardsCount },
      request,
    );

    const validated = validateCardData(
      incomingCards,
      userId,
      endpoint,
      request,
    );

    const validateErrorResponse = await validateIncomingPayload(
      validated,
      endpoint,
      endpointKey,
      request,
      startTime,
    );
    if (validateErrorResponse) return validateErrorResponse;

    const protectedWriteGrantResult = await validateProtectedWriteGrant({
      endpointKey,
      endpointName: endpoint,
      request,
      userId,
    });
    if ("errorResponse" in protectedWriteGrantResult) {
      return protectedWriteGrantResult.errorResponse;
    }

    const incomingCardsTyped = validated.success ? validated.cards : [];

    const cardsKey = `cards:${userId}`;
    logPrivacySafe(
      "log",
      endpoint,
      "Storing card configuration",
      { userId, cardsKey },
      request,
    );

    const existingState = await loadExistingStoreCardsState({
      cardsKey,
      userId,
      ifMatchUpdatedAt,
      ifMatchRevision,
      ifMatchSnapshotToken,
      routeContext,
    });
    if ("errorResponse" in existingState) return existingState.errorResponse;

    const preparedRecord = await prepareStoreCardsRecordForWrite({
      incomingCards: incomingCardsTyped,
      existingCards: existingState.existingCards,
      existingCardOrder: existingState.existingCardOrder,
      existingGlobalSettings: existingState.existingGlobalSettings,
      cardOrder,
      hasCardOrder,
      globalSettings,
      userId,
      routeContext,
    });
    if ("errorResponse" in preparedRecord) return preparedRecord.errorResponse;

    const { cardData } = preparedRecord;

    const storeResult = await storeCardsRecord({
      cardsKey,
      expectedSerializedCurrentRecord:
        existingState.ifMatchCheck.expectedSerializedCurrentRecord,
      userId,
      serializedCardData: JSON.stringify(cardData),
      ifMatchUpdatedAt,
      shouldEnforceAtomicCheck:
        existingState.ifMatchCheck.shouldEnforceAtomicCheck,
    });
    if (!storeResult.didWrite) {
      if (storeResult.reason === "missing_user_snapshot") {
        return createMissingUserSnapshotResponse(
          endpoint,
          endpointKey,
          request,
          startTime,
        );
      }

      return createIfMatchConflictResponse(
        storeResult.currentUpdatedAt,
        endpoint,
        endpointKey,
        request,
        startTime,
      );
    }

    return createStoreCardsSuccessResponse({
      userId,
      endpoint,
      endpointKey,
      request,
      startTime,
      cardData,
      storeResult,
    });
  } catch (error) {
    return handleError(
      error as Error,
      endpoint,
      startTime,
      buildAnalyticsMetricKey(endpointKey, "failed_requests"),
      "Card storage failed",
      request,
      {
        redisUnavailableMessage: "Card storage is temporarily unavailable",
      },
    );
  }
}

export function OPTIONS(request: Request) {
  const headers = apiJsonHeaders(request);
  return new Response(null, {
    headers: {
      ...headers,
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}
