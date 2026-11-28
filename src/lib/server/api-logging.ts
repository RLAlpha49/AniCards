import "server-only";

import { createLogger } from "@/lib/log";

const log = createLogger("request");

/**
 * Log an incoming request.
 * @param endpoint - Route label, for example `"Cards API"`.
 * @param ip - Caller address.
 * @param details - Optional extra context.
 * @source
 */
export function logRequest(
  endpoint: string,
  ip: string,
  details?: string,
): void {
  log.log(
    details
      ? `[${endpoint}] Incoming request from IP: ${ip} - ${details}`
      : `[${endpoint}] Incoming request from IP: ${ip}`,
  );
}

/**
 * Log a completed request.
 * @param endpoint - Route label, for example `"Cards API"`.
 * @param userId - AniList user id the request served.
 * @param duration - Handler duration in milliseconds.
 * @param details - Optional extra context.
 * @source
 */
export function logSuccess(
  endpoint: string,
  userId: number,
  duration: number,
  details?: string,
): void {
  log.log(
    details
      ? `[${endpoint}] ${details} for user ${userId} in ${duration}ms`
      : `[${endpoint}] Successfully processed user ${userId} [${duration}ms]`,
  );
}
