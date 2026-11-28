/**
 * Payload validation for the store endpoints.
 *
 * Username, user id, colour, border radius, and card list checks. Unknown
 * card names get a suggestion built from edit distance.
 * @source
 */
import { NextResponse } from "next/server";
import { validateBorderRadius } from "@/lib/cards/style";
import {
  getColorInvalidReason,
  validateColorValue,
} from "@/lib/color/gradients";
import { displayNames, isValidCardType } from "@/lib/card-data/validation";
import { logWith } from "@/lib/log";
import { ApiError } from "@/lib/api/errors";
import { apiJsonHeaders, jsonWithCors } from "@/lib/api/http";

/**
 * Validates the payload for the store-users endpoint including userId,
 * optional username, and stats object shape.
 * @param data - The request data to validate.
 * @param endpoint - Logical endpoint name for logging/analytics.
 * @returns A NextResponse with an ApiError when invalid, or null otherwise.
 * @source
 */
export function validateUserData(
  data: Record<string, unknown>,
  endpoint: string,
  request?: Request,
): NextResponse<ApiError> | null {
  // Check required fields
  if (data.userId === undefined || data.userId === null) {
    logWith("warn", endpoint, `Missing userId`);
    return jsonWithCors({ error: "Invalid data" }, request, 400);
  }

  // Validate userId is a number
  const userId = Number(data.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    logWith("warn", endpoint, `Invalid userId format: ${data.userId}`);
    return jsonWithCors({ error: "Invalid data" }, request, 400);
  }

  // Validate username if provided
  if (data.username !== undefined && data.username !== null) {
    if (!isValidUsername(data.username)) {
      logWith("warn", endpoint, `Username invalid: ${data.username}`);
      return jsonWithCors({ error: "Invalid data" }, request, 400);
    }
  }

  // Validate stats exists and is an object
  if (!data.stats || typeof data.stats !== "object") {
    logWith("warn", endpoint, `Stats must be a valid object`);
    return jsonWithCors({ error: "Invalid data" }, request, 400);
  }

  return null;
}

/**
 * Validates a username string following project constraints: length,
 * permitted characters, and trimming. Used by both GET and POST paths.
 * @param value - Username value to validate.
 * @returns True if the username is valid.
 * @source
 */
export function isValidUsername(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 100) return false;
  // Only allow letters, numbers, underscores, hyphens and whitespace inside usernames.
  return /^[a-zA-Z0-9_\-\s]*$/.test(trimmed);
}

/**
 * Ensures required string fields for a card are present and valid.
 * Validates color formats (hex or gradient) and length constraints on string fields.
 * @param card - Card object to validate.
 * @param cardIndex - Index of the card in the array for error messages.
 * @param endpoint - Endpoint name used for logging/analytics context.
 * @returns A NextResponse with an ApiError when invalid, or null otherwise.
 * @source
 */
