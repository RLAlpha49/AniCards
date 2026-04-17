/**
 * Error message mapping and recovery suggestion system.
 * Provides user-friendly error messages with actionable recovery steps.
 * @source
 */

/**
 * Categorizes errors for consistent handling and user communication.
 * @source
 */
export const ERROR_CATEGORIES = [
  "user_not_found",
  "rate_limited",
  "network_error",
  "invalid_data",
  "validation_error",
  "conflict",
  "server_error",
  "timeout",
  "authentication",
  "forbidden",
  "unknown",
] as const;

export type ErrorCategory = (typeof ERROR_CATEGORIES)[number];

const ERROR_CATEGORY_SET = new Set<ErrorCategory>(ERROR_CATEGORIES);

/**
 * Recovery suggestion for an error, guiding users toward resolution.
 * @source
 */
export interface RecoverySuggestion {
  title: string;
  description: string;
  actionUrl?: string;
  actionLabel?: string;
}

export interface StructuredErrorLike extends Error {
  statusCode?: number;
  status?: number;
  publicMessage?: string;
  category?: ErrorCategory;
  retryable?: boolean;
  recoverySuggestions?: RecoverySuggestion[];
}

/**
 * Comprehensive error details for display and tracking.
 * @source
 */
export interface ErrorDetails {
  userMessage: string;
  technicalMessage: string;
  category: ErrorCategory;
  suggestions: RecoverySuggestion[];
  retryable: boolean;
  statusCode?: number;
}

export interface StructuredErrorContext {
  message: string;
  statusCode?: number;
  category?: ErrorCategory;
  retryable?: boolean;
  recoverySuggestions?: RecoverySuggestion[];
}

interface GetErrorDetailsOptions {
  category?: ErrorCategory;
  retryable?: boolean;
  recoverySuggestions?: RecoverySuggestion[];
}

function isErrorCategoryValue(value: unknown): value is ErrorCategory {
  return (
    typeof value === "string" && ERROR_CATEGORY_SET.has(value as ErrorCategory)
  );
}

function isRecoverySuggestionValue(
  value: unknown,
): value is RecoverySuggestion {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const suggestion = value as Partial<RecoverySuggestion>;

  return (
    typeof suggestion.title === "string" &&
    suggestion.title.trim().length > 0 &&
    typeof suggestion.description === "string" &&
    suggestion.description.trim().length > 0 &&
    (suggestion.actionLabel === undefined ||
      (typeof suggestion.actionLabel === "string" &&
        suggestion.actionLabel.trim().length > 0)) &&
    (suggestion.actionUrl === undefined ||
      (typeof suggestion.actionUrl === "string" &&
        suggestion.actionUrl.trim().length > 0))
  );
}

function coerceErrorStatusCode(value: unknown): number | undefined {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 400 ||
    value > 599
  ) {
    return undefined;
  }

  return value;
}

function resolveStructuredErrorMessage(
  error: unknown,
  structuredError: StructuredErrorLike | undefined,
  fallbackMessage: string,
): string {
  const publicMessage = structuredError?.publicMessage;
  if (typeof publicMessage === "string" && publicMessage.trim().length > 0) {
    return publicMessage.trim();
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim();
  }

  return fallbackMessage;
}

function resolveErrorDetailsCategory(
  message: string,
  statusCode: number | undefined,
  options: GetErrorDetailsOptions | undefined,
  exactMatch: ErrorDetails | undefined,
): ErrorCategory {
  if (options?.category) {
    return options.category;
  }

  if (exactMatch?.category) {
    return exactMatch.category;
  }

  return statusCode
    ? categorizeByStatusCode(statusCode)
    : categorizeError(message);
}

function resolveFallbackErrorRetryable(
  category: ErrorCategory,
  statusCode: number | undefined,
  options: GetErrorDetailsOptions | undefined,
): boolean {
  if (typeof options?.retryable === "boolean") {
    return options.retryable;
  }

  if (options?.category) {
    return isRetryableErrorCategory(category);
  }

  return statusCode ? statusCode >= 500 : false;
}

/**
 * Resolve structured error metadata from a thrown value while preserving a
 * safe fallback when optional metadata is missing.
 * @param error - Unknown runtime error or string-like failure value.
 * @param fallbackMessage - Safe fallback copy when the error has no message.
 * @returns Normalized error context for shared user-facing handling.
 * @source
 */
