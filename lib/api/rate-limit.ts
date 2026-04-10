import { Ratelimit } from "@upstash/ratelimit";
import type { Redis } from "@upstash/redis";
import type { NextResponse } from "next/server";

import { createRealRedisClient } from "@/lib/api/clients";
import { readBooleanEnv, readPositiveIntegerEnv } from "@/lib/api/config";
import { type ApiError, apiErrorResponse } from "@/lib/api/errors";
import { logPrivacySafe } from "@/lib/api/logging";
import {
  resolveVerifiedClientIp,
  type VerifiedClientIpResult,
} from "@/lib/api/request-proof";
import {
  buildAnalyticsMetricKey,
  incrementAnalytics,
  isUnitTestRuntime,
  scheduleTelemetryTask,
} from "@/lib/api/telemetry";

export interface RateLimitIdentity {
  ip: string;
  reason?: string;
  source?: string;
  verified?: boolean;
}

export function createRateLimitIdentity(
  clientIp: VerifiedClientIpResult,
): RateLimitIdentity {
  return clientIp.verified
    ? {
        ip: clientIp.ip,
        source: clientIp.source,
        verified: true,
      }
    : {
        ip: "unknown",
        reason: clientIp.reason,
        verified: false,
      };
}

export function getRateLimitIdentity(request?: Request): RateLimitIdentity {
  return createRateLimitIdentity(resolveVerifiedClientIp(request));
}

type RateLimiterRuntimeState =
  | {
      mode: "active";
    }
  | {
      mode: "blocked" | "bypass";
      reason: "missing_or_invalid_upstash_config";
    };

const RATE_LIMITER_RUNTIME_STATE = Symbol.for(
  "anicards.rate-limiter-runtime-state",
);

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
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

function isRateLimiterRuntimeState(
  value: unknown,
): value is RateLimiterRuntimeState {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<RateLimiterRuntimeState>;
  return (
    candidate.mode === "active" ||
    candidate.mode === "blocked" ||
    candidate.mode === "bypass"
  );
}

function withRateLimiterRuntimeState(
  limiter: Ratelimit,
  state: RateLimiterRuntimeState,
): Ratelimit {
  Object.defineProperty(limiter, RATE_LIMITER_RUNTIME_STATE, {
    value: state,
    enumerable: false,
    configurable: false,
    writable: false,
  });

  return limiter;
}

function getRateLimiterRuntimeState(
  limiter: Ratelimit,
): RateLimiterRuntimeState | undefined {
  const candidate = (limiter as unknown as Record<string | symbol, unknown>)[
    RATE_LIMITER_RUNTIME_STATE
  ];

  return isRateLimiterRuntimeState(candidate) ? candidate : undefined;
}

function hasUsableUpstashRedisConfig(): boolean {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) {
    return false;
  }

  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

function createDisabledRateLimiter(
  limit: number,
  state: Extract<RateLimiterRuntimeState, { mode: "blocked" | "bypass" }>,
): Ratelimit {
  return withRateLimiterRuntimeState(
    {
      limit: async () => ({
        pending: undefined,
        success: true,
        limit,
        remaining: limit,
        reset: Date.now() + 1000,
      }),
    } as unknown as Ratelimit,
    state,
  );
}

function createConfiguredRateLimiter(options?: {
  limit?: number;
  window?: Parameters<typeof Ratelimit.slidingWindow>[1];
  redis?: Redis;
  analytics?: boolean;
  hotPath?: boolean;
  enableProtection?: boolean;
  prefix?: string;
  timeout?: number;
}): Ratelimit {
  const limit = options?.limit ?? 10;
  const window =
    options?.window ?? ("5 s" as Parameters<typeof Ratelimit.slidingWindow>[1]);
  const isUnitTestEnv = isUnitTestRuntime();

  if (!options?.redis && !hasUsableUpstashRedisConfig() && !isUnitTestEnv) {
    return createDisabledRateLimiter(limit, {
      mode: isProduction() ? "blocked" : "bypass",
      reason: "missing_or_invalid_upstash_config",
    });
  }

  const redis = options?.redis ?? createRealRedisClient();
  const analytics = (() => {
    if (typeof options?.analytics === "boolean") {
      return options.analytics;
    }

    if (options?.hotPath) {
      return false;
    }

    return shouldEnableRateLimitAnalytics();
  })();
  const enableProtection =
    options?.enableProtection ?? shouldEnableRateLimitProtection();
  const prefix = options?.prefix ?? getRateLimitPrefix();
  const timeout = options?.timeout ?? getRateLimitTimeoutMs();

  return withRateLimiterRuntimeState(
    new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, window),
      analytics,
      enableProtection,
      ...(prefix ? { prefix } : {}),
      ...(typeof timeout === "number" ? { timeout } : {}),
    }),
    { mode: "active" },
  );
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
  if (!isPromiseLike(pending)) {
    return;
  }

  try {
    await pending;
  } catch (error) {
    console.warn(
      `[${endpointName}] Upstash Ratelimit background sync failed:`,
      error,
    );
  }
}

let realRatelimit: Ratelimit | undefined;

