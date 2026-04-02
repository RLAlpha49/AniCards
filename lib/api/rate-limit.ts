import { Ratelimit } from "@upstash/ratelimit";
import type { Redis } from "@upstash/redis";
import type { NextResponse } from "next/server";

import { createRealRedisClient } from "@/lib/api/clients";
import { readBooleanEnv, readPositiveIntegerEnv } from "@/lib/api/config";
import { type ApiError, apiErrorResponse } from "@/lib/api/errors";
import { logPrivacySafe } from "@/lib/api/logging";
import {
  buildAnalyticsMetricKey,
  incrementAnalytics,
  scheduleTelemetryTask,
} from "@/lib/api/telemetry";

export interface RateLimitIdentity {
  ip: string;
  source?: string;
  verified?: boolean;
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

export async function checkRateLimit(
  request: Request | undefined,
  identity: string | RateLimitIdentity,
  endpointName: string,
  endpointKey: string,
  limiter?: Ratelimit,
  options?: {
    requireVerifiedIp?: boolean;
  },
): Promise<NextResponse<ApiError> | null> {
  const effectiveLimiter = limiter ?? ratelimit;
  const normalizedIdentity: RateLimitIdentity =
    typeof identity === "string" ? { ip: identity } : identity;
  const ip = normalizedIdentity.ip;

  if (options?.requireVerifiedIp && !normalizedIdentity.verified) {
    logPrivacySafe(
      "error",
      endpointName,
      "Rejected request because rate limiting requires a verified client IP.",
      {
        ip,
        source: normalizedIdentity.source ?? "unverified",
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