function validateCardRequiredFields(
  card: Record<string, unknown>,
  cardIndex: number,
  endpoint: string,
  request?: Request,
): NextResponse<ApiError> | null {
  const requiredStringFields = ["cardName", "variation"];
  const requiredColorFields = [
    "titleColor",
    "backgroundColor",
    "textColor",
    "circleColor",
  ];

  /** Validate required string fields with length constraints. */
  function validateRequiredStringFields(
    cardObj: Record<string, unknown>,
    fields: string[],
  ): NextResponse<ApiError> | null {
    for (const field of fields) {
      if (typeof cardObj[field] !== "string") {
        logWith(
          "warn",
          endpoint,
          `Card ${cardIndex} missing or invalid field: ${field}`,
        );
        return jsonWithCors({ error: "Invalid data" }, request, 400);
      }
      const value = cardObj[field];
      if (value.length === 0 || value.length > 100) {
        logWith(
          "warn",
          endpoint,
          `Card ${cardIndex} field ${field} exceeds length limits`,
        );
        return NextResponse.json(
          { error: "Invalid data" },
          { status: 400, headers: apiJsonHeaders(request) },
        );
      }
    }
    return null;
  }

  /** Validate required color fields, allowing hex string or gradient defs. */
  function validateRequiredColorFields(
    cardObj: Record<string, unknown>,
    fields: string[],
  ): NextResponse<ApiError> | null {
    for (const field of fields) {
      const value = cardObj[field];
      if (value === undefined || value === null) {
        logWith(
          "warn",
          endpoint,
          `Card ${cardIndex} missing required color field: ${field}`,
        );
        return NextResponse.json(
          { error: "Invalid data" },
          { status: 400, headers: apiJsonHeaders(request) },
        );
      }
      if (!validateColorValue(value)) {
        const reason = getColorInvalidReason(value);
        logWith(
          "warn",
          endpoint,
          `Card ${cardIndex} invalid color or gradient format for ${field} (${reason})`,
        );
        return NextResponse.json(
          { error: "Invalid data" },
          { status: 400, headers: apiJsonHeaders(request) },
        );
      }
    }
    return null;
  }

  const reqStrErr = validateRequiredStringFields(card, requiredStringFields);
  if (reqStrErr) return reqStrErr;

  // Ensure the cardName points to a supported card type (base type validation)
  const cardNameRaw = card["cardName"];
  if (typeof cardNameRaw !== "string" || !isValidCardType(cardNameRaw)) {
    logWith(
      "warn",
      endpoint,
      `Card ${cardIndex} has an invalid cardName: ${String(cardNameRaw)}`,
    );
    return NextResponse.json(
      { error: "Invalid data: Invalid card type" },
      { status: 400, headers: apiJsonHeaders(request) },
    );
  }

  const rawPreset = card["colorPreset"];
  const preset =
    typeof rawPreset === "string" && rawPreset.trim().length > 0
      ? rawPreset
      : undefined;
  const requireColorFields = preset === undefined || preset === "custom";
  if (requireColorFields) {
    const reqColorErr = validateRequiredColorFields(card, requiredColorFields);
    if (reqColorErr) return reqColorErr;
  }

  return null;
}

/**
 * Validates optional fields for a card such as booleans and optional
 * borderColor (hex or gradient format).
 * @param card - Card object to validate.
 * @param cardIndex - Index of the card in the array for error messages.
 * @param endpoint - Endpoint name used for logging/analytics context.
 * @returns A NextResponse with an ApiError when invalid, or null otherwise.
 * @source
 */
function validateCardOptionalFields(
  card: Record<string, unknown>,
  cardIndex: number,
  endpoint: string,
  request?: Request,
): NextResponse<ApiError> | null {
  // Validate optional boolean fields
  const optionalBooleanFields = [
    "showFavorites",
    "useStatusColors",
    "showPiePercentages",
  ];

  for (const field of optionalBooleanFields) {
    const value = card[field];
    if (value !== undefined && typeof value !== "boolean") {
      logWith(
        "warn",
        endpoint,
        `Card ${cardIndex} field ${field} must be boolean`,
      );
      return NextResponse.json(
        { error: "Invalid data" },
        { status: 400, headers: apiJsonHeaders(request) },
      );
    }
  }

  // Validate borderColor if present (optional, can be hex string or gradient)
  const borderColorValue = card.borderColor;
  const hasBorder = borderColorValue !== undefined && borderColorValue !== null;
  if (hasBorder) {
    if (!validateColorValue(borderColorValue)) {
      const reason = getColorInvalidReason(borderColorValue);
      logWith(
        "warn",
        endpoint,
        `Card ${cardIndex} invalid borderColor format (${reason})`,
      );
      return NextResponse.json(
        { error: "Invalid data" },
        { status: 400, headers: apiJsonHeaders(request) },
      );
    }
  }

  const borderRadiusValue = card.borderRadius;
  const borderRadiusError = validateBorderRadiusField(
    borderRadiusValue,
    cardIndex,
    endpoint,
    { requireValue: hasBorder },
    request,
  );
  if (borderRadiusError) return borderRadiusError;

  const gridColsValue = card.gridCols;
  if (gridColsValue !== undefined) {
    const n = Number(gridColsValue);
    if (!Number.isInteger(n) || n < 1 || n > 5) {
      logWith(
        "warn",
        endpoint,
        `Card ${cardIndex} gridCols must be an integer between 1 and 5`,
      );
      return NextResponse.json(
        { error: "Invalid data" },
        { status: 400, headers: apiJsonHeaders(request) },
      );
    }
  }

  const gridRowsValue = card.gridRows;
  if (gridRowsValue !== undefined) {
    const n = Number(gridRowsValue);
    if (!Number.isInteger(n) || n < 1 || n > 5) {
      logWith(
        "warn",
        endpoint,
        `Card ${cardIndex} gridRows must be an integer between 1 and 5`,
      );
      return NextResponse.json(
        { error: "Invalid data" },
        { status: 400, headers: apiJsonHeaders(request) },
      );
    }
  }

  return null;
}

