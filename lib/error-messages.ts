/**
 * Error message mapping and recovery suggestion system.
 * Provides user-friendly error messages with actionable recovery steps.
 * @source
 */

/**
 * Categorizes errors for consistent handling and user communication.
 * @source
 */
export type ErrorCategory =
  | "user_not_found"
  | "rate_limited"
  | "network_error"
  | "invalid_data"
  | "server_error"
  | "timeout"
  | "authentication"
  | "unknown";

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
};

/**
 * HTTP status code to error category mapping.
 * @source
 */
const STATUS_CODE_CATEGORIES: Record<number, ErrorCategory> = {
  400: "invalid_data",
  401: "authentication",
  403: "authentication",
  404: "user_not_found",
  408: "timeout",
  429: "rate_limited",
  500: "server_error",
  502: "server_error",
  503: "server_error",
  504: "timeout",
};

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
): ErrorDetails {
  // Check exact match in map
  const exactMatch = Object.entries(ERROR_MESSAGE_MAP).find(
    ([key]) =>
      message.toLowerCase().includes(key) ||
      key.includes(message.toLowerCase()),
  );

  if (exactMatch) {
    return exactMatch[1];
  }

  // Categorize dynamically
  const category = statusCode
    ? categorizeByStatusCode(statusCode)
    : categorizeError(message);

  // Try to find template by category
  const categoryMatch = Object.values(ERROR_MESSAGE_MAP).find(
    (details) => details.category === category,
  );

  if (categoryMatch) {
    return categoryMatch;
  }

  // Return generic error details
  return {
    userMessage: "Something went wrong",
    technicalMessage: message,
    category: "unknown",
    retryable: statusCode ? statusCode >= 500 : false,
    suggestions: [
      {
        title: "Try again",
        description:
          "Please try again or contact support if the issue persists",
      },
    ],
  };
}

/**
 * Format error details for display to user.
 * Returns tuple of [title, description].
 * @param details - ErrorDetails from getErrorDetails.
 * @returns Formatted [title, description] pair.
 * @source
 */
export function formatErrorForDisplay(details: ErrorDetails): [string, string] {
  return [details.userMessage, details.technicalMessage];
}

/**
 * Check if an error should be retried based on its characteristics.
 * @param details - ErrorDetails to analyze.
 * @returns True if the error is retryable.
 * @source
 */
export function isErrorRetryable(details: ErrorDetails): boolean {
  return details.retryable;
}

/**
 * Get recovery suggestions for an error.
 * @param details - ErrorDetails from getErrorDetails.
 * @returns Array of RecoverySuggestion objects.
 * @source
 */
export function getRecoverySuggestions(
  details: ErrorDetails,
): RecoverySuggestion[] {
  return details.suggestions;
}
