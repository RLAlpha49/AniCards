/**
 * Shared API-route infrastructure for AniCards.
 *
 * This module keeps route handlers thin by centralizing lazy Upstash clients,
 * CORS policy, request validation, analytics counters, and common response
 * helpers in one place.
 */
import { createHash, timingSafeEqual } from "node:crypto";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

import { displayNames, isValidCardType } from "@/lib/card-data/validation";
import {
  categorizeError,
  type ErrorCategory,
  getErrorDetails,
  isRetryableErrorCategory,
  isRetryableStatusCode,
  type RecoverySuggestion,
} from "@/lib/error-messages";
import type {
  PersistedRequestMetadata,
  StoredCardConfig,
} from "@/lib/types/records";
import {
  generateSecureId,
  getColorInvalidReason,
  getSecureRandomFraction,
  validateBorderRadius,
  validateColorValue,
} from "@/lib/utils";

// Create the Redis client lazily to prevent calling `Redis.fromEnv()` during module initialization.
// This avoids side effects in test environments (jest mocking) and preserves edge runtime safety.
let _realRedisClient: Redis | undefined;
/**
 * Create or return an existing Redis client instance using environment
 * configuration. This defers initialization until the client is used.
 * @returns The Upstash Redis client.
 * @source
 */
function createRealRedisClient(): Redis {
  _realRedisClient ??= Redis.fromEnv({
    enableAutoPipelining: true,
    retry: {
      retries: 3,
      backoff: (retryCount: number) => Math.round(Math.exp(retryCount) * 50),
    },
    latencyLogging: process.env.NODE_ENV !== "production",
  });
  return _realRedisClient;
}

/**
 * A lazily-initialized proxy for the Upstash Redis client that forwards
 * operations to a real client when they are invoked. This keeps module
 * initialization side-effect free and supports edge runtimes.
 * @source
 */
export const redisClient: Redis = new Proxy({} as Record<string, unknown>, {
  get(_: unknown, prop: string | symbol) {
    const client = createRealRedisClient();
    const value: unknown = (client as unknown as Record<string, unknown>)[
      prop as keyof typeof client
    ];
    if (typeof value === "function")
      return (...args: unknown[]) =>
        (value as (...args: unknown[]) => unknown).apply(client, args);
    return value;
  },
  set(_: unknown, prop: string | symbol, value: unknown) {
    const client = createRealRedisClient();
    (client as unknown as Record<string, unknown>)[
      prop as keyof typeof client
    ] = value;
    return true;
  },
}) as unknown as Redis;

type AnalyticsRedisPipeline = {
  incr: (key: string) => AnalyticsRedisPipeline;
  expire: (key: string, seconds: number) => AnalyticsRedisPipeline;
  exec: () => Promise<unknown>;
};

/**
 * Scans all keys matching a pattern using the Redis SCAN command.
 * This is safer and more efficient than the KEYS command for large datasets.
 * @param pattern - The pattern to match (e.g., "user:*").
 * @param count - The number of keys to fetch per scan iteration.
 * @returns A promise that resolves to an array of all matching keys.
 * @source
 */
export async function scanAllKeys(
  pattern: string,
  count: number = 1000,
): Promise<string[]> {
  let cursor: string | number = 0;
  const allKeys: string[] = [];

  do {
    const [nextCursor, keys] = (await redisClient.scan(cursor, {
      match: pattern,
      count,
    })) as [string | number, string[]];
    cursor = nextCursor;
    allKeys.push(...keys);
  } while (cursor !== 0 && cursor !== "0");

  return allKeys;
}

function readBooleanEnv(name: string): boolean | undefined {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === "true") return true;
  if (raw === "false") return false;
  return undefined;
}

function readPositiveIntegerEnv(name: string): number | undefined {
  const raw = process.env[name]?.trim();
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
}

export function isStrictPositiveIntegerString(
  value: string | null | undefined,
): value is string {
  if (typeof value !== "string") return false;
  return /^[1-9]\d*$/.test(value.trim());
}

export function parseStrictPositiveInteger(
  value: string | null | undefined,
): number | null {
  if (!isStrictPositiveIntegerString(value)) return null;
  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function shouldEnableRateLimitAnalytics(): boolean {
  return readBooleanEnv("UPSTASH_RATELIMIT_ANALYTICS") ?? true;
}

function shouldEnableRateLimitProtection(): boolean {
  return readBooleanEnv("UPSTASH_RATELIMIT_PROTECTION") ?? false;
}

function getRateLimitPrefix(): string | undefined {
  const prefix = process.env.UPSTASH_RATELIMIT_PREFIX?.trim();
  return prefix && prefix.length > 0 ? prefix : undefined;
}

function getRateLimitTimeoutMs(): number | undefined {
  return readPositiveIntegerEnv("UPSTASH_RATELIMIT_TIMEOUT_MS");
}

function createConfiguredRateLimiter(options?: {
  limit?: number;
  window?: Parameters<typeof Ratelimit.slidingWindow>[1];
  redis?: Redis;
  analytics?: boolean;
  enableProtection?: boolean;
  prefix?: string;
  timeout?: number;
}): Ratelimit {
  const limit = options?.limit ?? 10;
  const window =
    options?.window ?? ("5 s" as Parameters<typeof Ratelimit.slidingWindow>[1]);
  const redis = options?.redis ?? createRealRedisClient();
  const analytics = options?.analytics ?? shouldEnableRateLimitAnalytics();
  const enableProtection =
    options?.enableProtection ?? shouldEnableRateLimitProtection();
  const prefix = options?.prefix ?? getRateLimitPrefix();
  const timeout = options?.timeout ?? getRateLimitTimeoutMs();

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window),
    analytics,
    enableProtection,
    ...(prefix ? { prefix } : {}),
    ...(typeof timeout === "number" ? { timeout } : {}),
  });
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    "then" in value &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

async function flushRateLimitPendingWork(
  pending: unknown,
  endpointName: string,
): Promise<void> {
  if (!isPromiseLike(pending)) return;
  try {
    await pending;
  } catch (error) {
    console.warn(
      `[${endpointName}] Upstash Ratelimit background sync failed:`,
      error,
    );
  }
}

let _realRatelimit: Ratelimit | undefined;
/**
 * A lazily-initialized Upstash rate limiter proxy which creates the
 * RateLimit instance on first use with a default sliding window limiter.
 * @source
 */
export const ratelimit: Ratelimit = new Proxy({} as Record<string, unknown>, {
  get(_: unknown, prop: string | symbol) {
    _realRatelimit ??= createConfiguredRateLimiter();
    const val: unknown = (_realRatelimit as unknown as Record<string, unknown>)[
      prop as keyof typeof _realRatelimit
    ];
    if (typeof val === "function")
      return (...args: unknown[]) =>
        (val as (...args: unknown[]) => unknown).apply(_realRatelimit, args);
    return val;
  },
  set(_: unknown, prop: string | symbol, value: unknown) {
    _realRatelimit ??= createConfiguredRateLimiter();
    (_realRatelimit as unknown as Record<string, unknown>)[
      prop as keyof typeof _realRatelimit
    ] = value;
    return true;
  },
}) as unknown as Ratelimit;

/**
 * Creates a new Upstash Ratelimit instance using the shared Redis client.
 * Allows per-endpoint overrides for window/limit settings.
 * @param options.limit - Maximum number of requests allowed per window
 * @param options.window - Duration string (e.g. "10 s", "1 m")
 * @param options.analytics - Override analytics collection for the Upstash dashboard
 * @param options.enableProtection - Enable deny lists / auto IP protection when configured
 * @param options.prefix - Optional Redis key prefix for the Upstash rate limiter
 * @param options.timeout - Optional fail-open timeout in milliseconds
 * @returns A configured Ratelimit instance ready to be used for limiting
 */
export function createRateLimiter(options?: {
  limit?: number;
  window?: Parameters<typeof Ratelimit.slidingWindow>[1];
  redis?: Redis;
  analytics?: boolean;
  enableProtection?: boolean;
  prefix?: string;
  timeout?: number;
}): Ratelimit {
  return createConfiguredRateLimiter(options);
}

/**
 * Standardized API error response shape returned from API routes.
 * @source
 */
export interface ApiError {
  error: string;
  category: ErrorCategory;
  retryable: boolean;
  status: number;
  recoverySuggestions: RecoverySuggestion[];
}

interface SafeStructuredApiError extends Error {
  statusCode?: number;
  status?: number;
  publicMessage?: string;
  category?: ErrorCategory;
  retryable?: boolean;
  recoverySuggestions?: RecoverySuggestion[];
}

interface HandledApiErrorDetails {
  status: number;
  message: string;
  category?: ErrorCategory;
  retryable?: boolean;
  recoverySuggestions?: RecoverySuggestion[];
}

function getCandidateErrorStatus(error: Error): number {
  const candidate = (error as SafeStructuredApiError).statusCode;
  if (
    typeof candidate === "number" &&
    Number.isInteger(candidate) &&
    candidate >= 400 &&
    candidate <= 599
  ) {
    return candidate;
  }

  const alternateCandidate = (error as SafeStructuredApiError).status;
  if (
    typeof alternateCandidate === "number" &&
    Number.isInteger(alternateCandidate) &&
    alternateCandidate >= 400 &&
    alternateCandidate <= 599
  ) {
    return alternateCandidate;
  }

  return 500;
}

function looksLikeRedisTransportFailure(message: string): boolean {
  const normalized = message.toLowerCase();

  if (!(normalized.includes("redis") || normalized.includes("upstash"))) {
    return false;
  }

  return [
    "error",
    "fail",
    "failure",
    "connect",
    "connection",
    "unavailable",
    "timeout",
    "timed out",
    "network",
    "socket",
    "refused",
    "reset",
    "closed",
    "econn",
  ].some((token) => normalized.includes(token));
}

