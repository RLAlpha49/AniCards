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

  errorLog.push(entry);

  if (errorLog.length > MAX_ERROR_LOG_SIZE) {
    errorLog.shift();
  }

  if (process.env.NODE_ENV === "development") {
    console.error("[ErrorTracking]", entry);
  }
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
