/**
 * Error tracking with context for monitoring and debugging.
 * Captures user actions, timestamps, and error types for analysis.
 * @source
 */

import type { ErrorCategory } from "@/lib/error-messages";

/**
 * Context information about the user action when error occurred.
 * @source
 */
export interface ErrorContext {
  userAction: string;
  timestamp: number;
  errorType: ErrorCategory;
  message: string;
  statusCode?: number;
  userId?: string;
  username?: string;
}

/**
 * In-memory error log for the current session.
 * @source
 */
const errorLog: ErrorContext[] = [];

/**
 * Maximum number of errors to keep in the session log.
 * @source
 */
const MAX_ERROR_LOG_SIZE = 50;

/**
 * Track an error with full context information.
 * Stores error data in memory and logs to analytics.
 * @param context - ErrorContext with user action and error details.
 * @source
 */
export function trackErrorWithContext(context: ErrorContext): void {
  const timestamp = Date.now();
  const entry: ErrorContext = {
    ...context,
    timestamp,
  };

  // Add to in-memory log
  errorLog.push(entry);

  // Maintain log size
  if (errorLog.length > MAX_ERROR_LOG_SIZE) {
    errorLog.shift();
  }

  // Log to console in development
  if (process.env.NODE_ENV === "development") {
    console.error("[ErrorTracking]", entry);
  }

  // Here you could also send to external service:
  // await sendToErrorTrackingService(entry);
}

/**
 * Track an error from a user action (e.g., "submit_card_form").
 * @param userAction - Description of user action when error occurred.
 * @param error - The error object or message.
 * @param errorType - ErrorCategory for classification.
 * @param additionalContext - Optional additional context (userId, username, statusCode).
 * @source
 */
export function trackUserActionError(
  userAction: string,
  error: Error | string,
  errorType: ErrorCategory,
  additionalContext?: {
    userId?: string;
    username?: string;
    statusCode?: number;
  },
): void {
  const message = typeof error === "string" ? error : error.message;

  trackErrorWithContext({
    userAction,
    errorType,
    message,
    timestamp: Date.now(),
    ...additionalContext,
  });
}

/**
 * Get recent errors from the session log.
 * @param count - Number of recent errors to return (default: 10).
 * @returns Array of recent ErrorContext entries.
 * @source
 */
export function getRecentErrors(count = 10): ErrorContext[] {
  return errorLog.slice(Math.max(0, errorLog.length - count));
}

/**
 * Get all errors of a specific type from the log.
 * @param errorType - ErrorCategory to filter by.
 * @returns Array of ErrorContext entries matching the type.
 * @source
 */
export function getErrorsByType(errorType: ErrorCategory): ErrorContext[] {
  return errorLog.filter((entry) => entry.errorType === errorType);
}

/**
 * Get error statistics for the current session.
 * @returns Object with error counts and breakdown.
 * @source
 */
export function getErrorStats(): {
  totalErrors: number;
  errorsByType: Record<ErrorCategory, number>;
  recentErrors: ErrorContext[];
} {
  const errorsByType: Record<ErrorCategory, number> = {} as Record<
    ErrorCategory,
    number
  >;

  for (const entry of errorLog) {
    errorsByType[entry.errorType] = (errorsByType[entry.errorType] ?? 0) + 1;
  }

  return {
    totalErrors: errorLog.length,
    errorsByType,
    recentErrors: getRecentErrors(5),
  };
}

/**
 * Clear the error log.
 * @source
 */
export function clearErrorLog(): void {
  errorLog.length = 0;
}

/**
 * Get formatted error report for debugging.
 * @returns Formatted string containing error statistics and recent errors.
 * @source
 */
export function getErrorReport(): string {
  const stats = getErrorStats();

  const errorsByTypeEntries = Object.entries(stats.errorsByType)
    .map(([type, count]) => `  ${type}: ${count}`)
    .join("\n");

  const recentErrorsEntries = stats.recentErrors
    .map((error) => {
      const time = new Date(error.timestamp).toLocaleTimeString();
      return `  [${time}] ${error.userAction} - ${error.message}`;
    })
    .join("\n");

  const reportLines = [
    "=== Error Report ===",
    `Total Errors: ${stats.totalErrors}`,
    "",
    "Errors by Type:",
    errorsByTypeEntries,
    "",
    "Recent Errors:",
    recentErrorsEntries,
  ];

  return reportLines.join("\n");
}

/**
 * Export error log data for external analysis.
 * @returns JSON-serializable error log data.
 * @source
 */
export function exportErrorLog(): ErrorContext[] {
  return [...errorLog];
}