export function isRedisBackplaneUnavailable(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  if (looksLikeRedisTransportFailure(`${error.name} ${error.message}`)) {
    return true;
  }

  const cause = (error as { cause?: unknown }).cause;
  return cause instanceof Error
    ? looksLikeRedisTransportFailure(`${cause.name} ${cause.message}`)
    : false;
}

function resolveHandledApiErrorDetails(
  error: Error,
  fallbackMessage: string,
  options?: {
    redisUnavailableMessage?: string;
  },
): HandledApiErrorDetails {
  if (options?.redisUnavailableMessage && isRedisBackplaneUnavailable(error)) {
    return {
      status: 503,
      message: options.redisUnavailableMessage,
      category: "server_error",
      retryable: true,
    };
  }

  const structuredError = error as SafeStructuredApiError;
  let publicMessage: string | undefined;
  if (
    typeof structuredError.publicMessage === "string" &&
    structuredError.publicMessage.trim().length > 0
  ) {
    publicMessage = structuredError.publicMessage;
  } else if (error instanceof UpstreamTransportError) {
    publicMessage = error.message;
  }

  return {
    status: getCandidateErrorStatus(error),
    message: publicMessage ?? fallbackMessage,
    category: structuredError.category,
    retryable: structuredError.retryable,
    recoverySuggestions: structuredError.recoverySuggestions,
  };
}

function createApiErrorPayload(
  error: string,
  status: number,
  options?: {
    category?: ErrorCategory;
    retryable?: boolean;
    recoverySuggestions?: RecoverySuggestion[];
    additionalFields?: Record<string, unknown>;
  },
): ApiError & Record<string, unknown> {
  const details = getErrorDetails(error, status);
  const additionalFields = options?.additionalFields;
  const payload = {
    error,
    category: options?.category ?? details.category,
    retryable: options?.retryable ?? details.retryable,
    status,
    recoverySuggestions:
      options?.recoverySuggestions ?? details.suggestions ?? [],
  };

  if (additionalFields) {
    return {
      ...payload,
      ...additionalFields,
    };
  }

  return payload;
}

export function apiErrorResponse(
  request: Request | undefined,
  status: number,
  error: string,
  options?: {
    headers?: Record<string, string>;
    category?: ErrorCategory;
    retryable?: boolean;
    recoverySuggestions?: RecoverySuggestion[];
    additionalFields?: Record<string, unknown>;
  },
): NextResponse<ApiError & Record<string, unknown>> {
  return jsonWithCors(
    createApiErrorPayload(error, status, {
      category: options?.category,
      retryable: options?.retryable,
      recoverySuggestions: options?.recoverySuggestions,
      additionalFields: options?.additionalFields,
    }),
    request,
    status,
    options?.headers,
  );
}

export function invalidJsonResponse(
  request: Request | undefined,
  options?: { headers?: Record<string, string> },
): NextResponse<ApiError & Record<string, unknown>> {
  return apiErrorResponse(request, 400, "Invalid JSON body", {
    headers: options?.headers,
    category: "invalid_data",
    retryable: false,
  });
}

export class UpstreamTransportError extends Error {
  readonly statusCode: number;
  readonly retryAfterMs?: number;

  constructor(message: string, statusCode: number, retryAfterMs?: number) {
    super(message);
    this.name = "UpstreamTransportError";
    this.statusCode = statusCode;
    this.retryAfterMs = retryAfterMs;
  }
}

export class UpstreamCircuitOpenError extends UpstreamTransportError {
  readonly service: string;
  readonly degradedMode: boolean;

  constructor(options: {
    service: string;
    retryAfterMs: number;
    degradedMode?: boolean;
  }) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil(options.retryAfterMs / 1000),
    );
    super(
      options.degradedMode
        ? `${options.service} degraded mode is enabled`
        : `${options.service} circuit breaker is open`,
      503,
      options.retryAfterMs,
    );
    this.name = "UpstreamCircuitOpenError";
    this.service = options.service;
    this.degradedMode = options.degradedMode ?? false;

    if (!this.message.includes("Retry-After")) {
      this.message = `${this.message} (Retry-After: ${retryAfterSeconds})`;
    }
  }
}

interface UpstreamCircuitState {
  consecutiveFailures: number;
  openedUntil: number;
}

interface UpstreamCircuitBreakerOptions {
  key: string;
  failureThreshold?: number;
  cooldownMs?: number;
  degradedModeEnvVar?: string;
}

interface UpstreamFetchOptions {
  service: string;
  url: string;
  init?: RequestInit;
  timeoutMs?: number;
  maxAttempts?: number;
  backoffBaseMs?: number;
  maxBackoffMs?: number;
  circuitBreaker?: UpstreamCircuitBreakerOptions | false;
}

interface NormalizedUpstreamFetchOptions extends UpstreamFetchOptions {
  timeoutMs: number;
  maxAttempts: number;
  backoffBaseMs: number;
  maxBackoffMs: number;
}

interface ApiRequestContext {
  requestId: string;
  method: string;
  path: string;
  ip?: string;
  endpoint?: string;
  endpointKey?: string;
}

const DEFAULT_UPSTREAM_TIMEOUT_MS = 5_000;
const DEFAULT_UPSTREAM_MAX_ATTEMPTS = 3;
const DEFAULT_UPSTREAM_BACKOFF_BASE_MS = 250;
const DEFAULT_UPSTREAM_MAX_BACKOFF_MS = 5_000;
const DEFAULT_CIRCUIT_BREAKER_FAILURE_THRESHOLD = 5;
const DEFAULT_CIRCUIT_BREAKER_COOLDOWN_MS = 30_000;
const DEFAULT_JSON_BODY_LIMIT_BYTES = 512 * 1024;
export const ANALYTICS_COUNTER_TTL_SECONDS = 400 * 24 * 60 * 60;
const upstreamCircuitStates = new Map<string, UpstreamCircuitState>();
const apiRequestContextStore = new WeakMap<Request, ApiRequestContext>();
const REQUEST_ID_HEADER = "X-Request-Id";
const TELEMETRY_TEST_ENV_FLAG = "ANICARDS_UNIT_TEST";
const pendingTelemetryTasks = new Set<Promise<void>>();
let hasLoggedMissingApiOriginInProduction = false;

type RequestContextWaitUntil = (promise: Promise<unknown>) => void;

type NextRequestContextValue = {
  waitUntil?: RequestContextWaitUntil;
};

type NextRequestContext = {
  get?: () => NextRequestContextValue | undefined;
};

function shouldTrackTelemetryTasksForTests(): boolean {
  return process.env[TELEMETRY_TEST_ENV_FLAG] === "true";
}

function trackPendingTelemetryTaskForTests(task: Promise<void>): void {
  if (!shouldTrackTelemetryTasksForTests()) return;

  pendingTelemetryTasks.add(task);
  task.finally(() => {
    pendingTelemetryTasks.delete(task);
  });
}

function getRequestContextWaitUntil(): RequestContextWaitUntil | undefined {
  const requestContext = (
    globalThis as typeof globalThis & {
      [key: symbol]: NextRequestContext | undefined;
    }
  )[Symbol.for("@next/request-context")];

  const waitUntil = requestContext?.get?.()?.waitUntil;
  return typeof waitUntil === "function" ? waitUntil : undefined;
}

function createDeferredTelemetryTask(task: () => Promise<void>): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  }).then(task);
}

export async function flushScheduledTelemetryTasksForTests(): Promise<void> {
  if (!shouldTrackTelemetryTasksForTests()) return;

  while (pendingTelemetryTasks.size > 0) {
    await Promise.allSettled(pendingTelemetryTasks);
  }
}

export function scheduleTelemetryTask(
  task: () => Promise<unknown> | void,
  options?: {
    endpoint?: string;
    taskName?: string;
    request?: Request;
  },
): void {
  const taskName = options?.taskName ?? "scheduled telemetry task";
  const endpoint = options?.endpoint ?? "Telemetry";

  const runTask = async () => {
    try {
      await task();
    } catch (error) {
      logPrivacySafe(
        "warn",
        endpoint,
        "Scheduled telemetry task failed",
        {
          taskName,
          error: error instanceof Error ? error.message : String(error),
        },
        options?.request,
      );
    }
  };

  if (shouldTrackTelemetryTasksForTests()) {
    const pendingTask = runTask();
    trackPendingTelemetryTaskForTests(pendingTask);
    return;
  }

  const waitUntil = getRequestContextWaitUntil();
  if (waitUntil) {
    const pendingTask = createDeferredTelemetryTask(runTask);

    try {
      waitUntil(pendingTask);
      return;
    } catch (error) {
      logPrivacySafe(
        "warn",
        endpoint,
        "Falling back to immediate telemetry scheduling",
        {
          taskName,
          error: error instanceof Error ? error.message : String(error),
        },
        options?.request,
      );
      return;
    }
  }

  void runTask();
}

function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function isSafeRequestId(value: string): boolean {
  return /^[A-Za-z0-9._:-]{8,120}$/.test(value);
}

function createRequestId(): string {
  if (typeof crypto?.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return generateSecureId("request");
}

function getRequestPath(request: Request): string {
  try {
    return new URL(request.url).pathname;
  } catch {
    return request.url;
  }
}

function resolveProvidedRequestId(
  value: string | null | undefined,
): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || !isSafeRequestId(trimmed)) return undefined;
  return trimmed;
}

