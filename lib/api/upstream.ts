// lib/api/upstream.ts
//
// Shared transport layer for external requests that need timeouts, retries, and a
// circuit breaker. Route handlers use it to keep flaky upstream services from
// cascading into retry storms across server instances.
//
// Circuit state is backed by Redis when available, but falls back to in-memory
// storage so an observability dependency never becomes a hard availability dependency.

import { createHash, timingSafeEqual } from "node:crypto";

import { redisClient } from "@/lib/api/clients";
import { readBooleanEnv, readPositiveIntegerEnv } from "@/lib/api/config";
import { apiErrorResponse } from "@/lib/api/errors";
import { logPrivacySafe } from "@/lib/api/logging";
import {
  categorizeError,
  isRetryableErrorCategory,
  isRetryableStatusCode,
} from "@/lib/error-messages";
import { getSecureRandomFraction } from "@/lib/utils";

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

const DEFAULT_UPSTREAM_TIMEOUT_MS = 5_000;
const DEFAULT_UPSTREAM_MAX_ATTEMPTS = 3;
const DEFAULT_UPSTREAM_BACKOFF_BASE_MS = 250;
const DEFAULT_UPSTREAM_MAX_BACKOFF_MS = 5_000;
const DEFAULT_CIRCUIT_BREAKER_FAILURE_THRESHOLD = 5;
const DEFAULT_CIRCUIT_BREAKER_COOLDOWN_MS = 30_000;
const UPSTREAM_CIRCUIT_KEY_PREFIX = "upstream:circuit";
const upstreamCircuitStates = new Map<string, UpstreamCircuitState>();

/**
 * Error shape for upstream failures that callers can translate into HTTP responses.
 *
 * `publicMessage` is safe to surface to clients while the richer underlying error
 * stays in privacy-safe server logs.
 */
export class UpstreamTransportError extends Error {
  readonly statusCode: number;
  readonly retryAfterMs?: number;
  publicMessage: string;

  constructor(message: string, statusCode: number, retryAfterMs?: number) {
    super(message);
    this.name = "UpstreamTransportError";
    this.statusCode = statusCode;
    this.retryAfterMs = retryAfterMs;
    this.publicMessage = message;
  }
}

/**
 * Thrown when the shared circuit breaker refuses a request before the fetch starts.
 *
 * Callers can honor `retryAfterMs` to avoid retrying while the upstream is still cooling down.
 */
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
    const baseMessage = options.degradedMode
      ? `${options.service} degraded mode is enabled`
      : `${options.service} circuit breaker is open`;
    const message = baseMessage.includes("Retry-After")
      ? baseMessage
      : `${baseMessage} (Retry-After: ${retryAfterSeconds})`;

    super(message, 503, options.retryAfterMs);
    this.name = "UpstreamCircuitOpenError";
    this.service = options.service;
    this.degradedMode = options.degradedMode ?? false;
  }
}

function getRetryAfterMs(retryAfterHeader: string | null): number | undefined {
  if (!retryAfterHeader) {
    return undefined;
  }

  const asSeconds = Number(retryAfterHeader);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return asSeconds * 1000;
  }

  const retryAt = Date.parse(retryAfterHeader);
  if (Number.isNaN(retryAt)) {
    return undefined;
  }

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
  return error instanceof Error
    ? error.name === "AbortError" || error.name === "TimeoutError"
    : false;
}

function getAbortSignal(signal?: AbortSignal | null): AbortSignal | undefined {
  return signal ?? undefined;
}

function sleep(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (delayMs <= 0) {
    return Promise.resolve();
  }

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
  if (existing) {
    return existing;
  }

  const initialState: UpstreamCircuitState = {
    consecutiveFailures: 0,
    openedUntil: 0,
  };
  upstreamCircuitStates.set(key, initialState);
  return initialState;
}

function getCircuitBreakerFailureCountStorageKey(key: string): string {
  return `${UPSTREAM_CIRCUIT_KEY_PREFIX}:${key}:consecutive-failures`;
}

function getCircuitBreakerOpenedUntilStorageKey(key: string): string {
  return `${UPSTREAM_CIRCUIT_KEY_PREFIX}:${key}:opened-until`;
}

function parseStoredCircuitNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.trunc(value) : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

async function withCircuitBreakerBackplaneFallback<T>(options: {
  action: string;
  circuitKey: string;
  fallback: () => T | Promise<T>;
  operation: () => Promise<T>;
  service: string;
}): Promise<T> {
  try {
    return await options.operation();
  } catch (error) {
    logPrivacySafe(
      "warn",
      "Upstream Circuit Breaker",
      "Redis-backed circuit breaker state is unavailable; falling back to in-memory state.",
      {
        action: options.action,
        circuitKey: options.circuitKey,
        error: error instanceof Error ? error.message : String(error),
        service: options.service,
      },
    );

    return options.fallback();
  }
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
  if (!envVar) {
    return false;
  }

  return readBooleanEnv(envVar) === true;
}

function recordLocalCircuitBreakerSuccess(
  options?: UpstreamCircuitBreakerOptions | false,
): void {
  if (!options) {
    return;
  }

  const state = getCircuitBreakerState(options.key);
  state.consecutiveFailures = 0;
  state.openedUntil = 0;
}