export function extractStructuredErrorContext(
  error: unknown,
  fallbackMessage: string,
): StructuredErrorContext {
  const structuredError =
    typeof error === "object" && error !== null
      ? (error as StructuredErrorLike)
      : undefined;
  const message = resolveStructuredErrorMessage(
    error,
    structuredError,
    fallbackMessage,
  );
  const statusCode =
    coerceErrorStatusCode(structuredError?.statusCode) ??
    coerceErrorStatusCode(structuredError?.status);
  const category = isErrorCategoryValue(structuredError?.category)
    ? structuredError.category
    : undefined;
  const retryable =
    typeof structuredError?.retryable === "boolean"
      ? structuredError.retryable
      : undefined;
  const recoverySuggestions = Array.isArray(
    structuredError?.recoverySuggestions,
  )
    ? structuredError.recoverySuggestions.filter(isRecoverySuggestionValue)
    : undefined;

  return {
    message,
    ...(statusCode !== undefined ? { statusCode } : {}),
    ...(category ? { category } : {}),
    ...(typeof retryable === "boolean" ? { retryable } : {}),
    ...(recoverySuggestions ? { recoverySuggestions } : {}),
  };
}

/**
 * Mapping of error patterns to user-friendly messages and recovery suggestions.
 * @source
 */
const ERROR_MESSAGE_MAP: Record<string, ErrorDetails> = {
  // User not found errors
  not_found_user: {
    userMessage: "User not found",
    technicalMessage: "The AniList username could not be found",
    category: "user_not_found",
    retryable: false,
    suggestions: [
      {
        title: "Check the username",
        description:
          "Verify that the AniList username is spelled correctly and exists on AniList.co",
        actionUrl: "https://anilist.co",
        actionLabel: "Visit AniList",
      },
      {
        title: "Try again",
        description:
          "If you believe the username exists, wait a moment and try again",
      },
    ],
  },

  // Rate limiting errors
  rate_limited: {
    userMessage: "Too many requests",
    technicalMessage:
      "Rate limit exceeded. Please wait before making another request",
    category: "rate_limited",
    retryable: true,
    suggestions: [
      {
        title: "Wait and retry",
        description:
          "Please wait a minute before generating another card. We're limiting requests to keep the service running smoothly.",
      },
      {
        title: "Try a different user",
        description: "You can search for another AniList user in the meantime",
      },
    ],
  },

  // Network errors
  network_error: {
    userMessage: "Network connection error",
    technicalMessage:
      "Failed to reach the server. Please check your connection.",
    category: "network_error",
    retryable: true,
    suggestions: [
      {
        title: "Check your connection",
        description:
          "Make sure you have a stable internet connection and try again",
      },
      {
        title: "Try again",
        description: "Click the retry button or reload the page to try again",
      },
    ],
  },

  // Server errors
  server_error: {
    userMessage: "Server error",
    technicalMessage:
      "An error occurred on the server. Please try again later.",
    category: "server_error",
    retryable: true,
    suggestions: [
      {
        title: "Try again later",
        description:
          "The server is experiencing issues. Please try again in a moment.",
      },
      {
        title: "Contact support",
        description: "If the problem persists, please contact our support team",
      },
    ],
  },

  // Timeout errors
  timeout: {
    userMessage: "Request timed out",
    technicalMessage:
      "The request took too long to complete. Please try again.",
    category: "timeout",
    retryable: true,
    suggestions: [
      {
        title: "Try again",
        description:
          "The request took longer than expected. Please retry with a potentially smaller username or card selection.",
      },
      {
        title: "Simplify selection",
        description:
          "Try generating fewer cards at once to speed up the process",
      },
    ],
  },

  // Invalid data errors
  invalid_data: {
    userMessage: "Invalid data",
    technicalMessage:
      "The provided data is invalid or incomplete. Please check your input.",
    category: "invalid_data",
    retryable: false,
    suggestions: [
      {
        title: "Check your input",
        description: "Make sure all required fields are filled in correctly",
      },
      {
        title: "Try different settings",
        description:
          "Verify that your color selections and card options are valid",
      },
    ],
  },

  // Validation errors
  validation_error: {
    userMessage: "Some information needs to be corrected",
    technicalMessage:
      "The request was rejected because one or more values failed validation.",
    category: "validation_error",
    retryable: false,
    suggestions: [
      {
        title: "Review the latest values",
        description:
          "Check the information or settings involved in this action and correct anything incomplete or out of range.",
      },
      {
        title: "Reload if something looks out of sync",
        description:
          "If the page no longer matches the latest saved state, reload it before trying again.",
      },
    ],
  },

  // Conflict errors
  conflict_error: {
    userMessage: "This page is out of date",
    technicalMessage:
      "The request conflicts with newer saved data or another completed action.",
    category: "conflict",
    retryable: false,
    suggestions: [
      {
        title: "Reload the latest data",
        description:
          "Refresh the page to pick up the newest saved state before trying again.",
      },
      {
        title: "Avoid duplicate actions",
        description:
          "If you already submitted or saved once, wait for that change to finish before trying again.",
      },
    ],
  },

  // Missing stats
  missing_stats: {
    userMessage: "User has no anime/manga stats",
    technicalMessage:
      "The user does not have available statistics for the requested media type",
    category: "invalid_data",
    retryable: false,
    suggestions: [
      {
        title: "The user has no stats",
        description:
          "This user hasn't added any anime/manga to their AniList profile yet",
      },
      {
        title: "Try another user",
        description:
          "Search for a different AniList user who has added anime or manga to their profile",
      },
    ],
  },

  // Authentication errors
  authentication_error: {
    userMessage: "Authentication failed",
    technicalMessage: "Failed to authenticate with AniList",
    category: "authentication",
    retryable: true,
    suggestions: [
      {
        title: "Try again",
        description: "Refresh the page and try generating the card again",
      },
      {
        title: "Contact support",
        description:
          "If the problem persists, there may be an issue with our service configuration",
      },
    ],
  },

  // Forbidden / protected-request errors
  forbidden_request: {
    userMessage: "This request is blocked",
    technicalMessage:
      "The requested page or action is only available from a supported, protected flow.",
    category: "forbidden",
    retryable: false,
    suggestions: [
      {
        title: "Go back to the previous step",
        description:
          "This action may only work when you start from the original page or protected request flow.",
      },
      {
        title: "Reload from a safe entry point",
        description:
          "Open the page again through normal navigation instead of a stale, copied, or shared link.",
      },
    ],
  },
};