function mergeHeaderList(
  existingValue: string | undefined,
  entryToAdd: string,
): string {
  const mergedEntries = new Map<string, string>();

  for (const entry of (existingValue ?? "").split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    mergedEntries.set(trimmed.toLowerCase(), trimmed);
  }

  mergedEntries.set(entryToAdd.toLowerCase(), entryToAdd);
  return [...mergedEntries.values()].join(", ");
}

export function ensureRequestContext(
  request: Request,
  options?: Partial<Omit<ApiRequestContext, "requestId">> & {
    requestId?: string;
  },
): ApiRequestContext {
  const existing = apiRequestContextStore.get(request);

  const requestId =
    resolveProvidedRequestId(options?.requestId) ??
    resolveProvidedRequestId(request.headers.get(REQUEST_ID_HEADER)) ??
    resolveProvidedRequestId(
      request.headers.get(REQUEST_ID_HEADER.toLowerCase()),
    ) ??
    existing?.requestId ??
    createRequestId();

  const nextContext: ApiRequestContext = {
    requestId,
    method: options?.method ?? existing?.method ?? request.method,
    path: options?.path ?? existing?.path ?? getRequestPath(request),
    ...((options?.ip ?? existing?.ip)
      ? { ip: options?.ip ?? existing?.ip }
      : {}),
    ...((options?.endpoint ?? existing?.endpoint)
      ? { endpoint: options?.endpoint ?? existing?.endpoint }
      : {}),
    ...((options?.endpointKey ?? existing?.endpointKey)
      ? { endpointKey: options?.endpointKey ?? existing?.endpointKey }
      : {}),
  };

  apiRequestContextStore.set(request, nextContext);
  return nextContext;
}

export function getRequestContext(
  request?: Request,
): ApiRequestContext | undefined {
  if (!request) return undefined;
  return apiRequestContextStore.get(request);
}

export function getRequestId(request?: Request): string | undefined {
  if (!request) return undefined;

  return (
    apiRequestContextStore.get(request)?.requestId ??
    resolveProvidedRequestId(request.headers.get(REQUEST_ID_HEADER)) ??
    resolveProvidedRequestId(
      request.headers.get(REQUEST_ID_HEADER.toLowerCase()),
    )
  );
}

export function withRequestIdHeaders(
  headers: Record<string, string>,
  request?: Request,
  requestId?: string,
): Record<string, string> {
  const effectiveRequestId = requestId ?? getRequestId(request);
  if (!effectiveRequestId) return headers;

  return {
    ...headers,
    [REQUEST_ID_HEADER]: effectiveRequestId,
    "Access-Control-Expose-Headers": mergeHeaderList(
      headers["Access-Control-Expose-Headers"],
      REQUEST_ID_HEADER,
    ),
  };
}

/**
 * Determine the Access-Control-Allow-Origin value used by the Card SVG API.
 * Priority: NEXT_PUBLIC_CARD_SVG_ALLOWED_ORIGIN env -> production fallback -> request origin or '*'.
 * This helper centralizes CORS policy and is used by card route header helpers.
 * @param request - Optional Request used to extract the request origin in development.
 */
export function getAllowedCardSvgOrigin(request?: Request): string {
  const rawConfigured = process.env.NEXT_PUBLIC_CARD_SVG_ALLOWED_ORIGIN;
  const configured = normalizeOrigin(rawConfigured);

  let origin: string | undefined;

  if (configured) {
    origin = configured;
  } else if (process.env.NODE_ENV === "production") {
    origin = "https://anilist.co";
  } else {
    const requestOrigin = request?.headers?.get("origin");
    const requestNormalized = normalizeOrigin(requestOrigin);
    origin = requestNormalized ?? "*";
  }

  if (process.env.NODE_ENV === "production" && origin === "*") {
    console.warn(
      "[Card CORS] Computed Access-Control-Allow-Origin is '*' in production; forcing to https://anilist.co",
    );
    origin = "https://anilist.co";
  }

  return origin;
}

/**
 * Determine the Access-Control-Allow-Origin value used by JSON API endpoints.
 * Priority: NEXT_PUBLIC_APP_URL env -> production fallback -> request origin or '*'.
 * This helper centralizes CORS policy for JSON APIs.
 * @param request - Optional Request used to extract the request origin in development.
 */
export function getAllowedApiOrigin(request?: Request): string | null {
  const rawConfigured = process.env.NEXT_PUBLIC_APP_URL;
  const configured = normalizeOrigin(rawConfigured);

  if (configured) {
    return configured;
  }

  if (process.env.NODE_ENV === "production") {
    if (!hasLoggedMissingApiOriginInProduction) {
      console.error(
        "[API CORS] NEXT_PUBLIC_APP_URL is missing or invalid in production; omitting Access-Control-Allow-Origin to fail closed.",
      );
      hasLoggedMissingApiOriginInProduction = true;
    }
    return null;
  }

  const requestOrigin = request?.headers?.get("origin");
  const requestNormalized = normalizeOrigin(requestOrigin);
  return requestNormalized ?? "*";
}

/**
 * Standard headers for JSON API responses including CORS and Vary semantics.
 * @param request - Optional request to calculate the allowed origin in development.
 */
export function apiJsonHeaders(request?: Request): Record<string, string> {
  const allowedOrigin = getAllowedApiOrigin(request);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS, POST",
    "Access-Control-Expose-Headers":
      "Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset",
    Vary: "Origin",
  };

  if (allowedOrigin) {
    headers["Access-Control-Allow-Origin"] = allowedOrigin;
  }

  return withRequestIdHeaders(headers, request);
}

export function apiTextHeaders(request?: Request): Record<string, string> {
  return {
    ...apiJsonHeaders(request),
    "Content-Type": "text/plain",
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    return `${Math.round((bytes / 1024) * 10) / 10} KB`;
  }

  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
}

function readContentLengthHeader(request: Request): number | undefined {
  const rawValue = request.headers.get("content-length")?.trim();
  if (!rawValue) return undefined;

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return parsed;
}

function getUtf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export function payloadTooLargeResponse(
  request: Request | undefined,
  options?: {
    headers?: Record<string, string>;
    message?: string;
    maxBytes?: number;
  },
): NextResponse<ApiError & Record<string, unknown>> {
  return apiErrorResponse(
    request,
    413,
    options?.message ?? "Request body too large",
    {
      headers: options?.headers,
      category: "invalid_data",
      retryable: false,
      additionalFields:
        typeof options?.maxBytes === "number"
          ? { maxBytes: options.maxBytes }
          : undefined,
    },
  );
}

export type ReadJsonRequestBodyResult<T> =
  | { success: true; data: T }
  | {
      success: false;
      errorResponse: NextResponse<ApiError & Record<string, unknown>>;
    };

export async function readJsonRequestBody<T>(
  request: Request,
  options: {
    endpointName: string;
    endpointKey: string;
    maxBytes?: number;
  },
): Promise<ReadJsonRequestBodyResult<T>> {
  const maxBytes =
    typeof options.maxBytes === "number" && options.maxBytes > 0
      ? options.maxBytes
      : DEFAULT_JSON_BODY_LIMIT_BYTES;

  const contentLength = readContentLengthHeader(request);
  if (typeof contentLength === "number" && contentLength > maxBytes) {
    logPrivacySafe(
      "warn",
      options.endpointName,
      "Rejected request body larger than configured limit from Content-Length header.",
      {
        contentLength,
        maxBytes,
      },
      request,
    );
    const metric = buildAnalyticsMetricKey(
      options.endpointKey,
      "failed_requests",
    );
    scheduleTelemetryTask(() => incrementAnalytics(metric), {
      endpoint: options.endpointName,
      taskName: metric,
      request,
    });

    return {
      success: false,
      errorResponse: payloadTooLargeResponse(request, { maxBytes }),
    };
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    const metric = buildAnalyticsMetricKey(
      options.endpointKey,
      "failed_requests",
    );
    scheduleTelemetryTask(() => incrementAnalytics(metric), {
      endpoint: options.endpointName,
      taskName: metric,
      request,
    });

    return {
      success: false,
      errorResponse: invalidJsonResponse(request),
    };
  }

  const actualBytes = getUtf8ByteLength(rawBody);
  if (actualBytes > maxBytes) {
    logPrivacySafe(
      "warn",
      options.endpointName,
      "Rejected request body larger than configured limit after reading body.",
      {
        contentLength,
        actualBytes,
        maxBytes,
        maxSize: formatBytes(maxBytes),
      },
      request,
    );
    const metric = buildAnalyticsMetricKey(
      options.endpointKey,
      "failed_requests",
    );
    scheduleTelemetryTask(() => incrementAnalytics(metric), {
      endpoint: options.endpointName,
      taskName: metric,
      request,
    });

    return {
      success: false,
      errorResponse: payloadTooLargeResponse(request, { maxBytes }),
    };
  }

  try {
    return {
      success: true,
      data: JSON.parse(rawBody) as T,
    };
  } catch {
    const metric = buildAnalyticsMetricKey(
      options.endpointKey,
      "failed_requests",
    );
    scheduleTelemetryTask(() => incrementAnalytics(metric), {
      endpoint: options.endpointName,
      taskName: metric,
      request,
    });

    return {
      success: false,
      errorResponse: invalidJsonResponse(request),
    };
  }
}

function getRetryAfterMs(retryAfterHeader: string | null): number | undefined {
  if (!retryAfterHeader) return undefined;

  const asSeconds = Number(retryAfterHeader);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return asSeconds * 1000;
  }

  const retryAt = Date.parse(retryAfterHeader);
  if (Number.isNaN(retryAt)) return undefined;

  return Math.max(0, retryAt - Date.now());
}

function clampDelayMs(delayMs: number, maxDelayMs: number): number {
  return Math.max(0, Math.min(delayMs, maxDelayMs));
}