function validateBorderRadiusField(
  borderRadiusValue: unknown,
  cardIndex: number,
  endpoint: string,
  options?: { requireValue?: boolean },
  request?: Request,
): NextResponse<ApiError> | null {
  const { requireValue = false } = options ?? {};
  if (borderRadiusValue === undefined || borderRadiusValue === null) {
    if (requireValue) {
      logWith(
        "warn",
        endpoint,
        `Card ${cardIndex} borderRadius required when border is enabled`,
      );
      return NextResponse.json(
        { error: "Invalid data" },
        { status: 400, headers: apiJsonHeaders(request) },
      );
    }
    return null;
  }
  if (typeof borderRadiusValue !== "number") {
    logWith(
      "warn",
      endpoint,
      `Card ${cardIndex} borderRadius must be a number`,
    );
    return NextResponse.json(
      { error: "Invalid data" },
      { status: 400, headers: apiJsonHeaders(request) },
    );
  }
  if (!validateBorderRadius(borderRadiusValue)) {
    logWith(
      "warn",
      endpoint,
      `Card ${cardIndex} borderRadius out of range: ${borderRadiusValue}`,
    );
    return NextResponse.json(
      { error: "Invalid data" },
      { status: 400, headers: apiJsonHeaders(request) },
    );
  }
  return null;
}

/**
 * Validates the provided userId and returns an API error response when
 * invalid. Keeps logging consistent with existing behavior.
 * @param userId - The incoming userId value
 * @param endpoint - Endpoint name used for logging
 */
function validateUserIdField(
  userId: unknown,
  endpoint: string,
  request?: Request,
): NextResponse<ApiError> | null {
  if (userId === undefined || userId === null) {
    logWith("warn", endpoint, `Missing userId`);
    return NextResponse.json(
      { error: "Invalid data" },
      { status: 400, headers: apiJsonHeaders(request) },
    );
  }

  const userIdNum = Number(userId);
  if (!Number.isInteger(userIdNum) || userIdNum <= 0) {
    logWith("warn", endpoint, `Invalid userId format: ${userId}`);
    return NextResponse.json(
      { error: "Invalid data" },
      { status: 400, headers: apiJsonHeaders(request) },
    );
  }

  return null;
}

/**
 * Ensures the payload is an array. Returns an API error response when not.
 */
function validateCardsArrayField(
  cards: unknown,
  endpoint: string,
  request?: Request,
): NextResponse<ApiError> | null {
  if (!Array.isArray(cards)) {
    logWith("warn", endpoint, `Cards must be an array`);
    return NextResponse.json(
      { error: "Invalid data" },
      { status: 400, headers: apiJsonHeaders(request) },
    );
  }
  return null;
}

/**
 * Collects card names from the provided card objects and separates them
 * into supported (uniqueSupportedNames) and unknownNames sets.
 */
function collectUniqueAndUnknownCardNames(
  cards: unknown[],
  supportedNames: Set<string>,
): { uniqueSupportedNames: Set<string>; unknownNames: Set<string> } {
  const uniqueSupportedNames = new Set<string>();
  const unknownNames = new Set<string>();

  for (const c of cards) {
    if (typeof c === "object" && c !== null) {
      const name = (c as Record<string, unknown>).cardName;
      if (typeof name === "string" && name.length > 0) {
        if (supportedNames.has(name)) uniqueSupportedNames.add(name);
        else unknownNames.add(name);
      }
    }
  }

  return { uniqueSupportedNames, unknownNames };
}

/**
 * Compute the Levenshtein edit distance between two strings.
 */
function levenshteinDistance(a: string, b: string): number {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );

  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }

  return dp[n][m];
}

/**
 * Build suggestion candidates for unknown names using Levenshtein distance.
 */
