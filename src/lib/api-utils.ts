/**
 * The public interface of the API utility modules.
 *
 * This file used to hold all of it: 1450 lines covering the Redis client, the
 * rate limiter, origin policy, caller-address parsing, analytics counters, and
 * payload validation. Each of those now lives in its own module under
 * `lib/api/` or `lib/server/`. Importers may keep using this barrel or reach
 * for the specific module when they only need one half of it.
 *
 * @source
 */

// Redis client and the read helpers built on it.
export { redisClient, scanAllKeys, mgetInBatches } from "./server/redis";

// Rate limiting.
export {
  ratelimit,
  createRateLimiter,
  checkRateLimit,
} from "./server/rate-limit";

// Origin policy, CORS headers, and JSON responses.
export {
  doesCardSvgOriginVary,
  getAllowedCardSvgOrigin,
  getAllowedApiOrigin,
  apiJsonHeaders,
  jsonWithCors,
} from "./api/http";

// Caller address resolution.
export { getClientIp } from "./api/client-ip";

// The shared request opening and the error path it falls back to.
export { handleError } from "./server/api-response";
export {
  initializeApiRequest,
  type ApiInitResult,
} from "./server/request-init";

// Analytics counters.
export {
  incrementAnalytics,
  runAfterResponse,
  incrementAnalyticsInBackground,
  buildAnalyticsMetricKey,
} from "./server/analytics-counters";

// Payload validation.
export {
  validateUserData,
  isValidUsername,
  validateCardData,
} from "./api/validation";

// Request logging, re-exported so routes keep a single import for it.
export { logRequest, logSuccess } from "./server/api-logging";