function computeRetryDelayMs(options: {
  attempt: number;
  retryAfterMs?: number;
  backoffBaseMs: number;
  maxBackoffMs: number;
}): number {
  if (typeof options.retryAfterMs === "number") {
    return clampDelayMs(options.retryAfterMs, options.maxBackoffMs);
  }

  const exponentialDelay =
    options.backoffBaseMs * Math.pow(2, Math.max(0, options.attempt - 1));
  const jitterMultiplier = 0.75 + getSecureRandomFraction() * 0.5;
  return clampDelayMs(
    Math.round(exponentialDelay * jitterMultiplier),
    options.maxBackoffMs,
  );
}

function isAbortErrorLike(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === "AbortError" || error.name === "TimeoutError";
}

function getAbortSignal(signal?: AbortSignal | null): AbortSignal | undefined {
  return signal ?? undefined;
}

function sleep(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (delayMs <= 0) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);

    const onAbort = () => {
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", onAbort);
      const reason = signal?.reason;
      reject(
        reason instanceof Error ? reason : new Error("Aborted during backoff"),
      );
    };

    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

function hashSecretForConstantTimeComparison(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function secretsMatchConstantTime(
  expectedSecret: string,
  providedSecret: string | null | undefined,
): boolean {
  const expectedHash = hashSecretForConstantTimeComparison(expectedSecret);
  const providedHash = hashSecretForConstantTimeComparison(
    providedSecret ?? "",
  );
  return timingSafeEqual(expectedHash, providedHash);
}

function createAbortContext(
  timeoutMs: number,
  signal?: AbortSignal,
): {
  signal: AbortSignal;
  didTimeout: () => boolean;
  cleanup: () => void;
} {
  const controller = new AbortController();
  let timedOut = false;
  let abortListener: (() => void) | undefined;

  if (signal) {
    if (signal.aborted) {
      controller.abort(signal.reason);
    } else {
      abortListener = () => controller.abort(signal.reason);
      signal.addEventListener("abort", abortListener, { once: true });
    }
  }

  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort(
      new DOMException(
        `Request timed out after ${timeoutMs}ms`,
        "TimeoutError",
      ),
    );
  }, timeoutMs);

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup: () => {
      clearTimeout(timeoutId);
      if (signal && abortListener) {
        signal.removeEventListener("abort", abortListener);
      }
    },
  };
}

function getCircuitBreakerState(key: string): UpstreamCircuitState {
  const existing = upstreamCircuitStates.get(key);
  if (existing) return existing;

  const initialState: UpstreamCircuitState = {
    consecutiveFailures: 0,
    openedUntil: 0,
  };
  upstreamCircuitStates.set(key, initialState);
  return initialState;
}

function getCircuitBreakerFailureThreshold(
  options?: UpstreamCircuitBreakerOptions,
): number {
  return (
    options?.failureThreshold ??
    readPositiveIntegerEnv("ANILIST_UPSTREAM_CIRCUIT_FAILURE_THRESHOLD") ??
    DEFAULT_CIRCUIT_BREAKER_FAILURE_THRESHOLD
  );
}

function getCircuitBreakerCooldownMs(
  options?: UpstreamCircuitBreakerOptions,
): number {
  return (
    options?.cooldownMs ??
    readPositiveIntegerEnv("ANILIST_UPSTREAM_CIRCUIT_COOLDOWN_MS") ??
    DEFAULT_CIRCUIT_BREAKER_COOLDOWN_MS
  );
}

function isCircuitBreakerDegradedModeEnabled(
  options?: UpstreamCircuitBreakerOptions,
): boolean {
  const envVar = options?.degradedModeEnvVar;
  if (!envVar) return false;
  return readBooleanEnv(envVar) === true;
}

function ensureCircuitBreakerAllowsRequest(
  service: string,
  options?: UpstreamCircuitBreakerOptions | false,
): void {
  if (!options) return;

  const cooldownMs = getCircuitBreakerCooldownMs(options);

  if (isCircuitBreakerDegradedModeEnabled(options)) {
    throw new UpstreamCircuitOpenError({
      service,
      retryAfterMs: cooldownMs,
      degradedMode: true,
    });
  }

  const state = getCircuitBreakerState(options.key);
  if (state.openedUntil > Date.now()) {
    throw new UpstreamCircuitOpenError({
      service,
      retryAfterMs: state.openedUntil - Date.now(),
    });
  }
}

function recordCircuitBreakerSuccess(
  options?: UpstreamCircuitBreakerOptions | false,
): void {
  if (!options) return;
  const state = getCircuitBreakerState(options.key);
  state.consecutiveFailures = 0;
  state.openedUntil = 0;
}

function recordCircuitBreakerFailure(
  options?: UpstreamCircuitBreakerOptions | false,
): void {
  if (!options) return;

  const state = getCircuitBreakerState(options.key);
  state.consecutiveFailures += 1;

  const threshold = getCircuitBreakerFailureThreshold(options);
  if (state.consecutiveFailures < threshold) return;

  state.openedUntil = Date.now() + getCircuitBreakerCooldownMs(options);
}

function normalizeUpstreamFetchOptions(
  options: UpstreamFetchOptions,
): NormalizedUpstreamFetchOptions {
  return {
    ...options,
    timeoutMs: options.timeoutMs ?? DEFAULT_UPSTREAM_TIMEOUT_MS,
    maxAttempts: Math.max(
      1,
      options.maxAttempts ?? DEFAULT_UPSTREAM_MAX_ATTEMPTS,
    ),
    backoffBaseMs: options.backoffBaseMs ?? DEFAULT_UPSTREAM_BACKOFF_BASE_MS,
    maxBackoffMs: options.maxBackoffMs ?? DEFAULT_UPSTREAM_MAX_BACKOFF_MS,
  };
}

function shouldRetryUpstreamResponse(
  response: Response,
  attempt: number,
  maxAttempts: number,
): boolean {
  return (
    !response.ok &&
    isRetryableStatusCode(response.status) &&
    attempt < maxAttempts
  );
}

async function waitForUpstreamRetryDelay(options: {
  attempt: number;
  retryAfterMs?: number;
  normalizedOptions: NormalizedUpstreamFetchOptions;
}): Promise<void> {
  const delayMs = computeRetryDelayMs({
    attempt: options.attempt,
    retryAfterMs: options.retryAfterMs,
    backoffBaseMs: options.normalizedOptions.backoffBaseMs,
    maxBackoffMs: options.normalizedOptions.maxBackoffMs,
  });

  await sleep(delayMs, getAbortSignal(options.normalizedOptions.init?.signal));
}

function finalizeUpstreamResponse(
  response: Response,
  circuitBreaker?: UpstreamCircuitBreakerOptions | false,
): Response {
  if (!response.ok && isRetryableStatusCode(response.status)) {
    recordCircuitBreakerFailure(circuitBreaker);
  } else if (response.ok) {
    recordCircuitBreakerSuccess(circuitBreaker);
  }

  return response;
}

function buildUpstreamTransportError(options: {
  service: string;
  error: unknown;
  timedOut: boolean;
  timeoutMs: number;
}): UpstreamTransportError {
  const message =
    options.error instanceof Error
      ? options.error.message
      : String(options.error);

  if (options.error instanceof UpstreamTransportError) {
    return options.error;
  }

  if (options.timedOut || isAbortErrorLike(options.error)) {
    return new UpstreamTransportError(
      `${options.service} request timed out after ${options.timeoutMs}ms`,
      504,
    );
  }

  return new UpstreamTransportError(
    `${options.service} request failed: ${message}`,
    502,
  );
}

function shouldRetryUpstreamError(
  error: unknown,
  attempt: number,
  maxAttempts: number,
  didTimeout: boolean,
): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const category = didTimeout ? "timeout" : categorizeError(message);
  return isRetryableErrorCategory(category) && attempt < maxAttempts;
}

function recordUpstreamErrorFailure(
  error: unknown,
  didTimeout: boolean,
  circuitBreaker?: UpstreamCircuitBreakerOptions | false,
): void {
  const message = error instanceof Error ? error.message : String(error);
  const category = didTimeout ? "timeout" : categorizeError(message);

  if (isRetryableErrorCategory(category)) {
    recordCircuitBreakerFailure(circuitBreaker);
  }
}

export async function fetchUpstreamWithRetry(
  options: UpstreamFetchOptions,
): Promise<Response> {
  const normalizedOptions = normalizeUpstreamFetchOptions(options);

  ensureCircuitBreakerAllowsRequest(
    normalizedOptions.service,
    normalizedOptions.circuitBreaker,
  );

  for (
    let attempt = 1;
    attempt <= normalizedOptions.maxAttempts;
    attempt += 1
  ) {
    const abortContext = createAbortContext(
      normalizedOptions.timeoutMs,
      getAbortSignal(normalizedOptions.init?.signal),
    );

    try {
      const response = await fetch(normalizedOptions.url, {
        ...normalizedOptions.init,
        signal: abortContext.signal,
      });

      const retryAfterMs = getRetryAfterMs(response.headers.get("retry-after"));
      if (
        shouldRetryUpstreamResponse(
          response,
          attempt,
          normalizedOptions.maxAttempts,
        )
      ) {
        await waitForUpstreamRetryDelay({
          attempt,
          retryAfterMs,
          normalizedOptions,
        });
        continue;
      }

      return finalizeUpstreamResponse(
        response,
        normalizedOptions.circuitBreaker,
      );
    } catch (error) {
      if (
        shouldRetryUpstreamError(
          error,
          attempt,
          normalizedOptions.maxAttempts,
          abortContext.didTimeout(),
        )
      ) {
        await waitForUpstreamRetryDelay({
          attempt,
          normalizedOptions,
        });
        continue;
      }

      recordUpstreamErrorFailure(
        error,
        abortContext.didTimeout(),
        normalizedOptions.circuitBreaker,
      );

      throw buildUpstreamTransportError({
        service: normalizedOptions.service,
        error,
        timedOut: abortContext.didTimeout(),
        timeoutMs: normalizedOptions.timeoutMs,
      });
    } finally {
      abortContext.cleanup();
    }
  }

  throw new UpstreamTransportError(
    `${normalizedOptions.service} request failed after ${normalizedOptions.maxAttempts} attempts`,
    502,
  );
}