function buildLevenshteinSuggestions(
  unknownNames: Set<string>,
  supportedArray: string[],
  maxDistance = 3,
  topN = 3,
): Record<string, string[]> {
  const suggestions: Record<string, string[]> = {};
  for (const unknown of unknownNames) {
    const candidates = supportedArray
      .map((s) => ({ s, d: levenshteinDistance(unknown, s) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, topN)
      .filter((c) => c.d <= maxDistance)
      .map((c) => c.s);
    if (candidates.length) suggestions[unknown] = candidates;
  }
  return suggestions;
}

/**
 * Enforces a maximum on unique card types and returns an API error if exceeded.
 */
function validateUniqueCardTypes(
  cards: unknown[],
  endpoint: string,
  request?: Request,
): NextResponse<ApiError> | null {
  const maxSupportedTypes = Object.keys(displayNames).length || 33;
  const MAX_ALLOWED_CARDS = Math.max(33, maxSupportedTypes);

  const supportedNames = new Set<string>(Object.keys(displayNames));
  const { uniqueSupportedNames, unknownNames } =
    collectUniqueAndUnknownCardNames(cards, supportedNames);

  // If any invalid/unsupported card names are present, return a clear error
  if (unknownNames.size > 0) {
    logWith(
      "warn",
      endpoint,
      `Invalid card types provided: ${[...unknownNames].join(", ")}`,
    );

    const suggestions = buildLevenshteinSuggestions(unknownNames, [
      ...supportedNames,
    ]);

    return NextResponse.json(
      {
        error: "Invalid data: Invalid card type",
        invalidCardNames: [...unknownNames],
        suggestions,
      },
      { status: 400, headers: apiJsonHeaders(request) },
    );
  }

  // Enforce the allowed maximum against supported card types only
  if (uniqueSupportedNames.size > MAX_ALLOWED_CARDS) {
    logWith(
      "warn",
      endpoint,
      `Too many unique card types provided: ${uniqueSupportedNames.size} (max ${MAX_ALLOWED_CARDS})`,
    );
    return NextResponse.json(
      {
        error: `Too many cards provided: ${uniqueSupportedNames.size} (max ${MAX_ALLOWED_CARDS})`,
      },
      { status: 400, headers: apiJsonHeaders(request) },
    );
  }

  return null;
}

/**
 * Validates each card object in the array using existing helper validators.
 */
function validateCardsItems(
  cards: unknown[],
  endpoint: string,
  request?: Request,
): NextResponse<ApiError> | null {
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];

    if (typeof card !== "object" || card === null) {
      logWith("warn", endpoint, `Card ${i} is not a valid object`);
      return NextResponse.json(
        { error: "Invalid data" },
        { status: 400, headers: apiJsonHeaders(request) },
      );
    }

    const cardRecord = card as Record<string, unknown>;

    // Validate required fields
    const requiredFieldsError = validateCardRequiredFields(
      cardRecord,
      i,
      endpoint,
      request,
    );
    if (requiredFieldsError) return requiredFieldsError;

    // Validate optional fields
    const optionalFieldsError = validateCardOptionalFields(
      cardRecord,
      i,
      endpoint,
      request,
    );
    if (optionalFieldsError) return optionalFieldsError;
  }

  return null;
}

/**
 * Validates an array of cards provided in the store-cards endpoint, ensuring
 * userId is valid and that each card's required and optional fields are valid.
 * @param cards - Payload expected to be an array of card objects.
 * @param userId - User identifier associated with the cards.
 * @param endpoint - Logical endpoint name for logging/analytics.
 * @returns A NextResponse with an ApiError when invalid, or null otherwise.
 * @source
 */
export function validateCardData(
  cards: unknown,
  userId: unknown,
  endpoint: string,
  request?: Request,
): NextResponse<ApiError> | null {
  // Validate userId
  const userIdError = validateUserIdField(userId, endpoint, request);
  if (userIdError) return userIdError;

  // Validate that cards is an array
  const cardsArrayError = validateCardsArrayField(cards, endpoint, request);
  if (cardsArrayError) return cardsArrayError;

  const cardsArr = cards as unknown[];

  // Validate unique card types limit
  const uniqueErr = validateUniqueCardTypes(cardsArr, endpoint, request);
  if (uniqueErr) return uniqueErr;

  // Validate each card's structure and fields
  const itemsErr = validateCardsItems(cardsArr, endpoint, request);
  if (itemsErr) return itemsErr;

  return null;
}