/**
 * HTTP status code to error category mapping.
 * @source
 */
const STATUS_CODE_CATEGORIES: Record<number, ErrorCategory> = {
  400: "invalid_data",
  401: "authentication",
  403: "forbidden",
  404: "user_not_found",
  408: "timeout",
  409: "conflict",
  422: "validation_error",
  429: "rate_limited",
  500: "server_error",
  502: "server_error",
  503: "server_error",
  504: "timeout",
};

const RETRYABLE_ERROR_CATEGORIES = new Set<ErrorCategory>([
  "network_error",
  "rate_limited",
  "server_error",
  "timeout",
]);

/**
 * Map a status code to an error category.
 * @param statusCode - HTTP status code.
 * @returns ErrorCategory based on the status code, defaults to "server_error".
 * @source
 */
export function categorizeByStatusCode(statusCode?: number): ErrorCategory {
  if (!statusCode) return "unknown";
  return STATUS_CODE_CATEGORIES[statusCode] || "server_error";
}

/**
 * Determine whether a categorized failure should be treated as retryable.
 * @param category - Error category to evaluate.
 * @returns True when retry/backoff is appropriate.
 * @source
 */
export function isRetryableErrorCategory(category: ErrorCategory): boolean {
  return RETRYABLE_ERROR_CATEGORIES.has(category);
}

/**
 * Determine whether an HTTP status code should be retried for transient upstream failures.
 * @param statusCode - HTTP status code from an upstream response.
 * @returns True when the status represents a transient condition.
 * @source
 */
export function isRetryableStatusCode(statusCode?: number): boolean {
  if (!statusCode) return false;
  return isRetryableErrorCategory(categorizeByStatusCode(statusCode));
}

/**
 * Extract error category from error message or text.
 * @param message - Error message to analyze.
 * @returns Detected ErrorCategory based on message content.
 * @source
 */