function shouldAllowUnsecuredCronInDevelopment(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    readBooleanEnv("ALLOW_UNSECURED_CRON_IN_DEV") === true
  );
}

export function authorizeCronRequest(
  request: Request,
  endpointName: string,
): Response | null {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const cronSecretHeader = request.headers.get("x-cron-secret")?.trim();

  if (!cronSecret) {
    if (shouldAllowUnsecuredCronInDevelopment()) {
      logPrivacySafe(
        "warn",
        endpointName,
        "Allowing unsecured cron request in development because ALLOW_UNSECURED_CRON_IN_DEV=true.",
        undefined,
        request,
      );
      return null;
    }

    logPrivacySafe(
      "error",
      endpointName,
      "Rejected request because CRON_SECRET is not configured.",
      undefined,
      request,
    );
    return apiErrorResponse(request, 503, "CRON_SECRET is not configured");
  }

  if (!secretsMatchConstantTime(cronSecret, cronSecretHeader)) {
    logPrivacySafe(
      "error",
      endpointName,
      "Unauthorized: Invalid Cron secret",
      undefined,
      request,
    );
    return apiErrorResponse(request, 401, "Unauthorized");
  }

  return null;
}

/**
 * JSON response factory that always applies API CORS headers so callers don't forget.
 * Use this instead of calling `NextResponse.json(...)` directly when returning JSON.
 * @param data - payload to serialize
 * @param request - Request used to compute the allowed origin in dev
 * @param status - optional HTTP status code
 */
export function jsonWithCors<T = unknown>(
  data: T,
  request?: Request,
  status?: number,
  headers?: Record<string, string>,
): NextResponse<T> {
  const responseHeaders = apiJsonHeaders(request);
  if (headers) {
    for (const [key, value] of Object.entries(headers)) {
      if (
        key.toLowerCase() === "access-control-expose-headers" &&
        typeof responseHeaders[key] === "string"
      ) {
        const mergedValues = new Set(
          `${responseHeaders[key]},${value}`
            .split(",")
            .map((entry) => entry.trim())
            .filter(Boolean),
        );
        responseHeaders[key] = [...mergedValues].join(", ");
        continue;
      }

      responseHeaders[key] = value;
    }
  }

  const opts: Record<string, unknown> = {
    headers: responseHeaders,
  };
  if (typeof status === "number") opts.status = status;
  return NextResponse.json(
    data as unknown,
    opts as ResponseInit,
  ) as NextResponse<T>;
}

/**
 * Extracts the client IP address from trusted deployment headers only.
 * Falls back to localhost in non-production environments for local testing.
 * @param request - Incoming request whose headers may contain proxy IPs.
 * @returns The normalized client IP or a development fallback.
 */
export function getRequestIp(request?: Request): string {
  if (!request) return "127.0.0.1";

  const trustedHeaderNames = ["x-vercel-forwarded-for", "cf-connecting-ip"];
  for (const headerName of trustedHeaderNames) {
    const headerValue = request.headers.get(headerName)?.trim();
    if (headerValue) return headerValue;
  }

  return process.env.NODE_ENV === "production" ? "unknown" : "127.0.0.1";
}