/**
 * A lazily-initialized Upstash rate limiter proxy.
 */
export const ratelimit: Ratelimit = new Proxy({} as Record<string, unknown>, {
  get(_: unknown, prop: string | symbol) {
    realRatelimit ??= createConfiguredRateLimiter();
    const value: unknown = (
      realRatelimit as unknown as Record<string, unknown>
    )[prop as keyof typeof realRatelimit];

    if (typeof value === "function") {
      return (...args: unknown[]) =>
        (value as (...callArgs: unknown[]) => unknown).apply(
          realRatelimit,
          args,
        );
    }

    return value;
  },
  set(_: unknown, prop: string | symbol, value: unknown) {
    realRatelimit ??= createConfiguredRateLimiter();
    (realRatelimit as unknown as Record<string, unknown>)[
      prop as keyof typeof realRatelimit
    ] = value;
    return true;
  },
}) as unknown as Ratelimit;

export function createRateLimiter(options?: {
  limit?: number;
  window?: Parameters<typeof Ratelimit.slidingWindow>[1];
  redis?: Redis;
  analytics?: boolean;
  hotPath?: boolean;
  enableProtection?: boolean;
  prefix?: string;
  timeout?: number;
}): Ratelimit {
  return createConfiguredRateLimiter(options);
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

function createRateLimitUnavailableResponse(
  request: Request | undefined,
  endpointName: string,
  endpointKey: string,
  ip: string,
  options: {
    context?: Record<string, unknown>;
    logMessage: string;
    metricSuffix: "rate_limit_errors" | "rate_limit_timeouts";
  },
): NextResponse<ApiError> {
  logPrivacySafe(
    "error",
    endpointName,
    options.logMessage,
    {
      ip,
      ...options.context,
    },
    request,
  );

  const failureMetric = buildAnalyticsMetricKey(endpointKey, "failed_requests");
  scheduleTelemetryTask(() => incrementAnalytics(failureMetric), {
    endpoint: endpointName,
    taskName: failureMetric,
    request,
  });

  const availabilityMetric = buildAnalyticsMetricKey(
    endpointKey,
    options.metricSuffix,
  );
  scheduleTelemetryTask(() => incrementAnalytics(availabilityMetric), {
    endpoint: endpointName,
    taskName: availabilityMetric,
    request,
  });

  return apiErrorResponse(
    request,
    503,
    "Rate limiting is temporarily unavailable",
    {
      headers: { "Retry-After": "1" },
      category: "server_error",
      retryable: true,
    },
  );
}

export async function checkRateLimit(
  request: Request | undefined,
  identity: RateLimitIdentity,
  endpointName: string,
  endpointKey: string,
  limiter?: Ratelimit,
  options?: {
    requireVerifiedIp?: boolean;
  },
): Promise<NextResponse<ApiError> | null> {
  const effectiveLimiter = limiter ?? ratelimit;
  const ip = identity.ip;
  const shouldRejectUnverifiedIp =
    identity.verified === false &&
    (options?.requireVerifiedIp === true || isProduction());

  if (shouldRejectUnverifiedIp) {
    logPrivacySafe(
      "error",
      endpointName,
      options?.requireVerifiedIp
        ? "Rejected request because rate limiting requires a verified client IP."
        : "Rejected request because production rate limiting could not verify the client IP.",
      {
        ip,
        reason: identity.reason,
        source: identity.source ?? "unverified",
      },
      request,
    );

    const metric = buildAnalyticsMetricKey(endpointKey, "failed_requests");
    scheduleTelemetryTask(() => incrementAnalytics(metric), {
      endpoint: endpointName,
      taskName: metric,
      request,
    });

    return apiErrorResponse(request, 503, "Client IP could not be verified", {
      category: "server_error",
      retryable: true,
    });
  }

  const limiterRuntimeState = getRateLimiterRuntimeState(effectiveLimiter);
  if (isProduction() && limiterRuntimeState?.mode === "blocked") {
    return createRateLimitUnavailableResponse(
      request,
      endpointName,
      endpointKey,
      ip,
      {
        context: {
          reason: limiterRuntimeState.reason,
        },
        logMessage:
          "Rejected request because production rate limiting is not configured correctly.",
        metricSuffix: "rate_limit_errors",
      },
    );
  }

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
    if (isProduction()) {
      return createRateLimitUnavailableResponse(
        request,
        endpointName,
        endpointKey,
        ip,
        {
          context: {
            error: error instanceof Error ? error.message : String(error),
          },
          logMessage:
            "Rejected request because the rate-limit provider failed in production.",
          metricSuffix: "rate_limit_errors",
        },
      );
    }

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
    if (isProduction()) {
      return createRateLimitUnavailableResponse(
        request,
        endpointName,
        endpointKey,
        ip,
        {
          logMessage:
            "Rejected request because the rate-limit provider timed out in production.",
          metricSuffix: "rate_limit_timeouts",
        },
      );
    }

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

  if (!result.success) {
    logPrivacySafe(
      "warn",
      endpointName,
      "Rate limited request",
      {
        ip,
        denialDetails,
      },
      request,
    );

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