function recordLocalCircuitBreakerFailure(
  options?: UpstreamCircuitBreakerOptions | false,
): UpstreamCircuitState {
  if (!options) {
    return {
      consecutiveFailures: 0,
      openedUntil: 0,
    };
  }

  const state = getCircuitBreakerState(options.key);
  state.consecutiveFailures += 1;

  const threshold = getCircuitBreakerFailureThreshold(options);
  if (state.consecutiveFailures >= threshold) {
    state.openedUntil = Date.now() + getCircuitBreakerCooldownMs(options);
  } else {
    state.openedUntil = 0;
  }

  return {
    consecutiveFailures: state.consecutiveFailures,
    openedUntil: state.openedUntil,
  };
}

async function ensureCircuitBreakerAllowsRequest(
  service: string,
  options?: UpstreamCircuitBreakerOptions | false,
): Promise<void> {
  if (!options) {
    return;
  }

  const cooldownMs = getCircuitBreakerCooldownMs(options);
  if (isCircuitBreakerDegradedModeEnabled(options)) {
    throw new UpstreamCircuitOpenError({
      service,
      retryAfterMs: cooldownMs,
      degradedMode: true,
    });
  }

  const now = Date.now();
  const openedUntil = await withCircuitBreakerBackplaneFallback({
    action: "ensure-open-check",
    circuitKey: options.key,
    fallback: () => {
      const state = getCircuitBreakerState(options.key);
      return state.openedUntil > now ? state.openedUntil : 0;
    },
    operation: async () => {
      const storedValue = await redisClient.get(
        getCircuitBreakerOpenedUntilStorageKey(options.key),
      );
      const parsedOpenedUntil = parseStoredCircuitNumber(storedValue);
      return parsedOpenedUntil && parsedOpenedUntil > now
        ? parsedOpenedUntil
        : 0;
    },
    service,
  });

  const state = getCircuitBreakerState(options.key);
  state.openedUntil = openedUntil;

  if (openedUntil > now) {
    throw new UpstreamCircuitOpenError({
      service,
      retryAfterMs: openedUntil - now,
    });
  }
}

async function recordCircuitBreakerSuccess(
  service: string,
  options?: UpstreamCircuitBreakerOptions | false,
): Promise<void> {
  if (!options) {
    return;
  }

  recordLocalCircuitBreakerSuccess(options);

  await withCircuitBreakerBackplaneFallback({
    action: "record-success",
    circuitKey: options.key,
    fallback: () => undefined,
    operation: async () => {
      await redisClient.del(
        getCircuitBreakerFailureCountStorageKey(options.key),
        getCircuitBreakerOpenedUntilStorageKey(options.key),
      );
    },
    service,
  });
}

async function recordCircuitBreakerFailure(
  service: string,
  options?: UpstreamCircuitBreakerOptions | false,
): Promise<void> {
  if (!options) {
    return;
  }

  const localState = recordLocalCircuitBreakerFailure(options);
  const threshold = getCircuitBreakerFailureThreshold(options);
  const cooldownMs = getCircuitBreakerCooldownMs(options);
  const nextState = await withCircuitBreakerBackplaneFallback({
    action: "record-failure",
    circuitKey: options.key,
    fallback: () => localState,
    operation: async () => {
      const incrementResult = await redisClient.incr(
        getCircuitBreakerFailureCountStorageKey(options.key),
      );
      const consecutiveFailures =
        parseStoredCircuitNumber(incrementResult) ??
        localState.consecutiveFailures;
      const openedUntil =
        consecutiveFailures >= threshold ? Date.now() + cooldownMs : 0;

      if (openedUntil > 0) {
        await redisClient.set(
          getCircuitBreakerOpenedUntilStorageKey(options.key),
          String(openedUntil),
          {
            ex: Math.max(1, Math.ceil(cooldownMs / 1000)),
          },
        );
      }

      return {
        consecutiveFailures,
        openedUntil,
      };
    },
    service,
  });

  const state = getCircuitBreakerState(options.key);
  state.consecutiveFailures = nextState.consecutiveFailures;
  state.openedUntil = nextState.openedUntil;
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

async function finalizeUpstreamResponse(
  response: Response,
  service: string,
  circuitBreaker?: UpstreamCircuitBreakerOptions | false,
): Promise<Response> {
  if (!response.ok && isRetryableStatusCode(response.status)) {
    await recordCircuitBreakerFailure(service, circuitBreaker);
  } else if (response.ok) {
    await recordCircuitBreakerSuccess(service, circuitBreaker);
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

async function recordUpstreamErrorFailure(
  service: string,
  error: unknown,
  didTimeout: boolean,
  circuitBreaker?: UpstreamCircuitBreakerOptions | false,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  const category = didTimeout ? "timeout" : categorizeError(message);

  if (isRetryableErrorCategory(category)) {
    await recordCircuitBreakerFailure(service, circuitBreaker);
  }
}

/**
 * Fetches an upstream resource with bounded retries, timeout enforcement, and optional circuit breaking.
 *
 * Retryable transport failures and status codes back off with jitter. When a circuit breaker
 * is configured, successful and failed attempts update shared state in Redis so one bad
 * upstream does not fan out into every instance retrying at once.
 */
export async function fetchUpstreamWithRetry(
  options: UpstreamFetchOptions,
): Promise<Response> {
  const normalizedOptions = normalizeUpstreamFetchOptions(options);

  await ensureCircuitBreakerAllowsRequest(
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
        normalizedOptions.service,
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

      await recordUpstreamErrorFailure(
        normalizedOptions.service,
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

/**
 * Verifies the cron secret for internal maintenance routes.
 *
 * Local development can opt into unsecured cron calls with `ALLOW_UNSECURED_CRON_IN_DEV`,
 * but production stays fail-closed when the shared secret is missing or wrong.
 */
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