function truncateLogString(value: string, maxLength = 120): string {
  return value.length <= maxLength
    ? value
    : `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

function isStackWhitespace(char: string): boolean {
  return (
    char === " " ||
    char === "\t" ||
    char === "\n" ||
    char === "\r" ||
    char === "\f" ||
    char === "\v"
  );
}

function collapseStackWhitespace(value: string): string {
  let normalized = "";
  let lastWasWhitespace = false;

  for (const char of value) {
    if (isStackWhitespace(char)) {
      if (!lastWasWhitespace) normalized += " ";
      lastWasWhitespace = true;
      continue;
    }

    normalized += char;
    lastWasWhitespace = false;
  }

  return normalized;
}

function sanitizeStackFrame(line: string): string | undefined {
  const trimmed = line.trim();
  if (!trimmed.startsWith("at ")) return undefined;

  const frameText = trimmed.slice(3).trimStart();
  if (!frameText) return "at <frame>";

  let frameLabelEnd = frameText.length;
  for (let i = 0; i < frameText.length; i++) {
    if (frameText[i] !== "(") continue;

    let whitespaceStart = i - 1;
    while (
      whitespaceStart >= 0 &&
      isStackWhitespace(frameText[whitespaceStart])
    ) {
      whitespaceStart--;
    }

    if (whitespaceStart < i - 1) {
      frameLabelEnd = whitespaceStart + 1;
      break;
    }
  }

  const frameLabel = frameText.slice(0, frameLabelEnd).trim();
  if (!frameLabel) return "at <frame>";

  return `at ${truncateLogString(collapseStackWhitespace(frameLabel), 80)}`;
}

function summarizeStackForLogs(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;

  const frames = value
    .split(/\r?\n/)
    .map((line) => sanitizeStackFrame(line))
    .filter((line): line is string => typeof line === "string")
    .slice(0, 5);

  if (frames.length === 0) return undefined;
  return truncateLogString(frames.join(" | "), 200);
}

export function redactIp(ip: string): string {
  const normalized = ip.trim();
  if (!normalized || normalized === "unknown") return "unknown";
  if (normalized === "127.0.0.1" || normalized === "::1") {
    return "loopback";
  }

  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(
    normalized,
  );
  if (ipv4Match) {
    const [a, b, c, d] = ipv4Match.slice(1).map(Number);
    const validOctets = [a, b, c, d].every(
      (octet) => octet >= 0 && octet <= 255,
    );
    if (!validOctets) return "invalid_ip";

    const isPrivateRange =
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168);

    if (isPrivateRange) return "private_ipv4";
    return `${a}.${b}.x.x`;
  }

  if (normalized.includes(":")) {
    return "ipv6";
  }

  return "redacted";
}

export function redactUserIdentifier(value: unknown): string {
  if (value === undefined || value === null) return "missing";

  const normalized = String(value).trim();
  if (!normalized) return "missing";

  if (/^\d+$/.test(normalized)) {
    return `id:***${normalized.slice(-2)}`;
  }

  const prefix = normalized.slice(0, Math.min(2, normalized.length));
  return `${prefix}${normalized.length > 2 ? "***" : "*"}(${normalized.length})`;
}

export function buildPersistedRequestMetadata(
  ip: string,
): PersistedRequestMetadata | undefined {
  const lastSeenIpBucket = redactIp(ip);
  if (!lastSeenIpBucket || lastSeenIpBucket === "unknown") {
    return undefined;
  }

  return { lastSeenIpBucket };
}

function sanitizeLogContextValue(
  key: string,
  value: unknown,
): string | number | boolean | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "number" || typeof value === "boolean") return value;

  const normalizedKey = key.toLowerCase();
  if (normalizedKey.includes("ip")) {
    return redactIp(String(value));
  }

  if (
    normalizedKey.includes("userid") ||
    normalizedKey.includes("username") ||
    normalizedKey.includes("identifier")
  ) {
    return redactUserIdentifier(value);
  }

  if (normalizedKey === "requestid") {
    return truncateLogString(String(value), 120);
  }

  if (normalizedKey.includes("stack")) {
    return summarizeStackForLogs(value);
  }

  return truncateLogString(safeStringifyValue(value));
}

export function logPrivacySafe(
  level: "log" | "warn" | "error",
  endpoint: string,
  message: string,
  context?: Record<string, unknown>,
  request?: Request,
): void {
  const requestContext = request ? getRequestContext(request) : undefined;
  const requestIdFromContext =
    typeof context?.requestId === "string"
      ? resolveProvidedRequestId(context.requestId)
      : undefined;

  const safeContextEntries = Object.entries(context ?? {}).flatMap(
    ([key, value]) => {
      if (key === "requestId") return [];
      const sanitizedValue = sanitizeLogContextValue(key, value);
      return sanitizedValue === undefined ? [] : [[key, sanitizedValue]];
    },
  );

  const safeContext = Object.fromEntries(safeContextEntries);
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: level === "log" ? "info" : level,
    endpoint,
    message,
    ...((requestIdFromContext ?? requestContext?.requestId)
      ? {
          requestId: requestIdFromContext ?? requestContext?.requestId,
        }
      : {}),
    ...(requestContext?.method ? { method: requestContext.method } : {}),
    ...(requestContext?.path ? { path: requestContext.path } : {}),
    ...(Object.keys(safeContext).length > 0 ? { context: safeContext } : {}),
  };

  console[level](JSON.stringify(logEntry));
}

function createRateLimitHeaders(options: {
  limit: number;
  remaining: number;
  reset: number;
}): Record<string, string> {
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((options.reset - Date.now()) / 1000),
  );

  return {
    "X-RateLimit-Limit": String(options.limit),
    "X-RateLimit-Remaining": String(Math.max(options.remaining, 0)),
    "X-RateLimit-Reset": String(options.reset),
    "Retry-After": String(retryAfterSeconds),
  };
}

/**
 * Enforces a rate limit for an IP address using the configured Upstash
 * rate limiter. Records analytics and returns a 429 response on limit.
 * @param ip - IP address to check.
 * @param endpointName - Friendly endpoint name used for logging.
 * @param endpointKey - Stable canonical endpoint key used for analytics metric keys.
 * @param limiter - Optional per-endpoint Ratelimit instance used for rate limiting.
 * @returns A NextResponse with an ApiError when limited, or null when allowed.
 * @source
 */
export async function checkRateLimit(
  request: Request | undefined,
  ip: string,
  endpointName: string,
  endpointKey: string,
  limiter?: Ratelimit,
): Promise<NextResponse<ApiError> | null> {
  const effectiveLimiter = limiter ?? ratelimit;
  const userAgent = request?.headers.get("user-agent") ?? undefined;
  const country =
    request?.headers.get("x-vercel-ip-country") ??
    request?.headers.get("cf-ipcountry") ??
    undefined;

  let result;
  try {
    result = await effectiveLimiter.limit(ip, {
      ip,
      userAgent,
      country,
    });
  } catch (error) {
    logPrivacySafe(
      "error",
      endpointName,
      "Upstash Ratelimit check failed.",
      {
        ip,
        error: error instanceof Error ? error.message : String(error),
      },
      request,
    );
    const metric = buildAnalyticsMetricKey(endpointKey, "rate_limit_errors");
    scheduleTelemetryTask(() => incrementAnalytics(metric), {
      endpoint: endpointName,
      taskName: metric,
      request,
    });
    throw error;
  }

  await flushRateLimitPendingWork(result.pending, endpointName);

  const limit = typeof result.limit === "number" ? result.limit : 0;
  const remaining = typeof result.remaining === "number" ? result.remaining : 0;
  const reset = typeof result.reset === "number" ? result.reset : Date.now();

  let denialDetails = "";
  if (result.reason) {
    const deniedValueSuffix = result.deniedValue
      ? `: ${result.deniedValue}`
      : "";
    denialDetails = ` (${result.reason}${deniedValueSuffix})`;
  }

  const rateLimitHeaders = createRateLimitHeaders({
    limit,
    remaining,
    reset,
  });

  if (result.reason === "timeout") {
    logPrivacySafe(
      "error",
      endpointName,
      "Upstash Ratelimit timed out; allowing request to pass fail-open with observability escalation.",
      { ip },
      request,
    );
    const metric = buildAnalyticsMetricKey(endpointKey, "rate_limit_timeouts");
    scheduleTelemetryTask(() => incrementAnalytics(metric), {
      endpoint: endpointName,
      taskName: metric,
      request,
    });
  }

  const { success } = result;
  if (!success) {
    logPrivacySafe("warn", endpointName, "Rate limited request", {
      ip,
      denialDetails,
    });
    const metric = buildAnalyticsMetricKey(endpointKey, "failed_requests");
    scheduleTelemetryTask(() => incrementAnalytics(metric), {
      endpoint: endpointName,
      taskName: metric,
      request,
    });
    return apiErrorResponse(request, 429, "Too many requests", {
      headers: rateLimitHeaders,
      category: "rate_limited",
      retryable: true,
    });
  }
  return null;
}

/**
 * Validates that a given request originates from the same origin as the
 * application. Missing Origin headers are rejected by default and are only
 * allowed when a caller explicitly opts out via requireOrigin=false (for
 * trusted server-to-server flows such as cron handlers).
 * @param request - The incoming Request object to evaluate.
 * @param endpointName - Friendly endpoint name used for logs.
 * @param endpointKey - Stable canonical endpoint key used for analytics metric keys.
 * @returns A NextResponse with an ApiError when unauthorized, or null when allowed.
 * @source
 */
export function validateSameOrigin(
  request: Request,
  endpointName: string,
  endpointKey: string,
  options?: {
    requireOrigin?: boolean;
  },
): NextResponse<ApiError> | null {
  const origin = normalizeOrigin(request.headers.get("origin"));
  const requestOrigin = new URL(request.url).origin;
  const configuredAppOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL);
  const requireOrigin = options?.requireOrigin ?? true;

  if (process.env.NODE_ENV === "production" && !configuredAppOrigin) {
    logPrivacySafe(
      "error",
      endpointName,
      "Rejected request because NEXT_PUBLIC_APP_URL is not configured in production.",
      undefined,
      request,
    );

    const metric = buildAnalyticsMetricKey(endpointKey, "failed_requests");
    incrementAnalytics(metric).catch(() => {});

    return apiErrorResponse(request, 503, "Server misconfigured", {
      category: "server_error",
      retryable: true,
    });
  }

  const allowedOrigin = configuredAppOrigin ?? requestOrigin;

  if (!origin) {
    if (!requireOrigin) {
      return null;
    }

    logPrivacySafe(
      "warn",
      endpointName,
      "Rejected request with missing Origin header",
      { allowedOrigin },
      request,
    );

    const metric = buildAnalyticsMetricKey(endpointKey, "failed_requests");
    incrementAnalytics(metric).catch(() => {});

    return apiErrorResponse(request, 401, "Unauthorized", {
      category: "authentication",
      retryable: false,
    });
  }

  if (origin !== allowedOrigin) {
    logPrivacySafe(
      "warn",
      endpointName,
      "Rejected cross-origin request",
      { origin, allowedOrigin },
      request,
    );

    const metric = buildAnalyticsMetricKey(endpointKey, "failed_requests");

    incrementAnalytics(metric).catch((err) => {
      if (process.env.NODE_ENV !== "production") {
        logPrivacySafe("warn", endpointName, "Analytics increment failed", {
          metric,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });

    return apiErrorResponse(request, 401, "Unauthorized", {
      category: "authentication",
      retryable: false,
    });
  }

  return null;
}

/**
 * Safely increments a Redis-based analytics counter. This function
 * stores time-bucketed counters with a bounded TTL and intentionally swallows
 * errors to avoid affecting primary request paths.
 * @param metric - Redis key for the analytics counter to increment.
 * @source
 */
export function buildAnalyticsStorageKey(
  metric: string,
  now: Date = new Date(),
): string {
  if (/^analytics:.+:month:\d{4}-\d{2}$/.test(metric)) {
    return metric;
  }

  return `${metric}:month:${now.toISOString().slice(0, 7)}`;
}

export async function incrementAnalytics(
  metric: string,
  options?: { now?: Date },
): Promise<void> {
  const storageKey = buildAnalyticsStorageKey(metric, options?.now);

  try {
    await redisClient.incr(storageKey);
    await redisClient.expire(storageKey, ANALYTICS_COUNTER_TTL_SECONDS);
  } catch (error) {
    // Silently fail analytics to avoid affecting main functionality
    logPrivacySafe("warn", "Analytics", "Failed to increment analytics", {
      metric,
      storageKey,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function incrementAnalyticsBatch(
  metrics: Iterable<string>,
  options?: { now?: Date },
): Promise<void> {
  const storageKeys = Array.from(metrics, (metric) =>
    buildAnalyticsStorageKey(metric, options?.now),
  );

  if (storageKeys.length === 0) {
    return;
  }

  try {
    const pipeline =
      redisClient.pipeline() as unknown as AnalyticsRedisPipeline;

    for (const storageKey of storageKeys) {
      pipeline.incr(storageKey);
      pipeline.expire(storageKey, ANALYTICS_COUNTER_TTL_SECONDS);
    }

    await pipeline.exec();
  } catch (error) {
    logPrivacySafe("warn", "Analytics", "Failed to increment analytics batch", {
      metricCount: storageKeys.length,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Build a canonical analytics Redis key using a stable endpoint key.
 * Example: buildAnalyticsMetricKey("store_cards", "failed_requests")
 * returns "analytics:store_cards:failed_requests".
 * An optional extraSuffix is appended if provided for more granular metrics.
 */
export function buildAnalyticsMetricKey(
  endpointKey: string,
  metric: string,
  extraSuffix?: string,
): string {
  const normalized = String(endpointKey).toLowerCase().replaceAll(/\s+/g, "_");
  const base = `analytics:${normalized}:${metric}`;
  return extraSuffix ? `${base}:${extraSuffix}` : base;
}

/**
 * Logs an incoming API request with optional details for debugging.
 * @param endpoint - Logical endpoint name for logging context.
 * @param ip - IP address of the caller.
 * @param details - Optional additional info about the request.
 * @source
 */
export function logRequest(
  endpoint: string,
  ip: string,
  request?: Request,
  details?: string,
): void {
  logPrivacySafe(
    "log",
    endpoint,
    "Incoming request",
    {
      ip,
      ...(details ? { details } : {}),
    },
    request,
  );
}

/**
 * Centralized error handling for API routes that logs details,
 * increments an analytics metric, and returns a 500 error response.
 * @param error - Error object thrown by the route handler.
 * @param endpoint - Logical endpoint for logging context.
 * @param startTime - Request start timestamp used to calculate duration.
 * @param analyticsMetric - Redis metric key to increment on error.
 * @param errorMessage - User-facing error message returned in the response.
 * @returns A NextResponse containing an ApiError.
 * @source
 */
export function handleError(
  error: Error,
  endpoint: string,
  startTime: number,
  analyticsMetric: string,
  errorMessage: string,
  request?: Request,
  options?: {
    redisUnavailableMessage?: string;
    logContext?: Record<string, unknown>;
  },
): NextResponse<ApiError> {
  const duration = Date.now() - startTime;
  const logContext = options?.logContext;
  const logPayload: Record<string, unknown> = {
    durationMs: duration,
    error: error.message,
    ...(error.stack ? { stack: error.stack } : {}),
  };

  if (logContext) {
    Object.assign(logPayload, logContext);
  }

  logPrivacySafe("error", endpoint, "Request failed", logPayload, request);

  incrementAnalytics(analyticsMetric).catch(() => {});

  const handledError = resolveHandledApiErrorDetails(
    error,
    errorMessage,
    options,
  );

  return apiErrorResponse(request, handledError.status, handledError.message, {
    category: handledError.category,
    retryable: handledError.retryable,
    recoverySuggestions: handledError.recoverySuggestions,
  });
}

/**
 * Logs a successful operation for an endpoint with timing and optional details.
 * @param endpoint - Logical endpoint name for logging context.
 * @param userId - ID of the user associated with the successful operation.
 * @param duration - Duration in milliseconds for the operation.
 * @param details - Optional details string for the log.
 * @source
 */
export function logSuccess(
  endpoint: string,
  userId: number,
  duration: number,
  details?: string,
  request?: Request,
): void {
  logPrivacySafe(
    "log",
    endpoint,
    details ?? "Successfully processed request",
    {
      userId,
      durationMs: duration,
    },
    request,
  );
}

/**
 * Validates the payload for the store-users endpoint including userId,
 * optional username, and stats object shape.
 * @param data - The request data to validate.
 * @param endpoint - Logical endpoint name for logging/analytics.
 * @returns A NextResponse with an ApiError when invalid, or null otherwise.
 * @source
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const STORE_USER_REQUEST_KEYS = new Set([
  "userId",
  "username",
  "stats",
  "ifMatchUpdatedAt",
]);

function hasOnlyAllowedKeys(
  value: Record<string, unknown>,
  allowedKeys: Set<string>,
): boolean {
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function invalidStoreUserData(
  endpoint: string,
  request: Request | undefined,
  reason: string,
  context?: Record<string, unknown>,
): { success: false; error: NextResponse<ApiError> } {
  logPrivacySafe("warn", endpoint, reason, context);
  return {
    success: false,
    error: apiErrorResponse(request, 400, "Invalid data", {
      category: "invalid_data",
      retryable: false,
    }),
  };
}

export type ValidateUserDataResult =
  | {
      success: true;
      data: {
        userId: number;
        username?: string;
        stats: Record<string, unknown>;
        ifMatchUpdatedAt?: string;
      };
    }
  | { success: false; error: NextResponse<ApiError> };

export function validateUserData(
  data: Record<string, unknown>,
  endpoint: string,
  request?: Request,
): ValidateUserDataResult {
  if (!hasOnlyAllowedKeys(data, STORE_USER_REQUEST_KEYS)) {
    return invalidStoreUserData(
      endpoint,
      request,
      "Request contains unsupported top-level fields",
      {
        providedKeys: Object.keys(data)
          .sort((left, right) => left.localeCompare(right))
          .join(","),
      },
    );
  }

  if (data.userId === undefined || data.userId === null) {
    return invalidStoreUserData(endpoint, request, "Missing userId");
  }

  const userId = Number(data.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    return invalidStoreUserData(endpoint, request, "Invalid userId format", {
      userId: data.userId,
    });
  }

  let username: string | undefined;
  if (data.username !== undefined && data.username !== null) {
    if (!isValidUsername(data.username)) {
      return invalidStoreUserData(endpoint, request, "Username invalid", {
        username: data.username,
      });
    }

    username = String(data.username).trim();
  }

  if (!isPlainObject(data.stats)) {
    return invalidStoreUserData(
      endpoint,
      request,
      "Stats must be a non-array object",
      {
        statsType: Array.isArray(data.stats) ? "array" : typeof data.stats,
      },
    );
  }

  return {
    success: true,
    data: {
      userId,
      ...(username ? { username } : {}),
      stats: data.stats,
      ...(typeof data.ifMatchUpdatedAt === "string" &&
      data.ifMatchUpdatedAt.length > 0
        ? { ifMatchUpdatedAt: data.ifMatchUpdatedAt }
        : {}),
    },
  };
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
        console.warn(
          `⚠️ [${endpoint}] Card ${cardIndex} missing or invalid field: ${field}`,
        );
        return apiErrorResponse(request, 400, "Invalid data", {
          category: "invalid_data",
          retryable: false,
        });
      }
      const value = cardObj[field];
      if (value.length === 0 || value.length > 100) {
        console.warn(
          `⚠️ [${endpoint}] Card ${cardIndex} field ${field} exceeds length limits`,
        );
        return apiErrorResponse(request, 400, "Invalid data", {
          category: "invalid_data",
          retryable: false,
        });
      }
    }
    return null;
  }

  /** Validate required color fields, allowing hex string or gradient defs.
   *
   * When the incoming card object contains none of the color fields, treat it as
   * a partial patch (colors may be provided by the existing stored record). In
   * that case, skip the strict "all colors present" check here and allow the
   * merge step to fill missing values; a final merged-state validation will
   * enforce presence before persisting.
   */
  function validateRequiredColorFields(
    cardObj: Record<string, unknown>,
    fields: string[],
  ): NextResponse<ApiError> | null {
    const anyColorPresent = fields.some(
      (f) => cardObj[f] !== undefined && cardObj[f] !== null,
    );
    if (!anyColorPresent) return null;

    for (const field of fields) {
      const value = cardObj[field];
      if (value === undefined || value === null) {
        console.warn(
          `⚠️ [${endpoint}] Card ${cardIndex} missing required color field: ${field}`,
        );
        return apiErrorResponse(request, 400, "Invalid data", {
          category: "invalid_data",
          retryable: false,
        });
      }
      if (!validateColorValue(value)) {
        const reason = getColorInvalidReason(value);
        const reasonSuffix = reason ? ` (${reason})` : "";
        console.warn(
          `⚠️ [${endpoint}] Card ${cardIndex} invalid color or gradient format for ${field}${reasonSuffix}`,
        );
        return apiErrorResponse(request, 400, "Invalid data", {
          category: "invalid_data",
          retryable: false,
        });
      }
    }
    return null;
  }

  const isDisabled = card["disabled"] === true;
  const fieldsToValidate = isDisabled ? ["cardName"] : requiredStringFields;
  const reqStrErr = validateRequiredStringFields(card, fieldsToValidate);
  if (reqStrErr) return reqStrErr;

  const cardNameRaw = card["cardName"];
  if (typeof cardNameRaw !== "string" || !isValidCardType(cardNameRaw)) {
    console.warn(
      `⚠️ [${endpoint}] Card ${cardIndex} has an invalid cardName: ${safeStringifyValue(
        cardNameRaw,
      )}`,
    );
    return apiErrorResponse(request, 400, "Invalid data: Invalid card type", {
      category: "invalid_data",
      retryable: false,
    });
  }

  if (!isDisabled) {
    const rawPreset = card["colorPreset"];
    const preset =
      typeof rawPreset === "string" && rawPreset.trim().length > 0
        ? rawPreset
        : undefined;
    const requireColorFields = preset === undefined || preset === "custom";
    if (requireColorFields) {
      const reqColorErr = validateRequiredColorFields(
        card,
        requiredColorFields,
      );
      if (reqColorErr) return reqColorErr;
    }
  }

  return null;
}

/**
 * Helper: validate optional boolean fields existed and are booleans.
 */
function validateOptionalBooleanFields(
  card: Record<string, unknown>,
  cardIndex: number,
  endpoint: string,
  request?: Request,
): NextResponse<ApiError> | null {
  const optionalBooleanFields = [
    "disabled",
    "showFavorites",
    "useStatusColors",
    "showPiePercentages",
  ];

  for (const field of optionalBooleanFields) {
    const value = card[field];
    if (value !== undefined && typeof value !== "boolean") {
      console.warn(
        `⚠️ [${endpoint}] Card ${cardIndex} field ${field} must be boolean`,
      );
      return apiErrorResponse(request, 400, "Invalid data", {
        category: "invalid_data",
        retryable: false,
      });
    }
  }
  return null;
}

/**
 * Helper: validate optional border color field when present.
 */
function validateOptionalBorderColorField(
  card: Record<string, unknown>,
  cardIndex: number,
  endpoint: string,
  request?: Request,
): NextResponse<ApiError> | null {
  const borderColorValue = card.borderColor;
  const hasBorder = borderColorValue !== undefined && borderColorValue !== null;
  if (hasBorder) {
    if (
      typeof borderColorValue !== "string" ||
      !validateColorValue(borderColorValue)
    ) {
      const reason = getColorInvalidReason(borderColorValue);
      const reasonSuffix = reason ? ` (${reason})` : "";
      console.warn(
        `⚠️ [${endpoint}] Card ${cardIndex} invalid borderColor format${reasonSuffix}`,
      );
      return apiErrorResponse(request, 400, "Invalid data", {
        category: "invalid_data",
        retryable: false,
      });
    }
  }
  return null;
}

/**
 * Helper: validate a grid numeric field (cols/rows) ensuring integer between 1 and 5.
 */
function validateGridNumericField(
  value: unknown,
  cardIndex: number,
  fieldName: string,
  endpoint: string,
  request?: Request,
): NextResponse<ApiError> | null {
  if (value !== undefined) {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 5) {
      console.warn(
        `⚠️ [${endpoint}] Card ${cardIndex} ${fieldName} must be an integer between 1 and 5`,
      );
      return apiErrorResponse(request, 400, "Invalid data", {
        category: "invalid_data",
        retryable: false,
      });
    }
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
  const optBoolErr = validateOptionalBooleanFields(
    card,
    cardIndex,
    endpoint,
    request,
  );
  if (optBoolErr) return optBoolErr;

  const borderColorValue = card.borderColor;
  const hasBorder = borderColorValue !== undefined && borderColorValue !== null;
  const borderColorErr = validateOptionalBorderColorField(
    card,
    cardIndex,
    endpoint,
    request,
  );
  if (borderColorErr) return borderColorErr;

  const borderRadiusValue = card.borderRadius;
  const borderRadiusError = validateBorderRadiusField(
    borderRadiusValue,
    cardIndex,
    endpoint,
    { requireValue: hasBorder },
    request,
  );
  if (borderRadiusError) return borderRadiusError;

  const gridColsError = validateGridNumericField(
    card.gridCols,
    cardIndex,
    "gridCols",
    endpoint,
    request,
  );
  if (gridColsError) return gridColsError;

  const gridRowsError = validateGridNumericField(
    card.gridRows,
    cardIndex,
    "gridRows",
    endpoint,
    request,
  );
  if (gridRowsError) return gridRowsError;

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
      console.warn(
        `⚠️ [${endpoint}] Card ${cardIndex} borderRadius required when border is enabled`,
      );
      return apiErrorResponse(request, 400, "Invalid data", {
        category: "invalid_data",
        retryable: false,
      });
    }
    return null;
  }
  if (typeof borderRadiusValue !== "number") {
    console.warn(
      `⚠️ [${endpoint}] Card ${cardIndex} borderRadius must be a number`,
    );
    return apiErrorResponse(request, 400, "Invalid data", {
      category: "invalid_data",
      retryable: false,
    });
  }
  if (!validateBorderRadius(borderRadiusValue)) {
    console.warn(
      `⚠️ [${endpoint}] Card ${cardIndex} borderRadius out of range: ${borderRadiusValue}`,
    );
    return apiErrorResponse(request, 400, "Invalid data", {
      category: "invalid_data",
      retryable: false,
    });
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
    console.warn(`⚠️ [${endpoint}] Missing userId`);
    return apiErrorResponse(request, 400, "Invalid data", {
      category: "invalid_data",
      retryable: false,
    });
  }

  const userIdNum = Number(userId);
  if (!Number.isInteger(userIdNum) || userIdNum <= 0) {
    console.warn(
      `⚠️ [${endpoint}] Invalid userId format: ${safeStringifyValue(userId)}`,
    );
    return apiErrorResponse(request, 400, "Invalid data", {
      category: "invalid_data",
      retryable: false,
    });
  }

  return null;
}

/**
 * Utility to safely stringify unknown values for logs.
 * Uses JSON.stringify for objects when possible and falls back to String().
 */
function safeStringifyValue(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Coerce to a plain string: prefer original string when possible. */
function coerceToString(value: unknown): string {
  return typeof value === "string" ? value : safeStringifyValue(value);
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
    console.warn(`⚠️ [${endpoint}] Cards must be an array`);
    return apiErrorResponse(request, 400, "Invalid data", {
      category: "invalid_data",
      retryable: false,
    });
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

  if (unknownNames.size > 0) {
    console.warn(
      `⚠️ [${endpoint}] Invalid card types provided: ${[...unknownNames].join(", ")}`,
    );

    const suggestions = buildLevenshteinSuggestions(unknownNames, [
      ...supportedNames,
    ]);

    return NextResponse.json(
      createApiErrorPayload("Invalid data: Invalid card type", 400, {
        category: "invalid_data",
        retryable: false,
        additionalFields: {
          invalidCardNames: [...unknownNames],
          suggestions,
        },
      }),
      { status: 400, headers: apiJsonHeaders(request) },
    );
  }

  if (uniqueSupportedNames.size > MAX_ALLOWED_CARDS) {
    console.warn(
      `⚠️ [${endpoint}] Too many unique card types provided: ${uniqueSupportedNames.size} (max ${MAX_ALLOWED_CARDS})`,
    );
    return apiErrorResponse(
      request,
      400,
      `Too many cards provided: ${uniqueSupportedNames.size} (max ${MAX_ALLOWED_CARDS})`,
      {
        category: "invalid_data",
        retryable: false,
      },
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
      console.warn(`⚠️ [${endpoint}] Card ${i} is not a valid object`);
      return apiErrorResponse(request, 400, "Invalid data", {
        category: "invalid_data",
        retryable: false,
      });
    }

    const cardRecord = card as Record<string, unknown>;

    const requiredFieldsError = validateCardRequiredFields(
      cardRecord,
      i,
      endpoint,
      request,
    );
    if (requiredFieldsError) return requiredFieldsError;

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
 * On success this returns a discriminated result with typed cards so callers
 * can safely use normalized `StoredCardConfig` objects. On failure it returns
 * an API error response wrapped in the failure branch of the result.
 * @param cards - Payload expected to be an array of card objects.
 * @param userId - User identifier associated with the cards.
 * @param endpoint - Logical endpoint name for logging/analytics.
 * @returns A discriminated union: success with typed cards or failure with an API error response.
 * @source
 */
export type ValidateCardDataResult =
  | { success: true; cards: StoredCardConfig[] }
  | { success: false; error: NextResponse<ApiError> };

export function validateCardData(
  cards: unknown,
  userId: unknown,
  endpoint: string,
  request?: Request,
): ValidateCardDataResult {
  const userIdError = validateUserIdField(userId, endpoint, request);
  if (userIdError) return { success: false, error: userIdError };

  const cardsArrayError = validateCardsArrayField(cards, endpoint, request);
  if (cardsArrayError) return { success: false, error: cardsArrayError };

  const cardsArr = cards as unknown[];

  const uniqueErr = validateUniqueCardTypes(cardsArr, endpoint, request);
  if (uniqueErr) return { success: false, error: uniqueErr };

  const itemsErr = validateCardsItems(cardsArr, endpoint, request);
  if (itemsErr) return { success: false, error: itemsErr };

  const typedCards: StoredCardConfig[] = cardsArr.map((card) => {
    const r = card as Record<string, unknown>;

    const coerceNum = (v: unknown): number | undefined => {
      if (v === undefined || v === null) return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };

    return {
      cardName: coerceToString(r.cardName),
      variation:
        typeof r.variation === "string" && r.variation.length > 0
          ? r.variation
          : undefined,
      colorPreset:
        typeof r.colorPreset === "string" && r.colorPreset.length > 0
          ? r.colorPreset
          : undefined,
      titleColor: r.titleColor as StoredCardConfig["titleColor"],
      backgroundColor: r.backgroundColor as StoredCardConfig["backgroundColor"],
      textColor: r.textColor as StoredCardConfig["textColor"],
      circleColor: r.circleColor as StoredCardConfig["circleColor"],
      borderColor:
        r.borderColor !== undefined && r.borderColor !== null
          ? (r.borderColor as StoredCardConfig["borderColor"])
          : undefined,
      borderRadius: coerceNum(r.borderRadius),
      showFavorites:
        typeof r.showFavorites === "boolean" ? r.showFavorites : undefined,
      useStatusColors:
        typeof r.useStatusColors === "boolean" ? r.useStatusColors : undefined,
      showPiePercentages:
        typeof r.showPiePercentages === "boolean"
          ? r.showPiePercentages
          : undefined,
      gridCols: coerceNum(r.gridCols),
      gridRows: coerceNum(r.gridRows),
      useCustomSettings:
        typeof r.useCustomSettings === "boolean"
          ? r.useCustomSettings
          : undefined,
      disabled: typeof r.disabled === "boolean" ? r.disabled : undefined,
    } as StoredCardConfig;
  });

  return { success: true, cards: typedCards };
}

/**
 * The result returned from initializing an API request, including timing
 * context and any early error response encountered during initialization.
 * @source
 */
export interface ApiInitResult {
  startTime: number;
  ip: string;
  endpoint: string;
  endpointKey: string;
  requestId: string;
  errorResponse?: NextResponse<ApiError>;
}

/**
 * Performs common API request initialization checks (rate limit, same-origin)
 * and returns contextual information needed by handlers.
 * @param request - The incoming Request object.
 * @param endpointName - Friendly endpoint name used for logs.
 * @param endpointKey - Stable canonical endpoint key used for analytics metric keys.
 * @returns ApiInitResult with startTime, ip, endpoint and any early errorResponse.
 * @source
 */
export async function initializeApiRequest(
  request: Request,
  endpointName: string,
  endpointKey: string,
  limiter?: Ratelimit,
  options?: {
    requireOrigin?: boolean;
    skipRateLimit?: boolean;
    skipSameOrigin?: boolean;
    requestId?: string;
  },
): Promise<ApiInitResult> {
  const startTime = Date.now();
  const ip = getRequestIp(request);
  const endpoint = endpointName;
  const requestContext = ensureRequestContext(request, {
    endpoint,
    endpointKey,
    ip,
    requestId: options?.requestId,
  });

  logRequest(endpoint, ip, request);

  if (!options?.skipRateLimit) {
    const rateLimitResponse = await checkRateLimit(
      request,
      ip,
      endpoint,
      endpointKey,
      limiter,
    );
    if (rateLimitResponse) {
      return {
        startTime,
        ip,
        endpoint,
        endpointKey,
        requestId: requestContext.requestId,
        errorResponse: rateLimitResponse,
      };
    }
  }

  if (!options?.skipSameOrigin) {
    const sameOriginResponse = validateSameOrigin(
      request,
      endpoint,
      endpointKey,
      {
        requireOrigin: options?.requireOrigin ?? true,
      },
    );
    if (sameOriginResponse) {
      return {
        startTime,
        ip,
        endpoint,
        endpointKey,
        requestId: requestContext.requestId,
        errorResponse: sameOriginResponse,
      };
    }
  }

  return {
    startTime,
    ip,
    endpoint,
    endpointKey,
    requestId: requestContext.requestId,
  };
}