export function categorizeError(message: string): ErrorCategory {
  const lowercased = message.toLowerCase();

  if (
    lowercased.includes("not found") ||
    lowercased.includes("no such user") ||
    lowercased.includes("user does not exist") ||
    lowercased.includes("no user found")
  ) {
    return "user_not_found";
  }

  if (
    lowercased.includes("rate limit") ||
    lowercased.includes("too many request") ||
    lowercased.includes("429")
  ) {
    return "rate_limited";
  }

  if (
    lowercased.includes("network") ||
    lowercased.includes("failed to fetch") ||
    lowercased.includes("cors")
  ) {
    return "network_error";
  }

  if (
    lowercased.includes("timeout") ||
    lowercased.includes("abort") ||
    lowercased.includes("504")
  ) {
    return "timeout";
  }

  if (
    lowercased.includes("forbidden") ||
    lowercased.includes("protected request") ||
    lowercased.includes("permission denied") ||
    lowercased.includes("access denied") ||
    lowercased.includes("not allowed") ||
    lowercased.includes("403")
  ) {
    return "forbidden";
  }

  if (
    lowercased.includes("conflict") ||
    lowercased.includes("updated elsewhere") ||
    lowercased.includes("already exists") ||
    lowercased.includes("already bound") ||
    lowercased.includes("stale") ||
    lowercased.includes("out of date") ||
    lowercased.includes("revision mismatch") ||
    lowercased.includes("if-match") ||
    lowercased.includes("409")
  ) {
    return "conflict";
  }

  if (
    lowercased.includes("validation") ||
    lowercased.includes("unprocessable") ||
    lowercased.includes("422")
  ) {
    return "validation_error";
  }

  if (
    lowercased.includes("invalid") ||
    lowercased.includes("malformed") ||
    lowercased.includes("400")
  ) {
    return "invalid_data";
  }

  if (lowercased.includes("unauthorized") || lowercased.includes("401")) {
    return "authentication";
  }

  if (
    lowercased.includes("server error") ||
    lowercased.includes("500") ||
    lowercased.includes("502") ||
    lowercased.includes("503")
  ) {
    return "server_error";
  }

  return "unknown";
}

/**
 * Get error details for a given message or category.
 * Falls back to generating dynamic messages if exact match not found.
 * @param message - Error message or key to look up.
 * @param statusCode - Optional HTTP status code for categorization.
 * @returns ErrorDetails with user message, technical details, and suggestions.
 * @source
 */
export function getErrorDetails(
  message: string,
  statusCode?: number,
  options?: GetErrorDetailsOptions,
): ErrorDetails {
  const normalizedMessage = message.toLowerCase();
  const exactMatch = Object.entries(ERROR_MESSAGE_MAP).find(
    ([key]) =>
      normalizedMessage.includes(key) || key.includes(normalizedMessage),
  )?.[1];

  const category = resolveErrorDetailsCategory(
    message,
    statusCode,
    options,
    exactMatch,
  );

  const categoryMatch = Object.values(ERROR_MESSAGE_MAP).find(
    (details) => details.category === category,
  );

  const template =
    (options?.category ? categoryMatch : (exactMatch ?? categoryMatch)) ??
    categoryMatch;

  if (template) {
    return {
      ...template,
      category,
      retryable:
        typeof options?.retryable === "boolean"
          ? options.retryable
          : template.retryable,
      suggestions: options?.recoverySuggestions ?? template.suggestions,
      ...(statusCode !== undefined ? { statusCode } : {}),
    };
  }

  return {
    userMessage: "Something went wrong",
    technicalMessage: message,
    category,
    retryable: resolveFallbackErrorRetryable(category, statusCode, options),
    suggestions: options?.recoverySuggestions ?? [
      {
        title: "Try again",
        description:
          "Please try again or contact support if the issue persists",
      },
    ],
    ...(statusCode !== undefined ? { statusCode } : {}),
  };
}

/**
 * Build a safe summary string for user-facing fallbacks without exposing raw
 * technical error details.
 * @param message - Error message or key to look up.
 * @param statusCode - Optional HTTP status code for categorization.
 * @returns Concise user-facing summary derived from the structured error model.
 * @source
 */
export function getSafeErrorSummary(
  message: string,
  statusCode?: number,
): string {
  const details = getErrorDetails(message, statusCode);
  const primarySuggestion = details.suggestions.find(
    (suggestion) => suggestion.description.trim().length > 0,
  )?.description;

  if (!primarySuggestion) {
    return details.userMessage;
  }

  const normalizedUserMessage = details.userMessage.trim();
  const normalizedSuggestion = primarySuggestion.trim();

  if (
    normalizedSuggestion
      .toLowerCase()
      .startsWith(normalizedUserMessage.toLowerCase())
  ) {
    return normalizedSuggestion;
  }

  const hasTerminalPunctuation = /[.!?]$/.test(normalizedUserMessage);
  return `${normalizedUserMessage}${hasTerminalPunctuation ? "" : "."} ${normalizedSuggestion}`;
}
