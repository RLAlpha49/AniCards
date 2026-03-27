/**
 * Stores user card configuration snapshots while preserving editor-friendly,
 * partial-update semantics.
 *
 * The card editor does not resend every persisted field on each save, so this
 * route merges incoming changes with the existing Redis record, keeps omitted
 * per-card settings intact, and backfills newly supported card types to keep
 * older records forward-compatible.
 */
import type { NextResponse } from "next/server";

import {
  apiErrorResponse,
  apiJsonHeaders,
  buildAnalyticsMetricKey,
  handleError,
  incrementAnalytics,
  initializeApiRequest,
  jsonWithCors,
  logPrivacySafe,
  logSuccess,
  readJsonRequestBody,
  redisClient,
  validateCardData,
} from "@/lib/api-utils";
import { displayNames, isValidCardType } from "@/lib/card-data/validation";
import {
  CardsRecord,
  GlobalCardSettings,
  StoredCardConfig,
} from "@/lib/types/records";
import {
  clampBorderRadius,
  getColorInvalidReason,
  safeParse,
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

/**
 * Cached list of supported base card types.
 * Used to ensure stored Redis records are never empty/partial.
 */
const SUPPORTED_BASE_CARD_TYPES = Object.keys(displayNames);

/**
 * Ensures the stored record always contains every supported base card type.
 * Missing card types are added as disabled.
 */
function ensureAllSupportedCardTypesPresent(
  cardsMap: Map<string, StoredCardConfig>,
): void {
  for (const baseCardName of SUPPORTED_BASE_CARD_TYPES) {
    if (cardsMap.has(baseCardName)) continue;
    cardsMap.set(baseCardName, { cardName: baseCardName, disabled: true });
  }
}

/**
 * Checks if a card type supports pie variation.
 * @source
 */
function supportsPieVariation(cardName: string): boolean {
  return CARD_TYPES_WITH_PIE_VARIATION.has(cardName);
}

function parseStoredCardsRecord(
  rawValue: unknown,
  endpoint: string,
  endpointKey: string,
  cardsKey: string,
): StoredCardConfig[] {
  if (rawValue === undefined || rawValue === null) return [];

  try {
    const parsedValue =
      typeof rawValue === "string"
        ? safeParse(rawValue, `${endpoint}:stored-cards:${cardsKey}`)
        : rawValue;

    if (parsedValue && typeof parsedValue === "object") {
      const cards = (parsedValue as CardsRecord).cards;
      if (Array.isArray(cards)) {
        const filtered = cards.filter(
          (c): c is StoredCardConfig =>
            !!c &&
            typeof c === "object" &&
            typeof c.cardName === "string" &&
            isValidCardType(c.cardName),
        );
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
    }
  } catch (error) {
    logPrivacySafe("warn", endpoint, "Stored card record corrupted", {
      cardsKey,
      error: error instanceof Error ? error.message : String(error),
    });
    incrementAnalytics(
      buildAnalyticsMetricKey(endpointKey, "corrupted_records"),
    ).catch(() => {});
  }

  return [];
}

/** Helper to safely parse existing global settings from stored data */
function parseExistingGlobalSettings(
  existingData: unknown,
  endpoint: string,
): GlobalCardSettings | undefined {
  try {
    return (
      typeof existingData === "string"
        ? safeParse<CardsRecord>(existingData, `${endpoint}:globalSettings`)
        : (existingData as CardsRecord | null)
    )?.globalSettings;
  } catch (error) {
    logPrivacySafe(
      "warn",
      endpoint,
      "Failed to parse existing global settings",
      { error: error instanceof Error ? error.message : String(error) },
    );
    return undefined;
  }
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
  const useCustomSettings =
    incoming.useCustomSettings ?? previous?.useCustomSettings ?? true;

  const normalizedBorderRadius = useCustomSettings
    ? computeBorderRadius(incoming, previous)
    : undefined;

  const baseCardType = (incoming.cardName || "").split("-")[0] || "";
  const shouldSaveColorData = useCustomSettings;
  const effectiveColorPreset = shouldSaveColorData
    ? (incoming.colorPreset ?? previous?.colorPreset)
    : undefined;
  const shouldSaveIndividualColors =
    shouldSaveColorData &&
    (!effectiveColorPreset || effectiveColorPreset === "custom");

  const shouldPersistFavoritesGridDims =
    useCustomSettings && baseCardType === "favoritesGrid";
  const resolvedGridCols = shouldPersistFavoritesGridDims
    ? (clampGridDim(incoming.gridCols) ?? clampGridDim(previous?.gridCols))
    : undefined;
  const resolvedGridRows = shouldPersistFavoritesGridDims
    ? (clampGridDim(incoming.gridRows) ?? clampGridDim(previous?.gridRows))
    : undefined;

  const effectiveBorderColor = useCustomSettings
    ? (sanitizeStoredBorderColor(incoming.borderColor) ??
      sanitizeStoredBorderColor(previous?.borderColor))
    : undefined;

  const resolvedUseStatusColors = useCustomSettings
    ? (incoming.useStatusColors ?? previous?.useStatusColors)
    : undefined;

  const resolvedShowFavorites = useCustomSettings
    ? computeShowFavorites(incoming, previous)
    : undefined;

  const resolvedShowPiePercentages = useCustomSettings
    ? computeShowPiePercentages(incoming, previous)
    : undefined;

  return {
    cardName: incoming.cardName,
    disabled: incoming.disabled === true ? true : undefined,
    variation: incoming.variation ?? previous?.variation,
    colorPreset: effectiveColorPreset,
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
    borderColor: effectiveBorderColor,
    borderRadius: normalizedBorderRadius,
    showFavorites: resolvedShowFavorites,
    useStatusColors: resolvedUseStatusColors,
    showPiePercentages: resolvedShowPiePercentages,
    gridCols: resolvedGridCols,
    gridRows: resolvedGridRows,
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
  incomingCards: StoredCardConfig[];
  existingCards: StoredCardConfig[];
  mergedCardsByName: Map<string, StoredCardConfig>;
  cardOrder?: string[];
}): StoredCardConfig[] {
  const ordered: StoredCardConfig[] = [];
  const seen = new Set<string>();

  const pushByName = (name: string) => {
    if (seen.has(name)) return;
    const merged = opts.mergedCardsByName.get(name);
    if (!merged) return;
    ordered.push(merged);
    seen.add(name);
  };

  const shouldUseIncomingOrder =
    opts.incomingCards.length > 0 &&
    (opts.existingCards.length === 0 ||
      opts.incomingCards.length >= opts.existingCards.length);

  let primaryOrder: string[];
  if (opts.cardOrder && opts.cardOrder.length > 0) {
    primaryOrder = opts.cardOrder;
  } else if (shouldUseIncomingOrder) {
    primaryOrder = opts.incomingCards.map((c) => c.cardName);
  } else {
    primaryOrder = opts.existingCards.map((c) => c.cardName);
  }

  for (const name of primaryOrder) pushByName(name);

  for (const card of opts.existingCards) {
    pushByName(card.cardName);
  }

  for (const baseCardName of SUPPORTED_BASE_CARD_TYPES) {
    pushByName(baseCardName);
  }

  return ordered;
}

function normalizeIncomingCardOrder(raw: unknown): {
  cardOrder?: string[];
  invalid: boolean;
} {
  if (raw === undefined) return { invalid: false };
  if (!Array.isArray(raw)) return { invalid: true };

  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (typeof item !== "string") return { invalid: true };
    const trimmed = item.trim();
    if (!trimmed) continue;
    if (!isValidCardType(trimmed)) return { invalid: true };
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return {
    invalid: false,
    cardOrder: normalized.length > 0 ? normalized : undefined,
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
  statsData: unknown,
  endpoint: string,
  endpointKey: string,
  request: Request,
  userId: number,
): Promise<NextResponse | undefined> {
  if (!validated.success) {
    await incrementAnalytics(
      buildAnalyticsMetricKey(endpointKey, "failed_requests"),
    );
    return validated.error;
  }
  const statsError =
    statsData && typeof statsData === "object"
      ? (statsData as Record<string, unknown>).error
      : undefined;
  if (statsError !== undefined) {
    const errMsg = String(statsError);
    logPrivacySafe(
      "warn",
      endpoint,
      "Invalid store-cards stats payload",
      { userId, error: errMsg },
      request,
    );
    await incrementAnalytics(
      buildAnalyticsMetricKey(endpointKey, "failed_requests"),
    );
    return apiErrorResponse(request, 400, "Invalid data: " + errMsg, {
      category: "invalid_data",
      retryable: false,
    });
  }
  return undefined;
}

type ParsedStoreCardsBody = {
  statsData: unknown;
  userId: number;
  incomingCards: unknown;
  incomingCardsCount: number;
  globalSettings?: Partial<GlobalCardSettings>;
  ifMatchUpdatedAt?: string;
  cardOrder?: string[];
};

async function parseStoreCardsRequestBody(
  request: Request,
  endpoint: string,
  endpointKey: string,
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

  const statsData = body.statsData;
  const rawUserId = body.userId;
  const userId = typeof rawUserId === "number" ? rawUserId : Number(rawUserId);
  if (!Number.isFinite(userId)) {
    await incrementAnalytics(
      buildAnalyticsMetricKey(endpointKey, "failed_requests"),
    ).catch(() => {});
    return {
      errorResponse: apiErrorResponse(request, 400, "Invalid userId", {
        category: "invalid_data",
        retryable: false,
      }),
    };
  }

  const incomingCards = body.cards;
  const incomingCardsCount = Array.isArray(incomingCards)
    ? incomingCards.length
    : 0;

  const globalSettings = body.globalSettings as
    | Partial<GlobalCardSettings>
    | undefined;

  const ifMatchUpdatedAt =
    typeof body.ifMatchUpdatedAt === "string"
      ? body.ifMatchUpdatedAt
      : undefined;

  const cardOrderResult = normalizeIncomingCardOrder(body.cardOrder);
  if (cardOrderResult.invalid) {
    await incrementAnalytics(
      buildAnalyticsMetricKey(endpointKey, "failed_requests"),
    ).catch(() => {});
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
      statsData,
      userId,
      incomingCards,
      incomingCardsCount,
      globalSettings,
      ifMatchUpdatedAt,
      cardOrder,
    },
  };
}
async function enforceIfMatchUpdatedAt(
  existingData: unknown,
  ifMatchUpdatedAt: string | undefined,
  endpoint: string,
  endpointKey: string,
  cardsKey: string,
  request: Request,
): Promise<NextResponse | undefined> {
  if (!ifMatchUpdatedAt) return undefined;
  try {
    if (typeof existingData !== "string") return undefined;
    const existingRecord = safeParse<CardsRecord>(
      existingData,
      `${endpoint}:existing-record:${cardsKey}`,
    );
    if (
      typeof existingRecord?.updatedAt === "string" &&
      existingRecord.updatedAt.length > 0 &&
      existingRecord.updatedAt !== ifMatchUpdatedAt
    ) {
      await incrementAnalytics(
        buildAnalyticsMetricKey(endpointKey, "failed_requests"),
      ).catch(() => {});
      return apiErrorResponse(
        request,
        409,
        "Conflict: data was updated elsewhere. Please reload and try again.",
        {
          category: "invalid_data",
          retryable: false,
          additionalFields: {
            currentUpdatedAt: existingRecord.updatedAt,
          },
        },
      );
    }
  } catch {
    // If the existing record is corrupt, ignore version checks and let
    // downstream parsing handle it.
  }
  return undefined;
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

/**
 * Assemble stored cards and merged global settings.
 */
async function assembleStoredCardsAndGlobalSettings(params: {
  incomingCards: StoredCardConfig[];
  existingCards: StoredCardConfig[];
  existingGlobalSettings?: GlobalCardSettings;
  cardOrder?: string[];
  globalSettings?: Partial<GlobalCardSettings>;
  endpoint: string;
  endpointKey: string;
  request: Request;
}): Promise<
  | {
      orderedStoredCards: StoredCardConfig[];
      mergedGlobalSettings?: GlobalCardSettings;
    }
  | { errorResponse: NextResponse }
> {
  const {
    incomingCards,
    existingCards,
    existingGlobalSettings,
    cardOrder,
    globalSettings,
    endpoint,
    endpointKey,
    request,
  } = params;

  const existingCardsMap = new Map<string, StoredCardConfig>(
    existingCards.map((card) => [card.cardName, card]),
  );

  const sanitizeResult = sanitizeIncomingGlobalSettings(globalSettings);
  if (sanitizeResult?.invalidColorStringKey) {
    logPrivacySafe(
      "warn",
      endpoint,
      "Invalid globalSettings color value",
      { invalidColorKey: sanitizeResult.invalidColorStringKey },
      request,
    );
    await incrementAnalytics(
      buildAnalyticsMetricKey(endpointKey, "failed_requests"),
    ).catch(() => {});
    return {
      errorResponse: apiErrorResponse(request, 400, "Invalid data", {
        category: "invalid_data",
        retryable: false,
      }),
    };
  }
  const sanitizedGlobalSettings = sanitizeResult?.sanitized;

  const effectiveBorderEnabled =
    sanitizedGlobalSettings?.borderEnabled ??
    existingGlobalSettings?.borderEnabled;

  applyIncomingCards(existingCardsMap, incomingCards);

  ensureAllSupportedCardTypesPresent(existingCardsMap);

  const orderedStoredCards = buildOrderedStoredCards({
    incomingCards,
    existingCards,
    mergedCardsByName: existingCardsMap,
    cardOrder,
  });

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

  const mergedGlobalSettings: GlobalCardSettings | undefined =
    buildMergedGlobalSettings(sanitizedGlobalSettings, existingGlobalSettings, {
      borderEnabled: effectiveBorderEnabled,
      borderColor: effectiveBorderColor,
      borderRadius: effectiveBorderRadius,
      useStatusColors: effectiveUseStatusColors,
      showPiePercentages: effectiveShowPiePercentages,
      showFavorites: effectiveShowFavorites,
      gridCols: effectiveGridCols,
      gridRows: effectiveGridRows,
    });

  return { orderedStoredCards, mergedGlobalSettings };
}

/**
 * Validate per-card colors on stored cards and return a NextResponse on failure.
 */
async function validateCardColors(
  orderedStoredCards: StoredCardConfig[],
  endpoint: string,
  endpointKey: string,
  request: Request,
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
        await incrementAnalytics(
          buildAnalyticsMetricKey(endpointKey, "failed_requests"),
        ).catch(() => {});
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
        await incrementAnalytics(
          buildAnalyticsMetricKey(endpointKey, "failed_requests"),
        ).catch(() => {});
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
  );
  if (init.errorResponse) return init.errorResponse;

  const { startTime, endpoint, endpointKey } = init;

  try {
    const bodyParse = await parseStoreCardsRequestBody(
      request,
      endpoint,
      endpointKey,
    );
    if (bodyParse.errorResponse) return bodyParse.errorResponse;
    const {
      statsData,
      userId,
      incomingCards,
      incomingCardsCount,
      globalSettings,
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
      statsData,
      endpoint,
      endpointKey,
      request,
      userId,
    );
    if (validateErrorResponse) return validateErrorResponse;

    const incomingCardsTyped = validated.success ? validated.cards : [];

    const cardsKey = `cards:${userId}`;
    logPrivacySafe(
      "log",
      endpoint,
      "Storing card configuration",
      { userId, cardsKey },
      request,
    );

    const existingData = await redisClient.get(cardsKey);

    // Optimistic concurrency: reject when the record has been updated since the
    // caller's expected version.
    const conflictResponse = await enforceIfMatchUpdatedAt(
      existingData,
      ifMatchUpdatedAt,
      endpoint,
      endpointKey,
      cardsKey,
      request,
    );
    if (conflictResponse) return conflictResponse;
    const existingCards = parseStoredCardsRecord(
      existingData,
      endpoint,
      endpointKey,
      cardsKey,
    );

    const existingGlobalSettings = parseExistingGlobalSettings(
      existingData,
      endpoint,
    );

    const assembly = await assembleStoredCardsAndGlobalSettings({
      incomingCards: incomingCardsTyped,
      existingCards,
      existingGlobalSettings,
      cardOrder,
      globalSettings,
      endpoint,
      endpointKey,
      request,
    });
    if ("errorResponse" in assembly) return assembly.errorResponse;
    const { orderedStoredCards, mergedGlobalSettings } = assembly;

    const colorValidationError = await validateCardColors(
      orderedStoredCards,
      endpoint,
      endpointKey,
      request,
    );
    if (colorValidationError) return colorValidationError;

    const cardData: CardsRecord = {
      userId,
      cards: orderedStoredCards,
      globalSettings: mergedGlobalSettings,
      updatedAt: new Date().toISOString(),
    };

    await redisClient.set(cardsKey, JSON.stringify(cardData));

    const duration = Date.now() - startTime;
    logSuccess(endpoint, userId, duration, "Stored cards", request);
    await incrementAnalytics(
      buildAnalyticsMetricKey(endpointKey, "successful_requests"),
    );

    return jsonWithCors(
      { success: true, userId, updatedAt: cardData.updatedAt },
      request,
    );
  } catch (error) {
    return handleError(
      error as Error,
      endpoint,
      startTime,
      buildAnalyticsMetricKey(endpointKey, "failed_requests"),
      "Card storage failed",
      request,
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
